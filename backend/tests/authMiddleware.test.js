const authMiddleware = require('../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');
const blacklist = require('../blacklist');

jest.mock('jsonwebtoken');
jest.mock('../blacklist');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  test('Sin token: 401', () => {
    authMiddleware()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token' });
  });

  test('Token blacklisted: 401', () => {
    req.headers.authorization = 'Bearer invalid';
    blacklist.has.mockReturnValue(true);
    authMiddleware()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('Token inválido: 401', () => {
    req.headers.authorization = 'Bearer token';
    blacklist.has.mockReturnValue(false);
    jwt.verify.mockImplementation(() => { throw new Error('Invalid'); });
    authMiddleware()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('Rol no autorizado: 403', () => {
    req.headers.authorization = 'Bearer token';
    blacklist.has.mockReturnValue(false);
    jwt.verify.mockReturnValue({ role: 'client' });
    authMiddleware(['admin'])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('Éxito con rol correcto', () => {
    req.headers.authorization = 'Bearer token';
    blacklist.has.mockReturnValue(false);
    jwt.verify.mockReturnValue({ id: 1, role: 'admin' });
    authMiddleware(['admin'])(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 1, role: 'admin' });
  });

  test('Éxito sin roles especificados', () => {
    req.headers.authorization = 'Bearer token';
    jwt.verify.mockReturnValue({ role: 'client' });
    authMiddleware()(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});