const { body, validationResult, query, param } = require('express-validator');
const validateRegister = [
  body('name').trim().notEmpty().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').optional().isIn(['admin', 'client']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('fallbackPassword').isString(), // ← Esto podría estar fallando
  (req, res, next) => {
    console.log('Validating login:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
const validateSearch = [
  query('query').optional().trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];
const validateEditUser = [
  param('id').isInt(),
  body('*').optional().trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];
const validatePreferences = [
  body('preferences').isObject(),
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
  validatePreferences
};