process.env.SESSION_SECRET = 'secreto-de-prueba';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const pool = require('../src/config/db');
const { agenteCon } = require('./helpers');
const { calcularEdad } = require('../src/validators/paciente.validator');

const adulto = {
  dpi: '2456789010101',
  nombre: 'María',
  apellido: 'Gómez',
  fecha_nacimiento: '1985-04-12',
  sexo: 'F',
  telefono: '44441001',
  correo: '',
  direccion: 'Zona 1, Mazatenango',
};

beforeEach(() => pool.query.mockReset());

describe('HU-08 registro y edición de pacientes', () => {
  it('rechaza un DPI repetido e indica el paciente existente', async () => {
    const recepcion = await agenteCon('recepcionista');
    pool.query.mockResolvedValueOnce([[{ id: 1, nombre: 'María', apellido: 'Gómez' }]]);

    const res = await recepcion.post('/api/pacientes').send(adulto);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/María Gómez/);
    expect(res.body.datos.pacienteExistente.id).toBe(1);
  });

  it('registra un paciente y guarda los campos vacíos como null', async () => {
    const recepcion = await agenteCon('recepcionista');
    pool.query
      .mockResolvedValueOnce([[]]) // DPI libre
      .mockResolvedValueOnce([{ insertId: 4 }])
      .mockResolvedValueOnce([[{ id: 4, ...adulto, correo: null }]]);

    const res = await recepcion.post('/api/pacientes').send(adulto);

    expect(res.status).toBe(201);
    const params = pool.query.mock.calls.find(([sql]) => sql.includes('INSERT'))[1];
    expect(params[6]).toBeNull(); // correo
  });

  it('exige DPI a los adultos y encargado a los menores', async () => {
    const recepcion = await agenteCon('recepcionista');

    const sinDpi = await recepcion.post('/api/pacientes').send({ ...adulto, dpi: '' });
    expect(sinDpi.body.errores).toEqual([
      { campo: 'dpi', mensaje: 'El DPI es obligatorio para mayores de edad' },
    ]);

    const menor = await recepcion
      .post('/api/pacientes')
      .send({ ...adulto, dpi: '', fecha_nacimiento: '2019-08-20' });
    expect(menor.body.errores[0].campo).toBe('nombre_encargado');
  });

  it('valida formato de DPI, teléfono y fechas', async () => {
    const recepcion = await agenteCon('recepcionista');

    const res = await recepcion
      .post('/api/pacientes')
      .send({ ...adulto, dpi: '123', telefono: '12', fecha_nacimiento: '2026-02-30' });

    expect(res.status).toBe(400);
    const campos = res.body.errores.map((e) => e.campo);
    expect(campos).toEqual(expect.arrayContaining(['dpi', 'telefono', 'fecha_nacimiento']));
  });

  it('el médico puede consultar pacientes pero no registrarlos', async () => {
    const medico = await agenteCon('medico');
    await medico.post('/api/pacientes').send(adulto).expect(403);
  });
});

describe('HU-09 búsqueda de pacientes', () => {
  it('busca por nombre, DPI o teléfono con 20 resultados por página', async () => {
    const medico = await agenteCon('medico');
    pool.query.mockResolvedValueOnce([[{ total: 45 }]]).mockResolvedValueOnce([[]]);

    const res = await medico.get('/api/pacientes?buscar=gom&pagina=3');

    expect(res.status).toBe(200);
    expect(res.body.paginacion).toEqual({ pagina: 3, porPagina: 20, total: 45, totalPaginas: 3 });
    const [sql, params] = pool.query.mock.calls.at(-1);
    expect(sql).toMatch(/dpi LIKE \?/);
    expect(params).toEqual(['%gom%', '%gom%', 'gom%', 'gom%', 20, 40]);
  });

  it('trata los comodines de búsqueda como texto', async () => {
    const recepcion = await agenteCon('recepcionista');
    pool.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);

    await recepcion.get('/api/pacientes?buscar=50%25').expect(200);

    expect(pool.query.mock.calls.at(-1)[1][0]).toBe('%50\\%%');
  });
});

describe('cálculo de edad', () => {
  it('considera si ya cumplió años', () => {
    const hoy = new Date(2026, 9, 15);
    expect(calcularEdad('2008-10-15', hoy)).toBe(18);
    expect(calcularEdad('2008-10-16', hoy)).toBe(17);
  });
});
