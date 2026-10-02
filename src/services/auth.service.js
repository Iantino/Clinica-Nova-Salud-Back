const bcrypt = require('bcrypt');
const pool = require('../config/db');

// Si el correo no existe, se compara contra este hash para tardar lo mismo
// y no revelar qué correos están registrados.
const HASH_FALSO = '$2b$10$dPPDmTcbJtVsc.jgJXDlMulaH1lKxGKWgu45e9yW0nySmhyoZPBmq';

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

async function login(correo, password) {
  const [filas] = await pool.query(
    `SELECT u.id, u.nombre, u.apellido, u.correo, u.password_hash, u.activo, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE u.correo = ?
      LIMIT 1`,
    [correo]
  );

  const usuario = filas[0];
  const coincide = await bcrypt.compare(password, usuario ? usuario.password_hash : HASH_FALSO);

  // Mismo mensaje en todos los casos (RF-01: mensaje genérico)
  if (!usuario || !coincide || !usuario.activo) {
    throw new AuthError('Correo o contraseña incorrectos');
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    rol: usuario.rol,
  };
}

module.exports = { login, AuthError };
