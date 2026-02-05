// tests/userController.test.js
const userController = require('../controllers/userController');
const UserModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const blacklist = require('../blacklist');

// Mock de los módulos
jest.mock('../models/userModel');
jest.mock('jsonwebtoken');
jest.mock('bcrypt');
jest.mock('../blacklist');
jest.mock('../utils/encryption', () => ({
  encryptFaceEmbedding: jest.fn(),
  decryptFaceEmbedding: jest.fn(),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  testEncryption: jest.fn(),
  ensureKeyLength: jest.fn()
}));

const { encryptFaceEmbedding, decryptFaceEmbedding } = require('../utils/encryption');

describe('userController - Cobertura completa', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 1, email: 'test@test.com' },
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('register', () => {
    test('éxito', async () => {
      req.body = { name: 'Test User', email: 'test@test.com', password: 'password123', role: 'admin' };
      UserModel.findUserByEmail.mockResolvedValue(null);
      UserModel.createUser.mockResolvedValue({ id: 1, ...req.body });

      await userController.register(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('test@test.com');
      expect(UserModel.createUser).toHaveBeenCalledWith('Test User', 'test@test.com', 'password123', 'admin');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'Usuario registrado', user: { id: 1, ...req.body } });
    });

    test('email duplicado', async () => {
      req.body = { name: 'Test', email: 'duplicate@test.com', password: 'pass' };
      UserModel.findUserByEmail.mockResolvedValue({ id: 1, email: 'duplicate@test.com' });

      await userController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email ya registrado' });
    });

    test('catch - error en DB (líneas 34-51)', async () => {
      req.body = { name: 'Test', email: 'test@test.com', password: 'pass' };
      UserModel.findUserByEmail.mockRejectedValue(new Error('DB error'));

      await userController.register(req, res);

      expect(console.error).toHaveBeenCalledWith('Error en registro:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al registrar' });
    });
  });

  describe('publicRegister', () => {
    test('éxito con embedding', async () => {
      req.body = {
        name: 'New User',
        email: 'newuser@test.com',
        password: 'password123',
        embedding: Array(128).fill(0.1) // ✅ NUEVO: Array de 128 elementos
      };
      
      UserModel.findUserByEmail.mockResolvedValue(null);
      UserModel.getAllUsers.mockResolvedValue([]);
      UserModel.createUser.mockResolvedValue({ 
        id: 1, 
        preferences: { theme: 'light', notifications: true } 
      });
      UserModel.updateUser.mockResolvedValue({ id: 1 });
      
      // Mock analyzeEmbedding para que devuelva isValid: true
      jest.mock('../controllers/userController', () => {
        const original = jest.requireActual('../controllers/userController');
        return {
          ...original,
          analyzeEmbedding: jest.fn().mockReturnValue({ isValid: true })
        };
      });

      await userController.publicRegister(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('newuser@test.com');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining('Registro exitoso'),
        success: true,
        uniqueFace: true
      });
    });

    test('email duplicado', async () => {
      req.body = { 
        name: 'Test', 
        email: 'duplicate@test.com', 
        password: 'pass',
        embedding: [0.1, 0.2, 0.3]
      };
      UserModel.findUserByEmail.mockResolvedValue({ id: 1, email: 'duplicate@test.com' });

      await userController.publicRegister(req, res);

      expect(res.status).toHaveBeenCalledWith(409); // Ahora sí es 409
      expect(res.json).toHaveBeenCalledWith({ error: 'Email ya registrado' });
    });

    test('sin embedding', async () => {
      req.body = { name: 'Test', email: 'test@test.com', password: 'pass' };
      UserModel.findUserByEmail.mockResolvedValue(null);

      await userController.publicRegister(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Registro facial obligatorio. Capture su rostro para completar el registro.'
      });
    });

    test('catch - error en DB (líneas 40-51)', async () => {
      req.body = {
        name: 'Test',
        email: 'test@test.com',
        password: 'pass',
        embedding: [0.1, 0.2, 0.3]
      };
      UserModel.findUserByEmail.mockRejectedValue(new Error('DB error'));

      await userController.publicRegister(req, res);

      expect(console.error).toHaveBeenCalledWith(
        'Error en registro público biométrico:',
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al registrar usuario' });
    });
  });

  describe('login', () => {
    test('éxito con contraseña válida y biometría registrada', async () => {
      req.body = { email: 'test@test.com', password: 'password123' };
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        password_hash: 'hashed_password',
        preferences: { faceEmbedding: 'encrypted_embedding' }
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      await userController.login(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('test@test.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Contraseña válida. Proceda con la verificación facial.',
        requiresFaceVerification: true,
        email: 'test@test.com'
      });
    });

    test('sin email', async () => {
      req.body = { password: 'pass' };

      await userController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email requerido' });
    });

    test('usuario no encontrado', async () => {
      req.body = { email: 'notfound@test.com', password: 'pass' };
      UserModel.findUserByEmail.mockResolvedValue(null);

      await userController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('sin contraseña', async () => {
      req.body = { email: 'test@test.com' };
      const mockUser = { id: 1, email: 'test@test.com', password_hash: 'hash' };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);

      await userController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña requerida' });
    });

    test('contraseña inválida', async () => {
      req.body = { email: 'test@test.com', password: 'wrongpass' };
      const mockUser = { id: 1, email: 'test@test.com', password_hash: 'hash' };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await userController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña inválida' });
    });

    test('sin biometría registrada', async () => {
      req.body = { email: 'test@test.com', password: 'password123' };
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        password_hash: 'hashed_password',
        preferences: {}
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      await userController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Biometría facial no registrada. Por favor, registre su rostro primero.',
        requiresBiometric: true
      });
    });

    test('catch - error en DB', async () => {
      req.body = { email: 'test@test.com', password: 'pass' };
      UserModel.findUserByEmail.mockRejectedValue(new Error('DB error'));

      await userController.login(req, res);

      expect(console.error).toHaveBeenCalledWith('Error en login:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno' });
    });
  });

  describe('verifyFaceAfterPassword', () => {
    test('éxito con rostro válido', async () => {
      req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        role: 'client',
        preferences: { faceEmbedding: 'encrypted_embedding' }
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.3]);
      jwt.sign.mockReturnValue('test_token');

      await userController.verifyFaceAfterPassword(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('test@test.com');
      expect(decryptFaceEmbedding).toHaveBeenCalledWith('encrypted_embedding');
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, role: 'client', email: 'test@test.com' },
        'secret_key',
        { expiresIn: '5m' }
      );
      expect(res.json).toHaveBeenCalledWith({
        token: 'test_token',
        message: 'Login biométrico exitoso',
        user: { id: 1, name: undefined, role: 'client' }
      });
    });

    test('usuario no encontrado', async () => {
      req.body = { email: 'notfound@test.com', embedding: [0.1] };
      UserModel.findUserByEmail.mockResolvedValue(null);

      await userController.verifyFaceAfterPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('sin biometría registrada', async () => {
      req.body = { email: 'test@test.com', embedding: [0.1] };
      const mockUser = { id: 1, preferences: {} };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);

      await userController.verifyFaceAfterPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No hay biometría registrada' });
    });

    test('error en desencriptación', async () => {
      req.body = { email: 'test@test.com', embedding: [0.1] };
      const mockUser = { id: 1, preferences: { faceEmbedding: 'encrypted' } };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      decryptFaceEmbedding.mockReturnValue(null);

      await userController.verifyFaceAfterPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al verificar biometría' });
    });

    test('rostro no reconocido', async () => {
      req.body = { email: 'test@test.com', embedding: [1.0, 1.0, 1.0] };
      const mockUser = { id: 1, preferences: { faceEmbedding: 'encrypted' } };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.3]);

      await userController.verifyFaceAfterPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Rostro no reconocido' });
    });
  });

  describe('biometricLogin', () => {
    test('catch - error general', async () => {
      req.body = { email: 'test@test.com', embedding: [] };
      UserModel.findUserByEmail.mockRejectedValue(new Error('Error'));

      await userController.biometricLogin(req, res);

      expect(console.error).toHaveBeenCalledWith('Error en login biométrico:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno' });
    });

    // Añade estas pruebas adicionales para cubrir todas las líneas
    test('usuario no encontrado', async () => {
      req.body = { email: 'notfound@test.com', embedding: [0.1, 0.2, 0.3] };
      UserModel.findUserByEmail.mockResolvedValue(null);

      await userController.biometricLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('sin biometría registrada', async () => {
      req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
      const mockUser = {
        id: 1,
        preferences: {} // Sin faceEmbedding
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);

      await userController.biometricLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No hay biometría registrada' });
    });

    test('error en decryptFaceEmbedding', async () => {
      req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
      const mockUser = {
        id: 1,
        preferences: { faceEmbedding: 'encrypted' }
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      decryptFaceEmbedding.mockReturnValue(null); // Error específico

      await userController.biometricLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al verificar biometría' });
    });
  });

  describe('updateProfile', () => {
    test('éxito con todos los campos', async () => {
      req.body = {
        name: 'Updated Name',
        email: 'updated@test.com',
        password: 'newpassword',
        currentPassword: 'current'
      };
      const mockUser = { id: 1, password_hash: 'hashed_current' };
      UserModel.findUserById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashed_new');
      UserModel.updateUser.mockResolvedValue({ id: 1, name: 'Updated Name' });

      await userController.updateProfile(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('current', 'hashed_current');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(UserModel.updateUser).toHaveBeenCalledWith(1, {
        name: 'Updated Name',
        email: 'updated@test.com',
        password_hash: 'hashed_new'
      });
      expect(res.json).toHaveBeenCalledWith({ message: 'Perfil actualizado' });
    });

    test('contraseña actual incorrecta', async () => {
      req.body = { name: 'Updated', currentPassword: 'wrong' };
      const mockUser = { id: 1, password_hash: 'hashed' };
      UserModel.findUserById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await userController.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña actual incorrecta' });
    });

    test('catch - error general', async () => {
      req.body = { name: 'Updated', currentPassword: 'current' };
      UserModel.findUserById.mockRejectedValue(new Error('DB error'));

      await userController.updateProfile(req, res);

      expect(console.error).toHaveBeenCalledWith('Error en updateProfile:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error interno al actualizar perfil' });
    });
  });

  describe('logout', () => {
    test('éxito - agrega token a blacklist', async () => {
      req.headers.authorization = 'Bearer test_token';

      await userController.logout(req, res);

      expect(blacklist.add).toHaveBeenCalledWith('test_token');
      expect(res.json).toHaveBeenCalledWith({ message: 'Sesión cerrada' });
    });

    test('sin token - también funciona', async () => {
      await userController.logout(req, res);

      expect(blacklist.add).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Sesión cerrada' });
    });
  });

  describe('searchUsers', () => {
    test('éxito - busca usuarios', async () => {
      req.query = { query: 'test' };
      const mockUsers = [{ id: 1, name: 'Test User' }];
      UserModel.searchUsers.mockResolvedValue(mockUsers);

      await userController.searchUsers(req, res);

      expect(UserModel.searchUsers).toHaveBeenCalledWith('test');
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });
  });

  describe('getAllUsers', () => {
    test('éxito - obtiene todos los usuarios', async () => {
      const mockUsers = [{ id: 1 }, { id: 2 }];
      UserModel.getAllUsers.mockResolvedValue(mockUsers);

      await userController.getAllUsers(req, res);

      expect(UserModel.getAllUsers).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });
  });

  describe('editUser', () => {
    test('éxito - edita usuario sin password', async () => {
      req.params = { id: '1' };
      req.body = { name: 'Updated Name', email: 'updated@test.com' };
      UserModel.updateUser.mockResolvedValue({ id: 1, ...req.body });

      await userController.editUser(req, res);

      expect(UserModel.updateUser).toHaveBeenCalledWith('1', {
        name: 'Updated Name',
        email: 'updated@test.com'
      });
      expect(res.json).toHaveBeenCalledWith({ id: 1, ...req.body });
    });

    test('usuario no encontrado', async () => {
      req.params = { id: '999' };
      req.body = { name: 'Test' };
      UserModel.updateUser.mockResolvedValue(null);

      await userController.editUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });
  });

  describe('deleteUser', () => {
    test('éxito - elimina usuario', async () => {
      req.params = { id: '1' };
      UserModel.deleteUser.mockResolvedValue({ id: 1 });

      await userController.deleteUser(req, res);

      expect(UserModel.deleteUser).toHaveBeenCalledWith('1');
      expect(res.json).toHaveBeenCalledWith({ message: 'Usuario eliminado' });
    });

    test('usuario no encontrado', async () => {
      req.params = { id: '999' };
      UserModel.deleteUser.mockResolvedValue(null);

      await userController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });
  });

  describe('deleteBiometric', () => {
    test('éxito - elimina biometría', async () => {
      req.params = { id: '1' };
      const mockUser = { id: 1, preferences: { faceEmbedding: 'encrypted' } };
      UserModel.findUserById.mockResolvedValue(mockUser);
      UserModel.updateUser.mockResolvedValue({ id: 1 });

      await userController.deleteBiometric(req, res);

      expect(UserModel.findUserById).toHaveBeenCalledWith('1');
      expect(UserModel.updateUser).toHaveBeenCalledWith('1', {
        preferences: { faceEmbedding: null }
      });
      expect(res.json).toHaveBeenCalledWith({
        message: 'Biometría eliminada',
        updated: { id: 1 }
      });
    });

    test('usuario no encontrado', async () => {
      req.params = { id: '999' };
      UserModel.findUserById.mockResolvedValue(null);

      await userController.deleteBiometric(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });
  });

  describe('getProfile', () => {
    test('éxito - obtiene perfil', async () => {
    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@test.com',
      role: 'client',
      registration_date: '2024-01-01',
      preferences: { 
        theme: 'light', 
        notifications: true,
        faceEmbedding: 'encrypted'
      }
    };
    UserModel.findUserByEmail.mockResolvedValue(mockUser);

    await userController.getProfile(req, res);

    expect(UserModel.findUserByEmail).toHaveBeenCalledWith('test@test.com');
    // Verifica que faceEmbedding fue eliminado y se agregó hasBiometric
    expect(res.json.mock.calls[0][0].preferences.faceEmbedding).toBeUndefined();
    expect(res.json.mock.calls[0][0].preferences.hasBiometric).toBe(true);
    });

    test('preferences es null', async () => {
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        name: 'Test User',
        role: 'client',
        registration_date: '2024-01-01',
        preferences: null
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);

      await userController.getProfile(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.preferences).toBeDefined();
      expect(response.preferences.hasBiometric).toBe(false);
      expect(response.preferences.theme).toBe('light');
      expect(response.preferences.notifications).toBe(true);
    });

    test('preferences existe pero sin faceEmbedding', async () => {
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        name: 'Test User',
        role: 'client',
        registration_date: '2024-01-01',
        preferences: { 
          theme: 'dark', 
          notifications: true 
        }
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);

      await userController.getProfile(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.preferences.hasBiometric).toBe(false);
      expect(response.preferences.theme).toBe('dark');
      expect(response.preferences.notifications).toBe(true);
    });
  });

describe('updatePreferences', () => {
  test('éxito - actualiza preferencias', async () => {
    req.body = { 
      preferences: { 
        theme: 'dark', 
        notifications: false 
      } 
    };
    
    const mockUser = {
      id: 1,
      email: 'test@test.com',
      preferences: { 
        theme: 'light', 
        notifications: true,
        faceEmbedding: 'encrypted'
      }
    };
    
    UserModel.findUserById.mockResolvedValue(mockUser);
    UserModel.updateUser.mockResolvedValue({ 
      id: 1,
      preferences: {
        theme: 'dark',
        notifications: false,
        faceEmbedding: 'encrypted'  // Se preserva
      }
    });

    await userController.updatePreferences(req, res);

    expect(UserModel.findUserById).toHaveBeenCalledWith(1);
    expect(UserModel.updateUser).toHaveBeenCalledWith(1, {
      preferences: expect.objectContaining({
        theme: 'dark',
        notifications: false,
        faceEmbedding: 'encrypted'  // Se preserva
      })
    });
    expect(res.json).toHaveBeenCalled();
  });

  test('usuario no encontrado', async () => {
    req.body = { preferences: { theme: 'dark' } };
    UserModel.findUserById.mockResolvedValue(null);

    await userController.updatePreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });
});

  describe('saveFaceEmbedding', () => {
    test('contraseña incorrecta', async () => {
      req.body = { 
        embedding: Array(128).fill(0.1), // ✅ Array de 128 elementos
        password: 'wrong' 
      };
      const mockUser = { 
        id: 1, 
        password_hash: 'hashed',
        preferences: {}
      };
      UserModel.findUserById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await userController.saveFaceEmbedding(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña inválida' });
    });

    test('usuario no encontrado', async () => {
      req.body = { 
        embedding: Array(128).fill(0.1), // ✅ Array de 128 elementos
        password: 'pass' 
      };
      UserModel.findUserById.mockResolvedValue(null);

      await userController.saveFaceEmbedding(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('error interno', async () => {
      req.body = { 
        embedding: Array(128).fill(0.1), // ✅ Array de 128 elementos
        password: 'pass' 
      };
      UserModel.findUserById.mockRejectedValue(new Error('DB error'));

      await userController.saveFaceEmbedding(req, res);

      expect(console.error).toHaveBeenCalledWith('Error guardando biometría:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error guardando biometría' });
    });
  });

  describe('removeFaceEmbedding', () => {
    test('éxito - elimina embedding facial', async () => {
      req.body = { password: 'current' };
      const mockUser = { id: 1, password_hash: 'hashed', preferences: {} };
      UserModel.findUserById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      UserModel.updateUser.mockResolvedValue({ id: 1 });

      await userController.removeFaceEmbedding(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('current', 'hashed');
      expect(UserModel.updateUser).toHaveBeenCalledWith(1, {
        preferences: { faceEmbedding: null }
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Biometría eliminada'
      });
    });

    test('contraseña incorrecta', async () => {
      req.body = { password: 'wrong' };
      const mockUser = { id: 1, password_hash: 'hashed' };
      UserModel.findUserById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await userController.removeFaceEmbedding(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña inválida' });
    });

    test('error interno', async () => {
      req.body = { password: 'pass' };
      UserModel.findUserById.mockRejectedValue(new Error('DB error'));

      await userController.removeFaceEmbedding(req, res);

      expect(console.error).toHaveBeenCalledWith('Error eliminando biometría:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error eliminando biometría' });
    });
  });

  describe('renewToken', () => {
    test('éxito', async () => {
      const mockUser = { id: 1, email: 'test@test.com', role: 'client' };
      UserModel.findUserById.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('new_token');

      await userController.renewToken(req, res);

      expect(UserModel.findUserById).toHaveBeenCalledWith(1);
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, role: 'client', email: 'test@test.com' },
        'secret_key',
        { expiresIn: '5m' }
      );
      expect(res.json).toHaveBeenCalledWith({
        token: 'new_token',
        message: 'Token renovado'
      });
    });

    test('usuario no encontrado', async () => {
      UserModel.findUserById.mockResolvedValue(null);

      await userController.renewToken(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('error interno', async () => {
      UserModel.findUserById.mockRejectedValue(new Error('DB error'));

      await userController.renewToken(req, res);

      expect(console.error).toHaveBeenCalledWith('Error renovando token:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error renovando sesión' });
    });
  });

  describe('euclideanDistance', () => {
    test('arrays idénticos', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      const result = userController.euclideanDistance(arr1, arr2);
      expect(result).toBe(0);
    });

    test('arrays diferentes', () => {
      const arr1 = [0, 0, 0];
      const arr2 = [1, 1, 1];
      const result = userController.euclideanDistance(arr1, arr2);
      expect(result).toBeCloseTo(Math.sqrt(3), 5);
    });

    test('arrays de diferente longitud', () => {
      const arr1 = [1, 2];
      const arr2 = [1, 2, 3];
      expect(() => userController.euclideanDistance(arr1, arr2)).toThrow();
    });

    test('arrays vacíos', () => {
      const arr1 = [];
      const arr2 = [];
      const result = userController.euclideanDistance(arr1, arr2);
      expect(result).toBe(0);
    });
  });

  describe('userController - Cobertura de líneas no cubiertas', () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
        params: {},
        query: {},
        user: { id: 1, email: 'test@test.com' },
        headers: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
      };
      jest.clearAllMocks();
      console.error = jest.fn();
    });

    describe('saveFaceEmbedding - Líneas no cubiertas', () => {
      test('línea 100: usuario no encontrado en saveFaceEmbedding', async () => {
        req.body = { 
          embedding: Array(128).fill(0.1), // ✅ Array de 128 elementos
          password: 'current' 
        };
        UserModel.findUserById.mockResolvedValue(null);

        await userController.saveFaceEmbedding(req, res);

        expect(UserModel.findUserById).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
      });

      test('rostro duplicado encontrado', async () => {
        req.body = { 
          embedding: Array(128).fill(0.1), // ✅ Array de 128 elementos
          password: 'current' 
        };
        const mockUser = { 
          id: 1, 
          password_hash: 'hashed',
          preferences: {} 
        };
        
        const otroUsuario = {
          id: 2,
          email: 'otro@test.com',
          name: 'Otro User',
          preferences: { faceEmbedding: 'encrypted_otro' }
        };
        
        UserModel.findUserById.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        UserModel.getAllUsers.mockResolvedValue([mockUser, otroUsuario]);
        
        // Mock decryptFaceEmbedding y analyzeEmbedding
        decryptFaceEmbedding.mockReturnValue(Array(128).fill(0.1));
        
        // Mock analyzeEmbedding para que devuelva isValid: true
        const originalController = require('../controllers/userController');
        const analyzeEmbeddingSpy = jest.spyOn(originalController, 'analyzeEmbedding')
          .mockReturnValue({ isValid: true });

        try {
          await userController.saveFaceEmbedding(req, res);

          expect(UserModel.getAllUsers).toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(409);
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.stringContaining('Rostro ya registrado')
            })
          );
        } finally {
          analyzeEmbeddingSpy.mockRestore();
        }
      });
    });

    describe('verifyFaceAfterPassword - Líneas no cubiertas', () => {
      test('línea 130: catch block - error general', async () => {
        req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
        UserModel.findUserByEmail.mockRejectedValue(new Error('Error de base de datos'));

        await userController.verifyFaceAfterPassword(req, res);

        expect(console.error).toHaveBeenCalledWith('Error en verificación facial:', expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error interno' });
      });

      test('líneas 295-296: error en distance calculation', async () => {
        req.body = { email: 'test@test.com', embedding: 'not-an-array' };
        const mockUser = {
          id: 1,
          preferences: { faceEmbedding: 'encrypted' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.3]);

        // La función euclideanDistance lanzará error cuando embedding no sea array
        // Pero verifyFaceAfterPassword tiene un try-catch que captura el error
        await userController.verifyFaceAfterPassword(req, res);

        // Debería caer en el catch block
        expect(console.error).toHaveBeenCalledWith('Error en verificación facial:', expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
      });

      test('línea 303: error en jwt.sign', async () => {
        req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          role: 'client',
          name: 'Test User',
          preferences: { faceEmbedding: 'encrypted' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.3]);
        jwt.sign.mockImplementation(() => {
          throw new Error('Error firmando token');
        });

        await userController.verifyFaceAfterPassword(req, res);

        expect(console.error).toHaveBeenCalledWith('Error en verificación facial:', expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error interno' });
      });

      test('distancia exactamente 0.6 (caso borde)', async () => {
        req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          role: 'client',
          name: 'Test User',
          preferences: { faceEmbedding: 'encrypted' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.9]); // Distancia será > 0.6
        
        // Mock euclideanDistance para devolver exactamente 0.6
        const originalDistance = userController.euclideanDistance;
        userController.euclideanDistance = jest.fn().mockReturnValue(0.6);

        try {
          await userController.verifyFaceAfterPassword(req, res);
          
          expect(res.status).toHaveBeenCalledWith(401);
          expect(res.json).toHaveBeenCalledWith({ error: 'Rostro no reconocido' });
        } finally {
          // Restaurar función original
          userController.euclideanDistance = originalDistance;
        }
      });

      test('distancia menor a 0.6 pero error en user.name', async () => {
        req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          role: 'client',
          // Sin nombre definido
          preferences: { faceEmbedding: 'encrypted' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.3]);
        jwt.sign.mockReturnValue('test_token');

        await userController.verifyFaceAfterPassword(req, res);

        expect(jwt.sign).toHaveBeenCalledWith(
          { id: 1, role: 'client', email: 'test@test.com' },
          'secret_key',
          { expiresIn: '5m' }
        );
        expect(res.json).toHaveBeenCalledWith({
          token: 'test_token',
          message: 'Login biométrico exitoso',
          user: { id: 1, name: undefined, role: 'client' }
        });
      });
    });

    describe('Edge cases adicionales', () => {
      test('biometricLogin - error en decryptFaceEmbedding específico', async () => {
        req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          role: 'client',
          preferences: { faceEmbedding: 'encrypted' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        
        // Simular error específico en decryptFaceEmbedding
        decryptFaceEmbedding.mockImplementation(() => {
          throw new Error('Error específico de desencriptación');
        });

        await userController.biometricLogin(req, res);

        expect(console.error).toHaveBeenCalledWith('Error en login biométrico:', expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error interno' });
      });

      test('logout - error en blacklist.add', async () => {
        req.headers.authorization = 'Bearer test_token';
        blacklist.add.mockImplementation(() => {
          throw new Error('Error en blacklist');
        });

        await userController.logout(req, res);

        expect(blacklist.add).toHaveBeenCalledWith('test_token');
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al cerrar sesión' });
      });

      test('updateProfile - sin campos para actualizar', async () => {
        req.body = { currentPassword: 'current' };
        const mockUser = { id: 1, password_hash: 'hashed' };
        UserModel.findUserById.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);

        await userController.updateProfile(req, res);

        expect(bcrypt.compare).toHaveBeenCalledWith('current', 'hashed');
        expect(UserModel.updateUser).toHaveBeenCalledWith(1, {});
        expect(res.json).toHaveBeenCalledWith({ message: 'Perfil actualizado' });
      });

      test('getProfile - preferences es null', async () => {
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          preferences: null
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);

        await userController.getProfile(req, res);

        expect(res.json).toHaveBeenCalledWith(mockUser);
        expect(mockUser.preferences).toBeNull(); // No debería modificar
      });

      test('getProfile - preferences existe pero sin faceEmbedding', async () => {
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          preferences: { theme: 'dark', notifications: true }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);

        await userController.getProfile(req, res);

        expect(res.json).toHaveBeenCalledWith(mockUser);
        expect(mockUser.preferences.faceEmbedding).toBeUndefined();
      });
    });

    describe('publicRegister - casos adicionales', () => {
      test('error en UserModel.updateUser después de crear usuario', async () => {
        req.body = {
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
          embedding: [0.1, 0.2, 0.3]
        };
        
        UserModel.findUserByEmail.mockResolvedValue(null);
        UserModel.createUser.mockResolvedValue({ 
          id: 1, 
          preferences: { theme: 'light' }
        });
        encryptFaceEmbedding.mockReturnValue('encrypted');
        UserModel.updateUser.mockRejectedValue(new Error('Error actualizando usuario'));

        await userController.publicRegister(req, res);

        expect(console.error).toHaveBeenCalledWith(
          'Error en registro público biométrico:',
          expect.any(Error)
        );
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error al registrar usuario' });
      });

      test('embedding es string en lugar de array', async () => {
        req.body = {
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
          embedding: 'not-an-array'
        };
        
        UserModel.findUserByEmail.mockResolvedValue(null);

        await userController.publicRegister(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Registro facial obligatorio. Capture su rostro para completar el registro.'
        });
      });
    });

    describe('login - casos adicionales', () => {
      test('user existe pero password_hash es undefined', async () => {
        req.body = { email: 'test@test.com', password: 'password123' };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          password_hash: undefined,
          preferences: { faceEmbedding: 'encrypted' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);

        await userController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña inválida' });
      });

      test('error en bcrypt.compare', async () => {
        req.body = { email: 'test@test.com', password: 'password123' };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          password_hash: 'hashed',
          preferences: { faceEmbedding: 'encrypted' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        bcrypt.compare.mockRejectedValue(new Error('Error en bcrypt'));

        await userController.login(req, res);

        expect(console.error).toHaveBeenCalledWith('Error en login:', expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('Funciones nuevas añadidas', () => {
    test('checkFaceUnique - éxito - rostro único', async () => {
      req.body = { 
        embedding: [0.1, 0.2, 0.3], 
        currentUserId: 1 
      };
      
      const mockUsers = [
        { id: 1, preferences: { faceEmbedding: 'encrypted1' } },
        { id: 2, preferences: {} }, // Sin biometría
        { id: 3, preferences: { faceEmbedding: 'encrypted3' } }
      ];
      
      UserModel.getAllUsers.mockResolvedValue(mockUsers);
      decryptFaceEmbedding.mockImplementation((encrypted) => {
        if (encrypted === 'encrypted1') return [0.4, 0.5, 0.6]; // Diferente
        if (encrypted === 'encrypted3') return [0.7, 0.8, 0.9]; // Diferente
        return null;
      });

      await userController.checkFaceUnique(req, res);

      expect(UserModel.getAllUsers).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        isDuplicate: false,
        duplicateEmail: null,
        message: 'Rostro único, puede ser registrado'
      });
    });

    test('checkFaceUnique - rostro duplicado', async () => {
      req.body = { 
        embedding: [0.1, 0.2, 0.3], 
        currentUserId: 1 
      };
      
      const mockUsers = [
        { id: 1, email: 'user1@test.com', preferences: { faceEmbedding: 'encrypted1' } },
        { id: 2, email: 'user2@test.com', preferences: { faceEmbedding: 'encrypted2' } }
      ];
      
      UserModel.getAllUsers.mockResolvedValue(mockUsers);
      decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.3]); // Mismo para ambos

      await userController.checkFaceUnique(req, res);

      expect(res.json).toHaveBeenCalledWith({
        isDuplicate: true,
        duplicateEmail: 'user2@test.com',
        message: 'Este rostro ya está registrado en otra cuenta'
      });
    });
  });
  describe('Funciones nuevas añadidas', () => {
    test('checkMyFaceUnique - éxito - rostro único', async () => {
      // Usar checkMyFaceUnique en lugar de checkFaceUnique
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        preferences: { 
          faceEmbedding: 'encrypted1',
          faceRegisteredAt: '2024-01-01'
        }
      };
      
      UserModel.findUserById.mockResolvedValue(mockUser);
      UserModel.getAllUsers.mockResolvedValue([
        mockUser,
        { id: 2, preferences: { faceEmbedding: 'encrypted2' } }
      ]);
      
      decryptFaceEmbedding.mockImplementation((encrypted) => {
        if (encrypted === 'encrypted1') return [0.1, 0.2, 0.3];
        if (encrypted === 'encrypted2') return [0.4, 0.5, 0.6]; // Diferente
        return null;
      });

      await userController.checkMyFaceUnique(req, res);

      expect(UserModel.findUserById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          hasBiometric: true,
          isUnique: true,
          duplicateCount: 0
        })
      );
    });

    test('checkMyFaceUnique - rostro duplicado', async () => {
      const mockUser = {
        id: 1,
        email: 'user1@test.com',
        name: 'User 1',
        preferences: { 
          faceEmbedding: 'encrypted1',
          faceRegisteredAt: '2024-01-01'
        }
      };
      
      const otroUser = {
        id: 2,
        email: 'user2@test.com',
        name: 'User 2',
        preferences: { faceEmbedding: 'encrypted2' }
      };
      
      UserModel.findUserById.mockResolvedValue(mockUser);
      UserModel.getAllUsers.mockResolvedValue([mockUser, otroUser]);
      
      // Ambos devuelven el mismo embedding
      decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.3]);

      await userController.checkMyFaceUnique(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          hasBiometric: true,
          isUnique: false,
          duplicateCount: 1,
          duplicateAccounts: expect.any(Array)
        })
      );
    });
  });
});