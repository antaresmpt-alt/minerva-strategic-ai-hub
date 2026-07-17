import * as XLSX from "xlsx";

export type CalendarioProduccionImportRow = {
  fecha: string;
  ot_numero: string;
  orden: number;
};

const MESES: Record<string, number> = {
  gener: 1,
  febrero: 2,
  febrer: 2,
  març: 3,
  marzo: 3,
  abril: 4,
  maig: 5,
  mayo: 5,
  juny: 6,
  junio: 6,
  juliol: 7,
  julio: 7,
  agost: 8,
  agosto: 8,
  setembre: 9,
  septiembre: 9,
  octubre: 10,
  novembre: 11,
  noviembre: 11,
  desembre: 12,
  diciembre: 12,
};

const OT_RE = /^(\d{4,6})[_\s\-]*(.*)$/;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYearFromSheet(rows: unknown[][]): number {
  for (const row of rows.slice(0, 5)) {
    for (const cell of row) {
      const s = String(cell ?? "");
      const m = s.match(/20\d{2}/);
      if (m) return Number(m[0]);
    }
  }
  return new Date().getFullYear();
}

function parseWeekStart(label: string, year: number): Date | null {
  const s = label.toLowerCase().replace(/'/g, " ");
  let mes: number | null = null;
  for (const [k, v] of Object.entries(MESES)) {
    if (s.includes(k)) {
      mes = v;
      break;
    }
  }
  const nums = [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (mes == null || nums.length === 0) return null;
  return new Date(year, mes - 1, nums[0], 12, 0, 0);
}

/**
 * Parsea la pestaña «planificador» del Excel de Jordi/Carlos
 * (columnas Lun–Sáb, bloques «setmana …»).
 */
export function parseProgramacioPlanificadorExcel(
  buffer: ArrayBuffer,
): CalendarioProduccionImportRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase() === "planificador") ??
    wb.SheetNames[0];
  if (!sheetName) return [];

  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];

  const year = parseYearFromSheet(rows);
  const out: CalendarioProduccionImportRow[] = [];
  const ordenByDay = new Map<string, number>();
  let weekStart: Date | null = null;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const colA = String(row[0] ?? "").trim();
    if (colA && /setmana/i.test(colA)) {
      weekStart = parseWeekStart(colA, year);
      // Sin continue: en la misma fila suelen ir OTs (cols Lun–Sáb).
    }
    if (!weekStart) continue;
    // header Dilluns… skip
    if (r <= 3 && /dilluns|lunes/i.test(String(row[1] ?? ""))) continue;

    for (let c = 1; c <= 6; c++) {
      const raw = String(row[c] ?? "").trim();
      if (!raw) continue;
      const m = OT_RE.exec(raw);
      if (!m) continue;
      const ot = m[1]!;
      const d = new Date(weekStart);
      d.setDate(d.getDate() + (c - 1));
      const fecha = ymd(d);
      const orden = ordenByDay.get(fecha) ?? 0;
      ordenByDay.set(fecha, orden + 1);
      out.push({ fecha, ot_numero: ot, orden });
    }
  }

  const seen = new Set<string>();
  const uniq: CalendarioProduccionImportRow[] = [];
  for (const e of out) {
    const key = `${e.fecha}::${e.ot_numero}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(e);
  }
  return uniq;
}
