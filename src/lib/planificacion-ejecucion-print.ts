import type { MesaEjecucion } from "@/types/planificacion-mesa";

type PrintFilters = {
  maquina: string;
  estado: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function fmtHours(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1).replace(/\.0$/, "")}h`;
}

function estadoLabel(value: string): string {
  if (value === "en_curso") return "En curso";
  if (value === "pausada") return "Pausada";
  if (value === "finalizada") return "Finalizada";
  if (value === "cancelada") return "Cancelada";
  return value;
}

export function printParteEjecuciones(
  rows: MesaEjecucion[],
  filters: PrintFilters,
): void {
  const generatedAt = new Date();
  const title = `Parte operativo OTs en ejecución - ${new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(generatedAt)}`;

  const totalPlan = rows.reduce(
    (acc, r) => acc + (r.horasPlanificadasSnapshot ?? 0),
    0,
  );
  const totalReal = rows.reduce((acc, r) => acc + (r.horasReales ?? 0), 0);
  const desviacion = totalReal - totalPlan;

  const htmlRows = rows
    .map((r) => {
      const dev =
        r.horasReales != null && r.horasPlanificadasSnapshot != null
          ? r.horasReales - r.horasPlanificadasSnapshot
          : null;
      return `<tr>
        <td>${escapeHtml(r.ot)}</td>
        <td>${escapeHtml(r.maquinaNombre)}</td>
        <td>${escapeHtml(r.fechaPlanificada ?? "-")} / ${escapeHtml(r.turno ?? "-")}</td>
        <td>${escapeHtml(estadoLabel(r.estadoEjecucion))}</td>
        <td>${escapeHtml(fmtDate(r.inicioRealAt))}</td>
        <td>${escapeHtml(fmtDate(r.finRealAt))}</td>
        <td class="num">${escapeHtml(fmtHours(r.horasPlanificadasSnapshot))}</td>
        <td class="num">${escapeHtml(fmtHours(r.horasReales))}</td>
        <td class="num ${dev != null && dev > 0 ? "bad" : "ok"}">${escapeHtml(dev == null ? "-" : fmtHours(dev))}</td>
        <td>${escapeHtml(r.maquinista ?? "-")}</td>
        <td>${escapeHtml(r.incidencia ?? "-")}</td>
        <td>${escapeHtml(r.accionCorrectiva ?? "-")}</td>
        <td>${escapeHtml(r.observaciones ?? "-")}</td>
      </tr>`;
    })
    .join("");

  const doc = `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; color: #0f172a; }
        h1 { margin: 0 0 4px; color: #002147; font-size: 18px; }
        .meta { color: #475569; font-size: 11px; margin-bottom: 10px; }
        .summary { display: flex; gap: 10px; margin-bottom: 10px; font-size: 11px; }
        .summary span { border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th, td { border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; }
        th { background: #eef2f7; color: #002147; text-align: left; }
        .num { text-align: right; white-space: nowrap; }
        .bad { color: #b91c1c; font-weight: 700; }
        .ok { color: #047857; font-weight: 700; }
        footer { margin-top: 8px; color: #64748b; font-size: 9px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Filtros: máquina ${escapeHtml(filters.maquina)} · estado ${escapeHtml(filters.estado)} · registros ${rows.length}</div>
      <div class="summary">
        <span>Horas planificadas: <strong>${escapeHtml(fmtHours(totalPlan))}</strong></span>
        <span>Horas reales: <strong>${escapeHtml(fmtHours(totalReal))}</strong></span>
        <span>Desviación: <strong>${escapeHtml(fmtHours(desviacion))}</strong></span>
      </div>
      <table>
        <thead>
          <tr>
            <th>OT</th><th>Máquina</th><th>Fecha/Turno</th><th>Estado</th>
            <th>Inicio</th><th>Fin</th><th>Plan</th><th>Real</th><th>Desv.</th>
            <th>Maquinista</th><th>Incidencia</th><th>Acción correctiva</th><th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${htmlRows || `<tr><td colspan="13">Sin registros para los filtros actuales.</td></tr>`}</tbody>
      </table>
      <footer>Minerva AI Hub · Parte operativo generado automáticamente.</footer>
      <script>window.addEventListener("load", () => { window.print(); });</script>
    </body>
  </html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!w) throw new Error("El navegador bloqueó la ventana de impresión.");
  w.document.open();
  w.document.write(doc);
  w.document.close();
}
