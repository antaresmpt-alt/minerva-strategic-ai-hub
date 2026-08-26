/**
 * Impresión del detalle del día — ventana nueva (no react-to-print en la misma
 * pestaña). Evita el bug Electron/webview: cerrar el diálogo de impresión
 * tumba toda la app Minerva.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarioAmbito } from "@/lib/calendario-produccion-ambito";
import { labelCalendarioAmbito } from "@/lib/calendario-produccion-ambito";
import type { DetalleDiaDraftSlot } from "@/lib/calendario-detalle-dia";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

export type DetalleDiaPrintOtMeta = {
  otNumero: string;
  cliente: string;
  trabajo: string;
  fechaEntrega: string | null;
  tintas: string;
  barniz: string;
  acabado: string;
  papel: string;
  hojasBrutas: number;
  horasPlanificadas: number;
  materialStatus: string;
  troquelStatus: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatHoras(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "0";
  if (Math.abs(h - Math.round(h)) < 0.05) return String(Math.round(h));
  return h.toFixed(1).replace(/\.0$/, "");
}

function formatHojas(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("es-ES").format(Math.round(n));
}

function pctClass(pct: number): string {
  if (pct >= 100) return "pct-over";
  if (pct >= 85) return "pct-warn";
  if (pct > 0) return "pct-ok";
  return "pct-empty";
}

/**
 * Abre HTML en ventana nueva, imprime ahí y cierra solo esa ventana.
 * Nunca llama print() sobre la ventana de la app.
 */
export function printHtmlInNewWindow(html: string, title: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = title;
    const run = () => {
      try {
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
    };
    w.addEventListener("afterprint", () => {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    });
    if (w.document.readyState === "complete") {
      window.setTimeout(run, 300);
    } else {
      w.addEventListener("load", () => window.setTimeout(run, 300));
    }
    return true;
  } catch {
    try {
      w.close();
    } catch {
      /* ignore */
    }
    return false;
  }
}

/** Clona un nodo React offscreen e imprime en ventana nueva (mesa diaria, etc.). */
export function printElementInNewWindow(
  el: HTMLElement,
  title: string,
  pageCssExtra = "",
): boolean {
  const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
    .map((n) => n.outerHTML)
    .join("\n");
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
${styles}
<style>
  html, body { background: #fff !important; }
  body { margin: 0; }
  .mesa-diaria-print-root,
  [class*="print-root"] {
    position: static !important;
    left: auto !important;
    top: auto !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    z-index: auto !important;
    max-width: none !important;
  }
  @page { size: A4 landscape; margin: 10mm; }
  ${pageCssExtra}
</style>
</head>
<body>${el.outerHTML}</body>
</html>`;
  return printHtmlInNewWindow(html, title);
}

export async function fetchDetalleDiaPrintMetaByOts(
  supabase: SupabaseClient,
  otNumeros: readonly string[],
): Promise<Map<string, DetalleDiaPrintOtMeta>> {
  const ots = [
    ...new Set(otNumeros.map((o) => String(o ?? "").trim()).filter(Boolean)),
  ];
  const out = new Map<string, DetalleDiaPrintOtMeta>();
  if (ots.length === 0) return out;

  const genRows = await fetchAllInChunks(ots, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("prod_ots_general")
      .select("num_pedido, cliente, titulo, fecha_entrega")
      .in("num_pedido", chunk);
    if (error) throw error;
    return data ?? [];
  });

  const despRows = await fetchAllInChunks(ots, 80, async (chunk) => {
    const { data, error } = await supabase
      .from("produccion_ot_despachadas")
      .select(
        "ot_numero, material, tintas, acabado_pral, troquel, num_hojas_brutas, horas_entrada, horas_tiraje",
      )
      .in("ot_numero", chunk);
    if (error) throw error;
    return data ?? [];
  });

  type Gen = {
    num_pedido?: string | number | null;
    cliente?: string | null;
    titulo?: string | null;
    fecha_entrega?: string | null;
  };
  type Desp = {
    ot_numero?: string | null;
    material?: string | null;
    tintas?: string | null;
    acabado_pral?: string | null;
    troquel?: string | null;
    num_hojas_brutas?: number | null;
    horas_entrada?: number | null;
    horas_tiraje?: number | null;
  };

  const genByOt = new Map<string, Gen>();
  for (const g of genRows as Gen[]) {
    const ot = String(g.num_pedido ?? "").trim();
    if (ot) genByOt.set(ot, g);
  }
  const despByOt = new Map<string, Desp>();
  for (const d of despRows as Desp[]) {
    const ot = String(d.ot_numero ?? "").trim();
    if (ot) despByOt.set(ot, d);
  }

  for (const ot of ots) {
    const g = genByOt.get(ot);
    const d = despByOt.get(ot);
    const he =
      typeof d?.horas_entrada === "number" ? d.horas_entrada : Number(d?.horas_entrada);
    const ht =
      typeof d?.horas_tiraje === "number" ? d.horas_tiraje : Number(d?.horas_tiraje);
    const horas =
      (Number.isFinite(he) ? he : 0) + (Number.isFinite(ht) ? ht : 0);
    const troquel = String(d?.troquel ?? "").trim();
    out.set(ot, {
      otNumero: ot,
      cliente: String(g?.cliente ?? "").trim() || "—",
      trabajo: String(g?.titulo ?? "").trim() || "—",
      fechaEntrega: g?.fecha_entrega ?? null,
      tintas: String(d?.tintas ?? "").trim() || "—",
      barniz: "",
      acabado: String(d?.acabado_pral ?? "").trim() || "—",
      papel: String(d?.material ?? "").trim() || "—",
      hojasBrutas:
        typeof d?.num_hojas_brutas === "number"
          ? d.num_hojas_brutas
          : Number(d?.num_hojas_brutas) || 0,
      horasPlanificadas: horas,
      materialStatus: "gris",
      troquelStatus: troquel ? "ok" : "sin_informar",
    });
  }
  return out;
}

export type BuildDetalleDiaPrintHtmlArgs = {
  dayYmd: string;
  dayLabel: string;
  ambito: CalendarioAmbito;
  maquinaNombre: string;
  draft: readonly DetalleDiaDraftSlot[];
  metaByOt: Map<string, DetalleDiaPrintOtMeta>;
  generadoPor?: string | null;
  /** Capacidad horas por turno (default 8). */
  capManana?: number;
  capTarde?: number;
};

export function buildDetalleDiaPrintHtml(args: BuildDetalleDiaPrintHtmlArgs): string {
  const capM = args.capManana ?? 8;
  const capT = args.capTarde ?? 8;
  const manana = args.draft
    .filter((d) => d.turno === "manana")
    .sort((a, b) => a.slotOrden - b.slotOrden);
  const tarde = args.draft
    .filter((d) => d.turno === "tarde")
    .sort((a, b) => a.slotOrden - b.slotOrden);

  const horasOf = (items: DetalleDiaDraftSlot[]) =>
    items.reduce((acc, it) => {
      const m = args.metaByOt.get(it.otNumero);
      return acc + (m?.horasPlanificadas ?? 0);
    }, 0);

  const hM = horasOf(manana);
  const hT = horasOf(tarde);
  const hTot = hM + hT;
  const capTot = capM + capT;
  const pctTot = capTot > 0 ? Math.round((hTot / capTot) * 100) : 0;
  const pctM = capM > 0 ? Math.round((hM / capM) * 100) : 0;
  const pctT = capT > 0 ? Math.round((hT / capT) * 100) : 0;

  const genAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const card = (it: DetalleDiaDraftSlot) => {
    const m = args.metaByOt.get(it.otNumero);
    const cliente = m?.cliente ?? "—";
    const trabajo = m?.trabajo ?? "—";
    const tintas = m?.tintas ?? "—";
    const barniz = m?.barniz ?? "";
    const acabado = m?.acabado ?? "—";
    const papel = m?.papel ?? "—";
    const hojas = m?.hojasBrutas ?? 0;
    const horas = m?.horasPlanificadas ?? 0;
    const mat = m?.materialStatus ?? "gris";
    const troq = m?.troquelStatus ?? "sin_informar";
    return `<article class="card">
      <div class="card-top">
        <div>
          <div class="ot">${escapeHtml(it.otNumero)}</div>
          <div class="cliente">${escapeHtml(cliente)}</div>
          <div class="trabajo">${escapeHtml(trabajo)}</div>
        </div>
        <span class="badge estado">#${escapeHtml(String(it.slotOrden))}</span>
      </div>
      <div class="pills">
        ${tintas && tintas !== "—" ? `<span class="pill">${escapeHtml(tintas)}</span>` : ""}
        ${barniz ? `<span class="pill">${escapeHtml(barniz)}</span>` : ""}
        ${acabado && acabado !== "—" && acabado.toLowerCase() !== barniz.toLowerCase() ? `<span class="pill">${escapeHtml(acabado)}</span>` : ""}
        ${mat && mat !== "gris" ? `<span class="pill mat-${escapeHtml(mat)}">M: ${escapeHtml(mat)}</span>` : ""}
        ${troq && troq !== "sin_informar" ? `<span class="pill troq">T: ${escapeHtml(troq)}</span>` : ""}
      </div>
      <div class="card-foot">
        <span>📄 ${escapeHtml(papel)}</span>
        <span class="num">${escapeHtml(formatHojas(hojas))} hj · ${escapeHtml(formatHoras(horas))}h</span>
      </div>
    </article>`;
  };

  const turnoBlock = (
    label: string,
    items: DetalleDiaDraftSlot[],
    horas: number,
    cap: number,
    pct: number,
  ) => `<section class="turno">
    <header class="turno-h">
      <span>${escapeHtml(label)}</span>
      <span class="pct ${pctClass(pct)}">${escapeHtml(formatHoras(horas))} / ${escapeHtml(formatHoras(cap))}h · ${pct}%</span>
    </header>
    ${
      items.length === 0
        ? `<p class="empty">Sin trabajos planificados.</p>`
        : `<div class="cards">${items.map(card).join("")}</div>`
    }
  </section>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Plan-${escapeHtml(args.ambito)}-${escapeHtml(args.dayYmd)}</title>
<style>
  :root { --navy:#002147; --gold:#C69C2B; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 12mm; font: 10pt/1.35 system-ui, Segoe UI, sans-serif; color: #0f172a; }
  header.top { display:flex; justify-content:space-between; gap:16px; border-bottom:2px solid var(--navy); padding-bottom:10px; margin-bottom:14px; }
  .brand { display:flex; gap:12px; align-items:flex-end; }
  .logo { width:48px; height:48px; background:var(--navy); color:var(--gold); font-weight:800; font-size:8pt; display:flex; align-items:center; justify-content:center; text-align:center; padding:4px; }
  .eyebrow { margin:0; color:var(--gold); font-size:9pt; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
  h1 { margin:2px 0; color:var(--navy); font-size:15pt; }
  .day { margin:0; text-transform:capitalize; color:#334155; font-size:9pt; }
  .meta { text-align:right; font-size:8.5pt; color:#475569; }
  .meta strong { color:var(--navy); }
  .machine { border:1px solid #94a3b8; border-radius:6px; padding:8px; }
  .machine-h { display:flex; justify-content:space-between; gap:8px; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:8px; }
  .machine-h h2 { margin:0; color:var(--navy); font-size:11pt; }
  .tipo { border:1px solid #7dd3fc; background:#f0f9ff; color:#075985; border-radius:999px; padding:1px 8px; font-size:7.5pt; font-weight:700; }
  .turno { margin-top:8px; }
  .turno-h { display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; border-radius:4px; padding:4px 8px; font-size:8pt; font-weight:700; color:var(--navy); text-transform:uppercase; letter-spacing:.03em; }
  .pct { border-radius:999px; border:1px solid; padding:1px 6px; font-size:7.5pt; font-variant-numeric: tabular-nums; }
  .pct-over { background:#fee2e2; color:#991b1b; border-color:#fca5a5; }
  .pct-warn { background:#fef3c7; color:#92400e; border-color:#fcd34d; }
  .pct-ok { background:#d1fae5; color:#065f46; border-color:#6ee7b7; }
  .pct-empty { background:#f1f5f9; color:#64748b; border-color:#cbd5e1; }
  .empty { margin:6px 0; padding:6px; border:1px dashed #cbd5e1; background:#f8fafc; color:#94a3b8; font-style:italic; font-size:8pt; }
  .cards { display:flex; flex-direction:column; gap:6px; margin-top:6px; }
  .card { border:1px solid #cbd5e1; border-radius:5px; padding:6px 8px; break-inside: avoid; }
  .card-top { display:flex; justify-content:space-between; gap:8px; }
  .ot { font-family: ui-monospace, Consolas, monospace; font-weight:800; color:#b91c1c; font-size:11pt; }
  .cliente { color:var(--navy); font-weight:600; font-size:9pt; }
  .trabajo { color:#475569; font-size:8pt; }
  .badge.estado { border:1px solid #bae6fd; background:#e0f2fe; color:#075985; border-radius:999px; padding:1px 6px; font-size:7.5pt; font-weight:700; height:fit-content; }
  .pills { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
  .pill { border:1px solid #cbd5e1; background:#f8fafc; border-radius:4px; padding:1px 5px; font-size:7.5pt; font-weight:600; color:#334155; }
  .pill.mat-verde { background:#d1fae5; color:#065f46; border-color:#6ee7b7; }
  .pill.mat-amarillo { background:#fef3c7; color:#92400e; border-color:#fcd34d; }
  .pill.mat-rojo { background:#fee2e2; color:#991b1b; border-color:#fca5a5; }
  .card-foot { display:flex; justify-content:space-between; gap:8px; margin-top:6px; font-size:7.5pt; color:#64748b; }
  .num { font-variant-numeric: tabular-nums; }
  footer { margin-top:14px; border-top:1px solid #e2e8f0; padding-top:6px; font-size:7.5pt; color:#64748b; }
  @page { size: A4 landscape; margin: 8mm; }
</style>
</head>
<body>
  <header class="top">
    <div class="brand">
      <div class="logo">MINERVA<br/>GLOBAL</div>
      <div>
        <p class="eyebrow">Plan diario de producción</p>
        <h1>${escapeHtml(labelCalendarioAmbito(args.ambito))}</h1>
        <p class="day">${escapeHtml(args.dayLabel)}</p>
      </div>
    </div>
    <div class="meta">
      <div><strong>Documento para reunión</strong></div>
      <div>1 máquina · ${manana.length + tarde.length} trabajos</div>
      <div>Carga total: ${escapeHtml(formatHoras(hTot))} / ${escapeHtml(formatHoras(capTot))}h
        <span class="pct ${pctClass(pctTot)}">${pctTot}%</span>
      </div>
      <div>Generado ${escapeHtml(genAt)}${args.generadoPor ? ` · ${escapeHtml(args.generadoPor)}` : ""}</div>
    </div>
  </header>

  <div class="machine">
    <div class="machine-h">
      <div>
        <h2>${escapeHtml(args.maquinaNombre)}</h2>
        <div class="num" style="font-size:8pt;color:#475569">${escapeHtml(formatHoras(hTot))} / ${escapeHtml(formatHoras(capTot))}h</div>
      </div>
      <div style="display:flex;gap:6px;align-items:flex-start">
        <span class="tipo">Offset</span>
        <span class="pct ${pctClass(pctTot)}">${pctTot}%</span>
      </div>
    </div>
    ${turnoBlock("Mañana", manana, hM, capM, pctM)}
    ${turnoBlock("Tarde", tarde, hT, capT, pctT)}
  </div>

  <footer>MINERVA Strategic AI Hub — Documento operativo interno. Detalle del día · ${escapeHtml(labelCalendarioAmbito(args.ambito))} · ${escapeHtml(args.dayYmd)}. No lanza ejecución.</footer>
</body>
</html>`;
}
