// tests/db.test.js
const { Pool } = require('pg');

// Mock completo de pg
jest.mock('pg', () => {
  const mockPoolInstance = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  };
  
  const MockPool = jest.fn(() => mockPoolInstance);
  
  return {
    Pool: MockPool,
    __mockPoolInstance: mockPoolInstance
  };
});

describe('DbPool Singleton - Cobertura línea 5', () => {
  let originalDbPool;
  
  beforeEach(() => {
    // Guardar el módulo original
    originalDbPool = require('../config/db');
    
    // Limpiar require cache para poder recrear instancias
    jest.resetModules();
    
    // Limpiar mocks de Pool
    const { Pool } = require('pg');
    Pool.mockClear();
  });
  
  afterEach(() => {
    // Restaurar require cache
    jest.resetModules();
  });
  
  // PRUEBA ESPECÍFICA PARA CUBRIR LÍNEA 5 (ELSE del if)
  test('debería reutilizar instancia existente cuando ya existe (línea 5)', () => {
    // Mock de Pool que guarda llamadas
    const mockPoolInstance = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    };
    
    const MockPool = jest.fn(() => mockPoolInstance);
    require('pg').Pool = MockPool;
    
    // Primera llamada - debería crear nueva instancia
    const DbClass = require('../config/db').constructor;
    const instance1 = new DbClass();
    
    // Verificar que Pool fue llamado
    expect(MockPool).toHaveBeenCalledTimes(1);
    
    // Segunda llamada - debería reutilizar (línea 5: if (!instance))
    const instance2 = new DbClass();
    
    // Pool NO debería ser llamado de nuevo (misma instancia)
    expect(MockPool).toHaveBeenCalledTimes(1);
    
    // Ambas variables deberían apuntar a la misma instancia
    expect(instance1).toBe(instance2);
    expect(instance1.pool).toBe(instance2.pool);
  });
  
  test('singleton pattern - múltiples new() retornan misma instancia', () => {
    // Cargar módulo fresco
    jest.isolateModules(() => {
      const db1 = require('../config/db');
      const db2 = require('../config/db');
      
      // Deberían ser el mismo objeto
      expect(db1).toBe(db2);
      
      // Ambas deberían tener el mismo pool
      expect(db1.getPool()).toBe(db2.getPool());
    });
  });
  
  test('constructor retorna instancia existente en lugar de crear nueva', () => {
    jest.isolateModules(() => {
      // Cargar el módulo
      const DbModule = require('../config/db');
      
      // Obtener la clase constructor
      const DbClass = DbModule.constructor;
      
      // Crear "nueva" instancia
      const newInstance = new DbClass();
      
      // Debería ser la misma instancia que el módulo exportado
      expect(newInstance).toBe(DbModule);
    });
  });
  
  test('getPool() siempre retorna el mismo pool', () => {
    const db = require('../config/db');
    
    const pool1 = db.getPool();
    const pool2 = db.getPool();
    
    expect(pool1).toBe(pool2);
    expect(pool1).toBeDefined();
  });
});