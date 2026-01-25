// tests/db.test.js

// Mock simple sin variables complejas
jest.mock('pg', () => {
  // Crear mocks dentro del closure
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const mockEnd = jest.fn();
  const mockOn = jest.fn();
  
  const mockPoolInstance = {
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
    on: mockOn
  };
  
  const MockPool = jest.fn(() => mockPoolInstance);
  
  // Retornar tanto Pool como la instancia para tests
  return {
    Pool: MockPool,
    __mockPoolInstance: mockPoolInstance,
    __MockPool: MockPool
  };
});

// Importar después del mock
const { Pool, __mockPoolInstance, __MockPool } = require('pg');

describe('DbPool - Singleton y Pool', () => {
  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
  });

  test('getPool retorna el pool mockeado', () => {
    jest.resetModules();
    const db = require('../config/db');
    const pool = db.getPool();
    
    // Verificar que retorna una instancia de pool
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });

  test('maneja error en constructor sin romper', () => {
    // Para este test, necesitamos un mock especial
    // Simular error en Pool
    const originalPool = Pool;
    
    // Crear mock que lance error
    const errorMock = jest.fn(() => {
      throw new Error('Connection error');
    });
    
    // Reemplazar temporalmente
    require('pg').Pool = errorMock;
    
    // Reset cache del módulo db
    jest.resetModules();
    
    // Importar db - debería manejar el error
    expect(() => {
      require('../config/db');
    }).not.toThrow();
    
    // Restaurar
    require('pg').Pool = originalPool;
  });
});