const { createHash, randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const { correoConfigurado, enviarCorreoRestablecimiento } = require('./correo.service');

const COSTO_BCRYPT = 10;
const MENSAJE_ENLACE_INVALIDO = 'El enlace no es válido o ya venció. Solicita uno nuevo.';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function solicitarRestablecimiento(correo) {
  // Responder igual para todas las direcciones si falta la configuración evita
  // filtrar si la cuenta existe y permite mostrar una causa útil en la interfaz.
  if (!correoConfigurado()) {
    throw new HttpError(503, 'El servicio de correo no está configurado. Intenta más tarde.');
  }

  const [filas] = await pool.query(
    'SELECT id, nombre FROM usuarios WHERE correo = ? AND activo = TRUE LIMIT 1',
    [correo]
  );
  const usuario = filas[0];
  if (!usuario) return;

  const token = randomBytes(32).toString('base64url');
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query('DELETE FROM tokens_restablecimiento WHERE usuario_id = ?', [usuario.id]);
    await conexion.query(
      `INSERT INTO tokens_restablecimiento (usuario_id, token_hash, vence_en)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [usuario.id, hashToken(token)]
    );
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }

  const origen = process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = new URL('/restablecer-contrasena', origen);
  url.searchParams.set('token', token);
  try {
    await enviarCorreoRestablecimiento({ correo, nombre: usuario.nombre, url: url.toString() });
  } catch (error) {
    // No se registra el correo ni el token; la respuesta pública no revela si existe la cuenta.
    console.error(`No se pudo enviar el enlace de restablecimiento: ${error.code || 'error SMTP'}`);
  }
}

async function restablecerContrasena(token, password) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [filas] = await conexion.query(
      `SELECT id, usuario_id
         FROM tokens_restablecimiento
        WHERE token_hash = ? AND usado_en IS NULL AND vence_en > NOW()
        LIMIT 1 FOR UPDATE`,
      [hashToken(token)]
    );
    const registro = filas[0];
    if (!registro) throw new HttpError(400, MENSAJE_ENLACE_INVALIDO);

    const hashPassword = await bcrypt.hash(password, COSTO_BCRYPT);
    const [resultado] = await conexion.query(
      `UPDATE usuarios
          SET password_hash = ?, intentos_fallidos = 0, bloqueado_hasta = NULL
        WHERE id = ? AND activo = TRUE`,
      [hashPassword, registro.usuario_id]
    );
    if (!resultado.affectedRows) throw new HttpError(400, MENSAJE_ENLACE_INVALIDO);

    await conexion.query(
      'UPDATE tokens_restablecimiento SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL',
      [registro.usuario_id]
    );
    await conexion.commit();
    return { mensaje: 'La contraseña se cambió correctamente.' };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = { solicitarRestablecimiento, restablecerContrasena };
