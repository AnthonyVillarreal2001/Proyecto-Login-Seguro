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
  });
});