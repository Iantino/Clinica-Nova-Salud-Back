// Utilidades compartidas por las pruebas: iniciar sesión con un rol simulado
const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

// Hash de la contraseña "NovaSalud2026!"
const HASH = '$2b$10$dPPDmTcbJtVsc.jgJXDlMulaH1lKxGKWgu45e9yW0nySmhyoZPBmq';

const IDS = { administrador: 1, recepcionista: 2, medico: 4, paciente: 9 };

// Devuelve un agente de supertest con la sesión iniciada para ese rol
async function agenteCon(rol) {
  const agente = request.agent(app);
  pool.query.mockResolvedValueOnce([
    [
      {
        id: IDS[rol],
        nombre: 'Prueba',
        apellido: rol,
        correo: `${rol}@novasalud.com`,
        password_hash: HASH,
        activo: 1,
        intentos_fallidos: 0,
        bloqueado: 0,
        rol,
      },
    ],
  ]);
  await agente
    .post('/api/auth/login')
    .send({ correo: `${rol}@novasalud.com`, password: 'NovaSalud2026!' })
    .expect(200);
  return agente;
}

module.exports = { agenteCon, app };
