const jwt = require('jsonwebtoken');
const blacklist = require('../blacklist');

const authMiddleware = (roles = []) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  const token = authHeader.split(' ')[1];
  if (blacklist.has(token)) return res.status(401).json({ error: 'Token inválido' });

  try {
    const decoded = jwt.verify(token, 'secret_key');
    console.log('Token decodificado en middleware:', decoded);
    req.user = decoded;
    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Acceso denegado - rol insuficiente' });
    }
    next();
  } catch (err) {
    console.log('Error verify en middleware:', err.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = authMiddleware;