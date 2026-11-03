// Valida datos de la petición con un esquema de Zod antes de llegar al controlador (RNF-06).
// origen: 'body' (por defecto), 'query' o 'params'.
// En Express 5 req.query no se puede reemplazar, así que los datos validados
// de query y params se guardan en req.validado.
function validate(schema, origen = 'body') {
  return (req, res, next) => {
    const resultado = schema.safeParse(req[origen] ?? {});

    if (!resultado.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errores: resultado.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
    }

    if (origen === 'body') {
      req.body = resultado.data;
    } else {
      req.validado = { ...req.validado, [origen]: resultado.data };
    }
    next();
  };
}

module.exports = validate;
