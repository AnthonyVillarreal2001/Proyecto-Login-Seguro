const UserModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const blacklist = require('../blacklist');
const bcrypt = require('bcrypt');
const { encryptFaceEmbedding, decryptFaceEmbedding } = require('../utils/encryption');

const userController = {
  async register(req, res) {
    const { name, email, password, role } = req.body;
    try {
      const existingUser = await UserModel.findUserByEmail(email);
      if (existingUser) return res.status(409).json({ error: 'Email ya registrado' });
      const user = await UserModel.createUser(name.trim(), email.trim(), password, role);
      res.status(201).json({ message: 'Usuario registrado', user });
    } catch (err) {
      console.error('Error en registro:', err);
      res.status(500).json({ error: 'Error al registrar' });
    }
  },
  async publicRegister(req, res) {
    const { name, email, password, embedding } = req.body;
    
    try {
      // Validaciones básicas
      if (!embedding || !Array.isArray(embedding)) {
        return res.status(400).json({ 
          error: 'Registro facial obligatorio. Capture su rostro para completar el registro.' 
        });
      }

      // Validar dimensiones del embedding
      if (embedding.length !== 128 && embedding.length !== 512) {
        return res.status(400).json({ 
          error: 'Embedding facial inválido. Debe tener 128 o 512 dimensiones.' 
        });
      }

      const existingUser = await UserModel.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email ya registrado' });
      }

      // ✅ VERIFICACIÓN ESTRICTA DE DUPLICADOS
      const allUsers = await UserModel.getAllUsers();
      let duplicateFound = false;
      let duplicateEmail = '';
      const DUPLICATE_THRESHOLD = 0.5; // Bloquea similitud > 50%

      for (const user of allUsers) {
        if (user.preferences?.faceEmbedding) {
          try {
            const existingEmbedding = decryptFaceEmbedding(user.preferences.faceEmbedding);
            if (existingEmbedding && Array.isArray(existingEmbedding)) {
              // Solo comparar si tienen las mismas dimensiones
              if (existingEmbedding.length === embedding.length) {
                const distance = euclideanDistance(existingEmbedding, embedding);
                if (distance < DUPLICATE_THRESHOLD) {
                  duplicateFound = true;
                  duplicateEmail = user.email;
                  break;
                }
              }
            }
          } catch (err) {
            console.error(`Error verificando usuario ${user.email}:`, err);
          }
        }
      }

      if (duplicateFound) {
        return res.status(409).json({
          error: 'Rostro ya registrado',
          message: `Este rostro ya está registrado en la cuenta: ${duplicateEmail}. 
                  Por seguridad, cada persona debe tener una cuenta única.`,
          code: 'FACE_DUPLICATE'
        });
      }

      // Crear usuario si no hay duplicados
      const user = await UserModel.createUser(name.trim(), email.trim(), password, 'client');
      
      // Analizar calidad del embedding antes de guardar
      const embeddingStats = analyzeEmbedding(embedding);
      if (!embeddingStats.isValid) {
        // Eliminar usuario creado si el embedding es inválido
        await UserModel.deleteUser(user.id);
        return res.status(400).json({
          error: 'Captura facial de baja calidad',
          message: 'La imagen facial no es clara. Por favor, intenta nuevamente con mejor iluminación.'
        });
      }
      
      // Encriptar y guardar embedding
      const encryptedEmbedding = encryptFaceEmbedding(embedding);
      const preferences = { 
        ...user.preferences, 
        faceEmbedding: encryptedEmbedding,
        faceRegisteredAt: new Date().toISOString(),
        embeddingQuality: embeddingStats
      };
      
      await UserModel.updateUser(user.id, { preferences });

      res.status(201).json({ 
        message: '✅ Registro exitoso con biometría facial verificada como única.',
        success: true,
        uniqueFace: true
      });
      
    } catch (err) {
      console.error('Error en registro público biométrico:', err);
      res.status(500).json({ 
        error: 'Error al registrar usuario',
        details: err.message 
      });
    }
  },
  async login(req, res) {
    const { email, password } = req.body;
    
    try {
      if (!email) return res.status(400).json({ error: 'Email requerido' });
      
      const user = await UserModel.findUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      // Verificar contraseña
      if (!password) return res.status(400).json({ error: 'Contraseña requerida' });
      
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Contraseña inválida' });

      // Verificar si tiene biometría registrada
      const savedEncryptedEmbedding = user.preferences?.faceEmbedding;
      if (!savedEncryptedEmbedding) {
        return res.status(403).json({ 
          error: 'Biometría facial no registrada. Por favor, registre su rostro primero.',
          requiresBiometric: true 
        });
      }

      // Si tiene biometría, devolver información para el próximo paso
      res.json({ 
        message: 'Contraseña válida. Proceda con la verificación facial.',
        requiresFaceVerification: true,
        email: user.email 
      });
    } catch (err) {
      console.error('Error en login:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  },
  async biometricLogin(req, res) {
    const { email, embedding } = req.body;
    
    try {
      if (!email) return res.status(400).json({ error: 'Email requerido' });
      if (!embedding || !Array.isArray(embedding)) {
        return res.status(400).json({ error: 'Embedding facial requerido' });
      }

      const user = await UserModel.findUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      const savedEncryptedEmbedding = user.preferences?.faceEmbedding;
      if (!savedEncryptedEmbedding) {
        return res.status(401).json({ error: 'No hay biometría registrada' });
      }

      // Desencriptar el embedding guardado
      const savedEmbedding = decryptFaceEmbedding(savedEncryptedEmbedding);
      if (!savedEmbedding) {
        return res.status(500).json({ error: 'Error al verificar biometría' });
      }

      // ✅ VERIFICAR DUPLICADOS ANTES DE PERMITIR LOGIN
      const allUsers = await UserModel.getAllUsers();
      let duplicateFound = false;
      let duplicateCount = 0;
      
      for (const otherUser of allUsers) {
        if (otherUser.id === user.id) continue;
        
        if (otherUser.preferences?.faceEmbedding) {
          try {
            const otherEncrypted = otherUser.preferences.faceEmbedding;
            const otherEmbedding = decryptFaceEmbedding(otherEncrypted);
            
            if (otherEmbedding && Array.isArray(otherEmbedding)) {
              const distance = euclideanDistance(otherEmbedding, embedding);
              if (distance < 0.5) {
                duplicateFound = true;
                duplicateCount++;
              }
            }
          } catch (err) {
            console.error(`Error comparando con usuario ${otherUser.email}:`, err);
          }
        }
      }
      
      // Si se encuentra el mismo rostro en otras cuentas
      if (duplicateFound) {
        return res.status(403).json({ 
          error: 'Rostro detectado en múltiples cuentas',
          message: `Este rostro está registrado en ${duplicateCount + 1} cuentas. 
                  Contacta al administrador para resolver este problema.`
        });
      }

      // Verificar si el rostro coincide con el usuario actual
      const distance = euclideanDistance(savedEmbedding, embedding);

      if (distance < 0.6) {
        const token = jwt.sign(
          { id: user.id, role: user.role, email: user.email }, 
          'secret_key', 
          { expiresIn: '5m' }
        );
        return res.json({ 
          token, 
          message: 'Login biométrico exitoso',
          user: { id: user.id, name: user.name, email: user.email }
        });
      }
      
      return res.status(401).json({ error: 'Rostro no reconocido' });
      
    } catch (err) {
      console.error('Error en login biométrico:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  },
  async logout(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) blacklist.add(token);
      res.json({ message: 'Sesión cerrada' });
    } catch (err) {
      res.status(500).json({ error: 'Error al cerrar sesión' });
    }
  },
  async searchUsers(req, res) {
    const { query } = req.query;
    const users = await UserModel.searchUsers(query);
    res.json(users);
  },
  async getAllUsers(req, res) {
    const users = await UserModel.getAllUsers();
    res.json(users);
  },
  async editUser(req, res) {
    const { id } = req.params;
    const updates = req.body;
    if (updates.password) updates.password_hash = await bcrypt.hash(updates.password, 10);
    const updated = await UserModel.updateUser(id, updates);
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(updated);
  },
  async deleteUser(req, res) {
    const { id } = req.params;
    const deleted = await UserModel.deleteUser(id);
    if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  },
  async deleteBiometric(req, res) {
    const { id } = req.params;
    const user = await UserModel.findUserById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const preferences = { ...user.preferences, faceEmbedding: null };
    const updated = await UserModel.updateUser(id, { preferences });
    res.json({ message: 'Biometría eliminada', updated });
  },
  async getProfile(req, res) {
    const user = await UserModel.findUserByEmail(req.user.email);

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    // Preparar respuesta segura
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      registration_date: user.registration_date,
      preferences: {
        theme: user.preferences?.theme || 'light',
        notifications: user.preferences?.notifications !== false,
        // Incluir metadata de biometría pero NO el embedding encriptado
        ...(user.preferences?.faceRegisteredAt && { 
          faceRegisteredAt: user.preferences.faceRegisteredAt 
        }),
        hasBiometric: !!user.preferences?.faceEmbedding
      }
    };
    
    res.json(safeUser);
  },
  async updatePreferences(req, res) {
    const { id } = req.user;
    const { preferences } = req.body;
    
    try {
      // 1. Obtener usuario actual
      const user = await UserModel.findUserById(id);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      
      // 2. Fusionar preferencias manteniendo faceEmbedding
      const currentPrefs = user.preferences || {};
      const updatedPrefs = {
        ...currentPrefs,          // Mantener faceEmbedding existente
        theme: preferences.theme || currentPrefs.theme,
        notifications: preferences.notifications !== undefined 
          ? preferences.notifications 
          : currentPrefs.notifications,
        // Mantener cualquier otro campo existente
        ...(currentPrefs.faceEmbedding && { faceEmbedding: currentPrefs.faceEmbedding }),
        ...(currentPrefs.faceRegisteredAt && { faceRegisteredAt: currentPrefs.faceRegisteredAt })
      };
      
      // 3. Actualizar en base de datos
      const updated = await UserModel.updateUser(id, { preferences: updatedPrefs });
      res.json(updated);
    } catch (err) {
      console.error('Error actualizando preferencias:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  },
  async saveFaceEmbedding(req, res) {
    const { embedding, password } = req.body;
    
    try {
      // 1. Validaciones básicas del embedding
      if (!embedding || !Array.isArray(embedding)) {
        return res.status(400).json({ 
          error: 'Embedding facial inválido o vacío' 
        });
      }
      
      if (embedding.length !== 128 && embedding.length !== 512) {
        return res.status(400).json({ 
          error: `Embedding debe tener 128 o 512 dimensiones. Recibido: ${embedding.length}` 
        });
      }

      // 2. Verificar usuario y contraseña
      const user = await UserModel.findUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Contraseña inválida' });

      // 3. ✅ VERIFICACIÓN ESTRICTA DE DUPLICADOS CON LÓGICA MEJORADA
      const allUsers = await UserModel.getAllUsers();
      let duplicateFound = false;
      let duplicateDetails = null;
      const SIMILARITY_THRESHOLD = 0.5; // Bloquea similitud >50%

      for (const otherUser of allUsers) {
        if (otherUser.id === user.id) continue;
        
        if (otherUser.preferences?.faceEmbedding) {
          try {
            const otherEmbedding = decryptFaceEmbedding(otherUser.preferences.faceEmbedding);
            
            if (otherEmbedding && Array.isArray(otherEmbedding)) {
              // Validar dimensiones
              if (otherEmbedding.length !== embedding.length) {
                console.warn(`Usuario ${otherUser.email} tiene embedding con dimensiones diferentes: ${otherEmbedding.length} vs ${embedding.length}`);
                continue;
              }
              
              const distance = euclideanDistance(otherEmbedding, embedding);
              const similarity = 1 - distance;
              
              if (distance < SIMILARITY_THRESHOLD) {
                duplicateFound = true;
                duplicateDetails = {
                  email: otherUser.email,
                  name: otherUser.name,
                  distance: distance.toFixed(4),
                  similarity: similarity.toFixed(4),
                  isIdentical: distance < 0.1 // Rostros casi idénticos
                };
                break;
              }
            }
          } catch (err) {
            console.error(`Error verificando embedding de ${otherUser.email}:`, err);
            continue;
          }
        }
      }

      // 4. Si es duplicado, rechazar con información detallada
      if (duplicateFound) {
        return res.status(409).json({
          error: 'Rostro ya registrado en otra cuenta',
          message: `Este rostro es ${duplicateDetails.similarity * 100}% similar al de ${duplicateDetails.name} (${duplicateDetails.email}).`,
          details: duplicateDetails,
          action: 'Por seguridad, cada rostro debe ser único. Si eres esta persona, inicia sesión en esa cuenta.'
        });
      }

      // 5. Verificar calidad del embedding (valores atípicos)
      const embeddingStats = analyzeEmbedding(embedding);
      if (!embeddingStats.isValid) {
        return res.status(400).json({
          error: 'Embedding de baja calidad',
          message: 'La captura facial no es lo suficientemente clara. Intenta nuevamente con mejor iluminación.',
          stats: embeddingStats
        });
      }

      // 6. Encriptar y guardar (solo si pasa todas las validaciones)
      const encryptedEmbedding = encryptFaceEmbedding(embedding);
      const preferences = { 
        ...user.preferences, 
        faceEmbedding: encryptedEmbedding,
        faceRegisteredAt: new Date().toISOString(),
        embeddingVersion: 'v1.0'
      };
      
      await UserModel.updateUser(user.id, { preferences });

      res.json({ 
        success: true, 
        message: '✅ Biometría facial registrada exitosamente. Este rostro es único en el sistema.',
        stats: embeddingStats,
        unique: true
      });
      
    } catch (err) {
      console.error('Error guardando biometría:', err);
      res.status(500).json({ 
        error: 'Error técnico al guardar biometría',
        details: err.message 
      });
    }
  },
  async removeFaceEmbedding(req, res) {
    const { password } = req.body;
    try {
      const user = await UserModel.findUserById(req.user.id);
      if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Contraseña inválida' });
      const preferences = { ...user.preferences, faceEmbedding: null };
      await UserModel.updateUser(user.id, { preferences });
      res.json({ success: true, message: 'Biometría eliminada' });
    } catch (err) {
      console.error('Error eliminando biometría:', err);
      res.status(500).json({ error: 'Error eliminando biometría' });
    }
  },
  async updateProfile(req, res) {
    try {
      const { name, email, password, currentPassword } = req.body;
      const user = await UserModel.findUserById(req.user.id);

      if (!await bcrypt.compare(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }

      const updates = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (password) updates.password_hash = await bcrypt.hash(password, 10);

      await UserModel.updateUser(req.user.id, updates);
      res.json({ message: 'Perfil actualizado' });
    } catch (err) {
      console.error('Error en updateProfile:', err);
      res.status(500).json({ error: 'Error interno al actualizar perfil' });
    }
  },
  // Agrega esta función en userController.js
  async renewToken(req, res) {
    try {
      const user = await UserModel.findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      // Crear nuevo token con 5 minutos más
      const newToken = jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        'secret_key',
        { expiresIn: '5m' }
      );
      
      res.json({ token: newToken, message: 'Token renovado' });
    } catch (err) {
      console.error('Error renovando token:', err);
      res.status(500).json({ error: 'Error renovando sesión' });
    }
  },
  async verifyFaceAfterPassword(req, res) {
    const { email, embedding } = req.body;
    
    try {
      console.log('[verify-face] Email recibido:', JSON.stringify(email), '| Embedding length:', embedding?.length);
      const user = await UserModel.findUserByEmail(email);
      console.log('[verify-face] Usuario encontrado:', user ? user.email : 'NO');
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      const savedEncryptedEmbedding = user.preferences?.faceEmbedding;
      if (!savedEncryptedEmbedding) {
        return res.status(401).json({ error: 'No hay biometría registrada' });
      }

      // Desencriptar el embedding guardado
      const savedEmbedding = decryptFaceEmbedding(savedEncryptedEmbedding);
      if (!savedEmbedding) {
        return res.status(500).json({ error: 'Error al verificar biometría' });
      }
      
      const distance = euclideanDistance(savedEmbedding, embedding);
      console.log('[verify-face] Distancia facial:', distance);
      if (distance < 0.6) {
        const token = jwt.sign(
          { id: user.id, role: user.role, email: user.email }, 
          'secret_key', 
          { expiresIn: '5m' }
        );
        return res.json({ 
          token, 
          message: 'Login biométrico exitoso',
          user: { id: user.id, name: user.name, role: user.role }
        });
      }
      return res.status(401).json({ error: 'Rostro no reconocido' });
    } catch (err) {
      console.error('Error en verificación facial:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  },
  async checkDuplicateFaces(req, res) {
    try {
      const allUsers = await UserModel.getAllUsers();
      const usersWithFaces = allUsers.filter(u => u.preferences?.faceEmbedding);
      
      const embeddings = [];
      const duplicates = [];
      
      for (const user of usersWithFaces) {
        try {
          const embedding = decryptFaceEmbedding(user.preferences.faceEmbedding);
          if (embedding) {
            embeddings.push({
              userId: user.id,
              email: user.email,
              name: user.name,
              embedding: embedding
            });
          }
        } catch (err) {
          console.error(`Error decriptando embedding de ${user.email}:`, err);
        }
      }
      
      // Comparar todos contra todos
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const distance = euclideanDistance(embeddings[i].embedding, embeddings[j].embedding);
          if (distance < 0.5) {
            duplicates.push({
              user1: { id: embeddings[i].userId, email: embeddings[i].email },
              user2: { id: embeddings[j].userId, email: embeddings[j].email },
              similarity: (1 - distance).toFixed(3)
            });
          }
        }
      }
      
      res.json({
        totalUsers: allUsers.length,
        usersWithBiometric: usersWithFaces.length,
        duplicatesFound: duplicates.length,
        duplicates: duplicates
      });
    } catch (err) {
      console.error('Error verificando duplicados:', err);
      res.status(500).json({ error: 'Error verificando duplicados' });
    }
  },
  async checkMyFaceUnique(req, res) {
    try {
      const user = await UserModel.findUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      
      const hasBiometric = !!user.preferences?.faceEmbedding;
      
      if (!hasBiometric) {
        return res.json({
          hasBiometric: false,
          isUnique: true,
          duplicateCount: 0,
          registeredAt: null,
          message: 'No tienes biometría registrada'
        });
      }
      
      // Verificar duplicados
      const allUsers = await UserModel.getAllUsers();
      let duplicateFound = false;
      let duplicateCount = 0;
      
      for (const otherUser of allUsers) {
        if (otherUser.id === user.id) continue;
        
        if (otherUser.preferences?.faceEmbedding) {
          try {
            const myEmbedding = decryptFaceEmbedding(user.preferences.faceEmbedding);
            const otherEmbedding = decryptFaceEmbedding(otherUser.preferences.faceEmbedding);
            
            if (myEmbedding && otherEmbedding && 
                Array.isArray(myEmbedding) && Array.isArray(otherEmbedding) &&
                myEmbedding.length === otherEmbedding.length) {
              
              const distance = euclideanDistance(myEmbedding, otherEmbedding);
              if (distance < 0.5) {
                duplicateFound = true;
                duplicateCount++;
              }
            }
          } catch (err) {
            console.error(`Error comparando con ${otherUser.email}:`, err);
          }
        }
      }
      
      res.json({
        hasBiometric: true,
        isUnique: !duplicateFound,
        duplicateCount: duplicateCount,
        registeredAt: user.preferences?.faceRegisteredAt,
        message: duplicateFound 
          ? `Tu rostro está registrado en ${duplicateCount} cuenta(s) adicional(es)`
          : 'Tu rostro es único en el sistema'
      });
      
    } catch (err) {
      console.error('Error verificando unicidad facial:', err);
      res.status(500).json({ error: 'Error verificando unicidad facial' });
    }
  },
  async getFaceDuplicates(req, res) {
    try {
      const allUsers = await UserModel.getAllUsers();
      const usersWithFaces = allUsers.filter(u => u.preferences?.faceEmbedding);
      
      const embeddings = [];
      
      // Recopilar todos los embeddings
      for (const user of usersWithFaces) {
        try {
          const embedding = decryptFaceEmbedding(user.preferences.faceEmbedding);
          if (embedding && Array.isArray(embedding)) {
            embeddings.push({
              userId: user.id,
              email: user.email,
              name: user.name,
              embedding: embedding
            });
          }
        } catch (err) {
          console.error(`Error procesando usuario ${user.email}:`, err);
        }
      }
      
      // Buscar duplicados
      const duplicates = [];
      const processedPairs = new Set();
      
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const pairKey = `${embeddings[i].userId}-${embeddings[j].userId}`;
          
          if (!processedPairs.has(pairKey)) {
            const distance = euclideanDistance(
              embeddings[i].embedding, 
              embeddings[j].embedding
            );
            
            if (distance < 0.5) {
              duplicates.push({
                user1: {
                  id: embeddings[i].userId,
                  email: embeddings[i].email,
                  name: embeddings[i].name
                },
                user2: {
                  id: embeddings[j].userId,
                  email: embeddings[j].email,
                  name: embeddings[j].name
                },
                similarity: (1 - distance).toFixed(4),
                distance: distance.toFixed(4),
                isDuplicate: distance < 0.5 // Muy similares
              });
              
              processedPairs.add(pairKey);
            }
          }
        }
      }
      
      // Agrupar por clusters de rostros similares
      const clusters = [];
      const visited = new Set();
      
      for (const dup of duplicates) {
        if (!visited.has(dup.user1.id) && !visited.has(dup.user2.id)) {
          const cluster = {
            users: [dup.user1, dup.user2],
            similarity: dup.similarity
          };
          clusters.push(cluster);
          visited.add(dup.user1.id);
          visited.add(dup.user2.id);
        }
      }
      
      res.json({
        totalUsers: allUsers.length,
        usersWithBiometric: usersWithFaces.length,
        totalDuplicates: duplicates.length,
        clusters: clusters.length,
        duplicates: duplicates,
        clusters: clusters,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      console.error('Error obteniendo duplicados faciales:', err);
      res.status(500).json({ 
        error: 'Error obteniendo duplicados faciales',
        message: err.message 
      });
    }
  }
};

// Reemplazar la función euclideanDistance existente con esta versión mejorada
function euclideanDistance(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    throw new Error('Ambos parámetros deben ser arrays');
  }
  
  if (arr1.length !== arr2.length) {
    throw new Error(`Los arrays deben tener la misma longitud. Recibido: ${arr1.length} vs ${arr2.length}`);
  }
  
  if (arr1.length === 0 && arr2.length === 0) {
    return 0;
  }
  
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    // Validar que sean números
    if (typeof arr1[i] !== 'number' || typeof arr2[i] !== 'number') {
      throw new Error(`Elemento en índice ${i} no es un número`);
    }
    sum += Math.pow(arr1[i] - arr2[i], 2);
  }
  
  return Math.sqrt(sum);
}

// Añadir esta función auxiliar después de euclideanDistance
function analyzeEmbedding(embedding) {
  const stats = {
    mean: 0,
    std: 0,
    min: Infinity,
    max: -Infinity,
    zeros: 0,
    isValid: true
  };
  
  if (!Array.isArray(embedding) || embedding.length === 0) {
    stats.isValid = false;
    return stats;
  }
  
  // Calcular media
  const sum = embedding.reduce((a, b) => a + b, 0);
  stats.mean = sum / embedding.length;
  
  // Calcular desviación estándar y otros estadísticos
  let sqDiffSum = 0;
  for (const val of embedding) {
    sqDiffSum += Math.pow(val - stats.mean, 2);
    stats.min = Math.min(stats.min, val);
    stats.max = Math.max(stats.max, val);
    if (Math.abs(val) < 0.0001) stats.zeros++;
  }
  
  stats.std = Math.sqrt(sqDiffSum / embedding.length);
  
  // Validaciones de calidad
  const tooManyZeros = stats.zeros > embedding.length * 0.1; // Más del 10% ceros
  const tooLowStd = stats.std < 0.01; // Poca variación
  const extremeValues = stats.max > 100 || stats.min < -100; // Valores extremos
  
  stats.isValid = !(tooManyZeros || tooLowStd || extremeValues);
  
  return stats;
}

// Adjuntar al objeto para que sea accesible en tests
userController.euclideanDistance = euclideanDistance;

module.exports = userController;