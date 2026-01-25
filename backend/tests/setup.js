// tests/setup.js

// Guardar console original
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

beforeAll(() => {
  // Mockear todas las funciones de console
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
  
  // Mockear schema.js globalmente para evitar ejecución
  jest.mock('../database/schema', () => ({
    createTables: jest.fn().mockResolvedValue(undefined)
  }));
});

afterAll(() => {
  // Restaurar console original
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
  
  jest.restoreAllMocks();
});

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});