process.env.SESSION_SECRET = 'secreto-de-prueba';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { requireAuth, requireRol } = require('../src/middlewares/auth.middleware');

// App mínima para probar el middleware de forma aislada
function crearApp(usuarioEnSesion) {
  const app = express();
  app.use(session({ secret: 'x', resave: false, saveUninitialized: true }));
  app.use((req, res, next) => {
    if (usuarioEnSesion) req.session.usuario = usuarioEnSesion;
    next();
  });
  app.get('/privado', requireAuth, (req, res) => res.json({ id: req.usuario.id }));
  app.get('/expedientes', requireRol('medico'), (req, res) => res.json({ ok: true }));
  app.get('/gestion', requireRol('administrador', 'recepcionista'), (req, res) => res.json({ ok: true }));
  return app;
}

describe('HU-06 middleware de sesión y roles', () => {
  it('responde 401 sin sesión', async () => {
    await request(crearApp(null)).get('/privado').expect(401);
    await request(crearApp(null)).get('/expedientes').expect(401);
  });

  it('deja pasar a un usuario con sesión y expone req.usuario', async () => {
    const res = await request(crearApp({ id: 7, rol: 'recepcionista' })).get('/privado');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(7);
  });

  it('responde 403 si una recepcionista llama al endpoint de expedientes', async () => {
    const res = await request(crearApp({ id: 2, rol: 'recepcionista' })).get('/expedientes');
    expect(res.status).toBe(403);
  });

  it('acepta cualquiera de los roles permitidos', async () => {
    await request(crearApp({ id: 1, rol: 'administrador' })).get('/gestion').expect(200);
    await request(crearApp({ id: 2, rol: 'recepcionista' })).get('/gestion').expect(200);
    await request(crearApp({ id: 4, rol: 'medico' })).get('/gestion').expect(403);
  });
});
