// middlewares/validateMiddleware.js
const { body, validationResult, query, param } = require('express-validator');

const validateRegister = [
  body('name').trim().notEmpty().withMessage('Nombre requerido').escape(),
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Contraseña debe tener al menos 8 caracteres'),
  body('role').isIn(['admin', 'client']).withMessage('Rol inválido'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

const validateLogin = [
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('fallbackPassword').optional().isString(),
  body('biometricResponse').optional().isObject(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    const { fallbackPassword, biometricResponse } = req.body;
    if (!fallbackPassword && !biometricResponse) {
      return res.status(400).json({ error: 'Requiere contraseña o biometría' });
    }
    next();
  }
];

const validateSearch = [
  query('query').optional().isString().trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

const validateEditUser = [
  param('id').isInt().withMessage('ID inválido'),
  body('name').optional().trim().escape(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'client']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

const validatePreferences = [
  body('preferences').isObject().withMessage('Preferencias deben ser un objeto'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

const validateBiometricOptions = [
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

const validateBiometricVerify = [
  body('response').isObject().withMessage('Respuesta biométrica requerida'),
  body('challenge').isString().withMessage('Challenge requerido'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

module.exports = {
  validateRegister,
  validateLogin,
  validateSearch,
  validateEditUser,
  validatePreferences,
  validateBiometricOptions,
  validateBiometricVerify
};