process.env.SESSION_SECRET = 'secreto-de-prueba';

const request = require('supertest');
const app = require('../src/app');

describe('GET /api/health', () => {
  it('responde que la API está funcionando', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('responde 404 en una ruta inexistente', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
  });
});
