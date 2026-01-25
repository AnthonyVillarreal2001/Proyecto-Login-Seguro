// Patrones: Singleton (DbPool para conexión única), MVC (controllers/models/views en frontend), Observer (eventos storage en frontend).
// SOLID: S (UserModel solo maneja DB), O (extensible con middlewares), L (subclases posibles), I (interfaces pequeñas), D (inyección via require).
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
  validatePreferences
} = require('./middlewares/validateMiddleware');
const { createTables } = require('./database/schema');
const sessionTimeout = require('./middlewares/sessionTimeout');
const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(helmet());
app.use(express.json());
app.use(sessionTimeout);
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
});
app.use('/auth/login', limiter);
app.use('/auth/biometric/login', limiter);

// Rutas
app.post('/auth/public-register', validateRegister, userController.publicRegister);
app.post('/auth/register', authMiddleware(['admin']), validateRegister, userController.register);
app.post('/auth/login', validateLogin, userController.login);
app.post('/auth/biometric/login', userController.biometricLogin);
app.post('/auth/logout', authMiddleware(), userController.logout);
app.get('/users', authMiddleware(['admin']), userController.getAllUsers);
app.get('/users/search', authMiddleware(['admin']), validateSearch, userController.searchUsers);
app.put('/users/:id', authMiddleware(['admin']), validateEditUser, userController.editUser);
app.delete('/users/:id', authMiddleware(['admin']), userController.deleteUser);
app.delete('/users/:id/biometric', authMiddleware(['admin']), userController.deleteBiometric);
app.get('/profile', authMiddleware(), userController.getProfile);
app.put('/profile', authMiddleware(), userController.updateProfile);
app.put('/profile/preferences', authMiddleware(), validatePreferences, userController.updatePreferences);
app.post('/profile/save-face-embedding', authMiddleware(), userController.saveFaceEmbedding);
app.delete('/profile/biometric', authMiddleware(), userController.removeFaceEmbedding);
app.post('/auth/renew-token', authMiddleware(), userController.renewToken);

createTables().then(() => {
  if (process.env.NODE_ENV !== 'test') {
    app.listen(5000, () => console.log('Backend en http://localhost:5000'));
  }
});

module.exports = app;