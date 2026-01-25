// Crear mocks GLOBALES primero
const mockQuery = jest.fn();
const mockPool = { query: mockQuery };

jest.mock('../config/db', () => ({
  getPool: jest.fn(() => mockPool)
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn()
}));

// AHORA importamos los módulos
const UserModel = require('../models/userModel');
const db = require('../config/db');
const bcrypt = require('bcrypt');

describe('UserModel - Cobertura 100%', () => {
  beforeEach(() => {
    // Limpiar todos los mocks
    jest.clearAllMocks();
    
    // Configurar db.getPool para devolver nuestro mockPool
    db.getPool.mockReturnValue(mockPool);
    
    // Configurar bcrypt.hash para devolver hash mock
    bcrypt.hash.mockResolvedValue('hashed_password_123');
    
    // Resetear mockQuery
    mockQuery.mockReset();
  });

  describe('createUser', () => {
    test('éxito - inserta con preferencias por defecto', async () => {
      const mockUser = { 
        id: 1, 
        name: 'Test', 
        email: 'test@test.com',
        role: 'client'
      };
      
      // Configurar mockQuery para devolver resultado
      mockQuery.mockResolvedValue({ 
        rows: [mockUser],
        rowCount: 1
      });
      
      const result = await UserModel.createUser('Test', 'test@test.com', 'password123', 'client');
      
      expect(result).toEqual(mockUser);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['Test', 'test@test.com', 'hashed_password_123', 'client', '{"theme":"light","notifications":true}']
      );
    });
  });

  describe('updateUser - cobertura de líneas 27-29, 31-33', () => {
    test('líneas 27-29: retorna null si no hay campos para actualizar', async () => {
      const result = await UserModel.updateUser(1, { invalidField: 'value' });
      
      expect(result).toBeNull();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('líneas 31-33: actualiza campos normales (name, email)', async () => {
      const mockUpdatedUser = { 
        id: 1, 
        name: 'Nuevo Nombre', 
        email: 'new@email.com' 
      };
      
      mockQuery.mockResolvedValue({ 
        rows: [mockUpdatedUser],
        rowCount: 1
      });
      
      const result = await UserModel.updateUser(1, { 
        name: 'Nuevo Nombre', 
        email: 'new@email.com' 
      });
      
      expect(result).toEqual(mockUpdatedUser);
      
      // En lugar de verificar el string completo, verifica que se llamó con los parámetros correctos
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'), // Solo verifica parte del string
        [1, 'Nuevo Nombre', 'new@email.com']
      );
    });

    test('actualiza password_hash correctamente', async () => {
      const mockUpdatedUser = { id: 1 };
      
      mockQuery.mockResolvedValue({ 
        rows: [mockUpdatedUser],
        rowCount: 1
      });
      
      const result = await UserModel.updateUser(1, { 
        password_hash: 'new_hash' 
      });
      
      expect(result).toEqual(mockUpdatedUser);
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [1, 'new_hash']
      );
    });

    test('actualiza preferences (JSONB)', async () => {
      const mockUpdatedUser = { id: 1 };
      const preferences = { 
        theme: 'dark', 
        notifications: false 
      };
      
      mockQuery.mockResolvedValue({ 
        rows: [mockUpdatedUser],
        rowCount: 1
      });
      
      const result = await UserModel.updateUser(1, { preferences });
      
      expect(result).toEqual(mockUpdatedUser);
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [1, JSON.stringify(preferences)]
      );
    });
  });

  describe('findUserByEmail', () => {
    test('éxito - retorna usuario', async () => {
      const mockUser = { 
        id: 1, 
        email: 'test@test.com' 
      };
      
      mockQuery.mockResolvedValue({ 
        rows: [mockUser],
        rowCount: 1
      });
      
      const result = await UserModel.findUserByEmail('test@test.com');
      
      expect(result).toEqual(mockUser);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@test.com']
      );
    });
  });

  describe('findUserById - línea 59-61', () => {
    test('éxito - retorna usuario por ID', async () => {
      const mockUser = { id: 1 };
      
      mockQuery.mockResolvedValue({ 
        rows: [mockUser],
        rowCount: 1
      });
      
      const result = await UserModel.findUserById(1);
      
      expect(result).toEqual(mockUser);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [1]
      );
    });
  });

  describe('searchUsers - línea 63-65', () => {
    test('busca usuarios por nombre o email', async () => {
      const mockUsers = [{ id: 1 }, { id: 2 }];
      
      mockQuery.mockResolvedValue({ 
        rows: mockUsers,
        rowCount: 2
      });
      
      const result = await UserModel.searchUsers('test');
      
      expect(result).toEqual(mockUsers);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1',
        ['%test%']
      );
    });
  });

  describe('getAllUsers - línea 67-69', () => {
    test('retorna todos los usuarios', async () => {
      const mockUsers = [{ id: 1 }, { id: 2 }];
      
      mockQuery.mockResolvedValue({ 
        rows: mockUsers,
        rowCount: 2
      });
      
      const result = await UserModel.getAllUsers();
      
      expect(result).toEqual(mockUsers);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users');
    });
  });

  describe('deleteUser - líneas 71-73', () => {
    test('éxito - elimina y retorna usuario eliminado', async () => {
      const mockUser = { id: 1 };
      
      mockQuery.mockResolvedValue({ 
        rows: [mockUser],
        rowCount: 1
      });
      
      const result = await UserModel.deleteUser(1);
      
      expect(result).toEqual(mockUser);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1 RETURNING *',
        [1]
      );
    });

    test('no encontrado - retorna undefined', async () => {
      mockQuery.mockResolvedValue({ 
        rows: [],
        rowCount: 0
      });
      
      const result = await UserModel.deleteUser(999);
      
      expect(result).toBeUndefined();
    });
  });
});