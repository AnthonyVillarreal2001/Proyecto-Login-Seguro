const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const userController = require('./controllers/userController');
const authMiddleware = require('./middlewares/authMiddleware');
const { 
  validateRegister, 
  validateLogin, 
  validateSearch, 
  validateEditUser, 
  validatePreferences,
  validateBiometricOptions,
  validateBiometricVerify 
} = require('./middlewares/validateMiddleware');
const { createTables } = require('./database/schema');

const isTest = process.env.NODE_ENV === 'test';

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));  // Conexión front-back
app.use(helmet());  // Encriptación end-to-end (headers para HTTPS)
app.use(express.json());

// Logging seguro
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);  // Sin sensibles
  next();
});

// Rate limiting
const loginLimiter = isTest 
  ? (req, res, next) => next()  // Sin límite en tests
  : rateLimit({ windowMs: 5 * 60 * 1000, max: 5 });

app.use('/auth/login', loginLimiter);

// Rutas
app.post('/auth/register',
  validateRegister,               // Primero validaciones
  authMiddleware(['admin']),      // Luego auth
  userController.register
);
app.post('/auth/login', validateLogin, userController.login);
app.post('/auth/logout', authMiddleware(), userController.logout);
app.get('/users/search', validateSearch, authMiddleware(['admin']), userController.searchUsers);
app.put('/users/:id', validateEditUser, authMiddleware(['admin']), userController.editUser);
app.get('/profile', authMiddleware(['client']), userController.getProfile);
app.put('/profile/preferences', validatePreferences, authMiddleware(['client']), userController.updatePreferences);

// Nuevas rutas para registro biométrico (facial)
app.post('/auth/biometric/register-options', 
  validateBiometricOptions,  // Primero validación
  authMiddleware(),          // Luego autenticación
  userController.generateRegistrationOptions
);
app.post('/auth/biometric/verify-registration', validateBiometricVerify, authMiddleware(), userController.verifyRegistration); // Protegido
createTables()
  .then(() => {
    if (process.env.NODE_ENV !== 'test') {  // No escuchar en modo test (supertest lo maneja)
      app.listen(5000, () => {
        console.log('Backend corriendo en http://localhost:5000');
      });
    }
  })
  .catch((err) => {
    console.error('Error al crear tablas:', err);
    process.exit(1);
  });

module.exports = app;