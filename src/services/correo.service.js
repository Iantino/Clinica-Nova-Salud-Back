const nodemailer = require('nodemailer');

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
    auth: {
      user: process.env.SMTP_USER,
      // Gmail separa la contraseña de aplicación en grupos; Nodemailer la recibe sin espacios.
      pass: process.env.SMTP_PASSWORD.replace(/\s+/g, ''),
    },
  });
}

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caracter]);
}

async function enviarCorreoRestablecimiento({ correo, nombre, url }) {
  if (!correoConfigurado()) throw new Error('SMTP no está configurado');
  const nombreSeguro = escaparHtml(nombre || '');
  const urlSegura = escaparHtml(url);
  return crearTransportador().sendMail({
    from: `Clínica NovaSalud <${process.env.SMTP_FROM}>`,
    to: correo,
    subject: 'Restablece tu contraseña de NovaSalud',
    text: [
      `Hola ${nombre || ''},`,
      '',
      'Recibimos una solicitud para cambiar la contraseña de tu cuenta.',
      'Abre este enlace para elegir una nueva contraseña (vence en 30 minutos):',
      url,
      '',
      'Si no solicitaste el cambio, puedes ignorar este correo.',
      '',
      'Clínica NovaSalud',
    ].join('\n'),
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f1f8f5;font-family:Arial,sans-serif;color:#17221d;padding:32px 16px"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dcebe2;border-radius:18px;padding:32px"><p style="color:#08715e;font-weight:bold;letter-spacing:.12em;font-size:12px">CLÍNICA NOVASALUD</p><h1 style="font-size:24px">Restablece tu contraseña</h1><p>Hola ${nombreSeguro}, recibimos una solicitud para cambiar la contraseña de tu cuenta.</p><p>El enlace es de un solo uso y vence en 30 minutos.</p><p style="margin:28px 0"><a href="${urlSegura}" style="display:inline-block;background:#075344;color:white;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:bold">Crear nueva contraseña</a></p><p style="font-size:13px;color:#64748b">Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá vigente.</p></div></body></html>`,
  });
}

module.exports = { correoConfigurado, crearTransportador, enviarCorreoRestablecimiento };
