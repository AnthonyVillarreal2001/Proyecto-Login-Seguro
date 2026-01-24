const db = require('../config/db');
const pool = db.getPool();
const bcrypt = require('bcrypt');
class UserModel {
  async createUser(name, email, password, role = 'client') {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users 
      (name, email, password_hash, role, preferences) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *`,
      [name, email, hash, role, JSON.stringify({ theme: 'light', notifications: true })]
    );
    return result.rows[0];
  }

  async updateUser(id, fields) {
    // Solo permitimos campos seguros
    const validFields = ['name', 'email', 'password_hash', 'preferences'];
    const updates = [];
    const values = [id];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(fields)) {
      if (validFields.includes(key) && value !== undefined) {
        if (key === 'password_hash') {
          updates.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        } else if (key === 'preferences') {
          updates.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
          paramIndex++;
        } else {
          updates.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
    }

    if (updates.length === 0) return null;

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $1 
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }
  async findUserByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }
  async findUserById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }
  async searchUsers(query) {
    const result = await pool.query('SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1', [`%${query}%`]);
    return result.rows;
  }
  async getAllUsers() {
    const result = await pool.query('SELECT * FROM users');
    return result.rows;
  }
  async deleteUser(id) {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}
module.exports = new UserModel();