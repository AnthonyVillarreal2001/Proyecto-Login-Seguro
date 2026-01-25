// middlewares/sessionTimeout.js
const jwt = require('jsonwebtoken');
const blacklist = require('../blacklist');

const SESSION_TIMEOUT = 5 * 60 * 1000; // 30 minutos en milisegundos

const sessionTimeout = (req, res, next) => {
    // Solo aplicar a rutas protegidas
    if (!req.headers.authorization) return next();
    
    const token = req.headers.authorization.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, 'secret_key');
        const currentTime = Date.now();
        const tokenAge = currentTime - (decoded.iat * 1000);
        
        // Verificar timeout por inactividad
        if (tokenAge > SESSION_TIMEOUT) {
        blacklist.add(token, currentTime);
        return res.status(401).json({ 
            error: 'Sesión expirada por inactividad. Por favor, inicie sesión nuevamente.' 
        });
        }
        
        // Actualizar timestamp de actividad en el token (opcional)
        // Puedes renovar el token si el usuario está activo
        if (tokenAge > (SESSION_TIMEOUT / 2)) {
        // Renovar token si está en la mitad del tiempo
        const newToken = jwt.sign(
            { id: decoded.id, role: decoded.role, email: decoded.email }, 
            'secret_key', 
            { expiresIn: '5m' }
        );
        res.setHeader('X-Renewed-Token', newToken);
        }
        
        next();
    } catch (err) {
        next();
    }
};

module.exports = sessionTimeout;