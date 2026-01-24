const jwt = require('jsonwebtoken');
const blacklist = require('../blacklist');
const authMiddleware = (roles = []) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  if (blacklist.has(token)) return res.status(401).json({ error: 'Token inválido' });
  try {
    const decoded = jwt.verify(token, 'secret_key');
    req.user = decoded;
    if (roles.length && !roles.includes(decoded.role)) return res.status(403).json({ error: 'Acceso denegado' });
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};
module.exports = authMiddleware;