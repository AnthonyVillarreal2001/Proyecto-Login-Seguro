// Crea un archivo de test para db.js: tests/db.test.js
const DbPool = require('../config/db');

describe('DbPool Singleton', () => {
  test('Debe retornar la misma instancia siempre', () => {
    const instance1 = DbPool;
    const instance2 = DbPool;
    const instance3 = require('../config/db'); // Nueva require
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBe(instance3);
  });

  test('Debe tener método getPool', () => {
    const db = DbPool;
    expect(typeof db.getPool).toBe('function');
    
    const pool = db.getPool();
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });
});