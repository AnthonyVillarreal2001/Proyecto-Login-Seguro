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
    const { name, email, password, embedding } = req.body; // Agregar embedding
    
    try {
      const existingUser = await UserModel.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email ya registrado' });
      }

      // Validar que venga el embedding
      if (!embedding || !Array.isArray(embedding)) {
        return res.status(400).json({ 
          error: 'Registro facial obligatorio. Capture su rostro para completar el registro.' 
        });
      }

      // Crear usuario
      const user = await UserModel.createUser(name.trim(), email.trim(), password, 'client');
      
      // Encriptar y guardar embedding
      const encryptedEmbedding = encryptFaceEmbedding(embedding);
      const preferences = { 
        ...(user.preferences || { theme: 'light', notifications: true }),
        faceEmbedding: encryptedEmbedding
      };
      
      await UserModel.updateUser(user.id, { preferences });
      
      res.status(201).json({ 
        message: 'Registro exitoso con biometría facial. Ahora puede iniciar sesión.',
        success: true 
      });
    } catch (err) {
      console.error('Error en registro público biométrico:', err);
      res.status(500).json({ error: 'Error al registrar usuario' });
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
      const user = await UserModel.findUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

      const savedEncryptedEmbedding = user.preferences?.faceEmbedding;
      if (!savedEncryptedEmbedding) {
        return res.status(401).json({ error: 'No hay biometría registrada' });
      }

      //const savedEmbedding = user.preferences?.faceEmbedding; // ← Sin desencriptar
      // DESENCRIPTAR el embedding guardado
      const savedEmbedding = decryptFaceEmbedding(savedEncryptedEmbedding);
      if (!savedEmbedding) {
        return res.status(500).json({ error: 'Error al verificar biometría' });
      }
      const distance = euclideanDistance(savedEmbedding, embedding);
      if (distance < 0.6) {
        const token = jwt.sign(
          { id: user.id, role: user.role, email: user.email }, 
          'secret_key', 
          { expiresIn: '5m' }
        );
        return res.json({ token, message: 'Login biométrico exitoso' });
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
    
    // No devolver el embedding encriptado por seguridad
    if (user && user.preferences) {
      const safePreferences = { ...user.preferences };
      delete safePreferences.faceEmbedding; // Eliminar del response
      user.preferences = safePreferences;
    }
    
    res.json(user);
  },
  async updatePreferences(req, res) {
    const { id } = req.user;
    const { preferences } = req.body;
    const updated = await UserModel.updateUser(id, { preferences });
    res.json(updated);
  },
  async saveFaceEmbedding(req, res) {
  const { embedding, password } = req.body;
  try {
    const user = await UserModel.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Contraseña inválida' });

    // ENCRIPTAR el embedding antes de guardar
    const encryptedEmbedding = encryptFaceEmbedding(embedding);
    
    const preferences = { 
      ...user.preferences, 
      faceEmbedding: encryptedEmbedding
      //faceEmbedding: embedding
    };
    await UserModel.updateUser(user.id, { preferences });

    res.json({ success: true, message: 'Biometría registrada y encriptada' });
  } catch (err) {
    console.error('Error guardando biometría:', err);
    res.status(500).json({ error: 'Error guardando biometría' });
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
          user: { id: user.id, name: user.name, role: user.role }
        });
      }
      return res.status(401).json({ error: 'Rostro no reconocido' });
    } catch (err) {
      console.error('Error en verificación facial:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  },
};

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
  
  return Math.sqrt(arr1.reduce((sum, val, i) => sum + Math.pow(val - arr2[i], 2), 0));
}

// Adjuntar al objeto para que sea accesible en tests
userController.euclideanDistance = euclideanDistance;

module.exports = userController;