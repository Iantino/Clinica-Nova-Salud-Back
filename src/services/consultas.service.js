const pool = require('../config/db');
const HttpError = require('../utils/http-error');

async function auditar(connection, { usuarioId, pacienteId, accion, detalle }) {
  await connection.query(
    'INSERT INTO bitacora_expedientes (usuario_id, paciente_id, accion, detalle) VALUES (?, ?, ?, ?)',
    [usuarioId, pacienteId, accion, detalle]
  );
}

async function historial(pacienteId, usuario) {
  const [pacientes] = await pool.query('SELECT id FROM pacientes WHERE id = ?', [pacienteId]);
  if (!pacientes[0]) throw new HttpError(404, 'El paciente no existe');
  const [filas] = await pool.query(
    `SELECT q.id, q.cita_id, q.motivo_consulta, q.presion_arterial, q.frecuencia_cardiaca,
            q.temperatura, q.peso_kg, q.talla_cm, q.diagnostico, q.tratamiento, q.notas, q.creado_en,
            c.fecha, TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio,
            u.nombre AS medico_nombre, u.apellido AS medico_apellido, e.nombre AS especialidad
       FROM consultas q JOIN citas c ON c.id = q.cita_id
       JOIN medicos m ON m.id = c.medico_id
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
      WHERE c.paciente_id = ?
      ORDER BY c.fecha DESC, c.hora_inicio DESC, q.id DESC`,
    [pacienteId]
  );
  await auditar(pool, { usuarioId: usuario.id, pacienteId, accion: 'consultar', detalle: 'Consulta de historial clínico' });
  return filas;
}

async function obtener(id, usuario) {
  const [filas] = await pool.query(
    `SELECT q.id, q.cita_id, q.motivo_consulta, q.presion_arterial, q.frecuencia_cardiaca,
            q.temperatura, q.peso_kg, q.talla_cm, q.diagnostico, q.tratamiento, q.notas, q.creado_en,
            c.paciente_id, c.fecha, TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio,
            p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
            u.nombre AS medico_nombre, u.apellido AS medico_apellido, e.nombre AS especialidad,
            m.usuario_id AS medico_usuario_id
       FROM consultas q JOIN citas c ON c.id = q.cita_id
       JOIN pacientes p ON p.id = c.paciente_id
       JOIN medicos m ON m.id = c.medico_id
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
      WHERE q.id = ?`,
    [id]
  );
  const consulta = filas[0];
  if (!consulta) throw new HttpError(404, 'La consulta no existe');
  const [recetas] = await pool.query(
    `SELECT id, indicaciones_generales, creado_en FROM recetas WHERE consulta_id = ?`,
    [id]
  );
  let receta = null;
  if (recetas[0]) {
    const [medicamentos] = await pool.query(
      `SELECT id, medicamento, dosis, frecuencia, duracion FROM receta_detalle WHERE receta_id = ? ORDER BY id`,
      [recetas[0].id]
    );
    receta = { ...recetas[0], medicamentos };
  }
  await auditar(pool, { usuarioId: usuario.id, pacienteId: consulta.paciente_id, accion: 'consultar', detalle: `Consulta clínica ${id}` });
  const { medico_usuario_id: _propietario, ...datosConsulta } = consulta;
  return { ...datosConsulta, receta };
}

async function crear(datos, usuario) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [filas] = await connection.query(
      `SELECT c.id, c.paciente_id, c.estado, m.usuario_id
         FROM citas c JOIN medicos m ON m.id = c.medico_id
        WHERE c.id = ? FOR UPDATE`,
      [datos.cita_id]
    );
    const cita = filas[0];
    if (!cita) throw new HttpError(404, 'La cita no existe');
    if (cita.usuario_id !== usuario.id) throw new HttpError(403, 'Solo el médico asignado puede registrar la consulta');
    if (cita.estado !== 'en_atencion') throw new HttpError(409, 'Inicia la atención de la cita antes de registrar la consulta');

    const [resultado] = await connection.query(
      `INSERT INTO consultas
        (cita_id, motivo_consulta, presion_arterial, frecuencia_cardiaca, temperatura, peso_kg,
         talla_cm, diagnostico, tratamiento, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.cita_id, datos.motivo_consulta, datos.presion_arterial || null,
        datos.frecuencia_cardiaca ?? null, datos.temperatura ?? null, datos.peso_kg ?? null,
        datos.talla_cm ?? null, datos.diagnostico, datos.tratamiento || null, datos.notas || null,
      ]
    );
    await connection.query("UPDATE citas SET estado = 'atendida' WHERE id = ? AND estado = 'en_atencion'", [datos.cita_id]);
    await auditar(connection, {
      usuarioId: usuario.id, pacienteId: cita.paciente_id, accion: 'crear', detalle: 'Consulta médica registrada',
    });
    await connection.commit();
    return obtener(resultado.insertId, usuario);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'La cita ya tiene una consulta registrada');
    throw error;
  } finally {
    connection.release();
  }
}

async function crearReceta(consultaId, datos, usuario) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [filas] = await connection.query(
      `SELECT q.id, c.paciente_id, m.usuario_id
         FROM consultas q JOIN citas c ON c.id = q.cita_id
         JOIN medicos m ON m.id = c.medico_id
        WHERE q.id = ? FOR UPDATE`,
      [consultaId]
    );
    const consulta = filas[0];
    if (!consulta) throw new HttpError(404, 'La consulta no existe');
    if (consulta.usuario_id !== usuario.id) throw new HttpError(403, 'Solo el médico que atendió puede emitir la receta');
    const [existente] = await connection.query('SELECT id FROM recetas WHERE consulta_id = ?', [consultaId]);
    if (existente[0]) throw new HttpError(409, 'Esta consulta ya tiene una receta');

    const [resultado] = await connection.query(
      'INSERT INTO recetas (consulta_id, indicaciones_generales) VALUES (?, ?)',
      [consultaId, datos.indicaciones_generales || null]
    );
    for (const item of datos.medicamentos) {
      await connection.query(
        'INSERT INTO receta_detalle (receta_id, medicamento, dosis, frecuencia, duracion) VALUES (?, ?, ?, ?, ?)',
        [resultado.insertId, item.medicamento, item.dosis, item.frecuencia, item.duracion]
      );
    }
    await auditar(connection, {
      usuarioId: usuario.id, pacienteId: consulta.paciente_id, accion: 'modificar', detalle: 'Receta emitida',
    });
    await connection.commit();
    return obtener(consultaId, usuario);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Esta consulta ya tiene una receta');
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { historial, obtener, crear, crearReceta };
