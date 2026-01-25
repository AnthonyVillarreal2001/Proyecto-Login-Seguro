// tests/userModel.error.test.js

// Mock simple
const mockQuery = jest.fn();
const mockPool = { query: mockQuery };

jest.mock('../config/db', () => ({
  getPool: jest.fn(() => mockPool)
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn()
}));

const UserModel = require('../models/userModel');
const db = require('../config/db');
const bcrypt = require('bcrypt');

describe('UserModel - Error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mockQuery
    mockQuery.mockReset();
    db.getPool.mockReturnValue(mockPool);
    
    // Configurar bcrypt por defecto
    bcrypt.hash.mockResolvedValue('hashed_password');
  });

  test('createUser - error en bcrypt.hash (líneas 17-18)', async () => {
    bcrypt.hash.mockRejectedValue(new Error('BCrypt error'));
    
    await expect(UserModel.createUser('Test', 'test@test.com', 'password123'))
      .rejects.toThrow('BCrypt error');
  });

  test('updateUser - error en query (líneas 60-61)', async () => {
    // IMPORTANTE: mockRejectedValue debe lanzar un Error, no retornar undefined
    mockQuery.mockRejectedValue(new Error('DB error'));
    
    await expect(UserModel.updateUser(1, { name: 'Updated' }))
      .rejects.toThrow('DB error');
  });

  test('findUserByEmail - error en query (líneas 70-71)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));
    
    await expect(UserModel.findUserByEmail('test@test.com'))
      .rejects.toThrow('DB error');
  });

  test('findUserById - error en query (líneas 80-81)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));
    
    await expect(UserModel.findUserById(1))
      .rejects.toThrow('DB error');
  });

  test('searchUsers - error en query (líneas 90-91)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));
    
    await expect(UserModel.searchUsers('test'))
      .rejects.toThrow('DB error');
  });

  test('getAllUsers - error en query (líneas 100-101)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));
    
    await expect(UserModel.getAllUsers())
      .rejects.toThrow('DB error');
  });

  test('deleteUser - error en query (líneas 110-111)', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));
    
    await expect(UserModel.deleteUser(1))
      .rejects.toThrow('DB error');
  });
});