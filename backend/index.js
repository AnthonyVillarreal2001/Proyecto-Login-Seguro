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
app.post('/auth/verify-face', userController.verifyFaceAfterPassword);
// En index.js, añadir esta rota
app.get('/auth/check-face-unique', async (req, res) => {
  try {
    const { embedding, currentUserId } = req.query;
    
    if (!embedding) {
      return res.status(400).json({ error: 'Embedding requerido' });
    }
    
    const embeddingArray = JSON.parse(embedding);
    
    const allUsers = await UserModel.getAllUsers();
    let isDuplicate = false;
    const duplicateUsers = [];
    
    for (const user of allUsers) {
      if (currentUserId && user.id.toString() === currentUserId) continue;
      
      if (user.preferences?.faceEmbedding) {
        try {
          const existingEmbedding = decryptFaceEmbedding(user.preferences.faceEmbedding);
          if (existingEmbedding && Array.isArray(existingEmbedding)) {
            if (existingEmbedding.length === embeddingArray.length) {
              const distance = euclideanDistance(existingEmbedding, embeddingArray);
              if (distance < 0.4) {
                isDuplicate = true;
                duplicateUsers.push({
                  email: user.email,
                  name: user.name,
                  similarity: (1 - distance).toFixed(4)
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error verificando usuario ${user.email}:`, err);
        }
      }
    }
    
    res.json({
      isUnique: !isDuplicate,
      isDuplicate: isDuplicate,
      duplicateCount: duplicateUsers.length,
      duplicateUsers: duplicateUsers
    });
    
  } catch (err) {
    console.error('Error verificando unicidad facial:', err);
    res.status(500).json({ error: 'Error verificando unicidad' });
  }
});
// Verificación personal de unicidad
app.get('/profile/face-unique', authMiddleware(), userController.checkMyFaceUnique);

// Administración de duplicados (solo admin)
app.get('/admin/face-duplicates', authMiddleware(['admin']), userController.getFaceDuplicates);

// Forzar eliminación de biometría duplicada (solo admin)
app.delete('/admin/users/:id/force-remove-face', authMiddleware(['admin']), userController.deleteBiometric);
app.get('/admin/duplicate-faces', authMiddleware(['admin']), userController.checkDuplicateFaces);
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
app.get('/profile/face-unique', authMiddleware(), userController.checkMyFaceUnique);
app.post('/auth/renew-token', authMiddleware(), userController.renewToken);

createTables().then(() => {
  if (process.env.NODE_ENV !== 'test') {
    app.listen(5000, () => console.log('Backend en http://localhost:5000'));
  }
});

module.exports = app;