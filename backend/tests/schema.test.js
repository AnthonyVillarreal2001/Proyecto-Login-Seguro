// tests/schema.test.js - versión que no depende del mock global

// Primero, deshabilitar temporalmente el mock global de schema
// Vamos a mockear config/db directamente

// Mock config/db
const mockQuery = jest.fn();
const mockPool = { query: mockQuery };

jest.mock('../config/db', () => ({
  getPool: jest.fn(() => mockPool)
}));

// Importar después del mock
const { createTables } = require('../database/schema');
const db = require('../config/db');

describe('Schema - Creación de tablas y tipos', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockQuery.mockClear();
    
    // Configurar mock por defecto
    mockQuery.mockResolvedValue({ rows: [] });
    
    // Asegurar que getPool retorne nuestro mockPool
    db.getPool.mockReturnValue(mockPool);
  });

  test('crea el tipo ENUM si no existe', async () => {
    await createTables();
    
    // Verificar que se llamó al menos 2 veces (CREATE TYPE y CREATE TABLE)
    expect(mockQuery).toHaveBeenCalledTimes(2);
    
    // La primera llamada debe ser CREATE TYPE
    expect(mockQuery.mock.calls[0][0]).toContain('CREATE TYPE user_role AS ENUM');
  });

  test('crea la tabla users si no existe', async () => {
    await createTables();
    
    // La segunda llamada debe ser CREATE TABLE
    expect(mockQuery.mock.calls[1][0]).toContain('CREATE TABLE IF NOT EXISTS users');
  });

  test('maneja error en creación sin romper', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Hacer que la primera llamada falle
    mockQuery.mockRejectedValueOnce(new Error('Error de base de datos'));
    
    await createTables();
    
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error creando tablas');
    
    consoleErrorSpy.mockRestore();
  });
});