"use client";

import { Download, Eye, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  buildPrintPayload,
  type EstadoMesaExport,
  type ExportFormato,
  type ExportFuente,
  type ExportSalida,
  type ExportTurno,
} from "@/lib/planificacion-export";
import { exportPlanificacionExcel } from "@/lib/planificacion-excel";
import { exportPlanificacionPdf } from "@/lib/planificacion-pdf";
import { cn } from "@/lib/utils";
import type {
  CapacidadTurno,
  DayKey,
  MesaTrabajo,
  SlotKey,
} from "@/types/planificacion-mesa";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Días visibles en pantalla (yyyy-MM-dd). */
  visibleDayKeys: DayKey[];
  weekMondayKey: DayKey;
  /** Datos reales cargados de BD. */
  realBySlot: Record<SlotKey, MesaTrabajo[]>;
  /** Draft de simulación (null si simulación off). */
  draftBySlot: Record<SlotKey, MesaTrabajo[]> | null;
  simulationOn: boolean;
  capacidades: CapacidadTurno[];
  maquinaId: string;
  maquinaNombre: string;
  defaultCapacidad?: number;
  userEmail: string | null;
  trabajoByOt?: Record<string, string>;
}

// ─── Helper visual ─────────────────────────────────────────────────────────

function OptionButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "border-[#002147] bg-[#002147] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── Cuerpo del dialog (con estado propio) ──────────────────────────────────

function ExportDialogBody({
  visibleDayKeys,
  weekMondayKey,
  realBySlot,
  draftBySlot,
  simulationOn,
  capacidades,
  maquinaId,
  maquinaNombre,
  defaultCapacidad = 8,
  userEmail,
  trabajoByOt,
  onClose,
}: Omit<ExportDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [formato, setFormato] = useState<ExportFormato>("diario");
  const [salida, setSalida] = useState<ExportSalida>("pdf");
  const [turno, setTurno] = useState<ExportTurno>("ambos");
  const [fuente, setFuente] = useState<ExportFuente>("oficial");
  const [estadosIncluidos, setEstadosIncluidos] = useState<EstadoMesaExport[]>([
    "confirmado",
    "en_ejecucion",
    "finalizada",
  ]);
  const [selectedDay, setSelectedDay] = useState<DayKey>(
    () => visibleDayKeys[0] ?? weekMondayKey,
  );
  const [generating, setGenerating] = useState(false);

  const dayKey = formato === "diario" ? selectedDay : null;

  const previewPayload = useMemo(
    () =>
      buildPrintPayload({
        fuente,
        estadosIncluidos,
        formato,
        turno,
        dayKey,
        weekMondayKey,
        visibleDayKeys,
        realBySlot,
        draftBySlot,
        simulationOn,
        capacidades,
        maquinaId,
        maquinaNombre,
        generadoPor: userEmail ?? "usuario",
        trabajoByOt,
        defaultCapacidad,
      }),
    [
      fuente,
      estadosIncluidos,
      formato,
      turno,
      dayKey,
      weekMondayKey,
      visibleDayKeys,
      realBySlot,
      draftBySlot,
      simulationOn,
      capacidades,
      maquinaId,
      maquinaNombre,
      userEmail,
      trabajoByOt,
      defaultCapacidad,
    ],
  );

  const totalRows = useMemo(
    () => previewPayload.blocks.reduce((acc, b) => acc + b.rows.length, 0),
    [previewPayload],
  );

  const handleGenerate = useCallback(
    async (preview = false) => {
      if (generating) return;

      const payload = buildPrintPayload({
        fuente,
        estadosIncluidos,
        formato,
        turno,
        dayKey,
        weekMondayKey,
        visibleDayKeys,
        realBySlot,
        draftBySlot,
        simulationOn,
        capacidades,
        maquinaId,
        maquinaNombre,
        generadoPor: userEmail ?? "usuario",
        trabajoByOt,
        defaultCapacidad,
      });

      const hasData = payload.blocks.some((b) => b.rows.length > 0);
      if (!hasData) {
        toast.warning("No hay trabajos para los filtros seleccionados. Nada que exportar.");
        return;
      }

      setGenerating(true);
      try {
        if (salida === "excel") {
          exportPlanificacionExcel(payload);
          toast.success("Excel descargado correctamente.");
          onClose();
          return;
        }

        if (preview) {
          // Vista previa: generamos en objeto URL temporal
          toast.info("Vista previa: la descarga en PDF se abrirá en una pestaña nueva (requiere soporte de jsPDF inline).");
        }

        exportPlanificacionPdf(payload);
        toast.success("PDF descargado correctamente.");
        onClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al generar el archivo.";
        console.error("[Export] Error generando archivo", e);
        toast.error(msg);
      } finally {
        setGenerating(false);
      }
    },
    [
      generating, fuente, formato, turno, dayKey, weekMondayKey, visibleDayKeys,
      estadosIncluidos,
      realBySlot, draftBySlot, simulationOn, capacidades, maquinaId,
      maquinaNombre, userEmail, defaultCapacidad, salida, onClose,
      trabajoByOt,
    ],
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-[#002147]">
          <Printer className="size-5" />
          Imprimir / Exportar
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 px-1 py-2">
        {/* Máquina info */}
        <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-800">Máquina:</span>
          {maquinaNombre}
          <span className="ml-2 font-medium text-slate-800">Semana:</span>
          {weekMondayKey}
        </div>

        {/* Formato */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Formato</Label>
          <div className="flex gap-2">
            <OptionButton active={formato === "diario"} onClick={() => setFormato("diario")}>
              <FileText className="mb-0.5 mr-1 inline size-3.5" />
              Hoja diaria operativa
            </OptionButton>
            <OptionButton active={formato === "semanal"} onClick={() => setFormato("semanal")}>
              <FileSpreadsheet className="mb-0.5 mr-1 inline size-3.5" />
              Resumen semanal
            </OptionButton>
          </div>
        </div>

        {/* Salida */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Salida</Label>
          <div className="flex gap-2">
            <OptionButton active={salida === "pdf"} onClick={() => setSalida("pdf")}>
              PDF
            </OptionButton>
            <OptionButton active={salida === "excel"} onClick={() => setSalida("excel")}>
              Excel
            </OptionButton>
          </div>
        </div>

        {/* Rango (solo en diario) */}
        {formato === "diario" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Día</Label>
            <div className="flex flex-wrap gap-1.5">
              {visibleDayKeys.map((d) => {
                const day = new Date(d + "T12:00:00");
                const label = day.toLocaleDateString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                  month: "numeric",
                });
                return (
                  <OptionButton
                    key={d}
                    active={selectedDay === d}
                    onClick={() => setSelectedDay(d)}
                    className="flex-none"
                  >
                    {label}
                  </OptionButton>
                );
              })}
            </div>
          </div>
        )}

        {/* Turno */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Turno</Label>
          <div className="flex gap-2">
            <OptionButton active={turno === "ambos"} onClick={() => setTurno("ambos")}>
              Ambos
            </OptionButton>
            <OptionButton active={turno === "manana"} onClick={() => setTurno("manana")}>
              Mañana
            </OptionButton>
            <OptionButton active={turno === "tarde"} onClick={() => setTurno("tarde")}>
              Tarde
            </OptionButton>
          </div>
        </div>

        {/* Fuente */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Fuente de datos</Label>
          <div className="flex gap-2">
            <OptionButton active={fuente === "oficial"} onClick={() => setFuente("oficial")}>
              Plan oficial
            </OptionButton>
            <OptionButton active={fuente === "borrador"} onClick={() => setFuente("borrador")}>
              Borrador
            </OptionButton>
            <OptionButton
              active={fuente === "visible_actual"}
              onClick={() => setFuente("visible_actual")}
            >
              Visible ahora
            </OptionButton>
          </div>
          <p className="text-[10px] text-slate-500">
            {fuente === "oficial"
              ? "Usa confirmados/en_ejecución/finalizadas. Si no hay, usa borrador como fallback."
              : fuente === "borrador"
                ? "Solo trabajos en estado borrador."
                : simulationOn
                  ? "Incluye los cambios del modo simulación activo."
                  : "Vista sin simulación: igual que plan oficial."}
          </p>
        </div>

        {/* Estados */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold text-slate-700">Estados a incluir</Label>
            <div className="flex gap-1.5 text-[10px]">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-50"
                onClick={() => setEstadosIncluidos(["confirmado", "en_ejecucion"])}
              >
                Operativo
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-50"
                onClick={() => setEstadosIncluidos(["confirmado", "en_ejecucion", "finalizada"])}
              >
                Completo
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-slate-50"
                onClick={() => setEstadosIncluidos(["borrador", "confirmado", "en_ejecucion", "finalizada"])}
              >
                Todos
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "borrador", label: "Borrador" },
              { key: "confirmado", label: "Confirmada" },
              { key: "en_ejecucion", label: "En ejecución" },
              { key: "finalizada", label: "Finalizada" },
            ].map((it) => {
              const key = it.key as EstadoMesaExport;
              const active = estadosIncluidos.includes(key);
              return (
                <OptionButton
                  key={it.key}
                  active={active}
                  onClick={() =>
                    setEstadosIncluidos((prev) =>
                      active
                        ? prev.filter((x) => x !== key)
                        : [...prev, key],
                    )
                  }
                  className="flex-none"
                >
                  {it.label}
                </OptionButton>
              );
            })}
          </div>
          {estadosIncluidos.length === 0 ? (
            <p className="text-[10px] text-amber-700">
              Selecciona al menos un estado para poder exportar.
            </p>
          ) : null}
        </div>

        {/* Resumen */}
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            totalRows === 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {totalRows === 0
            ? "Sin trabajos para los filtros actuales. Ajusta el rango, turno o fuente."
            : `${totalRows} trabajo${totalRows > 1 ? "s" : ""} incluido${totalRows > 1 ? "s" : ""}.`}
        </div>

        {/* Simulación activa aviso */}
        {simulationOn && fuente !== "visible_actual" && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Modo simulación activo. Para incluir los cambios de simulación, selecciona
            fuente <strong>Visible ahora</strong>.
          </p>
        )}
      </div>

      {/* Botones */}
      <div className="flex justify-between gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={generating}
        >
          Cancelar
        </Button>
        <div className="flex gap-2">
          {salida === "pdf" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={generating || totalRows === 0}
              onClick={() => void handleGenerate(true)}
            >
              <Eye className="mr-1 size-4" />
              Vista previa
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#001735]"
            disabled={generating || totalRows === 0}
            onClick={() => void handleGenerate(false)}
          >
            {generating ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Download className="mr-1 size-4" />
            )}
            Descargar {salida === "pdf" ? "PDF" : "Excel"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Componente exportado ───────────────────────────────────────────────────

export function ExportDialog({
  open,
  onOpenChange,
  ...rest
}: ExportDialogProps) {
  const bodyKey = `${open ? "open" : "closed"}::${rest.maquinaId}::${rest.weekMondayKey}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <ExportDialogBody
            key={bodyKey}
            {...rest}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
