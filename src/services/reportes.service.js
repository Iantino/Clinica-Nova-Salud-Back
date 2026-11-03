const pool = require('../config/db');
const { offset, respuestaPaginada, POR_PAGINA } = require('../utils/paginacion');

function rangoSql(filtros, alias = 'c') {
  const condiciones = [];
  const valores = [];
  if (filtros.desde) { condiciones.push(`${alias}.fecha >= ?`); valores.push(filtros.desde); }
  if (filtros.hasta) { condiciones.push(`${alias}.fecha <= ?`); valores.push(filtros.hasta); }
  if (filtros.medico_id) { condiciones.push(`${alias}.medico_id = ?`); valores.push(filtros.medico_id); }
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', valores };
}

async function resumen(fecha) {
  const [filas] = await pool.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(estado = 'programada'), 0) AS programadas,
            COALESCE(SUM(estado = 'confirmada'), 0) AS confirmadas,
            COALESCE(SUM(estado = 'atendida'), 0) AS atendidas,
            COALESCE(SUM(estado = 'cancelada'), 0) AS canceladas,
            COALESCE(SUM(estado = 'no_asistio'), 0) AS inasistencias
       FROM citas WHERE fecha = ?`,
    [fecha]
  );
  return { fecha, ...Object.fromEntries(Object.entries(filas[0]).map(([k, v]) => [k, Number(v)])) };
}

const SELECT_CITAS = `SELECT DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
    TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora,
    CONCAT(p.nombre, ' ', p.apellido) AS paciente,
    CONCAT(u.nombre, ' ', u.apellido) AS medico,
    e.nombre AS especialidad, c.estado, COALESCE(c.motivo, '') AS motivo,
    COALESCE(c.motivo_cancelacion, '') AS motivo_cancelacion
  FROM citas c JOIN pacientes p ON p.id = c.paciente_id
  JOIN medicos m ON m.id = c.medico_id
  JOIN usuarios u ON u.id = m.usuario_id
  JOIN especialidades e ON e.id = m.especialidad_id`;

async function listarCitas(filtros) {
  const { where, valores } = rangoSql(filtros);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM citas c ${where}`, valores);
  const [filas] = await pool.query(
    `${SELECT_CITAS} ${where} ORDER BY c.fecha DESC, c.hora_inicio DESC, u.apellido, u.nombre LIMIT ? OFFSET ?`,
    [...valores, POR_PAGINA, offset(filtros.pagina)]
  );
  return respuestaPaginada(filas, Number(total), filtros.pagina);
}

async function todasLasCitas(filtros) {
  const { where, valores } = rangoSql(filtros);
  const [filas] = await pool.query(`${SELECT_CITAS} ${where} ORDER BY c.fecha DESC, c.hora_inicio DESC`, valores);
  return filas;
}

async function bitacora(filtros) {
  const condiciones = [];
  const valores = [];
  if (filtros.desde) { condiciones.push('b.fecha >= CONCAT(?, \' 00:00:00\')'); valores.push(filtros.desde); }
  if (filtros.hasta) { condiciones.push('b.fecha < DATE_ADD(?, INTERVAL 1 DAY)'); valores.push(filtros.hasta); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM bitacora_expedientes b ${where}`, valores);
  const [filas] = await pool.query(
    `SELECT b.id, b.fecha, b.accion, b.detalle,
            CONCAT(u.nombre, ' ', u.apellido) AS usuario,
            CONCAT(p.nombre, ' ', p.apellido) AS paciente
       FROM bitacora_expedientes b
       JOIN usuarios u ON u.id = b.usuario_id
       JOIN pacientes p ON p.id = b.paciente_id
       ${where} ORDER BY b.fecha DESC, b.id DESC LIMIT ? OFFSET ?`,
    [...valores, POR_PAGINA, offset(filtros.pagina)]
  );
  return respuestaPaginada(filas, Number(total), filtros.pagina);
}

module.exports = { resumen, listarCitas, todasLasCitas, bitacora };
