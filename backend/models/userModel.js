const db = require('../config/db');
const pool = db.getPool();
const bcrypt = require('bcrypt');

class UserModel {
  async createUser(name, email, password, role) {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, registration_date) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, email, hash, role]
    );
    return result.rows[0];
  }

  async findUserByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  async searchUsers(query) {
    const result = await pool.query('SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1', [`%${query}%`]);
    return result.rows;
  }

  async updateUser(id, fields) {
    // Manejar casos donde fields es undefined, null o no es un objeto
    if (!fields || typeof fields !== 'object') {
      // Si no hay campos válidos, retornar el usuario actual
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    }
    
    // Filtrar campos undefined o null
    const filteredFields = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        filteredFields[key] = value;
      }
    }
    
    // Si después de filtrar no quedan campos, retornar el usuario actual
    if (Object.keys(filteredFields).length === 0) {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    }
    
    // Verificar que los campos existan en la tabla antes de construir la query
    const validColumns = ['name', 'email', 'role', 'preferences', 'credentialID', 'publicKey', 'counter', 'challenge'];
    const safeUpdates = {};
    
    for (const [key, value] of Object.entries(filteredFields)) {
      if (validColumns.includes(key)) {
        safeUpdates[key] = value;
      }
      // Ignorar columnas que no existen en la tabla
    }
    
    // Si no hay campos seguros después de validar
    if (Object.keys(safeUpdates).length === 0) {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    }
    
    const updates = Object.keys(safeUpdates).map((key, i) => `${key} = $${i+2}`).join(', ');
    const values = [id, ...Object.values(safeUpdates)];
    
    try {
      const result = await pool.query(`UPDATE users SET ${updates} WHERE id = $1 RETURNING *`, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async updatePreferences(id, preferences) {
    const result = await pool.query('UPDATE users SET preferences = $2 WHERE id = $1 RETURNING *', [id, JSON.stringify(preferences)]);
    return result.rows[0];
  }
}

module.exports = new UserModel();