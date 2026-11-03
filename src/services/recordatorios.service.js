const nodemailer = require('nodemailer');
const pool = require('../config/db');

function correoConfigurado() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.SMTP_FROM
  );
}

function crearTransportador() {
  const port = Number(process.env.SMTP_PORT);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    ...(process.env.SMTP_USER ? {
      // Google muestra la contraseña de aplicación en grupos; Nodemailer recibe
      // el mismo secreto sin espacios.
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD.replace(/\s+/g, '') },
    } : {}),
  });
}

function fechaLegible(fecha, hora) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const local = new Date(Date.UTC(anio, mes - 1, dia, 12));
  return `${new Intl.DateTimeFormat('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(local)} a las ${hora.slice(0, 5)}`;
}

async function enviarRecordatorios() {
  if (!correoConfigurado()) return { enviados: 0, omitidos: true };
  const [citas] = await pool.query(
    `SELECT c.id, c.fecha, TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio,
            p.nombre AS paciente_nombre, p.correo,
            u.nombre AS medico_nombre, u.apellido AS medico_apellido, e.nombre AS especialidad
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
       JOIN medicos m ON m.id = c.medico_id
       JOIN usuarios u ON u.id = m.usuario_id
       JOIN especialidades e ON e.id = m.especialidad_id
      WHERE c.recordatorio_enviado = FALSE
        AND c.estado IN ('programada', 'confirmada')
        AND p.correo IS NOT NULL AND p.correo <> ''
        AND STR_TO_DATE(CONCAT(c.fecha, ' ', TIME_FORMAT(c.hora_inicio, '%H:%i:%s')), '%Y-%m-%d %H:%i:%s')
            BETWEEN DATE_SUB(DATE_ADD(UTC_TIMESTAMP() - INTERVAL 6 HOUR, INTERVAL 1 DAY), INTERVAL 5 MINUTE)
                AND DATE_ADD(DATE_ADD(UTC_TIMESTAMP() - INTERVAL 6 HOUR, INTERVAL 1 DAY), INTERVAL 5 MINUTE)
      ORDER BY c.fecha, c.hora_inicio
      LIMIT 50`
  );
  if (!citas.length) return { enviados: 0, omitidos: false };

  const transportador = crearTransportador();
  let enviados = 0;
  for (const cita of citas) {
    try {
      await transportador.sendMail({
        from: `Clínica NovaSalud <${process.env.SMTP_FROM}>`,
        to: cita.correo,
        subject: 'Recordatorio de tu cita en Clínica NovaSalud',
        text: [
          `Hola ${cita.paciente_nombre},`,
          '',
          `Te recordamos tu cita para ${fechaLegible(cita.fecha, cita.hora_inicio)}.`,
          `Profesional: Dr. ${cita.medico_nombre} ${cita.medico_apellido} (${cita.especialidad}).`,
          '',
          'Si necesitas cancelar o reprogramar, ingresa al portal de pacientes o comunícate con la clínica.',
          '',
          'Clínica NovaSalud',
        ].join('\n'),
      });
      await pool.query(
        `UPDATE citas SET recordatorio_enviado = TRUE
          WHERE id = ? AND recordatorio_enviado = FALSE AND fecha = ? AND hora_inicio = ?
            AND estado IN ('programada', 'confirmada')`,
        [cita.id, cita.fecha, `${cita.hora_inicio}:00`]
      );
      enviados += 1;
    } catch (error) {
      // No se escribe el correo ni otros datos personales en los logs.
      console.error(`No se pudo enviar el recordatorio de la cita ${cita.id}: ${error.code || 'error SMTP'}`);
    }
  }
  return { enviados, omitidos: false };
}

module.exports = { enviarRecordatorios, correoConfigurado };
