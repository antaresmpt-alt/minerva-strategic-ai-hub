import type { MesaEjecucion } from "@/types/planificacion-mesa";
import {
  buildEjecucionEfficiencyReport,
  formatMinutesDuration,
  type PauseDetail,
  type PausesByExecutionId,
} from "@/lib/planificacion-ejecucion-efficiency";

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

function pauseDetailRows(details: PauseDetail[]): string {
  return details
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.ot)}</td>
        <td>${escapeHtml(fmtDate(p.inicio))}</td>
        <td>${escapeHtml(fmtDate(p.fin))}</td>
        <td>${escapeHtml(p.motivo)}</td>
        <td>${escapeHtml(p.categoria)}</td>
        <td class="num">${escapeHtml(formatMinutesDuration(p.duracionMin))}</td>
        <td>${escapeHtml(p.observaciones ?? "-")}</td>
      </tr>`,
    )
    .join("");
}

function estadoLabel(value: string): string {
  if (value === "pendiente_inicio") return "Pendiente inicio";
  if (value === "en_curso") return "En curso";
  if (value === "pausada") return "Pausada";
  if (value === "finalizada") return "Finalizada";
  if (value === "cancelada") return "Cancelada";
  return value;
}

export function printParteEjecuciones(
  targetWindow: Window,
  rows: MesaEjecucion[],
  filters: PrintFilters,
  pausesByExecutionId: PausesByExecutionId = {},
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
  const efficiency = buildEjecucionEfficiencyReport(rows, pausesByExecutionId);
  const causeText = efficiency.causaPrincipal
    ? `${efficiency.causaPrincipal.categoria} · ${efficiency.causaPrincipal.motivo} (${formatMinutesDuration(efficiency.causaPrincipal.minutos)})`
    : "-";
  const pauseRows = pauseDetailRows(efficiency.pauseDetails);

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
        <td class="num">${escapeHtml(r.numPausas > 0 ? String(r.numPausas) : "-")}</td>
        <td class="num">${escapeHtml(r.minutosPausadaAcum > 0 ? `${r.minutosPausadaAcum} min` : "-")}</td>
        <td>${escapeHtml(fmtDate(r.pausaActivaDesde))}</td>
        <td>${escapeHtml(r.motivoPausaActiva ?? "-")}</td>
        <td>${escapeHtml(r.motivoPausaCategoriaActiva ?? "-")}</td>
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
        .efficiency { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; margin-bottom: 10px; background: #f8fafc; font-size: 11px; }
        .efficiency h2 { margin: 0 0 6px; color: #002147; font-size: 13px; }
        .eff-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .eff-cell { border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; background: #fff; }
        .eff-label { display: block; color: #64748b; font-size: 9px; text-transform: uppercase; }
        .eff-value { font-weight: 700; color: #0f172a; }
        .machine-badge { display: inline-block; border-radius: 999px; padding: 3px 8px; color: white; font-weight: 700; }
        h2.section { color: #002147; font-size: 13px; margin: 12px 0 6px; }
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
      <section class="efficiency">
        <h2>Resumen de eficiencia del periodo filtrado</h2>
        <div class="eff-grid">
          <div class="eff-cell"><span class="eff-label">Tiempo de marcha</span><span class="eff-value">${escapeHtml(formatMinutesDuration(efficiency.tiempoMarchaMin))}</span></div>
          <div class="eff-cell"><span class="eff-label">Tiempo de pausa</span><span class="eff-value">${escapeHtml(formatMinutesDuration(efficiency.tiempoPausaMin))}</span></div>
          <div class="eff-cell"><span class="eff-label">Causa principal</span><span class="eff-value">${escapeHtml(causeText)}</span></div>
          <div class="eff-cell"><span class="eff-label">Estado máquina</span><span class="machine-badge" style="background:${escapeHtml(efficiency.estadoMaquina.hex)}">${escapeHtml(efficiency.estadoMaquina.label)} · ${escapeHtml(`${efficiency.eficienciaPct}%`)}</span></div>
        </div>
      </section>
      <table>
        <thead>
          <tr>
            <th>OT</th><th>Máquina</th><th>Fecha/Turno</th><th>Estado</th>
            <th>Inicio</th><th>Fin</th><th>Plan</th><th>Real</th><th>Desv.</th><th>Nº pausas</th><th>Min pausa</th><th>Última pausa</th><th>Motivo pausa</th><th>Categoría pausa</th>
            <th>Maquinista</th><th>Incidencia</th><th>Acción correctiva</th><th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${htmlRows || `<tr><td colspan="18">Sin registros para los filtros actuales.</td></tr>`}</tbody>
      </table>
      <h2 class="section">Histórico Detallado de Pausas</h2>
      <table>
        <thead>
          <tr>
            <th>OT</th><th>Inicio</th><th>Fin</th><th>Motivo</th><th>Categoría</th><th>Duración</th><th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${pauseRows || `<tr><td colspan="7">Sin pausas para los filtros actuales.</td></tr>`}</tbody>
      </table>
      <footer>Minerva AI Hub · Parte operativo generado automáticamente.</footer>
      <script>window.addEventListener("load", () => { window.print(); });</script>
    </body>
  </html>`;

  targetWindow.document.open();
  targetWindow.document.write(doc);
  targetWindow.document.close();
}
