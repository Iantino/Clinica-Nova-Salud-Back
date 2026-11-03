process.env.SESSION_SECRET = 'secreto-de-prueba';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const pool = require('../src/config/db');
const { agenteCon } = require('./helpers');

const fila = (extra = {}) => ({
  id: 3,
  nombre: 'Andrés',
  apellido: 'López',
  correo: 'recepcion2@novasalud.com',
  rol: 'recepcionista',
  activo: 1,
  bloqueado: 0,
  creado_en: '2026-10-01 08:00:00',
  ...extra,
});

beforeEach(() => pool.query.mockReset());

describe('HU-05 gestión de usuarios', () => {
  it('solo el administrador puede entrar al módulo', async () => {
    const recepcion = await agenteCon('recepcionista');
    await recepcion.get('/api/usuarios').expect(403);
  });

  it('lista usuarios paginados sin exponer contraseñas', async () => {
    const admin = await agenteCon('administrador');
    pool.query.mockResolvedValueOnce([[{ total: 1 }]]).mockResolvedValueOnce([[fila()]]);

    const res = await admin.get('/api/usuarios?buscar=lóp&pagina=1');

    expect(res.status).toBe(200);
    expect(res.body.datos[0].activo).toBe(true);
    expect(res.body.datos[0].password_hash).toBeUndefined();
    expect(res.body.paginacion).toEqual({ pagina: 1, porPagina: 20, total: 1, totalPaginas: 1 });
  });

  it('valida los datos al crear un usuario', async () => {
    const admin = await agenteCon('administrador');

    const res = await admin
      .post('/api/usuarios')
      .send({ nombre: 'A', apellido: 'López', correo: 'malo', password: 'corta', rol: 'medico' });

    expect(res.status).toBe(400);
    const campos = res.body.errores.map((e) => e.campo);
    expect(campos).toEqual(expect.arrayContaining(['nombre', 'correo', 'password', 'rol']));
  });

  it('crea un usuario con la contraseña cifrada', async () => {
    const admin = await agenteCon('administrador');
    pool.query
      .mockResolvedValueOnce([[{ id: 2 }]]) // rol
      .mockResolvedValueOnce([{ insertId: 3 }]) // insert
      .mockResolvedValueOnce([[fila()]]); // obtener

    const res = await admin.post('/api/usuarios').send({
      nombre: 'Andrés',
      apellido: 'López',
      correo: 'Recepcion2@NovaSalud.com',
      password: 'Segura2026',
      rol: 'recepcionista',
    });

    expect(res.status).toBe(201);
    const params = pool.query.mock.calls.find(([sql]) => sql.includes('INSERT'))[1];
    expect(params[3]).toBe('recepcion2@novasalud.com');
    expect(params[4]).toMatch(/^\$2b\$/);
    expect(params[4]).not.toBe('Segura2026');
  });

  it('responde 409 si el correo ya existe', async () => {
    const admin = await agenteCon('administrador');
    pool.query
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));

    const res = await admin.post('/api/usuarios').send({
      nombre: 'Andrés',
      apellido: 'López',
      correo: 'admin@novasalud.com',
      password: 'Segura2026',
      rol: 'recepcionista',
    });

    expect(res.status).toBe(409);
  });

  it('no permite que el administrador se desactive a sí mismo', async () => {
    const admin = await agenteCon('administrador');

    const res = await admin.patch('/api/usuarios/1/estado').send({ activo: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/propia cuenta/);
  });

  it('desactiva a otro usuario', async () => {
    const admin = await agenteCon('administrador');
    pool.query
      .mockResolvedValueOnce([[fila()]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[fila({ activo: 0 })]]);

    const res = await admin.patch('/api/usuarios/3/estado').send({ activo: false });

    expect(res.status).toBe(200);
    expect(res.body.usuario.activo).toBe(false);
  });

  it('no cambia el rol de un médico desde este módulo', async () => {
    const admin = await agenteCon('administrador');
    pool.query.mockResolvedValueOnce([[fila({ id: 4, rol: 'medico' })]]);

    const res = await admin.put('/api/usuarios/4').send({
      nombre: 'Carlos',
      apellido: 'Méndez',
      correo: 'cmendez@novasalud.com',
      rol: 'recepcionista',
    });

    expect(res.status).toBe(400);
  });
});
