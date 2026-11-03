const POR_PAGINA = 20; // RNF-08: 20 registros por página

function offset(pagina) {
  return (pagina - 1) * POR_PAGINA;
}

function respuestaPaginada(datos, total, pagina) {
  return {
    datos,
    paginacion: {
      pagina,
      porPagina: POR_PAGINA,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    },
  };
}

// Escapa los comodines de LIKE para que el texto buscado se tome literal
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

module.exports = { POR_PAGINA, offset, respuestaPaginada, escaparLike };
