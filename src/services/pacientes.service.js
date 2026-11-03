const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const { offset, respuestaPaginada, escaparLike, POR_PAGINA } = require('../utils/paginacion');

const CAMPOS = [
  'dpi',
  'nombre',
  'apellido',
  'fecha_nacimiento',
  'sexo',
  'telefono',
  'correo',
  'direccion',
  'nombre_encargado',
  'alergias',
  'antecedentes',
];

const EDAD = 'TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad';

// RF-04: búsqueda por nombre, DPI o teléfono, 20 resultados por página
async function listar({ buscar, pagina }) {
  let where = '';
  const valores = [];

  if (buscar) {
    const contiene = `%${escaparLike(buscar)}%`;
    const empieza = `${escaparLike(buscar)}%`;
    where = `WHERE CONCAT(nombre, ' ', apellido) LIKE ?
                OR CONCAT(apellido, ' ', nombre) LIKE ?
                OR dpi LIKE ?
                OR telefono LIKE ?`;
    valores.push(contiene, contiene, empieza, empieza);
  }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM pacientes ${where}`, valores);
  const [filas] = await pool.query(
    `SELECT id, dpi, nombre, apellido, fecha_nacimiento, sexo, telefono, ${EDAD}
       FROM pacientes ${where}
      ORDER BY apellido, nombre
      LIMIT ? OFFSET ?`,
    [...valores, POR_PAGINA, offset(pagina)]
  );

  return respuestaPaginada(filas, Number(total), pagina);
}

async function obtener(id) {
  const [filas] = await pool.query(
    `SELECT id, ${CAMPOS.join(', ')}, ${EDAD}, creado_en, actualizado_en
       FROM pacientes WHERE id = ?`,
    [id]
  );
  if (!filas[0]) throw new HttpError(404, 'El paciente no existe');
  return filas[0];
}

// Criterio de aceptación RF-03: rechazar un DPI repetido e indicar el paciente existente
async function verificarDpi(dpi, idActual = 0) {
  if (!dpi) return;
  const [filas] = await pool.query(
    'SELECT id, nombre, apellido FROM pacientes WHERE dpi = ? AND id <> ? LIMIT 1',
    [dpi, idActual]
  );
  if (filas[0]) {
    const p = filas[0];
    throw new HttpError(409, `Ya existe un paciente con ese DPI: ${p.nombre} ${p.apellido}`, {
      pacienteExistente: p,
    });
  }
}

function errorDuplicado(error) {
  if (error.code === 'ER_DUP_ENTRY') return new HttpError(409, 'Ya existe un paciente con ese DPI');
  return error;
}

async function crear(datos, rol) {
  await verificarDpi(datos.dpi);
  const campos = rol === 'recepcionista'
    ? CAMPOS.filter((c) => c !== 'alergias' && c !== 'antecedentes')
    : CAMPOS;
  try {
    const [resultado] = await pool.query(
      `INSERT INTO pacientes (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
      campos.map((c) => datos[c] ?? null)
    );
    return obtener(resultado.insertId);
  } catch (error) {
    throw errorDuplicado(error);
  }
}

async function actualizar(id, datos, rol) {
  await obtener(id);
  await verificarDpi(datos.dpi, id);
  const campos = rol === 'recepcionista'
    ? CAMPOS.filter((c) => c !== 'alergias' && c !== 'antecedentes')
    : CAMPOS;
  try {
    await pool.query(
      `UPDATE pacientes SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...campos.map((c) => datos[c] ?? null), id]
    );
  } catch (error) {
    throw errorDuplicado(error);
  }
  return obtener(id);
}

module.exports = { listar, obtener, crear, actualizar };


