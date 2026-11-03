require('dotenv').config();

const app = require('./app');
const pool = require('./config/db');
const { iniciarRecordatorios } = require('./jobs/recordatorios.job');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('Conectado a MySQL');

    app.listen(PORT, () => {
      console.log(`API escuchando en http://localhost:${PORT}`);
      iniciarRecordatorios();
    });
  } catch (error) {
    console.error('No se pudo conectar a MySQL:', error.message);
    process.exit(1);
  }
}

start();
