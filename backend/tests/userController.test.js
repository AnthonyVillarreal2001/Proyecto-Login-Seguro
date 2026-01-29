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
jest.mock('../utils/encryption');

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
        embedding: [0.1, 0.2, 0.3]
      };
      UserModel.findUserByEmail.mockResolvedValue(null);
      UserModel.createUser.mockResolvedValue({ id: 1, preferences: { theme: 'light', notifications: true } });
      encryptFaceEmbedding.mockReturnValue('encrypted_embedding');
      UserModel.updateUser.mockResolvedValue({ id: 1 });

      await userController.publicRegister(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('newuser@test.com');
      expect(UserModel.createUser).toHaveBeenCalledWith('New User', 'newuser@test.com', 'password123', 'client');
      expect(encryptFaceEmbedding).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Registro exitoso con biometría facial. Ahora puede iniciar sesión.',
        success: true
      });
    });

    test('email duplicado', async () => {
      req.body = { name: 'Test', email: 'duplicate@test.com', password: 'pass' };
      UserModel.findUserByEmail.mockResolvedValue({ id: 1 });

      await userController.publicRegister(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
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
        embedding: [0.1, 0.2]
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

    test('éxito con distancia válida', async () => {
      req.body = { email: 'test@test.com', embedding: [0.1, 0.2, 0.3] };
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        role: 'client',
        preferences: { faceEmbedding: 'encrypted' }
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      decryptFaceEmbedding.mockReturnValue([0.1, 0.2, 0.3]);
      jwt.sign.mockReturnValue('test_token');

      await userController.biometricLogin(req, res);

      expect(res.json).toHaveBeenCalledWith({
        token: 'test_token',
        message: 'Login biométrico exitoso'
      });
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
        email: 'test@test.com',
        preferences: { theme: 'light', faceEmbedding: 'encrypted' }
      };
      UserModel.findUserByEmail.mockResolvedValue(mockUser);

      await userController.getProfile(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('test@test.com');
      expect(mockUser.preferences.faceEmbedding).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('updatePreferences', () => {
    test('éxito - actualiza preferencias', async () => {
      req.body = { preferences: { theme: 'dark', notifications: false } };
      UserModel.updateUser.mockResolvedValue({ id: 1 });

      await userController.updatePreferences(req, res);

      expect(UserModel.updateUser).toHaveBeenCalledWith(1, {
        preferences: { theme: 'dark', notifications: false }
      });
      expect(res.json).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('saveFaceEmbedding', () => {
    test('éxito - guarda embedding facial', async () => {
      req.body = { embedding: [0.1, 0.2, 0.3], password: 'current' };
      const mockUser = { id: 1, password_hash: 'hashed' };
      UserModel.findUserById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      encryptFaceEmbedding.mockReturnValue('encrypted');
      UserModel.updateUser.mockResolvedValue({ id: 1 });

      await userController.saveFaceEmbedding(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('current', 'hashed');
      expect(encryptFaceEmbedding).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
      expect(UserModel.updateUser).toHaveBeenCalledWith(1, {
        preferences: { faceEmbedding: 'encrypted' }
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Biometría registrada y encriptada'
      });
    });

    test('contraseña incorrecta', async () => {
      req.body = { embedding: [], password: 'wrong' };
      const mockUser = { id: 1, password_hash: 'hashed' };
      UserModel.findUserById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await userController.saveFaceEmbedding(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Contraseña inválida' });
    });

    test('usuario no encontrado', async () => {
      req.body = { embedding: [], password: 'pass' };
      UserModel.findUserById.mockResolvedValue(null);

      await userController.saveFaceEmbedding(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    test('error interno', async () => {
      req.body = { embedding: [], password: 'pass' };
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
        req.body = { embedding: [0.1, 0.2, 0.3], password: 'current' };
        UserModel.findUserById.mockResolvedValue(null);

        await userController.saveFaceEmbedding(req, res);

        expect(UserModel.findUserById).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
      });

      test('línea 107: error en encryptFaceEmbedding', async () => {
        req.body = { embedding: [0.1, 0.2, 0.3], password: 'current' };
        const mockUser = { id: 1, password_hash: 'hashed' };
        UserModel.findUserById.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        encryptFaceEmbedding.mockImplementation(() => {
          throw new Error('Error de encriptación');
        });

        await userController.saveFaceEmbedding(req, res);

        expect(bcrypt.compare).toHaveBeenCalledWith('current', 'hashed');
        expect(encryptFaceEmbedding).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
        expect(console.error).toHaveBeenCalledWith('Error guardando biometría:', expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error guardando biometría' });
      });

      test('línea 118: error en UserModel.updateUser', async () => {
        req.body = { embedding: [0.1, 0.2, 0.3], password: 'current' };
        const mockUser = { 
          id: 1, 
          password_hash: 'hashed',
          preferences: { theme: 'light' }
        };
        UserModel.findUserById.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        encryptFaceEmbedding.mockReturnValue('encrypted_embedding');
        UserModel.updateUser.mockRejectedValue(new Error('Error de base de datos'));

        await userController.saveFaceEmbedding(req, res);

        expect(bcrypt.compare).toHaveBeenCalledWith('current', 'hashed');
        expect(encryptFaceEmbedding).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
        expect(UserModel.updateUser).toHaveBeenCalledWith(1, {
          preferences: { theme: 'light', faceEmbedding: 'encrypted_embedding' }
        });
        expect(console.error).toHaveBeenCalledWith('Error guardando biometría:', expect.any(Error));
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error guardando biometría' });
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
});