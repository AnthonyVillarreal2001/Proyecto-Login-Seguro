// backend/__tests__/validateMiddleware.test.js
const { body, validationResult } = require('express-validator');
const {
  validateRegister,
  validateLogin,
  validateSearch,
  validateEditUser,
  validatePreferences,
} = require('../middlewares/validateMiddleware');

describe('validateMiddleware - Cobertura completa', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  // Función auxiliar mejorada: maneja async y detecta respuesta enviada
  const runMiddlewareChain = async (middlewares) => {
    return new Promise((resolve) => {
      let index = 0;

      const nextFn = () => {
        index++;
        if (index >= middlewares.length) {
          next();
          resolve();
          return;
        }
        middlewares[index](req, res, nextFn);
      };

      middlewares[0](req, res, nextFn);

      // Si se envía respuesta (status 400), resolvemos inmediatamente
      const checkResponse = setInterval(() => {
        if (res.status.mock.calls.length > 0) {
          clearInterval(checkResponse);
          resolve();
        }
      }, 10);

      // Timeout de seguridad (por si algo falla)
      setTimeout(() => {
        clearInterval(checkResponse);
        resolve();
      }, 500);
    });
  };

  describe('validateRegister - líneas 25-27, 34-36, 42-44', () => {
    test('éxito con datos válidos', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'client',
      };

      await runMiddlewareChain(validateRegister);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('error sin nombre - cubre línea 25-27', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        role: 'client',
      };

      await runMiddlewareChain(validateRegister);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'name',
              msg: 'Invalid value',
              type: 'field',
            }),
          ]),
        })
      );
    });

    test('error email inválido - cubre línea 34-36', async () => {
      req.body = {
        name: 'Test',
        email: 'invalid-email',
        password: 'password123',
        role: 'client',
      };

      await runMiddlewareChain(validateRegister);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'email',
              msg: 'Invalid value',
              type: 'field',
            }),
          ]),
        })
      );
    });

    test('error contraseña corta - cubre línea 42-44', async () => {
      req.body = {
        name: 'Test',
        email: 'test@example.com',
        password: 'short',
        role: 'client',
      };

      await runMiddlewareChain(validateRegister);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'password',
              msg: 'Invalid value',
              type: 'field',
            }),
          ]),
        })
      );
    });

    test('error rol inválido', async () => {
      req.body = {
        name: 'Test',
        email: 'test@example.com',
        password: 'password123',
        role: 'superadmin',
      };

      await runMiddlewareChain(validateRegister);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'role',
              msg: 'Invalid value',
              type: 'field',
            }),
          ]),
        })
      );
    });
  });

  describe('validateLogin', () => {
    test('éxito con email y contraseña', async () => {
      req.body = {
        email: 'test@example.com',
        fallbackPassword: 'password123',
      };

      await runMiddlewareChain(validateLogin);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('error sin email', async () => {
      req.body = {
        fallbackPassword: 'password123',
      };

      await runMiddlewareChain(validateLogin);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'email',
              msg: 'Invalid value',
              type: 'field',
            }),
          ]),
        })
      );
    });

    // NUEVA PRUEBA PARA CUBRIR LÍNEA 40
    test('error sin fallbackPassword - cubre línea 40 (callback validation)', async () => {
      req.body = {
        email: 'test@example.com',
        // Sin fallbackPassword
      };

      await runMiddlewareChain(validateLogin);
      
      // Verifica que se llamó a console.log (línea 39)
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'fallbackPassword',
            }),
          ]),
        })
      );
    });

    // PRUEBA ADICIONAL PARA CUBRIR EL console.log
    test('debería registrar validación en consola', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      req.body = {
        email: 'test@example.com',
        fallbackPassword: 'password123',
      };

      await runMiddlewareChain(validateLogin);
      
      expect(consoleSpy).toHaveBeenCalledWith('Validating login:', req.body);
      consoleSpy.mockRestore();
    });

    // PRUEBA ADICIONAL PARA CUBRIR console.log de errores
    test('debería registrar errores de validación en consola', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      req.body = {
        email: 'invalid-email',
        fallbackPassword: 'password123',
      };

      await runMiddlewareChain(validateLogin);
      
      expect(consoleSpy).toHaveBeenCalledWith('Validating login:', req.body);
      expect(consoleSpy).toHaveBeenCalledWith('Validation errors:', expect.any(Array));
      consoleSpy.mockRestore();
    });
  });

  // Pruebas rápidas para los otros middlewares (cobertura adicional)
  describe('Otros middlewares', () => {
    test('validateSearch - éxito', async () => {
      req.query = { query: 'test' };
      await runMiddlewareChain(validateSearch);
      expect(next).toHaveBeenCalled();
    });

    test('validateEditUser - error en id no entero', async () => {
      req.params = { id: 'abc' };
      await runMiddlewareChain(validateEditUser);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('validatePreferences - error si preferences no es objeto', async () => {
      req.body = { preferences: 'string' };
      await runMiddlewareChain(validatePreferences);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    // NUEVA PRUEBA PARA CUBRIR LÍNEA 48 (callback de validatePreferences)
    test('validatePreferences - éxito con objeto válido', async () => {
      req.body = { 
        preferences: { 
          theme: 'dark', 
          notifications: true 
        } 
      };
      
      await runMiddlewareChain(validatePreferences);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    // PRUEBA ADICIONAL PARA validatePreferences con objeto vacío
    test('validatePreferences - éxito con objeto vacío', async () => {
      req.body = { preferences: {} };
      await runMiddlewareChain(validatePreferences);
      expect(next).toHaveBeenCalled();
    });

    // PRUEBA PARA CUBRIR validateEditUser con body opcional
    test('validateEditUser - sin body también debería pasar', async () => {
      req.params = { id: '1' };
      req.body = {}; // Body vacío
      await runMiddlewareChain(validateEditUser);
      expect(next).toHaveBeenCalled();
    });
  });

  // NUEVA SECCIÓN PARA CASOS ESPECÍFICOS DE COBERTURA
  describe('Cobertura de líneas específicas', () => {
    // LÍNEA 40: El callback de validateLogin que incluye console.log
    test('línea 40: callback de validateLogin con errores de validación', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      req.body = {
        email: 'not-an-email',
        fallbackPassword: 123, // Número en lugar de string
      };

      await runMiddlewareChain(validateLogin);
      
      expect(consoleSpy).toHaveBeenCalledWith('Validating login:', req.body);
      expect(consoleSpy).toHaveBeenCalledWith('Validation errors:', expect.any(Array));
      expect(res.status).toHaveBeenCalledWith(400);
      
      consoleSpy.mockRestore();
    });

    // LÍNEA 48: El callback de validatePreferences
    test('línea 48: callback de validatePreferences sin errores', async () => {
      req.body = {
        preferences: {
          theme: 'light',
          notifications: false,
          language: 'es'
        }
      };

      await runMiddlewareChain(validatePreferences);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    // CASO EXTRA: validateLogin con password en lugar de fallbackPassword
    test('validateLogin - error con password field (no fallbackPassword)', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123', // Usando 'password' en lugar de 'fallbackPassword'
      };

      await runMiddlewareChain(validateLogin);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'fallbackPassword',
            }),
          ]),
        })
      );
    });

    // CASO EXTRA: validateLogin con ambos campos vacíos
    test('validateLogin - error con ambos campos vacíos', async () => {
      req.body = {
        email: '',
        fallbackPassword: '',
      };

      await runMiddlewareChain(validateLogin);
      
      expect(res.status).toHaveBeenCalledWith(400);
      // Debería tener errores para ambos campos
    });
  });
});