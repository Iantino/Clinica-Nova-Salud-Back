const bcrypt = require('bcrypt');
const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const { offset, respuestaPaginada, escaparLike, POR_PAGINA } = require('../utils/paginacion');
const { ROLES_GESTIONABLES } = require('../validators/usuario.validator');

const COSTO_BCRYPT = 10;

// Nunca se selecciona password_hash: la contraseña no sale de la base de datos
const COLUMNAS = `u.id, u.nombre, u.apellido, u.correo, r.nombre AS rol, u.activo,
  (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado, u.creado_en`;

function formatear(fila) {
  return { ...fila, activo: Boolean(fila.activo), bloqueado: Boolean(Number(fila.bloqueado)) };
}

async function listar({ buscar, rol, pagina }) {
  const condiciones = [];
  const valores = [];

  if (buscar) {
    const termino = `%${escaparLike(buscar)}%`;
    condiciones.push("(CONCAT(u.nombre, ' ', u.apellido) LIKE ? OR u.correo LIKE ?)");
    valores.push(termino, termino);
  }
  if (rol) {
    condiciones.push('r.nombre = ?');
    valores.push(rol);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM usuarios u JOIN roles r ON r.id = u.rol_id ${where}`,
    valores
  );
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM usuarios u JOIN roles r ON r.id = u.rol_id ${where}
      ORDER BY u.apellido, u.nombre LIMIT ? OFFSET ?`,
    [...valores, POR_PAGINA, offset(pagina)]
  );

  return respuestaPaginada(filas.map(formatear), Number(total), pagina);
}

async function obtener(id) {
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`,
    [id]
  );
  if (!filas[0]) throw new HttpError(404, 'El usuario no existe');
  return formatear(filas[0]);
}

async function idDeRol(nombre) {
  const [filas] = await pool.query('SELECT id FROM roles WHERE nombre = ?', [nombre]);
  if (!filas[0]) throw new HttpError(400, 'El rol no existe');
  return filas[0].id;
}

function errorCorreoDuplicado(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    return new HttpError(409, 'Ya existe un usuario con ese correo');
  }
  return error;
}

async function crear(datos) {
  const rolId = await idDeRol(datos.rol);
  const hash = await bcrypt.hash(datos.password, COSTO_BCRYPT);

  try {
    const [resultado] = await pool.query(
      `INSERT INTO usuarios (rol_id, nombre, apellido, correo, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [rolId, datos.nombre, datos.apellido, datos.correo, hash]
    );
    return obtener(resultado.insertId);
  } catch (error) {
    throw errorCorreoDuplicado(error);
  }
}

async function actualizar(id, datos, idSesion) {
  const actual = await obtener(id);
  const cambios = ['nombre = ?', 'apellido = ?', 'correo = ?'];
  const valores = [datos.nombre, datos.apellido, datos.correo];

  if (datos.rol && datos.rol !== actual.rol) {
    if (!ROLES_GESTIONABLES.includes(actual.rol)) {
      throw new HttpError(400, 'El rol de médicos y pacientes no se cambia desde este módulo');
    }
    if (id === idSesion) {
      throw new HttpError(400, 'No puedes cambiar tu propio rol');
    }
    cambios.push('rol_id = ?');
    valores.push(await idDeRol(datos.rol));
  }

  if (datos.password) {
    // Al cambiar la contraseña también se desbloquea la cuenta
    cambios.push('password_hash = ?', 'intentos_fallidos = 0', 'bloqueado_hasta = NULL');
    valores.push(await bcrypt.hash(datos.password, COSTO_BCRYPT));
  }

  try {
    await pool.query(`UPDATE usuarios SET ${cambios.join(', ')} WHERE id = ?`, [...valores, id]);
  } catch (error) {
    throw errorCorreoDuplicado(error);
  }
  return obtener(id);
}

async function cambiarEstado(id, activo, idSesion) {
  if (id === idSesion && !activo) {
    throw new HttpError(400, 'No puedes desactivar tu propia cuenta');
  }
  await obtener(id);
  // Al reactivar una cuenta también se desbloquea
  await pool.query(
    `UPDATE usuarios SET activo = ?,
            intentos_fallidos = IF(?, 0, intentos_fallidos),
            bloqueado_hasta = IF(?, NULL, bloqueado_hasta)
      WHERE id = ?`,
    [activo, activo, activo, id]
  );
  return obtener(id);
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
