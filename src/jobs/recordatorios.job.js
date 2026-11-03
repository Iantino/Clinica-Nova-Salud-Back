const { enviarRecordatorios, correoConfigurado } = require('../services/recordatorios.service');

function iniciarRecordatorios() {
  if (!correoConfigurado()) {
    console.info('Recordatorios por correo desactivados: configura SMTP_HOST, SMTP_PORT y SMTP_FROM en .env');
    return null;
  }

  let ejecutando = false;
  const ejecutar = async () => {
    if (ejecutando) return;
    ejecutando = true;
    try {
      const resultado = await enviarRecordatorios();
      if (resultado.enviados) console.info(`Recordatorios enviados: ${resultado.enviados}`);
    } catch (error) {
      console.error(`No se pudo revisar la cola de recordatorios: ${error.code || 'error de base de datos'}`);
    } finally {
      ejecutando = false;
    }
  };

  void ejecutar();
  const timer = setInterval(ejecutar, 5 * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { iniciarRecordatorios };
