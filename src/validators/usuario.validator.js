const { z } = require('zod');
const { idParams, pagina, correo } = require('./comunes');

// Roles que se administran desde este módulo. Los médicos se crean
// en el módulo de médicos (HU-10) porque necesitan especialidad y colegiado.
const ROLES_GESTIONABLES = ['administrador', 'recepcionista'];

const texto = (campo, max) =>
  z
    .string({ message: `${campo} es obligatorio` })
    .trim()
    .min(2, `${campo} debe tener al menos 2 caracteres`)
    .max(max, `${campo} admite máximo ${max} caracteres`);

const password = z
  .string({ message: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña admite máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

const rol = z.enum(ROLES_GESTIONABLES, { message: 'Elige administrador o recepcionista' });

const crearUsuarioSchema = z.object({
  nombre: texto('El nombre', 80),
  apellido: texto('El apellido', 80),
  correo,
  password,
  rol,
});

const actualizarUsuarioSchema = z.object({
  nombre: texto('El nombre', 80),
  apellido: texto('El apellido', 80),
  correo,
  // Opcionales: si no se envían, no cambian
  rol: rol.optional(),
  password: password.optional(),
});

const estadoSchema = z.object({
  activo: z.boolean({ message: 'Indica si el usuario queda activo (true o false)' }),
});

const listarUsuariosSchema = z.object({
  buscar: z.string().trim().max(100).optional(),
  rol: z.enum(['administrador', 'recepcionista', 'medico', 'paciente']).optional(),
  pagina,
});

module.exports = {
  ROLES_GESTIONABLES,
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  estadoSchema,
  listarUsuariosSchema,
  idParams,
};
