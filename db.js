// db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',               // Usuario de PostgreSQL
  host: 'localhost',              // O 127.0.0.1
  database: 'coleccion_postulantes',  // Nombre de tu base de datos
  password: 'TU_CONTRASEÑA',      // Cambia por la contraseña que configuraste
  port: 5432,                     // Puerto por defecto
});

module.exports = pool;
