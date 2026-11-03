const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const { offset, respuestaPaginada, POR_PAGINA } = require('../utils/paginacion');

const DURACION_MINUTOS = 20;
const ESTADOS_TERMINALES = ['atendida', 'cancelada', 'no_asistio'];

function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function horaFin(horaInicio) {
  const total = minutos(horaInicio) + DURACION_MINUTOS;
  if (total >= 24 * 60) throw new HttpError(400, 'La cita excede el horario del día');
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
}

function diaSemana(fecha) {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return dia || 7;
}

function esPasada(fecha, hora) {
  const ahoraGuatemala = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const hoy = `${ahoraGuatemala.getUTCFullYear()}-${String(ahoraGuatemala.getUTCMonth() + 1).padStart(2, '0')}-${String(ahoraGuatemala.getUTCDate()).padStart(2, '0')}`;
  const horaActual = `${String(ahoraGuatemala.getUTCHours()).padStart(2, '0')}:${String(ahoraGuatemala.getUTCMinutes()).padStart(2, '0')}`;
  return fecha < hoy || (fecha === hoy && hora <= horaActual);
}

async function verificarDisponibilidad(connection, { medicoId, fecha, horaInicio, idExcluir }) {
  if (esPasada(fecha, horaInicio)) throw new HttpError(400, 'No puedes agendar una cita en el pasado');
  const fin = horaFin(horaInicio);
  const numeroDia = diaSemana(fecha);
  if (numeroDia > 5 || horaInicio < '08:00' || fin > '13:00:00') {
    throw new HttpError(400, 'La clínica agenda de lunes a viernes entre 08:00 y 13:00');
  }
  const medico = await connection.query(
    `SELECT m.id FROM medicos m JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.id = ? AND u.activo = TRUE FOR UPDATE`,
    [medicoId]
  );
  if (!medico[0][0]) throw new HttpError(404, 'El médico no existe o está inactivo');

  const [horarios] = await connection.query(
    `SELECT id FROM horarios_medico
      WHERE medico_id = ? AND dia_semana = ? AND hora_inicio <= ? AND hora_fin >= ? LIMIT 1`,
    [medicoId, numeroDia, horaInicio, fin]
  );
  if (!horarios[0]) throw new HttpError(409, 'El médico no atiende en ese día y horario');

  const valores = [medicoId, fecha, fin, horaInicio];
  let excluir = '';
  if (idExcluir) {
    excluir = 'AND id <> ?';
    valores.push(idExcluir);
  }
  const [choques] = await connection.query(
    `SELECT id FROM citas
      WHERE medico_id = ? AND fecha = ? AND estado <> 'cancelada'
        AND hora_inicio < ? AND hora_fin > ? ${excluir}
      LIMIT 1 FOR UPDATE`,
    valores
  );
  if (choques[0]) throw new HttpError(409, 'Ese horario ya está ocupado. Elige otro horario disponible.');
  return fin;
}

async function obtener(id, usuario) {
  const [filas] = await pool.query(
    `SELECT c.id, c.paciente_id, c.medico_id, c.fecha,
            TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio,
            TIME_FORMAT(c.hora_fin, '%H:%i') AS hora_fin,
            c.estado, c.motivo, c.motivo_cancelacion, c.creada_por, c.creado_en,
            p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.telefono AS paciente_telefono,
            u.nombre AS medico_nombre, u.apellido AS medico_apellido,
            e.nombre AS especialidad
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
       JOIN medicos m ON m.id = c.medico_id
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
      WHERE c.id = ? ${usuario?.rol === 'medico' ? 'AND m.usuario_id = ?' : ''}
        ${usuario?.rol === 'paciente' ? 'AND p.usuario_id = ?' : ''}`,
    usuario?.rol === 'medico' || usuario?.rol === 'paciente' ? [id, usuario.id] : [id]
  );
  if (!filas[0]) throw new HttpError(404, 'La cita no existe');
  return filas[0];
}

async function listar(filtros, usuario) {
  const condiciones = [];
  const valores = [];
  if (filtros.desde) { condiciones.push('c.fecha >= ?'); valores.push(filtros.desde); }
  if (filtros.hasta) { condiciones.push('c.fecha <= ?'); valores.push(filtros.hasta); }
  if (filtros.medico_id) { condiciones.push('c.medico_id = ?'); valores.push(filtros.medico_id); }
  if (filtros.estado) { condiciones.push('c.estado = ?'); valores.push(filtros.estado); }
  if (usuario.rol === 'medico') { condiciones.push('m.usuario_id = ?'); valores.push(usuario.id); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM citas c JOIN medicos m ON m.id = c.medico_id ${where}`,
    valores
  );
  const [filas] = await pool.query(
    `SELECT c.id, c.paciente_id, c.medico_id, c.fecha,
            TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio,
            TIME_FORMAT(c.hora_fin, '%H:%i') AS hora_fin,
            c.estado, c.motivo, c.motivo_cancelacion,
            p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
            u.nombre AS medico_nombre, u.apellido AS medico_apellido,
            e.nombre AS especialidad
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
       JOIN medicos m ON m.id = c.medico_id
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
       ${where}
      ORDER BY c.fecha, c.hora_inicio, u.apellido, u.nombre
      LIMIT ? OFFSET ?`,
    [...valores, POR_PAGINA, offset(filtros.pagina)]
  );
  return respuestaPaginada(filas, Number(total), filtros.pagina);
}

async function crear(datos, usuario) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [pacientes] = await connection.query('SELECT id FROM pacientes WHERE id = ?', [datos.paciente_id]);
    if (!pacientes[0]) throw new HttpError(404, 'El paciente no existe');
    const fin = await verificarDisponibilidad(connection, {
      medicoId: datos.medico_id, fecha: datos.fecha, horaInicio: datos.hora_inicio,
    });
    const [resultado] = await connection.query(
      `INSERT INTO citas (paciente_id, medico_id, fecha, hora_inicio, hora_fin, motivo, creada_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [datos.paciente_id, datos.medico_id, datos.fecha, `${datos.hora_inicio}:00`, fin, datos.motivo || null, usuario.id]
    );
    await connection.commit();
    return obtener(resultado.insertId, usuario);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ese horario ya está ocupado. Elige otro horario disponible.');
    throw error;
  } finally {
    connection.release();
  }
}

async function reprogramar(id, datos, usuario) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [actuales] = await connection.query(
      `SELECT c.medico_id, c.estado FROM citas c JOIN medicos m ON m.id = c.medico_id
        JOIN pacientes p ON p.id = c.paciente_id
        WHERE c.id = ? ${usuario.rol === 'medico' ? 'AND m.usuario_id = ?' : ''}
          ${usuario.rol === 'paciente' ? 'AND p.usuario_id = ?' : ''} FOR UPDATE`,
      usuario.rol === 'medico' || usuario.rol === 'paciente' ? [id, usuario.id] : [id]
    );
    const actual = actuales[0];
    if (!actual) throw new HttpError(404, 'La cita no existe');
    if (ESTADOS_TERMINALES.includes(actual.estado) || actual.estado === 'en_atencion') {
      throw new HttpError(409, 'Esta cita ya no se puede reprogramar');
    }
    const medicoId = datos.medico_id ?? actual.medico_id;
    const fin = await verificarDisponibilidad(connection, {
      medicoId, fecha: datos.fecha, horaInicio: datos.hora_inicio, idExcluir: id,
    });
    await connection.query(
      'UPDATE citas SET medico_id = ?, fecha = ?, hora_inicio = ?, hora_fin = ? WHERE id = ?',
      [medicoId, datos.fecha, `${datos.hora_inicio}:00`, fin, id]
    );
    await connection.commit();
    return obtener(id, usuario);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ese horario ya está ocupado. Elige otro horario disponible.');
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelar(id, motivo, usuario) {
  const cita = await obtener(id, usuario);
  if (ESTADOS_TERMINALES.includes(cita.estado) || cita.estado === 'en_atencion') {
    throw new HttpError(409, 'Esta cita ya no se puede cancelar');
  }
  await pool.query(
    "UPDATE citas SET estado = 'cancelada', motivo_cancelacion = ? WHERE id = ?",
    [motivo, id]
  );
  return obtener(id, usuario);
}

const TRANSICIONES = {
  programada: ['confirmada', 'en_atencion', 'no_asistio'],
  confirmada: ['en_atencion', 'no_asistio'],
  en_atencion: [], // Solo crear la consulta permite terminar la atención.
  atendida: [],
  cancelada: [],
  no_asistio: [],
};

async function cambiarEstado(id, estado, usuario) {
  const cita = await obtener(id, usuario);
  if (!TRANSICIONES[cita.estado].includes(estado)) {
    throw new HttpError(409, `No se puede cambiar una cita de ${cita.estado} a ${estado}`);
  }
  const ahoraGuatemala = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const fechaActual = `${ahoraGuatemala.getUTCFullYear()}-${String(ahoraGuatemala.getUTCMonth() + 1).padStart(2, '0')}-${String(ahoraGuatemala.getUTCDate()).padStart(2, '0')}`;
  const horaActual = `${String(ahoraGuatemala.getUTCHours()).padStart(2, '0')}:${String(ahoraGuatemala.getUTCMinutes()).padStart(2, '0')}`;
  const horaFinCita = cita.hora_fin.slice(0, 5);
  if (estado === 'en_atencion' && (cita.fecha > fechaActual || (cita.fecha === fechaActual && cita.hora_inicio > horaActual))) {
    throw new HttpError(409, 'La atención solo puede iniciarse a partir de la hora programada');
  }
  if (estado === 'no_asistio' && (cita.fecha > fechaActual || (cita.fecha === fechaActual && horaFinCita > horaActual))) {
    throw new HttpError(409, 'La cita solo puede marcarse como no asistida después de su horario');
  }
  await pool.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);
  return obtener(id, usuario);
}

async function disponibilidad(medicoId, fecha) {
  const numeroDia = diaSemana(fecha);
  if (numeroDia > 5) return [];
  const [medicos] = await pool.query(
    'SELECT m.id FROM medicos m JOIN usuarios u ON u.id = m.usuario_id WHERE m.id = ? AND u.activo = TRUE',
    [medicoId]
  );
  if (!medicos[0]) throw new HttpError(404, 'El médico no existe o está inactivo');
  const [horarios] = await pool.query(
    `SELECT TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
            TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin
       FROM horarios_medico WHERE medico_id = ? AND dia_semana = ? ORDER BY hora_inicio`,
    [medicoId, numeroDia]
  );
  const [ocupadas] = await pool.query(
    `SELECT TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
            TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin
       FROM citas WHERE medico_id = ? AND fecha = ? AND estado <> 'cancelada'`,
    [medicoId, fecha]
  );
  const disponibles = [];
  for (const horario of horarios) {
    const final = minutos(horario.hora_fin);
    for (let inicio = minutos(horario.hora_inicio); inicio + DURACION_MINUTOS <= final; inicio += DURACION_MINUTOS) {
      const horaInicio = `${String(Math.floor(inicio / 60)).padStart(2, '0')}:${String(inicio % 60).padStart(2, '0')}`;
      const horaFinal = `${String(Math.floor((inicio + DURACION_MINUTOS) / 60)).padStart(2, '0')}:${String((inicio + DURACION_MINUTOS) % 60).padStart(2, '0')}`;
      const ocupada = ocupadas.some((cita) => horaInicio < cita.hora_fin && horaFinal > cita.hora_inicio);
      if (!ocupada && !esPasada(fecha, horaInicio)) disponibles.push(horaInicio);
    }
  }
  return disponibles;
}

module.exports = { listar, obtener, crear, reprogramar, cancelar, cambiarEstado, disponibilidad };
