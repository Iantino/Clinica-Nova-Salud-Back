const bcrypt = require('bcrypt');
const pool = require('../config/db');
const HttpError = require('../utils/http-error');

const COSTO_BCRYPT = 10;

async function horariosDe(medicoId, connection = pool) {
  const [filas] = await connection.query(
    `SELECT id, dia_semana, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
            TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin
       FROM horarios_medico WHERE medico_id = ? ORDER BY dia_semana, hora_inicio`,
    [medicoId]
  );
  return filas;
}

async function obtener(id, connection = pool) {
  const [filas] = await connection.query(
    `SELECT m.id, m.usuario_id, u.nombre, u.apellido, u.correo, u.activo,
            m.especialidad_id, e.nombre AS especialidad, m.colegiado, m.telefono
       FROM medicos m
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
      WHERE m.id = ?`,
    [id]
  );
  if (!filas[0]) throw new HttpError(404, 'El médico no existe');
  return { ...filas[0], activo: Boolean(filas[0].activo), horarios: await horariosDe(id, connection) };
}

async function listar(usuario) {
  const propio = usuario.rol === 'medico';
  const where = propio ? 'WHERE u.id = ?' : '';
  const [filas] = await pool.query(
    `SELECT m.id, m.usuario_id, u.nombre, u.apellido, u.correo, u.activo,
            m.especialidad_id, e.nombre AS especialidad, m.colegiado, m.telefono
       FROM medicos m
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
       ${where}
      ORDER BY u.apellido, u.nombre`,
    propio ? [usuario.id] : []
  );
  const todosHorarios = filas.length
    ? (await pool.query(
        `SELECT h.id, h.medico_id, h.dia_semana,
                TIME_FORMAT(h.hora_inicio, '%H:%i') AS hora_inicio,
                TIME_FORMAT(h.hora_fin, '%H:%i') AS hora_fin
           FROM horarios_medico h
          WHERE h.medico_id IN (${filas.map(() => '?').join(',')})
          ORDER BY h.dia_semana, h.hora_inicio`,
        filas.map((f) => f.id)
      ))[0]
    : [];
  return filas.map((fila) => ({
    ...fila,
    activo: Boolean(fila.activo),
    horarios: todosHorarios.filter((h) => h.medico_id === fila.id),
  }));
}

async function listarEspecialidades({ incluirInactivas = false } = {}) {
  const where = incluirInactivas ? '' : 'WHERE activo = TRUE';
  const [filas] = await pool.query(
    `SELECT id, nombre, descripcion, activo FROM especialidades ${where} ORDER BY nombre`
  );
  return filas.map((f) => ({ ...f, activo: Boolean(f.activo) }));
}

async function insertarHorarios(connection, medicoId, datos) {
  for (const horario of datos) {
    await connection.query(
      'INSERT INTO horarios_medico (medico_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)',
      [medicoId, horario.dia_semana, `${horario.hora_inicio}:00`, `${horario.hora_fin}:00`]
    );
  }
}

function conflictoUnico(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    throw new HttpError(409, 'El correo o número de colegiado ya está registrado');
  }
  throw error;
}

async function crear(datos) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[rol]] = await connection.query("SELECT id FROM roles WHERE nombre = 'medico'");
    if (!rol) throw new HttpError(500, 'No está configurado el rol médico');
    const hash = await bcrypt.hash(datos.password, COSTO_BCRYPT);
    const [usuario] = await connection.query(
      'INSERT INTO usuarios (rol_id, nombre, apellido, correo, password_hash) VALUES (?, ?, ?, ?, ?)',
      [rol.id, datos.nombre, datos.apellido, datos.correo, hash]
    );
    const [medico] = await connection.query(
      'INSERT INTO medicos (usuario_id, especialidad_id, colegiado, telefono) VALUES (?, ?, ?, ?)',
      [usuario.insertId, datos.especialidad_id, datos.colegiado, datos.telefono ?? null]
    );
    await insertarHorarios(connection, medico.insertId, datos.horarios);
    await connection.commit();
    return obtener(medico.insertId);
  } catch (error) {
    await connection.rollback();
    conflictoUnico(error);
  } finally {
    connection.release();
  }
}

async function actualizar(id, datos) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const actual = await obtener(id, connection);
    await connection.query(
      'UPDATE usuarios SET nombre = ?, apellido = ?, correo = ? WHERE id = ?',
      [datos.nombre, datos.apellido, datos.correo, actual.usuario_id]
    );
    if (datos.password) {
      await connection.query(
        'UPDATE usuarios SET password_hash = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
        [await bcrypt.hash(datos.password, COSTO_BCRYPT), actual.usuario_id]
      );
    }
    await connection.query(
      'UPDATE medicos SET especialidad_id = ?, colegiado = ?, telefono = ? WHERE id = ?',
      [datos.especialidad_id, datos.colegiado, datos.telefono ?? null, id]
    );
    await connection.query('DELETE FROM horarios_medico WHERE medico_id = ?', [id]);
    await insertarHorarios(connection, id, datos.horarios);
    await connection.commit();
    return obtener(id);
  } catch (error) {
    await connection.rollback();
    conflictoUnico(error);
  } finally {
    connection.release();
  }
}

async function cambiarEstado(id, activo) {
  const medico = await obtener(id);
  await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, medico.usuario_id]);
  return obtener(id);
}

async function crearEspecialidad(datos) {
  try {
    const [resultado] = await pool.query(
      'INSERT INTO especialidades (nombre, descripcion) VALUES (?, ?)',
      [datos.nombre, datos.descripcion ?? null]
    );
    const [filas] = await pool.query(
      'SELECT id, nombre, descripcion, activo FROM especialidades WHERE id = ?',
      [resultado.insertId]
    );
    return { ...filas[0], activo: Boolean(filas[0].activo) };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ya existe una especialidad con ese nombre');
    throw error;
  }
}

async function actualizarEspecialidad(id, datos) {
  try {
    const [resultado] = await pool.query(
      'UPDATE especialidades SET nombre = ?, descripcion = ? WHERE id = ?',
      [datos.nombre, datos.descripcion ?? null, id]
    );
    if (!resultado.affectedRows) throw new HttpError(404, 'La especialidad no existe');
    return (await listarEspecialidades({ incluirInactivas: true })).find((e) => e.id === id);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ya existe una especialidad con ese nombre');
    throw error;
  }
}

module.exports = { listar, obtener, listarEspecialidades, crear, actualizar, cambiarEstado, crearEspecialidad, actualizarEspecialidad };
