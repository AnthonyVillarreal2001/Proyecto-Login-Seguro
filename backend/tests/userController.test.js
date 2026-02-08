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
        // Valores sin ceros y con variación suficiente para pasar analyzeEmbedding
        embedding: Array.from({ length: 128 }, (_, i) => 0.15 + ((i % 5) * 0.02))
      };
      
      UserModel.findUserByEmail.mockResolvedValue(null);
      UserModel.getAllUsers.mockResolvedValue([]);
      UserModel.createUser.mockResolvedValue({ 
        id: 1, 
        preferences: { theme: 'light', notifications: true } 
      });
      UserModel.updateUser.mockResolvedValue({ id: 1 });

      await userController.publicRegister(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('newuser@test.com');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        uniqueFace: true
      }));
    });

    test('email duplicado', async () => {
      req.body = { 
        name: 'Test', 
        email: 'duplicate@test.com', 
        password: 'pass',
        embedding: Array.from({ length: 128 }, (_, i) => (i % 5) / 10)
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
        embedding: Array.from({ length: 128 }, (_, i) => (i % 7) / 10)
      };
      UserModel.findUserByEmail.mockRejectedValue(new Error('DB error'));

      await userController.publicRegister(req, res);

      expect(console.error).toHaveBeenCalledWith(
        'Error en registro público biométrico:',
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Error al registrar usuario' }));
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
        embedding: Array.from({ length: 128 }, (_, i) => (i % 5) / 10),
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
        embedding: Array.from({ length: 128 }, (_, i) => (i % 7) / 10),
        password: 'pass' 
      };
      UserModel.findUserById.mockResolvedValue(null);

      await userController.saveFaceEmbedding(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('error interno', async () => {
      req.body = { 
        embedding: Array.from({ length: 128 }, (_, i) => (i % 9) / 10),
        password: 'pass' 
      };
      UserModel.findUserById.mockRejectedValue(new Error('DB error'));

      await userController.saveFaceEmbedding(req, res);

      expect(console.error).toHaveBeenCalledWith('Error guardando biometría:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Error técnico al guardar biometría',
        details: 'DB error'
      }));
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
          embedding: Array.from({ length: 128 }, (_, i) => (i % 6) / 10),
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
          embedding: Array.from({ length: 128 }, (_, i) => (i % 6) / 10),
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

        decryptFaceEmbedding.mockImplementation((value) => {
          if (value === 'encrypted_otro') return req.body.embedding; // Igual que el nuevo rostro
          return Array(128).fill(0.2);
        });

        await userController.saveFaceEmbedding(req, res);

        expect(UserModel.getAllUsers).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('Rostro ya registrado')
          })
        );
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

        const response = res.json.mock.calls[0][0];
        expect(response).toEqual(expect.objectContaining({
          id: 1,
          email: 'test@test.com',
          preferences: {
            theme: 'light',
            notifications: true,
            hasBiometric: false
          }
        }));
      });

      test('getProfile - preferences existe pero sin faceEmbedding', async () => {
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          preferences: { theme: 'dark', notifications: true }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);

        await userController.getProfile(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.preferences).toEqual(expect.objectContaining({
          theme: 'dark',
          notifications: true,
          hasBiometric: false
        }));
      });
    });

    describe('publicRegister - casos adicionales', () => {
      test('error en UserModel.updateUser después de crear usuario', async () => {
        req.body = {
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
          embedding: Array.from({ length: 128 }, (_, i) => 0.2 + ((i % 5) * 0.02))
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
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Error al registrar usuario' }));
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

  describe('Funciones nuevas añadidas - duplicados', () => {
    test('checkDuplicateFaces - sin duplicados', async () => {
      UserModel.getAllUsers.mockResolvedValue([
        { id: 1, email: 'a@test.com', name: 'A', preferences: { faceEmbedding: 'enc1' } },
        { id: 2, email: 'b@test.com', name: 'B', preferences: { faceEmbedding: 'enc2' } }
      ]);

      decryptFaceEmbedding.mockImplementation((value) => {
        if (value === 'enc1') return [0.1, 0.2];
        if (value === 'enc2') return [0.8, 0.9];
        return null;
      });

      await userController.checkDuplicateFaces(req, res);

      expect(UserModel.getAllUsers).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        duplicatesFound: 0,
        usersWithBiometric: 2
      }));
    });

    test('checkDuplicateFaces - detecta duplicados', async () => {
      UserModel.getAllUsers.mockResolvedValue([
        { id: 1, email: 'a@test.com', name: 'A', preferences: { faceEmbedding: 'enc1' } },
        { id: 2, email: 'b@test.com', name: 'B', preferences: { faceEmbedding: 'enc2' } }
      ]);

      decryptFaceEmbedding.mockReturnValue([0.1, 0.2]); // Igual para ambos

      await userController.checkDuplicateFaces(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        duplicatesFound: 1,
        duplicates: expect.any(Array)
      }));
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
          registeredAt: '2024-01-01',
          message: expect.stringContaining('rostro está registrado')
        })
      );
    });
  });

  describe('Cobertura adicional líneas faltantes', () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
        params: {},
        query: {},
        user: { id: 1, email: 'test@test.com', role: 'client' },
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

    describe('publicRegister - ramas faltantes', () => {
      test('error al desencriptar embedding existente no bloquea registro', async () => {
        const embedding = Array.from({ length: 128 }, (_, i) => 0.2 + ((i % 5) * 0.02));
        req.body = {
          name: 'Throws',
          email: 'throws@test.com',
          password: 'password123',
          embedding
        };

        UserModel.findUserByEmail.mockResolvedValue(null);
        UserModel.getAllUsers.mockResolvedValue([
          { id: 2, email: 'bad@test.com', preferences: { faceEmbedding: 'bad_enc' } }
        ]);
        decryptFaceEmbedding.mockImplementation(() => { throw new Error('decrypt fail'); });
        UserModel.createUser.mockResolvedValue({ id: 5, preferences: {} });
        UserModel.updateUser.mockResolvedValue({ id: 5 });

        await userController.publicRegister(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ uniqueFace: true }));
      });
      test('embedding con dimensión inválida devuelve 400', async () => {
        req.body = {
          name: 'Dim Invalid',
          email: 'dim@test.com',
          password: 'password123',
          embedding: [0.1, 0.2, 0.3] // longitud distinta de 128/512
        };

        UserModel.findUserByEmail.mockResolvedValue(null);

        await userController.publicRegister(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Embedding facial inválido. Debe tener 128 o 512 dimensiones.'
        }));
      });

      test('rostro duplicado existente devuelve 409', async () => {
        const embedding = Array.from({ length: 128 }, (_, i) => 0.2 + ((i % 5) * 0.02));
        req.body = {
          name: 'Dup Face',
          email: 'dup@test.com',
          password: 'password123',
          embedding
        };

        UserModel.findUserByEmail.mockResolvedValue(null);
        UserModel.getAllUsers.mockResolvedValue([
          { id: 2, email: 'other@test.com', preferences: { faceEmbedding: 'enc_other' } }
        ]);
        decryptFaceEmbedding.mockReturnValue(embedding);

        await userController.publicRegister(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Rostro ya registrado',
          code: 'FACE_DUPLICATE'
        }));
      });

      test('embedding de baja calidad elimina usuario y devuelve 400', async () => {
        const lowQuality = Array(128).fill(0);
        req.body = {
          name: 'Low Quality',
          email: 'low@test.com',
          password: 'password123',
          embedding: lowQuality
        };

        UserModel.findUserByEmail.mockResolvedValue(null);
        UserModel.getAllUsers.mockResolvedValue([]);
        UserModel.createUser.mockResolvedValue({ id: 10, preferences: {} });
        UserModel.deleteUser.mockResolvedValue(true);

        await userController.publicRegister(req, res);

        expect(UserModel.deleteUser).toHaveBeenCalledWith(10);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Captura facial de baja calidad'
        }));
      });

      test('embedding con valores extremos devuelve 400', async () => {
        const extreme = Array.from({ length: 128 }, () => 150);
        req.body = {
          name: 'Extreme',
          email: 'extreme@test.com',
          password: 'password123',
          embedding: extreme
        };

        UserModel.findUserByEmail.mockResolvedValue(null);
        UserModel.getAllUsers.mockResolvedValue([]);
        UserModel.createUser.mockResolvedValue({ id: 11, preferences: {} });
        UserModel.deleteUser.mockResolvedValue(true);

        await userController.publicRegister(req, res);

        expect(UserModel.deleteUser).toHaveBeenCalledWith(11);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Captura facial de baja calidad'
        }));
      });
    });

    describe('biometricLogin - ramas faltantes', () => {
      test('sin email retorna 400', async () => {
        req.body = { embedding: [0.1, 0.2] };

        await userController.biometricLogin(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Email requerido' });
      });

      test('embedding no es array retorna 400', async () => {
        req.body = { email: 'test@test.com', embedding: 'bad' };

        await userController.biometricLogin(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Embedding facial requerido' });
      });

      test('rostro duplicado en otras cuentas retorna 403', async () => {
        req.body = { email: 'test@test.com', embedding: [0.1, 0.2] };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          preferences: { faceEmbedding: 'self_enc' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        UserModel.getAllUsers.mockResolvedValue([
          mockUser,
          { id: 2, email: 'dup@test.com', preferences: { faceEmbedding: 'other_enc' } }
        ]);
        decryptFaceEmbedding.mockImplementation((val) => {
          if (val === 'self_enc') return [0.1, 0.2];
          if (val === 'other_enc') return [0.1, 0.2];
          return null;
        });

        await userController.biometricLogin(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Rostro detectado en múltiples cuentas'
        }));
      });

      test('rostro no reconocido retorna 401', async () => {
        req.body = { email: 'test@test.com', embedding: [1, 1] };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          preferences: { faceEmbedding: 'self_enc' }
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        UserModel.getAllUsers.mockResolvedValue([]);
        decryptFaceEmbedding.mockReturnValue([0, 0]);

        await userController.biometricLogin(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Rostro no reconocido' });
      });

      test('error al comparar con otro usuario se registra y continúa', async () => {
        req.body = { email: 'test@test.com', embedding: [0.1, 0.2] };
        const mockUser = {
          id: 1,
          email: 'test@test.com',
          preferences: { faceEmbedding: 'self_enc' },
          role: 'client'
        };
        UserModel.findUserByEmail.mockResolvedValue(mockUser);
        UserModel.getAllUsers.mockResolvedValue([
          mockUser,
          { id: 2, email: 'err@test.com', preferences: { faceEmbedding: 'err_enc' } }
        ]);
        decryptFaceEmbedding.mockImplementation((val) => {
          if (val === 'self_enc') return [0.1, 0.2];
          if (val === 'err_enc') throw new Error('decrypt error');
          return null;
        });
        jwt.sign.mockReturnValue('token-ok');

        await userController.biometricLogin(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'token-ok' }));
      });
    });

    describe('updatePreferences y getProfile - ramas faltantes', () => {
      test('updatePreferences error interno', async () => {
        req.body = { preferences: { theme: 'dark' } };
        UserModel.findUserById.mockResolvedValue({ id: 1, preferences: { theme: 'light' } });
        UserModel.updateUser.mockRejectedValue(new Error('DB fail'));

        await userController.updatePreferences(req, res);

        expect(console.error).toHaveBeenCalledWith('Error actualizando preferencias:', expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error interno' });
      });

      test('getProfile usuario no encontrado', async () => {
        UserModel.findUserByEmail.mockResolvedValue(null);

        await userController.getProfile(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
      });
    });

    describe('saveFaceEmbedding - validaciones faltantes', () => {
      test('embedding no es array retorna 400', async () => {
        req.body = { embedding: 'bad', password: 'pass' };

        await userController.saveFaceEmbedding(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Embedding facial inválido o vacío' });
      });

      test('embedding con longitud inválida retorna 400', async () => {
        req.body = { embedding: [0.1, 0.2, 0.3], password: 'pass' };

        await userController.saveFaceEmbedding(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: expect.stringContaining('Embedding debe tener 128 o 512 dimensiones')
        }));
      });

      test('embedding de baja calidad retorna 400', async () => {
        req.body = { embedding: Array(128).fill(0), password: 'pass' };
        const mockUser = { id: 1, password_hash: 'hashed', preferences: {} };
        UserModel.findUserById.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        UserModel.getAllUsers.mockResolvedValue([]);

        await userController.saveFaceEmbedding(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Embedding de baja calidad'
        }));
      });

      test('embedding de otra dimensión dispara warning y continúa', async () => {
        req.body = { embedding: Array.from({ length: 128 }, (_, i) => 0.1 + (i * 0.002)), password: 'pass' };
        const mockUser = { id: 1, password_hash: 'hashed', preferences: {} };
        UserModel.findUserById.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        UserModel.getAllUsers.mockResolvedValue([
          mockUser,
          { id: 2, email: 'dim@test.com', preferences: { faceEmbedding: 'enc512' } }
        ]);
        decryptFaceEmbedding.mockImplementation((val) => {
          if (val === 'enc512') return Array(512).fill(0.1);
          return req.body.embedding;
        });
        console.warn = jest.fn();
        UserModel.updateUser.mockResolvedValue({ id: 1 });

        await userController.saveFaceEmbedding(req, res);

        expect(console.warn).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      });

      test('rostro casi idéntico marca isIdentical en detalles', async () => {
        const embedding = Array(128).fill(0.05);
        req.body = { embedding, password: 'pass' };
        const mockUser = { id: 1, password_hash: 'hashed', preferences: {} };
        UserModel.findUserById.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        UserModel.getAllUsers.mockResolvedValue([
          mockUser,
          { id: 2, email: 'dup@test.com', name: 'Dup', preferences: { faceEmbedding: 'enc_dup' } }
        ]);
        decryptFaceEmbedding.mockImplementation(() => embedding.map(v => v + 0.001));

        await userController.saveFaceEmbedding(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          details: expect.objectContaining({ isIdentical: true })
        }));
      });

      test('registro exitoso de embedding válido', async () => {
        const embedding = Array.from({ length: 128 }, (_, i) => 0.2 + ((i % 5) * 0.02));
        req.body = { embedding, password: 'pass' };
        const mockUser = { id: 1, password_hash: 'hashed', preferences: { theme: 'light' } };
        UserModel.findUserById.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        UserModel.getAllUsers.mockResolvedValue([mockUser]);
        encryptFaceEmbedding.mockReturnValue('enc');
        UserModel.updateUser.mockResolvedValue({ id: 1 });

        await userController.saveFaceEmbedding(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          unique: true
        }));
      });
    });

    describe('checkMyFaceUnique y duplicados', () => {
      test('usuario no encontrado en checkMyFaceUnique', async () => {
        UserModel.findUserById.mockResolvedValue(null);

        await userController.checkMyFaceUnique(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
      });

      test('sin biometría retorna hasBiometric false', async () => {
        UserModel.findUserById.mockResolvedValue({ id: 1, preferences: {} });

        await userController.checkMyFaceUnique(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          hasBiometric: false,
          isUnique: true,
          duplicateCount: 0
        }));
      });
    });

    describe('checkDuplicateFaces / getFaceDuplicates - errores', () => {
      test('checkDuplicateFaces error interno devuelve 500', async () => {
        UserModel.getAllUsers.mockRejectedValue(new Error('DB error'));

        await userController.checkDuplicateFaces(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error verificando duplicados' });
      });

      test('getFaceDuplicates error interno devuelve 500', async () => {
        UserModel.getAllUsers.mockRejectedValue(new Error('DB error'));

        await userController.getFaceDuplicates(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Error obteniendo duplicados faciales'
        }));
      });

      test('checkDuplicateFaces sin rostros devuelve contadores en cero', async () => {
        UserModel.getAllUsers.mockResolvedValue([
          { id: 1, email: 'a@test.com', preferences: {} },
          { id: 2, email: 'b@test.com', preferences: {} }
        ]);

        await userController.checkDuplicateFaces(req, res);

        expect(res.json).toHaveBeenCalledWith({
          totalUsers: 2,
          usersWithBiometric: 0,
          duplicatesFound: 0,
          duplicates: []
        });
      });

      test('getFaceDuplicates sin rostros retorna contadores en cero', async () => {
        UserModel.getAllUsers.mockResolvedValue([
          { id: 1, email: 'a@test.com', preferences: {} }
        ]);

        await userController.getFaceDuplicates(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          totalDuplicates: 0,
          clusters: expect.any(Array),
          duplicates: expect.any(Array)
        }));
      });

      test('getFaceDuplicates con rostros no duplicados no crea clusters', async () => {
        UserModel.getAllUsers.mockResolvedValue([
          { id: 1, email: 'a@test.com', name: 'A', preferences: { faceEmbedding: 'enc1' } },
          { id: 2, email: 'b@test.com', name: 'B', preferences: { faceEmbedding: 'enc2' } }
        ]);

        decryptFaceEmbedding.mockImplementation((val) => {
          if (val === 'enc1') return [0.1, 0.2];
          if (val === 'enc2') return [0.9, 0.9];
          return null;
        });

        await userController.getFaceDuplicates(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.totalDuplicates).toBe(0);
        expect(Array.isArray(payload.clusters) ? payload.clusters.length : payload.clusters).toBe(0);
      });
    });
  });
});