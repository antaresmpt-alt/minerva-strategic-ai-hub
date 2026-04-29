"use client";

import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_OTS_GENERAL = "prod_ots_general";
const TABLE_COMPRA = "prod_compra_material";
const TABLE_RECEPCION = "prod_recepciones_material";
const TABLE_TROQUELES = "prod_troqueles";
const TABLE_POOL = "prod_planificacion_pool";
const TABLE_MESA = "prod_mesa_planificacion_trabajos";

type DespachadaRow = {
  ot_numero: string;
  tintas: string | null;
  material: string | null;
  num_hojas_brutas: number | null;
  horas_entrada: number | null;
  horas_tiraje: number | null;
  troquel: string | null;
  despachado_at: string | null;
};

type OtGeneralRow = {
  num_pedido: string;
  cliente: string | null;
  titulo: string | null;
  fecha_entrega: string | null;
  prioridad: string | null;
};

type CompraRow = { id: string; ot_numero: string };
type RecepcionRow = { compra_id: string; hojas_recibidas: number | null };

type PoolRow = {
  ot: string;
  cliente: string;
  trabajo: string;
  material: string;
  tintas: string;
  prioridad: string;
  fechaEntrega: string | null;
  hojasObjetivo: number;
  hojasRecibidasTotal: number;
  materialStatus: "verde" | "amarillo" | "rojo";
  troquelLabel: string;
  troquelStatus: "ok" | "falta" | "no_aplica";
  requiereTroquel: boolean;
  horasTotal: number;
};

function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fechaBadgeClass(fechaEntrega: string | null): string {
  if (!fechaEntrega) return "bg-slate-100 text-slate-700";
  const d = new Date(fechaEntrega);
  if (Number.isNaN(d.getTime())) return "bg-slate-100 text-slate-700";
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (diffDays <= 1) return "bg-red-100 text-red-800";
  if (diffDays <= 3) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function materialBadgeClass(status: PoolRow["materialStatus"]): string {
  if (status === "verde") return "bg-emerald-100 text-emerald-800";
  if (status === "amarillo") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export function PlanificacionPoolOtsTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const loadPoolRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data: despData, error: despErr } = await supabase
        .from(TABLE_DESPACHADAS)
        .select(
          "ot_numero, tintas, material, num_hojas_brutas, horas_entrada, horas_tiraje, troquel, despachado_at"
        )
        .order("despachado_at", { ascending: false })
        .limit(1500);
      if (despErr) throw despErr;

      const despRows = (despData ?? []) as DespachadaRow[];
      const byOt = new Map<string, PoolRow>();
      for (const d of despRows) {
        const ot = String(d.ot_numero ?? "").trim();
        if (!ot) continue;
        const prev = byOt.get(ot);
        const horasTotal = parseNum(d.horas_entrada) + parseNum(d.horas_tiraje);
        const hojasObj = Math.max(0, Math.trunc(parseNum(d.num_hojas_brutas)));
        const troquelRaw = String(d.troquel ?? "").trim();
        const tintasRaw = String(d.tintas ?? "").trim();
        const materialRaw = String(d.material ?? "").trim();
        if (!prev) {
          byOt.set(ot, {
            ot,
            cliente: "—",
            trabajo: "—",
            material: materialRaw || "—",
            tintas: tintasRaw || "—",
            prioridad: "Normal",
            fechaEntrega: null,
            hojasObjetivo: hojasObj,
            hojasRecibidasTotal: 0,
            materialStatus: "rojo",
            troquelLabel: troquelRaw,
            troquelStatus: troquelRaw ? "falta" : "no_aplica",
            requiereTroquel: troquelRaw.length > 0,
            horasTotal,
          });
          continue;
        }
        prev.horasTotal += horasTotal;
        prev.hojasObjetivo = Math.max(prev.hojasObjetivo, hojasObj);
        if (!prev.material || prev.material === "—") prev.material = materialRaw || "—";
        if (!prev.tintas || prev.tintas === "—") prev.tintas = tintasRaw || "—";
        if (!prev.troquelLabel && troquelRaw) {
          prev.troquelLabel = troquelRaw;
          prev.requiereTroquel = true;
          prev.troquelStatus = "falta";
        }
      }
      const otList = [...byOt.keys()];
      if (otList.length === 0) {
        setRows([]);
        setSelected({});
        return;
      }

      const { data: mesaActiva, error: mesaErr } = await supabase
        .from(TABLE_MESA)
        .select("ot_numero")
        .in("estado_mesa", ["borrador", "confirmado", "en_ejecucion"]);
      if (mesaErr) throw mesaErr;
      const otsMesa = new Set(
        ((mesaActiva ?? []) as Array<{ ot_numero: string | null }>)
          .map((x) => String(x.ot_numero ?? "").trim())
          .filter(Boolean)
      );
      const { data: poolStateData, error: poolStateErr } = await supabase
        .from(TABLE_POOL)
        .select("ot_numero, estado_pool")
        .in("ot_numero", otList)
        .in("estado_pool", ["pendiente", "enviada_mesa", "cerrada"]);
      if (poolStateErr) throw poolStateErr;
      const otsPoolCerradas = new Set(
        ((poolStateData ?? []) as Array<{ ot_numero: string | null; estado_pool: string | null }>)
          .filter((x) => String(x.estado_pool ?? "").trim().toLowerCase() === "cerrada")
          .map((x) => String(x.ot_numero ?? "").trim())
          .filter(Boolean)
      );

      const { data: generalData, error: genErr } = await supabase
        .from(TABLE_OTS_GENERAL)
        .select("num_pedido, cliente, titulo, fecha_entrega, prioridad")
        .in("num_pedido", otList);
      if (genErr) throw genErr;
      const genByOt = new Map<string, OtGeneralRow>();
      for (const g of (generalData ?? []) as OtGeneralRow[]) {
        const ot = String(g.num_pedido ?? "").trim();
        if (ot) genByOt.set(ot, g);
      }

      const { data: comprasData, error: comprasErr } = await supabase
        .from(TABLE_COMPRA)
        .select("id, ot_numero")
        .in("ot_numero", otList);
      if (comprasErr) throw comprasErr;
      const compras = (comprasData ?? []) as CompraRow[];
      const compraIds = compras.map((c) => c.id);
      const compraByOt = new Map<string, string[]>();
      for (const c of compras) {
        const ot = String(c.ot_numero ?? "").trim();
        if (!ot) continue;
        const arr = compraByOt.get(ot) ?? [];
        arr.push(c.id);
        compraByOt.set(ot, arr);
      }

      const recepByCompra = new Map<string, number>();
      if (compraIds.length > 0) {
        const { data: recData, error: recErr } = await supabase
          .from(TABLE_RECEPCION)
          .select("compra_id, hojas_recibidas")
          .in("compra_id", compraIds);
        if (recErr) throw recErr;
        for (const r of (recData ?? []) as RecepcionRow[]) {
          const cid = String(r.compra_id ?? "").trim();
          if (!cid) continue;
          recepByCompra.set(cid, (recepByCompra.get(cid) ?? 0) + parseNum(r.hojas_recibidas));
        }
      }

      const troquelNeedles = [...new Set(
        [...byOt.values()]
          .map((r) => r.troquelLabel.trim())
          .filter((x) => x.length > 0)
      )];
      const troquelSet = new Set<string>();
      if (troquelNeedles.length > 0) {
        const { data: troqData, error: troqErr } = await supabase
          .from(TABLE_TROQUELES)
          .select("num_troquel")
          .in("num_troquel", troquelNeedles);
        if (troqErr) throw troqErr;
        for (const row of troqData ?? []) {
          const v = String((row as { num_troquel?: string | null }).num_troquel ?? "").trim();
          if (v) troquelSet.add(v);
        }
      }

      const finalRows: PoolRow[] = [];
      for (const [ot, base] of byOt.entries()) {
        if (otsMesa.has(ot)) continue;
        if (otsPoolCerradas.has(ot)) continue;
        const g = genByOt.get(ot);
        if (g) {
          base.cliente = String(g.cliente ?? "").trim() || "—";
          base.trabajo = String(g.titulo ?? "").trim() || "—";
          base.prioridad = String(g.prioridad ?? "").trim() || "Normal";
          base.fechaEntrega = g.fecha_entrega ?? null;
        }
        const ids = compraByOt.get(ot) ?? [];
        const hojasRec = ids.reduce((acc, id) => acc + (recepByCompra.get(id) ?? 0), 0);
        base.hojasRecibidasTotal = Math.max(0, Math.trunc(hojasRec));
        if (ids.length === 0 || base.hojasRecibidasTotal <= 0) {
          base.materialStatus = "rojo";
        } else if (base.hojasRecibidasTotal < base.hojasObjetivo) {
          base.materialStatus = "amarillo";
        } else {
          base.materialStatus = "verde";
        }
        if (!base.requiereTroquel) {
          base.troquelStatus = "no_aplica";
        } else {
          base.troquelStatus = troquelSet.has(base.troquelLabel) ? "ok" : "falta";
        }
        finalRows.push(base);
      }

      finalRows.sort((a, b) => {
        const da = a.fechaEntrega ? new Date(a.fechaEntrega).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.fechaEntrega ? new Date(b.fechaEntrega).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });
      setRows(finalRows);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const r of finalRows) next[r.ot] = prev[r.ot] ?? false;
        return next;
      });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error cargando Pool de OT's.");
      setRows([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadPoolRows();
  }, [loadPoolRows]);

  const allChecked = rows.length > 0 && rows.every((r) => selected[r.ot]);
  const selectedRows = rows.filter((r) => selected[r.ot]);

  const pasarAMesa = useCallback(async () => {
    if (selectedRows.length === 0) {
      toast.error("Selecciona al menos una OT para pasar a Mesa.");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actorId =
        typeof user?.id === "string" && user.id.trim().length > 0 ? user.id.trim() : null;
      const actorEmail =
        typeof user?.email === "string" && user.email.trim().length > 0
          ? user.email.trim()
          : null;

      const otSel = selectedRows.map((r) => r.ot);
      const { data: mesaExistData, error: mesaExistErr } = await supabase
        .from(TABLE_MESA)
        .select("ot_numero")
        .in("ot_numero", otSel)
        .in("estado_mesa", ["borrador", "confirmado", "en_ejecucion"]);
      if (mesaExistErr) throw mesaExistErr;
      const yaEnMesa = new Set(
        ((mesaExistData ?? []) as Array<{ ot_numero: string | null }>)
          .map((x) => String(x.ot_numero ?? "").trim())
          .filter(Boolean)
      );
      const nuevos = selectedRows.filter((r) => !yaEnMesa.has(r.ot));
      if (nuevos.length === 0) {
        toast.message("Las OT's seleccionadas ya estaban en mesa activa.");
        return;
      }

      const hoy = toYmd(new Date());
      const { data: hoyRows, error: hoyErr } = await supabase
        .from(TABLE_MESA)
        .select("slot_orden")
        .eq("fecha_planificada", hoy)
        .is("maquina", null);
      if (hoyErr) throw hoyErr;
      let nextSlot = ((hoyRows ?? []) as Array<{ slot_orden: number | null }>).reduce(
        (acc, r) => Math.max(acc, Math.trunc(parseNum(r.slot_orden))),
        0
      );

      const mesaInsert = nuevos.map((r) => {
        nextSlot += 1;
        return {
          ot_numero: r.ot,
          fecha_planificada: hoy,
          slot_orden: nextSlot,
          maquina: null,
          estado_mesa: "borrador",
          prioridad_snapshot: r.prioridad || null,
          fecha_entrega_snapshot: r.fechaEntrega,
          material_status: r.materialStatus,
          troquel_status: r.troquelStatus,
          created_by: actorId,
          created_by_email: actorEmail,
        };
      });
      const { error: insMesaErr } = await supabase.from(TABLE_MESA).insert(mesaInsert);
      if (insMesaErr) throw insMesaErr;

      const { data: poolExistData, error: poolExistErr } = await supabase
        .from(TABLE_POOL)
        .select("id, ot_numero")
        .in("ot_numero", nuevos.map((r) => r.ot))
        .in("estado_pool", ["pendiente", "enviada_mesa", "cerrada"]);
      if (poolExistErr) throw poolExistErr;

      const poolByOt = new Map<string, string>();
      for (const p of (poolExistData ?? []) as Array<{ id: string; ot_numero: string }>) {
        const ot = String(p.ot_numero ?? "").trim();
        if (ot) poolByOt.set(ot, p.id);
      }
      const toUpdateIds = nuevos.map((r) => poolByOt.get(r.ot)).filter((x): x is string => !!x);
      if (toUpdateIds.length > 0) {
        const { error: updErr } = await supabase
          .from(TABLE_POOL)
          .update({
            estado_pool: "enviada_mesa",
            closed_at: null,
            closed_by: null,
            closed_by_email: null,
            notas: "Enviada desde Pool a Mesa",
          })
          .in("id", toUpdateIds);
        if (updErr) throw updErr;
      }
      const toInsertPool = nuevos.filter((r) => !poolByOt.has(r.ot)).map((r) => ({
        ot_numero: r.ot,
        estado_pool: "enviada_mesa",
        prioridad_snapshot: r.prioridad || null,
        fecha_entrega_snapshot: r.fechaEntrega,
        material_status: r.materialStatus,
        troquel_status: r.troquelStatus,
        requiere_troquel: r.requiereTroquel,
        notas: "Enviada desde Pool a Mesa",
        created_by: actorId,
        created_by_email: actorEmail,
      }));
      if (toInsertPool.length > 0) {
        const { error: insPoolErr } = await supabase.from(TABLE_POOL).insert(toInsertPool);
        if (insPoolErr) throw insPoolErr;
      }

      toast.success(`Mesa actualizada: ${nuevos.length} OT(s) enviadas.`);
      await loadPoolRows();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo pasar la selección a mesa.");
    } finally {
      setSaving(false);
    }
  }, [loadPoolRows, selectedRows, supabase]);

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg text-[#002147]">Pool de OT&apos;s</CardTitle>
        <CardDescription>
          OTs despachadas pendientes de planificación, con control de material y
          disponibilidad de troquel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#001735]"
            disabled={saving || selectedRows.length === 0}
            onClick={() => void pasarAMesa()}
          >
            {saving ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="mr-1.5 size-4" aria-hidden />
            )}
            Pasar a Mesa de Secuenciación
          </Button>
          <span className="text-xs text-slate-600">
            Seleccionadas:{" "}
            <span className="font-semibold text-[#002147]">{selectedRows.length}</span>
          </span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-6 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Cargando pool de OT&apos;s...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-6 text-sm text-slate-600">
            No hay OT&apos;s despachadas pendientes de planificación.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200/90">
            <Table className="min-w-[76rem]">
              <TableHeader>
                <TableRow className="bg-slate-50/90">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => {
                        const next: Record<string, boolean> = {};
                        for (const r of rows) next[r.ot] = e.target.checked;
                        setSelected(next);
                      }}
                      aria-label="Seleccionar todas"
                    />
                  </TableHead>
                  <TableHead>Prioridad / Entrega</TableHead>
                  <TableHead>OT / Cliente</TableHead>
                  <TableHead>Trabajo</TableHead>
                  <TableHead>Tintas</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Troquel</TableHead>
                  <TableHead className="text-right">Tiempos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.ot}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!!selected[r.ot]}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [r.ot]: e.target.checked }))
                        }
                        aria-label={`Seleccionar OT ${r.ot}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="rounded-md bg-[#C69C2B]/20 px-2 py-0.5 text-xs font-medium text-[#002147]">
                          {r.prioridad || "Normal"}
                        </span>
                        <div>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${fechaBadgeClass(
                              r.fechaEntrega
                            )}`}
                          >
                            {r.fechaEntrega ? formatFechaEsCorta(r.fechaEntrega) : "Sin fecha"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold text-[#002147]">{r.ot}</p>
                      <p className="text-xs text-slate-600">{r.cliente || "—"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-slate-900">{r.trabajo || "—"}</p>
                      <p className="text-xs text-slate-600">{r.material || "—"}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.tintas || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${materialBadgeClass(
                            r.materialStatus
                          )}`}
                        >
                          {r.materialStatus.toUpperCase()}
                        </span>
                        <p className="text-[11px] text-slate-600">
                          {r.hojasRecibidasTotal}/{r.hojasObjetivo} hojas
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.troquelStatus === "ok" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          <CheckCircle2 className="size-3.5" aria-hidden />
                          OK
                        </span>
                      ) : r.troquelStatus === "falta" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          Falta
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          No aplica
                        </span>
                      )}
                      {r.troquelLabel ? (
                        <p className="mt-1 font-mono text-[11px] text-slate-600">{r.troquelLabel}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium tabular-nums text-slate-900">
                        {r.horasTotal.toFixed(2)} h
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
