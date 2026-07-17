"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildSemanasLaboralesMes,
  entradasPorDia,
  fechaDiaLabel,
  filtrarEntradasPorTexto,
  mesAnioLabel,
  monthRangeYmd,
  numColumnasCalendario,
  splitLineasDosColumnas,
  type CalendarioProduccionLinea,
} from "@/lib/calendario-produccion";
import {
  exportCalendarioProduccionDiaPdf,
  exportCalendarioProduccionMensualPdf,
} from "@/lib/calendario-produccion-export";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  CalendarioProduccionOtDetalle,
  ProdCalendarioProduccionOtRow,
} from "@/types/prod-calendario-produccion-ot";

const TABLE = "prod_calendario_produccion_ot";
const TABLE_MAESTRO = "prod_ots_general";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";

const MIGRATION_HINT =
  "Ejecuta la migración 20260717140000_prod_calendario_produccion_ot.sql en Supabase.";

const STORAGE_SHOW_SATURDAY = "cal-prod-show-saturday";

function isMissingTable(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes("prod_calendario_produccion_ot");
}

type OtSearchHit = {
  num_pedido: string;
  cliente: string | null;
  titulo: string | null;
  cantidad: number | null;
};

function DiaCelda({
  dayNum,
  lineas,
  onEditDay,
  onOpenOt,
}: {
  dayNum: number;
  lineas: CalendarioProduccionLinea[];
  onEditDay: () => void;
  onOpenOt: (otNumero: string) => void;
}) {
  const { left, right } = splitLineasDosColumnas(lineas);
  const dosColumnas = right.length > 0;

  const renderList = (list: CalendarioProduccionLinea[]) =>
    list.map((l) => (
      <button
        key={l.id}
        type="button"
        className="w-full break-words text-left text-[11px] font-medium leading-tight text-[#002147] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#002147]/40"
        title={`${l.label} — ver detalle`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenOt(l.otNumero);
        }}
      >
        {l.label}
      </button>
    ));

  return (
    <div className="group relative flex min-h-[9rem] flex-col border border-slate-200/90 bg-white">
      <div className="flex shrink-0 items-center justify-between bg-[#002147] px-2 py-1">
        <button
          type="button"
          className="rounded px-1 text-[10px] font-medium text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-white/10"
          onClick={onEditDay}
          title="Añadir / editar OTs del día"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          className="shrink-0 text-sm font-bold tabular-nums text-white hover:underline"
          onClick={onEditDay}
          title="Editar día"
        >
          {dayNum}
        </button>
      </div>
      {lineas.length === 0 ? (
        <button
          type="button"
          className="min-h-[2rem] flex-1 p-1.5 text-left text-[10px] text-slate-400 hover:bg-slate-50"
          onClick={onEditDay}
        >
          + OT
        </button>
      ) : dosColumnas ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-1.5 overflow-y-auto p-1.5">
          <div className="space-y-0.5">{renderList(left)}</div>
          <div className="space-y-0.5">{renderList(right)}</div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {renderList(lineas)}
        </div>
      )}
    </div>
  );
}

function DetalleField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{value}</dd>
    </div>
  );
}

export function CalendarioProduccionPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [showSaturday, setShowSaturday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProdCalendarioProduccionOtRow[]>([]);
  const [tituloByOt, setTituloByOt] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const [filtro, setFiltro] = useState("");
  const [saving, setSaving] = useState(false);

  const [dayOpen, setDayOpen] = useState(false);
  const [dayYmd, setDayYmd] = useState<string | null>(null);
  const [otQuery, setOtQuery] = useState("");
  const [otHits, setOtHits] = useState<OtSearchHit[]>([]);
  const [searchingOt, setSearchingOt] = useState(false);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalle, setDetalle] = useState<CalendarioProduccionOtDetalle | null>(
    null,
  );

  useEffect(() => {
    try {
      setShowSaturday(localStorage.getItem(STORAGE_SHOW_SATURDAY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const semanas = useMemo(
    () => buildSemanasLaboralesMes(year, monthIndex, { includeSaturday: showSaturday }),
    [year, monthIndex, showSaturday],
  );
  const cols = numColumnasCalendario(showSaturday);
  const range = useMemo(
    () => monthRangeYmd(year, monthIndex),
    [year, monthIndex],
  );

  const entradasByDay = useMemo(() => {
    const all = entradasPorDia(rows, tituloByOt);
    return filtrarEntradasPorTexto(all, filtro);
  }, [rows, tituloByOt, filtro]);

  const dayLineas = useMemo(() => {
    if (!dayYmd) return [];
    return entradasByDay.get(dayYmd) ?? [];
  }, [dayYmd, entradasByDay]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, fecha, ot_numero, orden, notas, created_by, created_at, updated_at")
        .gte("fecha", range.start)
        .lte("fecha", range.end)
        .order("fecha", { ascending: true })
        .order("orden", { ascending: true });

      if (error) {
        if (isMissingTable(error.message)) {
          toast.error(MIGRATION_HINT);
          setRows([]);
          return;
        }
        throw error;
      }

      const list = (data ?? []) as ProdCalendarioProduccionOtRow[];
      setRows(list);

      const ots = [
        ...new Set(list.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean)),
      ];
      if (ots.length === 0) {
        setTituloByOt(new Map());
        return;
      }

      const { data: maestros, error: mErr } = await supabase
        .from(TABLE_MAESTRO)
        .select("num_pedido, titulo")
        .in("num_pedido", ots);
      if (mErr) throw mErr;

      const map = new Map<string, string | null>();
      for (const m of maestros ?? []) {
        const n = String((m as { num_pedido?: string }).num_pedido ?? "").trim();
        if (n) map.set(n, (m as { titulo?: string | null }).titulo ?? null);
      }
      setTituloByOt(map);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo cargar el calendario."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, range.start, range.end]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, monthIndex + delta, 1);
    setYear(d.getFullYear());
    setMonthIndex(d.getMonth());
  };

  const openDay = (ymd: string) => {
    setDayYmd(ymd);
    setOtQuery("");
    setOtHits([]);
    setDayOpen(true);
  };

  const searchOts = useCallback(
    async (q: string) => {
      const needle = q.trim().replace(/[%_,]/g, " ").trim();
      if (needle.length < 2) {
        setOtHits([]);
        return;
      }
      setSearchingOt(true);
      try {
        const { data, error } = await supabase
          .from(TABLE_MAESTRO)
          .select("num_pedido, cliente, titulo, cantidad")
          .or(
            `num_pedido.ilike.%${needle}%,titulo.ilike.%${needle}%,cliente.ilike.%${needle}%`,
          )
          .order("num_pedido", { ascending: false })
          .limit(12);
        if (error) throw error;
        setOtHits(
          ((data ?? []) as OtSearchHit[]).filter((h) =>
            String(h.num_pedido ?? "").trim(),
          ),
        );
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo buscar la OT."));
        setOtHits([]);
      } finally {
        setSearchingOt(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (!dayOpen) return;
    const t = window.setTimeout(() => void searchOts(otQuery), 280);
    return () => window.clearTimeout(t);
  }, [otQuery, dayOpen, searchOts]);

  const addOtToDay = async (hit: OtSearchHit) => {
    if (!dayYmd) return;
    const ot = String(hit.num_pedido ?? "").trim();
    if (!ot) return;
    setSaving(true);
    try {
      const existing = rows.filter((r) => r.fecha.slice(0, 10) === dayYmd);
      const nextOrden =
        existing.length === 0
          ? 0
          : Math.max(...existing.map((r) => r.orden)) + 1;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from(TABLE).insert({
        fecha: dayYmd,
        ot_numero: ot,
        orden: nextOrden,
        created_by: user?.id ?? null,
      });
      if (error) {
        if (error.code === "23505") {
          toast.message(`La OT ${ot} ya está en este día.`);
          return;
        }
        throw error;
      }

      setTituloByOt((prev) => {
        const next = new Map(prev);
        next.set(ot, hit.titulo ?? null);
        return next;
      });
      toast.success(`OT ${ot} añadida.`);
      setOtQuery("");
      setOtHits([]);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo añadir la OT."));
    } finally {
      setSaving(false);
    }
  };

  const removeEntrada = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      toast.success("OT quitada del día.");
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo quitar la OT."));
    } finally {
      setSaving(false);
    }
  };

  const openDetalle = async (otNumero: string) => {
    setDetalleOpen(true);
    setDetalle(null);
    setDetalleLoading(true);
    try {
      const ot = otNumero.trim();
      const [{ data: maestro, error: mErr }, { data: despacho, error: dErr }] =
        await Promise.all([
          supabase
            .from(TABLE_MAESTRO)
            .select(
              "num_pedido, cliente, titulo, cantidad, fecha_entrega, despachado",
            )
            .eq("num_pedido", ot)
            .maybeSingle(),
          supabase
            .from(TABLE_DESPACHADAS)
            .select(
              "material, gramaje, tamano_hoja, tintas, acabado_pral, troquel, poses, num_hojas_brutas, num_hojas_netas",
            )
            .eq("ot_numero", ot)
            .maybeSingle(),
        ]);
      if (mErr) throw mErr;
      if (dErr) throw dErr;

      const m = maestro as {
        cliente?: string | null;
        titulo?: string | null;
        cantidad?: number | null;
        fecha_entrega?: string | null;
        despachado?: boolean | null;
      } | null;
      const d = despacho as {
        material?: string | null;
        gramaje?: number | null;
        tamano_hoja?: string | null;
        tintas?: string | null;
        acabado_pral?: string | null;
        troquel?: string | null;
        poses?: number | null;
        num_hojas_brutas?: number | null;
        num_hojas_netas?: number | null;
      } | null;

      setDetalle({
        otNumero: ot,
        cliente: m?.cliente ?? null,
        trabajo: m?.titulo ?? null,
        cantidad: m?.cantidad ?? null,
        fechaEntrega: m?.fecha_entrega ?? null,
        despachado: Boolean(m?.despachado),
        material: d?.material ?? null,
        gramaje: d?.gramaje ?? null,
        tamanoHoja: d?.tamano_hoja ?? null,
        tintas: d?.tintas ?? null,
        acabadoPral: d?.acabado_pral ?? null,
        troquel: d?.troquel ?? null,
        poses: d?.poses ?? null,
        hojasBrutas: d?.num_hojas_brutas ?? null,
        hojasNetas: d?.num_hojas_netas ?? null,
      });
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo cargar el detalle."));
      setDetalleOpen(false);
    } finally {
      setDetalleLoading(false);
    }
  };

  const exportMes = () => {
    exportCalendarioProduccionMensualPdf({
      year,
      monthIndex,
      semanas,
      entradasByDay,
      includeSaturday: showSaturday,
      filtroTexto: filtro,
    });
  };

  const exportDia = () => {
    if (!dayYmd) return;
    exportCalendarioProduccionDiaPdf({
      ymd: dayYmd,
      tituloDia: fechaDiaLabel(dayYmd),
      lineas: dayLineas,
    });
  };

  const cabecera = useMemo(() => {
    const base = ["Lun", "Mar", "Mié", "Jue", "Vie"];
    return showSaturday ? [...base, "Sáb"] : base;
  }, [showSaturday]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">
            Calendario Producción
          </h2>
          <p className="text-xs text-slate-600">
            Coloca OTs por día (visión mensual). Clic en la OT para ver ficha
            sintética.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-[#002147]">
            {mesAnioLabel(year, monthIndex)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const t = new Date();
              setYear(t.getFullYear());
              setMonthIndex(t.getMonth());
            }}
          >
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportMes}>
            <FileDown className="mr-1 size-4" />
            PDF mes
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="Filtrar OT / trabajo / cliente…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300"
            checked={showSaturday}
            onChange={(e) => {
              const v = e.target.checked;
              setShowSaturday(v);
              try {
                localStorage.setItem(STORAGE_SHOW_SATURDAY, v ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          />
          Mostrar sábado
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Cargando calendario…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50">
          <div
            className="grid min-w-[640px] gap-px bg-slate-200"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {cabecera.map((d) => (
              <div
                key={d}
                className="bg-slate-100 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              >
                {d}
              </div>
            ))}
            {semanas.map((semana, si) =>
              semana.map((celda, ci) =>
                celda ? (
                  <DiaCelda
                    key={celda.ymd}
                    dayNum={celda.dayNum}
                    lineas={entradasByDay.get(celda.ymd) ?? []}
                    onEditDay={() => openDay(celda.ymd)}
                    onOpenOt={(ot) => void openDetalle(ot)}
                  />
                ) : (
                  <div
                    key={`empty-${si}-${ci}`}
                    className="min-h-[9rem] bg-slate-100/60"
                  />
                ),
              ),
            )}
          </div>
        </div>
      )}

      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>OTs del día</DialogTitle>
            <DialogDescription>
              {dayYmd ? fechaDiaLabel(dayYmd) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Añadir OT</Label>
              <Input
                className="mt-1"
                placeholder="Buscar nº OT, cliente o trabajo…"
                value={otQuery}
                onChange={(e) => setOtQuery(e.target.value)}
              />
              {searchingOt ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Loader2 className="size-3 animate-spin" /> Buscando…
                </p>
              ) : null}
              {otHits.length > 0 ? (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200">
                  {otHits.map((h) => (
                    <li key={h.num_pedido}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
                        disabled={saving}
                        onClick={() => void addOtToDay(h)}
                      >
                        <span className="font-semibold text-[#002147]">
                          {h.num_pedido}
                        </span>
                        <span className="line-clamp-1 text-xs text-slate-600">
                          {h.cliente ?? "—"} · {h.titulo ?? "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">
                En este día ({dayLineas.length})
              </p>
              {dayLineas.length === 0 ? (
                <p className="text-sm text-slate-500">Ninguna OT todavía.</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {dayLineas.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left text-sm hover:underline"
                          onClick={() => void openDetalle(l.otNumero)}
                        >
                          <span className="font-semibold text-[#002147]">
                            {l.otNumero}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-600">
                            {l.trabajo ?? "—"}
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 shrink-0 p-0 text-red-700"
                          disabled={saving}
                          title="Quitar del día"
                          onClick={() => void removeEntrada(l.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!dayYmd}
              onClick={exportDia}
            >
              <FileDown className="mr-1 size-4" />
              PDF día
            </Button>
            <Button type="button" size="sm" onClick={() => setDayOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              OT{" "}
              <span className="font-mono text-[#002147]">
                {detalle?.otNumero ?? "…"}
              </span>
            </DialogTitle>
            <DialogDescription>
              Ficha sintética (maestro + despacho).
            </DialogDescription>
          </DialogHeader>
          {detalleLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </div>
          ) : detalle ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetalleField label="Cliente" value={detalle.cliente ?? "—"} />
              <DetalleField
                label="Cantidad"
                value={
                  detalle.cantidad != null
                    ? detalle.cantidad.toLocaleString("es-ES")
                    : "—"
                }
              />
              <div className="sm:col-span-2">
                <DetalleField label="Trabajo" value={detalle.trabajo ?? "—"} />
              </div>
              <DetalleField
                label="Entrega"
                value={
                  detalle.fechaEntrega
                    ? formatFechaEsCorta(detalle.fechaEntrega)
                    : "—"
                }
              />
              <DetalleField
                label="Despachada"
                value={detalle.despachado ? "Sí" : "No"}
              />
              <DetalleField
                label="Papel / material"
                value={
                  [
                    detalle.material,
                    detalle.gramaje != null ? `${detalle.gramaje} g` : null,
                    detalle.tamanoHoja,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"
                }
              />
              <DetalleField label="Tintas" value={detalle.tintas ?? "—"} />
              <DetalleField
                label="Acabado principal"
                value={detalle.acabadoPral ?? "—"}
              />
              <DetalleField
                label="Troquel"
                value={
                  [
                    detalle.troquel,
                    detalle.poses != null ? `${detalle.poses} poses` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"
                }
              />
              <DetalleField
                label="Hojas"
                value={
                  detalle.hojasBrutas != null || detalle.hojasNetas != null
                    ? `${detalle.hojasBrutas?.toLocaleString("es-ES") ?? "—"} brutas · ${detalle.hojasNetas?.toLocaleString("es-ES") ?? "—"} netas`
                    : "—"
                }
              />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Sin datos.</p>
          )}
          <DialogFooter>
            <Button type="button" size="sm" onClick={() => setDetalleOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
