// blacklist.js mejorado
const blacklist = new Map(); // Cambiado de Set a Map para almacenar timestamp

module.exports = {
  add: (token, expiresAt) => blacklist.set(token, { expiresAt }),
  has: (token) => {
    const data = blacklist.get(token);
    if (!data) return false;
    
    // Limpiar token expirado
    if (Date.now() > data.expiresAt) {
      blacklist.delete(token);
      return false;
    }
    return true;
  },
  clearExpired: () => {
    const now = Date.now();
    for (const [token, data] of blacklist.entries()) {
      if (now > data.expiresAt) {
        blacklist.delete(token);
      }
    }
  },
  clear: () => blacklist.clear()
};