// tests/userModel.coverage.test.js

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

describe('UserModel - Cobertura completa de try-catch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.getPool.mockReturnValue(mockPool);
    bcrypt.hash.mockResolvedValue('hashed_password');
  });

  // Test para cubrir console.error en catch blocks
  test('createUser - log error en catch', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    bcrypt.hash.mockRejectedValue(new Error('BCrypt error'));
    
    await expect(UserModel.createUser('Test', 'test@test.com', 'password123'))
      .rejects.toThrow();
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error en createUser:', expect.any(Error));
    
    consoleErrorSpy.mockRestore();
  });

  test('updateUser - log error en catch', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    mockQuery.mockRejectedValue(new Error('DB error'));
    
    await expect(UserModel.updateUser(1, { name: 'Updated' }))
      .rejects.toThrow();
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error en updateUser:', expect.any(Error));
    
    consoleErrorSpy.mockRestore();
  });

  // Similar para los otros métodos...
  // findUserByEmail, findUserById, searchUsers, getAllUsers, deleteUser
});