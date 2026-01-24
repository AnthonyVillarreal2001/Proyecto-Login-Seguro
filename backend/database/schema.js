// backend/database/schema.js
const db = require('../config/db');
const pool = db.getPool();

const createTables = async () => {
  try {
    // Crear tipo ENUM
    await pool.query(`
      DO $$
      BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'client');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Crear tabla limpia (sin campos WebAuthn)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL,
        registration_date TIMESTAMP NOT NULL DEFAULT NOW(),
        preferences JSONB DEFAULT '{"theme": "light", "notifications": true}'
      );
    `);

    console.log('✅ Tabla users creada/actualizada correctamente (sin campos WebAuthn).');
  } catch (err) {
    console.error('❌ Error creando tablas:', err.message);
  }
};

module.exports = { createTables };