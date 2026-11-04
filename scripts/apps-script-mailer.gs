/**
 * Pasarela de correo para Railway usando el servicio MailApp de Google.
 * Guarda MAILER_SHARED_SECRET en Project Settings > Script properties y
 * despliega este proyecto como Web app ejecutada por el propietario.
 */
function doPost(e) {
  try {
    const input = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty('MAILER_SHARED_SECRET');

    if (!expectedSecret || input.token !== expectedSecret) {
      return jsonOutput({ ok: false, code: 'UNAUTHORIZED' });
    }

    if (
      typeof input.to !== 'string' || input.to.length > 254 ||
      typeof input.subject !== 'string' || !input.subject || input.subject.length > 180 ||
      typeof input.text !== 'string' || input.text.length > 20000 ||
      (input.html !== undefined && (typeof input.html !== 'string' || input.html.length > 50000))
    ) {
      return jsonOutput({ ok: false, code: 'BAD_REQUEST' });
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      return jsonOutput({ ok: false, code: 'MAIL_QUOTA_EXCEEDED' });
    }

    const message = {
      to: input.to,
      subject: input.subject,
      body: input.text,
      name: 'Clínica NovaSalud',
    };
    if (input.html) message.htmlBody = input.html;

    MailApp.sendEmail(message);
    return jsonOutput({ ok: true });
  } catch (error) {
    // No registrar el cuerpo: contiene la dirección del paciente y el enlace/token.
    console.error(`MAILER_SEND_FAILED: ${error && error.name ? error.name : 'Error'}`);
    return jsonOutput({ ok: false, code: 'SEND_FAILED' });
  }
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
