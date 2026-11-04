const nodemailer = require('nodemailer');

function smtpConfigurado() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.SMTP_FROM
  );
}

function resendConfigurado() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

function appsScriptConfigurado() {
  return Boolean(process.env.GOOGLE_APPS_SCRIPT_URL && process.env.GOOGLE_APPS_SCRIPT_SECRET);
}

function correoConfigurado() {
  // Railway bloquea SMTP en los planes Free, Trial y Hobby. En producción se
  // requiere un proveedor HTTPS. Apps Script permite enviar desde Gmail sin dominio propio.
  return resendConfigurado() || appsScriptConfigurado() || (process.env.NODE_ENV !== 'production' && smtpConfigurado());
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

async function enviarPorResend({ to, subject, text, html }) {
  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!respuesta.ok) {
    const error = new Error('El proveedor de correo rechazó el mensaje');
    error.code = `RESEND_HTTP_${respuesta.status}`;
    throw error;
  }

  return respuesta.json();
}

async function enviarPorAppsScript({ to, subject, text, html }) {
  const respuesta = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: process.env.GOOGLE_APPS_SCRIPT_SECRET,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok || resultado.ok !== true) {
    const error = new Error('Google Apps Script no pudo enviar el mensaje');
    error.code = resultado.code || `APPS_SCRIPT_HTTP_${respuesta.status}`;
    throw error;
  }

  return resultado;
}

async function enviarCorreo({ to, subject, text, html }) {
  if (resendConfigurado()) {
    return enviarPorResend({ to, subject, text, html });
  }

  if (appsScriptConfigurado()) {
    return enviarPorAppsScript({ to, subject, text, html });
  }

  if (process.env.NODE_ENV === 'production') {
    const error = new Error('Configura Google Apps Script o Resend para el correo de producción');
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  if (!smtpConfigurado()) {
    const error = new Error('Configura Resend o SMTP para enviar correos');
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  const sender = process.env.SMTP_FROM.includes('<')
    ? process.env.SMTP_FROM
    : `Clínica NovaSalud <${process.env.SMTP_FROM}>`;

  return crearTransportador().sendMail({ from: sender, to, subject, text, html });
}

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caracter]);
}

async function enviarCorreoRestablecimiento({ correo, nombre, url }) {
  const nombreSeguro = escaparHtml(nombre || '');
  const urlSegura = escaparHtml(url);
  return enviarCorreo({
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

async function enviarCorreoContrasenaActualizada({ correo, nombre }) {
  const nombreSeguro = escaparHtml(nombre || '');
  return enviarCorreo({
    to: correo,
    subject: 'Tu contraseña se cambió correctamente | Clínica NovaSalud',
    text: [
      `Hola ${nombre || ''},`,
      '',
      'La contraseña de tu cuenta de Clínica NovaSalud se cambió correctamente.',
      'Si reconoces este cambio, no necesitas hacer nada más.',
      'Si no lo reconoces, ponte en contacto con la clínica para proteger tu cuenta.',
      '',
      'Por seguridad, nunca incluimos tu contraseña en este correo.',
      '',
      'Clínica NovaSalud',
    ].join('\n'),
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f1f8f5;font-family:Arial,sans-serif;color:#17221d;padding:32px 16px"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dcebe2;border-radius:18px;padding:32px"><p style="color:#08715e;font-weight:bold;letter-spacing:.12em;font-size:12px">CLÍNICA NOVASALUD</p><h1 style="font-size:24px">Contraseña actualizada</h1><p>Hola ${nombreSeguro},</p><p>La contraseña de tu cuenta se cambió correctamente.</p><p>Si reconoces este cambio, no necesitas hacer nada más. Si no lo reconoces, ponte en contacto con la clínica para proteger tu cuenta.</p><p style="font-size:13px;color:#64748b">Por seguridad, nunca incluimos tu contraseña en este correo.</p></div></body></html>`,
  });
}

module.exports = {
  appsScriptConfigurado,
  correoConfigurado,
  crearTransportador,
  enviarCorreo,
  enviarCorreoContrasenaActualizada,
  enviarCorreoRestablecimiento,
};
