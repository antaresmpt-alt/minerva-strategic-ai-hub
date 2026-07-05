import {
  tituloFromRefLote,
  truncateCartelaTitulo,
} from "@/lib/cartela-print-trigger";
import type { ProdStockPaletConOts } from "@/types/prod-stock";

export type CartelaPrintJob = {
  palet: ProdStockPaletConOts;
  copies?: number;
  proveedorNombre?: string | null;
  otTitulos?: Record<string, string>;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveOtTitulo(
  ot: string,
  otTitulos: Record<string, string> | undefined,
  refLote: string | null
): string | null {
  const fromMeta = otTitulos?.[ot]?.trim();
  if (fromMeta) return fromMeta;
  return tituloFromRefLote(refLote, ot);
}

function renderCartelaBoxHtml(
  palet: ProdStockPaletConOts,
  proveedorNombre: string | null | undefined,
  otTitulos: Record<string, string> | undefined
): string {
  const reservasDuras = (palet.otsReservas ?? []).filter(
    (r) => r.cantidad_reservada != null && r.cantidad_reservada > 0
  );
  const reservadaTotal = reservasDuras.reduce(
    (acc, r) => acc + (r.cantidad_reservada ?? 0),
    0
  );
  const hayReservaDura = reservasDuras.length > 0;
  const libreCalc = Math.max(palet.cantidad_actual - reservadaTotal, 0);
  const refLoteDisplay = palet.ref_lote ?? palet.ref_lote_proveedor ?? null;

  const mostrarDesgloseAtp =
    hayReservaDura &&
    !(
      palet.ots.length === 1 &&
      reservasDuras.length === 1 &&
      reservasDuras[0]!.cantidad_reservada === palet.cantidad_actual &&
      libreCalc === 0
    ) &&
    !(libreCalc === 0 && reservasDuras.length <= 1 && palet.ots.length <= 1);

  const fecha = new Date(palet.created_at).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hora = new Date(palet.created_at).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const idStockFormatted = palet.id_stock.toLocaleString("es-ES");
  const materialLine = [
    palet.material_nombre ?? palet.descripcion_material ?? "—",
    palet.gramaje ? `${palet.gramaje} gr` : "",
    palet.formato ? ` · ${palet.formato}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const badges: string[] = [];
  if (palet.es_fsc) badges.push('<span class="badge">FSC</span>');
  if (palet.es_pefc) badges.push('<span class="badge">PEFC</span>');
  if (palet.ubicacion_fila) {
    badges.push(
      `<span class="badge badge-right">${escapeHtml(palet.ubicacion_fila)}</span>`
    );
  }

  let otBlock: string;
  if (palet.ots.length === 0) {
    otBlock = '<div><span class="lbl">OT: </span>(stock libre)</div>';
  } else {
    const lines = palet.ots
      .map((ot) => {
        const titulo = resolveOtTitulo(ot, otTitulos, palet.ref_lote);
        const tituloHtml = titulo
          ? `<span class="ot-titulo">${escapeHtml(truncateCartelaTitulo(titulo))}</span>`
          : "";
        return `<div class="ot-line"><span class="lbl">OT: </span><span class="ot-num">${escapeHtml(ot)}</span>${tituloHtml}</div>`;
      })
      .join("");
    otBlock = `<div class="ot-list">${lines}</div>`;
  }

  let atpBlock = "";
  if (mostrarDesgloseAtp) {
    const rows = reservasDuras
      .map(
        (r) =>
          `<div>→ <strong>${(r.cantidad_reservada ?? 0).toLocaleString("es-ES")}</strong> reservadas · OT ${escapeHtml(r.ot_numero)}</div>`
      )
      .join("");
    const libreRow =
      libreCalc > 0
        ? `<div>→ <strong>${libreCalc.toLocaleString("es-ES")}</strong> libres</div>`
        : "";
    atpBlock = `<div class="atp">${rows}${libreRow}</div>`;
  }

  const refLoteBlock = refLoteDisplay
    ? `<div class="section ref-lote">
        <div class="section-lbl">Ref. Lote</div>
        <div class="section-val">${escapeHtml(refLoteDisplay)}</div>
        ${
          palet.ref_lote_proveedor && palet.ref_lote
            ? `<div class="muted">Lote prov.: ${escapeHtml(palet.ref_lote_proveedor)}</div>`
            : ""
        }
      </div>`
    : "";

  const codigoBlock = palet.codigo_articulo
    ? `<div class="codigo">Cód. Artículo: ${escapeHtml(palet.codigo_articulo)}</div>`
    : "";

  const proveedorBlock = proveedorNombre
    ? `<div><span class="lbl">Proveedor: </span>${escapeHtml(proveedorNombre)}</div>`
    : "";

  const notaBlock = palet.nota_entrega
    ? `<div><span class="lbl">Nota Entrega: </span>${escapeHtml(palet.nota_entrega)}</div>`
    : "";

  return `<div class="cartela-box">
    <div class="id-block">
      <div class="id-stock">${escapeHtml(idStockFormatted)}</div>
      ${codigoBlock}
    </div>
    <div class="section material">
      <div class="material-line">${escapeHtml(materialLine)}</div>
      ${palet.marca ? `<div class="marca">${escapeHtml(palet.marca)}</div>` : ""}
      ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
    </div>
    <div class="section qty">
      <div class="qty-ini">inicial: ${palet.cantidad_inicial.toLocaleString("es-ES")} h</div>
      <div class="qty-now">${palet.cantidad_actual.toLocaleString("es-ES")}<span class="qty-u"> h</span></div>
    </div>
    <div class="section ot">${otBlock}${atpBlock}</div>
    ${refLoteBlock}
    <div class="footer">
      <div>${proveedorBlock}${notaBlock}</div>
      <div class="fecha"><span class="lbl">Recibido: </span>${escapeHtml(fecha)} ${escapeHtml(hora)}</div>
    </div>
  </div>`;
}

const CARTELA_PRINT_CSS = `
  @page { size: 148mm 105mm landscape; margin: 5mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .cartela-box {
    width: 148mm;
    height: 100mm;
    border: 2px solid #000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    page-break-after: always;
    break-inside: avoid;
    background: #fff;
  }
  .cartela-box:last-child { page-break-after: avoid; }
  .id-block {
    text-align: center;
    padding: 10px 8px 8px;
    border-bottom: 2px solid #000;
  }
  .id-stock {
    font-size: 3.25rem;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.05em;
  }
  .codigo { font-size: 11px; color: #555; margin-top: 4px; }
  .section { padding: 6px 10px; border-bottom: 1px solid #000; }
  .material-line { font-size: 14px; font-weight: 700; line-height: 1.2; }
  .marca { font-size: 12px; color: #444; margin-top: 2px; }
  .badges { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
  .badge {
    font-size: 10px; border: 1px solid #000; padding: 0 4px; font-weight: 700;
  }
  .badge-right { margin-left: auto; }
  .qty {
    display: flex; align-items: baseline; justify-content: space-between;
  }
  .qty-ini { font-size: 11px; color: #666; }
  .qty-now { font-size: 1.75rem; font-weight: 900; }
  .qty-u { font-size: 12px; font-weight: 400; }
  .lbl { font-weight: 700; font-size: 10px; text-transform: uppercase; }
  .ot { font-size: 13px; }
  .ot-list { display: flex; flex-direction: column; gap: 2px; }
  .ot-line { line-height: 1.25; }
  .ot-num { font-weight: 600; }
  .ot-titulo { font-size: 10px; color: #444; margin-left: 6px; font-weight: 400; }
  .atp { margin-top: 4px; font-size: 11px; }
  .section-lbl {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.04em; color: #666;
  }
  .section-val { font-size: 13px; font-weight: 600; margin-top: 2px; line-height: 1.25; }
  .muted { font-size: 10px; color: #666; margin-top: 3px; }
  .footer {
    margin-top: auto;
    display: flex; justify-content: space-between; align-items: flex-end;
    padding: 6px 10px; font-size: 11px;
  }
  .fecha { text-align: right; }
`;

function buildCartelasDocument(jobs: CartelaPrintJob[]): string {
  const boxes: string[] = [];
  for (const job of jobs) {
    const copies = job.copies ?? 2;
    for (let i = 0; i < copies; i++) {
      boxes.push(
        renderCartelaBoxHtml(job.palet, job.proveedorNombre, job.otTitulos)
      );
    }
  }

  const title =
    jobs.length === 1
      ? `Cartela-${jobs[0]!.palet.id_stock}`
      : "Cartelas-material";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${CARTELA_PRINT_CSS}</style>
</head>
<body>
  ${boxes.join("\n")}
  <script>
    window.addEventListener("load", function () {
      window.focus();
      window.print();
    });
    window.addEventListener("afterprint", function () {
      window.close();
    });
  </script>
</body>
</html>`;
}

const PLACEHOLDER_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cartela</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      color: #334155;
    }
  </style>
</head>
<body><p>Preparando cartela…</p></body>
</html>`;

/**
 * Abre ventana de impresión en el mismo tick del clic (antes de awaits).
 * No usar `noopener`: en Chrome hace que window.open devuelva null.
 */
export function openCartelaPrintWindow(title: string): Window | null {
  const w = window.open("", "_blank", "width=820,height=640");
  if (!w) return null;
  w.document.open();
  w.document.write(PLACEHOLDER_HTML.replace("<title>Cartela</title>", `<title>${escapeHtml(title)}</title>`));
  w.document.close();
  return w;
}

export function writeCartelasToWindow(
  target: Window,
  jobs: CartelaPrintJob[]
): void {
  if (!jobs.length) return;
  target.document.open();
  target.document.write(buildCartelasDocument(jobs));
  target.document.close();
}

/** Imprime vía iframe oculto (fallback si el popup está bloqueado). */
function printCartelasViaIframe(jobs: CartelaPrintJob[]): boolean {
  if (!jobs.length || typeof document === "undefined") return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Impresión cartela");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return false;
  }

  win.document.open();
  win.document.write(buildCartelasDocument(jobs));
  win.document.close();

  const cleanup = () => iframe.remove();
  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, 120_000);

  return true;
}

/** Imprime cartelas en ventana aislada (sin estilos de la app). */
export function printCartelasWindow(jobs: CartelaPrintJob[]): boolean {
  if (!jobs.length) return false;

  const title =
    jobs.length === 1
      ? `Cartela-${jobs[0]!.palet.id_stock}`
      : "Cartelas-material";

  const w = openCartelaPrintWindow(title);
  if (!w) return printCartelasViaIframe(jobs);

  writeCartelasToWindow(w, jobs);
  return true;
}
