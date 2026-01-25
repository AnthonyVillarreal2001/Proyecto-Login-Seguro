const request = require('supertest');
const app = require('../index');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');

// Mocks
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../models/userModel');

describe('API Integración', () => {
  const validToken = 'valid.jwt.token';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /auth/login: éxito', async () => {
    const mockUser = {
      id: 1,
      email: 'test@test.com',
      password_hash: 'hashed_password',
      role: 'client',
    };
    
    UserModel.findUserByEmail.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue(validToken);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@test.com', fallbackPassword: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token', validToken);
    expect(res.body).toHaveProperty('message', 'Login exitoso');
    
    expect(UserModel.findUserByEmail).toHaveBeenCalledWith('test@test.com');
    expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: 1, role: 'client', email: 'test@test.com' },
      'secret_key',
      { expiresIn: '30m' }
    );
  });

  test('GET /profile: con token válido', async () => {
    const mockUser = {
      id: 1,
      email: 'test@test.com',
      name: 'Test User',
      role: 'client'
    };
    
    UserModel.findUserByEmail.mockResolvedValue(mockUser);
    
    // Mock jwt.verify para que no falle
    jwt.verify = jest.fn().mockReturnValue({ 
      id: 1, 
      email: 'test@test.com',
      role: 'client' 
    });

    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockUser);
  });
});