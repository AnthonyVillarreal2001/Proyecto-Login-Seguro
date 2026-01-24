const { Pool } = require('pg');
let instance = null;
class DbPool {
  constructor() {
    if (!instance) {
      this.pool = new Pool({
        user: 'postgres',
        host: 'localhost',
        database: 'secure_app_db',
        password: '1234',
        port: 5432,
      });
      instance = this;
    }
    return instance;
  }
  getPool() {
    return this.pool;
  }
}
module.exports = new DbPool();