const { zipSync, strToU8 } = require('fflate');

const ENCABEZADOS = ['Fecha', 'Hora', 'Paciente', 'Médico', 'Especialidad', 'Estado', 'Motivo', 'Motivo de cancelación'];
const CAMPOS = ['fecha', 'hora', 'paciente', 'medico', 'especialidad', 'estado', 'motivo', 'motivo_cancelacion'];

function valor(valorCelda) {
  return String(valorCelda ?? '');
}

function csv(filas) {
  const escapar = (dato) => {
    let texto = valor(dato);
    // Evita que valores de usuario se interpreten como fórmulas al abrir el CSV en Excel.
    if (/^[\t\r\n ]*[=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${[ENCABEZADOS, ...filas.map((fila) => CAMPOS.map((campo) => fila[campo]))]
    .map((fila) => fila.map(escapar).join(',')).join('\r\n')}`;
}

function xml(texto) {
  return valor(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function columna(indice) {
  let n = indice + 1;
  let nombre = '';
  while (n > 0) {
    const residuo = (n - 1) % 26;
    nombre = String.fromCharCode(65 + residuo) + nombre;
    n = Math.floor((n - 1) / 26);
  }
  return nombre;
}

function xlsx(filas) {
  const datos = [ENCABEZADOS, ...filas.map((fila) => CAMPOS.map((campo) => fila[campo]))];
  const filasXml = datos.map((fila, indiceFila) => {
    const celdas = fila.map((dato, indiceColumna) =>
      `<c r="${columna(indiceColumna)}${indiceFila + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(dato)}</t></is></c>`
    ).join('');
    return `<row r="${indiceFila + 1}">${celdas}</row>`;
  }).join('');
  const archivos = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Citas" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filasXml}</sheetData></worksheet>`),
  };
  return Buffer.from(zipSync(archivos));
}

module.exports = { csv, xlsx };
