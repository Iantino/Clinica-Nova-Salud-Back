process.env.SESSION_SECRET = 'secreto-de-prueba';

// Se simula la base de datos para probar sin MySQL
jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

// Hash de la contraseña "NovaSalud2026!"
const HASH = '$2b$10$dPPDmTcbJtVsc.jgJXDlMulaH1lKxGKWgu45e9yW0nySmhyoZPBmq';

const usuarioActivo = {
  id: 2,
  nombre: 'Lucía',
  apellido: 'Pérez',
  correo: 'recepcion1@novasalud.com',
  password_hash: HASH,
  activo: 1,
  rol: 'recepcionista',
};

beforeEach(() => {
  pool.query.mockReset();
});

describe('POST /api/auth/login', () => {
  it('inicia sesión con credenciales correctas y no devuelve la contraseña', async () => {
    pool.query.mockResolvedValue([[usuarioActivo]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'Recepcion1@NovaSalud.com', password: 'NovaSalud2026!' });

    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('recepcionista');
    expect(res.body.usuario.password_hash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/nova\.sid=.*HttpOnly/);
    // El correo se normaliza a minúsculas antes de consultar
    expect(pool.query.mock.calls[0][1]).toEqual(['recepcion1@novasalud.com']);
  });

  it('rechaza una contraseña incorrecta con mensaje genérico', async () => {
    pool.query.mockResolvedValue([[usuarioActivo]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'recepcion1@novasalud.com', password: 'otra' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Correo o contraseña incorrectos');
  });

  it('usa el mismo mensaje si el correo no existe', async () => {
    pool.query.mockResolvedValue([[]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'nadie@novasalud.com', password: 'NovaSalud2026!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Correo o contraseña incorrectos');
  });

  it('no deja entrar a un usuario desactivado', async () => {
    pool.query.mockResolvedValue([[{ ...usuarioActivo, activo: 0 }]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'recepcion1@novasalud.com', password: 'NovaSalud2026!' });

    expect(res.status).toBe(401);
  });

  it('valida el formato de los datos', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'no-es-correo', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.errores.length).toBe(2);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('sesión', () => {
  it('GET /me responde 401 sin sesión', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('mantiene la sesión y la cierra con logout', async () => {
    pool.query.mockResolvedValue([[usuarioActivo]]);
    const agente = request.agent(app);

    await agente
      .post('/api/auth/login')
      .send({ correo: 'recepcion1@novasalud.com', password: 'NovaSalud2026!' })
      .expect(200);

    const me = await agente.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.usuario.correo).toBe('recepcion1@novasalud.com');

    await agente.post('/api/auth/logout').expect(204);
    await agente.get('/api/auth/me').expect(401);
  });
});
