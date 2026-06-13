import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const SOURCE_DIR =
  "C:\\Users\\USUARIO\\Downloads\\ETIQUETAS\\TROQUELES\\TROQUELES\\TROQUELES ETIQUETAS";
const OUTPUT_PATH =
  "C:\\Users\\USUARIO\\Downloads\\ETIQUETAS\\TROQUELES\\TROQUELES\\troqueles-etiquetas-MAESTRO.xlsx";

const SHAPE_PATTERNS = [
  { forma: "redondo", patterns: [/REDONDO/i] },
  { forma: "ovalado", patterns: [/OVALADO/i] },
  { forma: "triangulo", patterns: [/TRI[ÁA]NGULO/i] },
  { forma: "hexagonal", patterns: [/HEXAGONAL/i] },
];

function cleanSpaces(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDecimal(raw) {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function boolEs(value) {
  return value ? "Sí" : "No";
}

function normalizeCodigo(raw) {
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return "";
  return String(n).padStart(4, "0");
}

function detectDocumentType(name) {
  const upper = name.toUpperCase();
  if (upper.includes("PROD")) return "prod";
  if (upper.includes("PRESENTACION") || upper.includes("PRESENTACIÓN")) {
    return "presentacion";
  }
  if (upper.includes("MOCKUP")) return "mockup";
  if (upper.includes("LINK")) return "link";
  if (upper.includes("NUEVO")) return "nuevo";
  return "base";
}

function listDocuments(folderPath) {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => !entry.name.startsWith("."))
    .filter((entry) => /\.(pdf|tif|tiff|jpg|jpeg|png)$/i.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(folderPath, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        nombre: entry.name,
        tipo: detectDocumentType(entry.name),
        extension: path.extname(entry.name).replace(".", "").toLowerCase(),
        bytes: stat.size,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
}

function parseDimensions(text, forma) {
  const normalized = text.replace(/×/g, "x");
  const pair = normalized.match(
    /(\d+(?:[,.]\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:[,.]\d+)?)\s*(?:mm)?/i
  );
  if (pair) {
    return {
      ancho_mm: normalizeDecimal(pair[1]),
      alto_mm: normalizeDecimal(pair[2]),
      diametro_mm: null,
      dimensiones_texto: cleanSpaces(pair[0]),
    };
  }

  const single = normalized.match(/(\d+(?:[,.]\d+)?)\s*mm/i);
  if (single && forma === "redondo") {
    const diametro = normalizeDecimal(single[1]);
    return {
      ancho_mm: diametro,
      alto_mm: null,
      diametro_mm: diametro,
      dimensiones_texto: cleanSpaces(single[0]),
    };
  }

  if (single) {
    return {
      ancho_mm: normalizeDecimal(single[1]),
      alto_mm: null,
      diametro_mm: null,
      dimensiones_texto: cleanSpaces(single[0]),
    };
  }

  return {
    ancho_mm: null,
    alto_mm: null,
    diametro_mm: null,
    dimensiones_texto: "",
  };
}

function parseFolderName(folderName, folderPath) {
  const match = folderName.match(/^TROQ\s*(\d+)\s*\.?\s*(.*)$/i);
  const codigo = match ? normalizeCodigo(match[1]) : "";
  const rawTail = match ? match[2] : folderName;
  const upper = folderName.toUpperCase();

  const estado = /\bVACIO\b/i.test(folderName) ? "vacio" : "activo";
  const especial = /\bESPECIAL\b/i.test(folderName);
  const multiple = /\b(DOBLE|MULTIPLE|M[ÚU]LTIPLE)\b/i.test(folderName);
  const conHendido = /CON\s+HENDIDO/i.test(folderName);
  const necesitaRevision = /[?\uF028\uF029]/.test(folderName);

  let forma = "";
  for (const shape of SHAPE_PATTERNS) {
    if (shape.patterns.some((pattern) => pattern.test(folderName))) {
      forma = shape.forma;
      break;
    }
  }
  if (!forma && multiple) forma = "multiple";
  if (!forma && especial) forma = "especial";
  if (!forma && estado === "vacio") forma = "desconocida";

  const preliminaryDimensions = parseDimensions(rawTail, forma || "rectangular");
  if (!forma && preliminaryDimensions.ancho_mm != null && preliminaryDimensions.alto_mm != null) {
    forma = "rectangular";
  }
  if (!forma && preliminaryDimensions.ancho_mm != null && preliminaryDimensions.alto_mm == null) {
    forma = "desconocida";
  }
  if (!forma) forma = "desconocida";

  const dimensions = parseDimensions(rawTail, forma);
  const documentos = listDocuments(folderPath);
  const documentosTipos = [...new Set(documentos.map((doc) => doc.tipo))].join(" | ");

  const notes = [];
  if (especial) notes.push("ESPECIAL");
  if (multiple) notes.push("MULTIPLE/DOBLE");
  if (conHendido) notes.push("CON HENDIDO");
  if (necesitaRevision) notes.push("REVISAR (?)");
  if (estado === "vacio") notes.push("VACIO");
  if (!dimensions.dimensiones_texto && estado !== "vacio") {
    notes.push("SIN DIMENSIONES PARSEADAS");
  }

  return {
    codigo,
    carpeta_original: folderName,
    estado,
    forma,
    ancho_mm: dimensions.ancho_mm,
    alto_mm: dimensions.alto_mm,
    diametro_mm: dimensions.diametro_mm,
    dimensiones_texto: dimensions.dimensiones_texto,
    especial: boolEs(especial),
    multiple: boolEs(multiple),
    con_hendido: boolEs(conHendido),
    necesita_revision: boolEs(necesitaRevision || (!dimensions.dimensiones_texto && estado !== "vacio")),
    notas: notes.join(" | "),
    carpeta_path: folderPath,
    documentos: documentosTipos,
    documentos_detalle: JSON.stringify(documentos),
    nombre_normalizado: `${codigo}${dimensions.dimensiones_texto ? ` · ${dimensions.dimensiones_texto}` : ""}${forma ? ` · ${forma}` : ""}`,
    _sort: Number(codigo || "0"),
    _upper: upper,
  };
}

function countBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key] || "(vacío)";
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "es", { numeric: true }))
    .map(([value, count]) => ({ valor: value, total: count }));
}

function worksheetFromRows(rows) {
  const publicRows = rows.map((row) => {
    const publicRow = { ...row };
    delete publicRow._sort;
    delete publicRow._upper;
    return publicRow;
  });
  return XLSX.utils.json_to_sheet(publicRows);
}

function setColumnWidths(ws, widths) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`No existe la carpeta origen: ${SOURCE_DIR}`);
  }

  const folders = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  const rows = folders
    .map((folderName) =>
      parseFolderName(folderName, path.join(SOURCE_DIR, folderName))
    )
    .sort((a, b) => a._sort - b._sort || a.carpeta_original.localeCompare(b.carpeta_original));

  const resumenRows = [
    { seccion: "Totales", valor: "Carpetas origen", total: folders.length },
    { seccion: "Totales", valor: "Filas Excel", total: rows.length },
    { seccion: "Totales", valor: "Necesitan revisión", total: rows.filter((r) => r.necesita_revision === "Sí").length },
    { seccion: "Totales", valor: "Sin dimensiones", total: rows.filter((r) => !r.dimensiones_texto && r.estado !== "vacio").length },
    { seccion: "Totales", valor: "Vacíos", total: rows.filter((r) => r.estado === "vacio").length },
    {},
    ...countBy(rows, "forma").map((row) => ({ seccion: "Por forma", ...row })),
    {},
    ...countBy(rows, "estado").map((row) => ({ seccion: "Por estado", ...row })),
  ];

  const revisarRows = rows
    .filter((r) => r.necesita_revision === "Sí" || !r.dimensiones_texto || r.estado === "vacio")
    .map(({ codigo, carpeta_original, estado, forma, dimensiones_texto, notas }) => ({
      codigo,
      carpeta_original,
      estado,
      forma,
      dimensiones_texto,
      notas,
    }));

  const wb = XLSX.utils.book_new();
  const wsTroqueles = worksheetFromRows(rows);
  setColumnWidths(wsTroqueles, [
    10, 55, 12, 14, 12, 12, 12, 22, 10, 10, 12, 16, 32, 90, 24, 120, 36,
  ]);
  wsTroqueles["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows, {
    header: ["seccion", "valor", "total"],
  });
  setColumnWidths(wsResumen, [22, 38, 12]);

  const wsRevision = XLSX.utils.json_to_sheet(revisarRows);
  setColumnWidths(wsRevision, [10, 55, 12, 14, 22, 42]);
  wsRevision["!freeze"] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, wsTroqueles, "Troqueles");
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsRevision, "Revision");
  XLSX.writeFile(wb, OUTPUT_PATH, { compression: true });

  const summary = {
    output: OUTPUT_PATH,
    total: rows.length,
    revision: rows.filter((r) => r.necesita_revision === "Sí").length,
    sinDimensiones: rows.filter((r) => !r.dimensiones_texto && r.estado !== "vacio").length,
    vacios: rows.filter((r) => r.estado === "vacio").length,
    porForma: countBy(rows, "forma"),
    dudosos: rows
      .filter((r) => r.necesita_revision === "Sí")
      .map((r) => `${r.codigo} · ${r.carpeta_original}`),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
