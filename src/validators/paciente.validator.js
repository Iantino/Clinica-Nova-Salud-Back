const { z } = require('zod');
const { opcional, idParams, pagina } = require('./comunes');

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Edad cumplida a la fecha de hoy
function calcularEdad(fechaTexto, hoy = new Date()) {
  const [anio, mes, dia] = fechaTexto.split('-').map(Number);
  let edad = hoy.getFullYear() - anio;
  const aunNoCumple =
    hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia);
  if (aunNoCumple) edad -= 1;
  return edad;
}

function fechaValida(texto) {
  if (!FECHA.test(texto)) return false;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
}

const fechaNacimiento = z
  .string({ message: 'La fecha de nacimiento es obligatoria' })
  .refine(fechaValida, 'Usa una fecha válida con el formato AAAA-MM-DD')
  .refine((t) => !fechaValida(t) || new Date(t) <= new Date(), 'La fecha no puede ser futura')
  .refine((t) => !fechaValida(t) || Number(t.slice(0, 4)) >= 1900, 'Revisa el año de nacimiento');

const texto = (campo, max) =>
  z
    .string({ message: `${campo} es obligatorio` })
    .trim()
    .min(2, `${campo} debe tener al menos 2 caracteres`)
    .max(max, `${campo} admite máximo ${max} caracteres`);

const pacienteSchema = z
  .object({
    dpi: opcional(z.string().trim().regex(/^\d{13}$/, 'El DPI debe tener 13 dígitos')),
    nombre: texto('El nombre', 80),
    apellido: texto('El apellido', 80),
    fecha_nacimiento: fechaNacimiento,
    sexo: z.enum(['F', 'M'], { message: 'Elige femenino o masculino' }),
    telefono: z
      .string({ message: 'El teléfono es obligatorio' })
      .trim()
      .regex(/^\d{8}$/, 'El teléfono debe tener 8 dígitos'),
    correo: opcional(z.string().trim().toLowerCase().max(120).email('El correo no es válido')),
    direccion: opcional(z.string().trim().max(255, 'Máximo 255 caracteres')),
    nombre_encargado: opcional(z.string().trim().max(160, 'Máximo 160 caracteres')),
    alergias: opcional(z.string().trim().max(2000, 'Máximo 2000 caracteres')),
    antecedentes: opcional(z.string().trim().max(2000, 'Máximo 2000 caracteres')),
  })
  .superRefine((datos, ctx) => {
    if (!fechaValida(datos.fecha_nacimiento)) return;
    const edad = calcularEdad(datos.fecha_nacimiento);

    // Los mayores de edad se identifican con DPI; los menores, con su encargado
    if (edad >= 18 && !datos.dpi) {
      ctx.addIssue({ code: 'custom', path: ['dpi'], message: 'El DPI es obligatorio para mayores de edad' });
    }
    if (edad < 18 && !datos.nombre_encargado) {
      ctx.addIssue({
        code: 'custom',
        path: ['nombre_encargado'],
        message: 'Indica el nombre del encargado del menor',
      });
    }
  });

const registroPacienteSchema = pacienteSchema.and(z.object({
  correo: z.string().trim().toLowerCase().max(120).email('El correo no es válido'),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña admite máximo 72 caracteres')
    .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
    .regex(/\d/, 'La contraseña debe incluir al menos un número'),
}));

const listarPacientesSchema = z.object({
  buscar: z.string().trim().max(100).optional(),
  pagina,
});

module.exports = { pacienteSchema, registroPacienteSchema, listarPacientesSchema, idParams, calcularEdad };
