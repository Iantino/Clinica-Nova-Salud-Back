const bcrypt = require('bcrypt');
const pool = require('../config/db');

const HASH_FALSO = '$2b$10$dPPDmTcbJtVsc.jgJXDlMulaH1lKxGKWgu45e9yW0nySmhyoZPBmq';
const MENSAJE_LOGIN = 'Correo o contraseña incorrectos';

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

async function login(correo, password) {
  const [filas] = await pool.query(
    `SELECT u.id, u.nombre, u.apellido, u.correo, u.password_hash, u.activo,
            u.intentos_fallidos, u.bloqueado_hasta,
            (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado,
            r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE u.correo = ?
      LIMIT 1`,
    [correo]
  );

  const usuario = filas[0];
  const coincide = await bcrypt.compare(password, usuario ? usuario.password_hash : HASH_FALSO);
  const activo = usuario && Boolean(usuario.activo);
  const bloqueado = usuario && Boolean(Number(usuario.bloqueado));

  if (!usuario || !coincide || !activo || bloqueado) {
    if (usuario && activo && !bloqueado && !coincide) {
      await pool.query(
        `UPDATE usuarios
            SET bloqueado_hasta = IF(intentos_fallidos + 1 >= 5,
                                      DATE_ADD(NOW(), INTERVAL 15 MINUTE),
                                      bloqueado_hasta),
                intentos_fallidos = intentos_fallidos + 1
          WHERE id = ?`,
        [usuario.id]
      );
    }
    throw new AuthError(MENSAJE_LOGIN);
  }

  await pool.query(
    'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
    [usuario.id]
  );

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    rol: usuario.rol,
  };
}

module.exports = { login, AuthError };

