// tests/index.test.js
const request = require('supertest');
const app = require('../index');

// Mock las dependencias globalmente
jest.mock('../models/userModel', () => ({
  findUserByEmail: jest.fn()
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  sign: jest.fn()
}));

const UserModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('API Integración', () => {
  beforeAll(async () => {
    // Esperar a que se creen las tablas
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Limpiar mocks
    jest.clearAllMocks();
  });

  describe('Autenticación', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('POST /auth/login: éxito con credenciales válidas', async () => {
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        password_hash: '$2b$10$hashedpassword',
        preferences: { faceEmbedding: 'encrypted' }
      };
      
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'password123' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requiresFaceVerification', true);
      expect(response.body).toHaveProperty('email', 'test@test.com');
      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('test@test.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', '$2b$10$hashedpassword');
    });

    test('POST /auth/login: error con credenciales inválidas', async () => {
      UserModel.findUserByEmail.mockResolvedValue(null);
      
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'notfound@test.com', password: 'password123' });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Usuario no encontrado');
    });

    test('GET /profile: con token válido', async () => {
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        name: 'Test User',
        preferences: { theme: 'light' }
      };
      
      // Mock JWT verification
      jwt.verify.mockReturnValue({ id: 1, email: 'test@test.com', role: 'client' });
      UserModel.findUserByEmail.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer valid_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', 'test@test.com');
      expect(response.body).toHaveProperty('name', 'Test User');
      expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'secret_key');
      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('test@test.com');
    });

    test('GET /profile: sin token', async () => {
      const response = await request(app)
        .get('/profile');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No token');
    });

    test('POST /auth/register: error sin autorización de admin', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'New User',
          email: 'new@test.com',
          password: 'password123',
          role: 'client'
        });
      
      // Debería devolver 401 porque no hay token de admin
      expect(response.status).toBe(401);
    });

    test('POST /auth/public-register: éxito con embedding', async () => {
      const mockUser = {
        id: 1,
        preferences: { theme: 'light', notifications: true }
      };
      
      UserModel.findUserByEmail.mockResolvedValue(null);
      UserModel.createUser = jest.fn().mockResolvedValue(mockUser);
      UserModel.updateUser = jest.fn().mockResolvedValue({ id: 1 });
      
      // Mock de encriptación
      jest.mock('../utils/encryption', () => ({
        encryptFaceEmbedding: jest.fn().mockReturnValue('encrypted_embedding')
      }));
      
      const response = await request(app)
        .post('/auth/public-register')
        .send({
          name: 'New User',
          email: 'new@test.com',
          password: 'password123',
          embedding: [0.1, 0.2, 0.3]
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(UserModel.findUserByEmail).toHaveBeenCalledWith('new@test.com');
    });

    test('POST /auth/logout: éxito', async () => {
      const response = await request(app)
        .post('/auth/logout');
      
      expect(response.status).toBe(401); // Sin token, pero la ruta existe
    });
  });
});