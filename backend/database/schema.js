// backend/database/schema.js
const db = require('../config/db');
const pool = db.getPool();

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TYPE user_role AS ENUM ('admin', 'client');
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role user_role NOT NULL,
        registration_date TIMESTAMP NOT NULL DEFAULT NOW(),
        preferences JSONB DEFAULT '{}',
        credentialID BYTEA,
        publicKey BYTEA,
        counter BIGINT DEFAULT 0,
        challenge VARCHAR(500)  -- AGREGAR ESTA LÍNEA
      );
    `);

    console.log('Tablas verificadas/creadas correctamente.');
  } catch (err) {
    if (err.code === '42710') { // type ya existe
      console.log('Tipo user_role ya existe.');
    } else if (err.code === '42P07') { // table already exists
      console.log('Tabla users ya existe. Agregando columna challenge si no existe...');
      // Agregar la columna si no existe
      try {
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS challenge VARCHAR(500);
        `);
        console.log('Columna challenge agregada/verificada.');
      } catch (alterErr) {
        console.error('Error agregando columna challenge:', alterErr.message);
      }
    } else {
      console.error('Error creando tablas:', err);
      process.exit(1);
    }
  }
};

module.exports = { createTables };