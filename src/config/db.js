const mysql = require('mysql2/promise');

// Pool de conexiones a MySQL: reutiliza conexiones en lugar de abrir una por consulta
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: '-06:00', // Hora de Guatemala
});

module.exports = pool;
