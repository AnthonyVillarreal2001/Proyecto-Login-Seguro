// blacklist.js
class Blacklist {
  constructor() {
    this.tokens = new Set();
  }

  add(token) {
    this.tokens.add(token);
  }

  has(token) {
    return this.tokens.has(token);
  }

  clear() {
    this.tokens.clear();
  }
}

// Exporta la instancia
const blacklist = new Blacklist();
module.exports = blacklist;