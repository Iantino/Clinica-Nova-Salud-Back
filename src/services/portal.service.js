const bcrypt = require('bcrypt');
const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const citasService = require('./citas.service');
const medicosService = require('./medicos.service');
const { offset, respuestaPaginada, POR_PAGINA } = require('../utils/paginacion');

const COSTO_BCRYPT = 10;

async function registrar(datos) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[rol]] = await connection.query("SELECT id FROM roles WHERE nombre = 'paciente'");
    if (!rol) throw new HttpError(500, 'No está configurado el rol paciente');
    const hash = await bcrypt.hash(datos.password, COSTO_BCRYPT);
    const [usuario] = await connection.query(
      'INSERT INTO usuarios (rol_id, nombre, apellido, correo, password_hash) VALUES (?, ?, ?, ?, ?)',
      [rol.id, datos.nombre, datos.apellido, datos.correo, hash]
    );
    const [paciente] = await connection.query(
      `INSERT INTO pacientes
        (usuario_id, dpi, nombre, apellido, fecha_nacimiento, sexo, telefono, correo,
         direccion, nombre_encargado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.insertId, datos.dpi || null, datos.nombre, datos.apellido, datos.fecha_nacimiento,
        datos.sexo, datos.telefono, datos.correo, datos.direccion || null, datos.nombre_encargado || null,
      ]
    );
    await connection.commit();
    return {
      usuario: { id: usuario.insertId, nombre: datos.nombre, apellido: datos.apellido, correo: datos.correo, rol: 'paciente' },
      paciente_id: paciente.insertId,
    };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'El correo o DPI ya está registrado. Revisa los datos o inicia sesión.');
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function pacienteIdDe(usuarioId) {
  const [filas] = await pool.query('SELECT id FROM pacientes WHERE usuario_id = ?', [usuarioId]);
  if (!filas[0]) throw new HttpError(404, 'No se encontró el perfil de paciente de esta cuenta');
  return filas[0].id;
}

async function listarMedicos() {
  const medicos = await medicosService.listar({ rol: 'paciente' });
  return medicos.filter((medico) => medico.activo).map(({ id, nombre, apellido, especialidad, horarios }) => ({
    id, nombre, apellido, especialidad, horarios,
  }));
}

async function listarCitas(usuarioId, pagina = 1) {
  const pacienteId = await pacienteIdDe(usuarioId);
  const condiciones = 'WHERE c.paciente_id = ?';
  const [totalFilas] = await pool.query(`SELECT COUNT(*) AS total FROM citas c ${condiciones}`, [pacienteId]);
  const [filas] = await pool.query(
    `SELECT c.id, c.medico_id, c.fecha,
            TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio,
            TIME_FORMAT(c.hora_fin, '%H:%i') AS hora_fin,
            c.estado, c.motivo, c.motivo_cancelacion,
            u.nombre AS medico_nombre, u.apellido AS medico_apellido, e.nombre AS especialidad
       FROM citas c JOIN medicos m ON m.id = c.medico_id
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
      ${condiciones}
      ORDER BY c.fecha DESC, c.hora_inicio DESC
      LIMIT ? OFFSET ?`,
    [pacienteId, POR_PAGINA, offset(pagina)]
  );
  return respuestaPaginada(filas, Number(totalFilas[0].total), pagina);
}

async function crearCita(datos, usuario) {
  const pacienteId = await pacienteIdDe(usuario.id);
  return citasService.crear({ ...datos, paciente_id: pacienteId }, usuario);
}

async function reprogramarCita(id, datos, usuario) {
  return citasService.reprogramar(id, datos, usuario);
}

function esPasada(fecha, hora) {
  const ahora = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const hoy = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, '0')}-${String(ahora.getUTCDate()).padStart(2, '0')}`;
  const horaActual = `${String(ahora.getUTCHours()).padStart(2, '0')}:${String(ahora.getUTCMinutes()).padStart(2, '0')}`;
  return fecha < hoy || (fecha === hoy && hora <= horaActual);
}

async function cancelarCita(id, motivo, usuario) {
  const pacienteId = await pacienteIdDe(usuario.id);
  const [filas] = await pool.query(
    `SELECT estado, fecha, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio
       FROM citas WHERE id = ? AND paciente_id = ?`,
    [id, pacienteId]
  );
  const cita = filas[0];
  if (!cita) throw new HttpError(404, 'No se encontró la cita');
  if (!['programada', 'confirmada'].includes(cita.estado) || esPasada(cita.fecha, cita.hora_inicio)) {
    throw new HttpError(409, 'Esta cita ya no se puede cancelar');
  }
  const [resultado] = await pool.query(
    `UPDATE citas SET estado = 'cancelada', motivo_cancelacion = ?
      WHERE id = ? AND paciente_id = ? AND estado IN ('programada', 'confirmada')`,
    [motivo, id, pacienteId]
  );
  if (!resultado.affectedRows) throw new HttpError(409, 'La cita cambió de estado y ya no se puede cancelar');
  return { mensaje: 'La cita se canceló correctamente' };
}

module.exports = { registrar, listarMedicos, listarCitas, crearCita, reprogramarCita, cancelarCita, pacienteIdDe };
