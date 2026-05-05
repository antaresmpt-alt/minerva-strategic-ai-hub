"use client";

import { Loader2, RefreshCw, Route } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, type Option } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  normalizeOtRawToString,
  otRawToIdPedido,
} from "@/lib/externos-excel-import";
import {
  type ExternoItinerarioQueueRow,
  externosComputeDiasHastaFEntregaOt,
  externosDateInputToTimestamptz,
  fetchExternoItinerarioQueue,
} from "@/lib/externos-itinerario-queue";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE_SEGUIMIENTO = "prod_seguimiento_externos";

const EMPTY_SELECT: Option[] = [{ value: "", label: "— Seleccionar —" }];

/** Primera aparición por `ot_paso_id`; evita keys duplicadas en la tabla. */
function dedupeQueueByOtPasoId(rows: ExternoItinerarioQueueRow[]): ExternoItinerarioQueueRow[] {
  const seen = new Set<string>();
  const out: ExternoItinerarioQueueRow[] = [];
  for (const r of rows) {
    const k = String(r.ot_paso_id ?? "").trim();
    if (!k) {
      out.push(r);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

type ProveedorLite = {
  id: string;
  nombre: string;
  tipo_proveedor_id: string;
};

type TipoProveedorLite = { id: string; nombre: string };

type AcabadoLite = {
  id: string;
  tipo_proveedor_id: string;
  nombre: string;
};

function normalizeTipoNombreSegment(s: string): string {
  return s.trim().toLowerCase();
}

function resolveTipoProveedorIdsForAcabados(
  prov: ProveedorLite,
  tipos: TipoProveedorLite[],
): string[] {
  const tipoRow = tipos.find((t) => t.id === prov.tipo_proveedor_id);
  const raw = tipoRow?.nombre?.trim() ?? "";
  if (!raw) return [prov.tipo_proveedor_id];
  const parts = raw
    .split("/")
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [prov.tipo_proveedor_id];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const match = tipos.find(
      (t) => normalizeTipoNombreSegment(t.nombre) === normalizeTipoNombreSegment(p),
    );
    if (match && !seen.has(match.id)) {
      seen.add(match.id);
      out.push(match.id);
    }
  }
  return out.length > 0 ? out : [prov.tipo_proveedor_id];
}

function acabadosFiltradosPorProveedor(
  prov: ProveedorLite,
  tipos: TipoProveedorLite[],
  catalog: AcabadoLite[],
): AcabadoLite[] {
  const tipoIds = resolveTipoProveedorIdsForAcabados(prov, tipos);
  const allow = new Set(tipoIds);
  return catalog
    .filter((a) => allow.has(a.tipo_proveedor_id))
    .sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
    );
}

type Props = {
  supabase: SupabaseClient;
  proveedores: ProveedorLite[];
  tipos: TipoProveedorLite[];
  acabadosCatalogo: AcabadoLite[];
  onCreated: () => void;
  onIrASeguimiento: () => void;
};

export function ExternosItinerarioPoolTab({
  supabase,
  proveedores,
  tipos,
  acabadosCatalogo,
  onCreated,
  onIrASeguimiento,
}: Props) {
  const [rows, setRows] = useState<ExternoItinerarioQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const [bulkProv, setBulkProv] = useState("");
  const [bulkAcab, setBulkAcab] = useState("");
  const [bulkFechaPrev, setBulkFechaPrev] = useState("");

  const proveedorOptions: Option[] = useMemo(
    () => [
      ...EMPTY_SELECT,
      ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
    ],
    [proveedores],
  );

  const acabadoOptions: Option[] = useMemo(() => {
    if (!bulkProv) return EMPTY_SELECT;
    const prov = proveedores.find((p) => p.id === bulkProv);
    if (!prov) return EMPTY_SELECT;
    const list = acabadosFiltradosPorProveedor(prov, tipos, acabadosCatalogo);
    return [
      ...EMPTY_SELECT,
      ...list.map((a) => ({ value: a.id, label: a.nombre })),
    ];
  }, [bulkProv, proveedores, tipos, acabadosCatalogo]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExternoItinerarioQueue(supabase);
      setRows(dedupeQueueByOtPasoId(data));
      setSelected(new Set());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "No se pudo cargar la cola de itinerario externo.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (rows.length === 0 || bulkFechaPrev.length === 10) return;
    const withDate = rows.find((r) => r.fecha_entrega);
    if (withDate?.fecha_entrega) setBulkFechaPrev(withDate.fecha_entrega);
  }, [rows, bulkFechaPrev]);

  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.ot_paso_id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.ot_paso_id)));
  }

  function toggleOne(otPasoId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(otPasoId)) next.delete(otPasoId);
      else next.add(otPasoId);
      return next;
    });
  }

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.ot_paso_id)),
    [rows, selected],
  );

  async function crearPendientes() {
    if (!proveedores.length) {
      toast.error("Primero debes dar de alta un colaborador en Proveedores.");
      return;
    }
    if (selectedRows.length === 0) {
      toast.error("Selecciona al menos una OT.");
      return;
    }
    if (!bulkProv || !bulkAcab) {
      toast.error("Elige proveedor y acabado para todas las filas seleccionadas.");
      return;
    }
    if (!bulkFechaPrev || bulkFechaPrev.length !== 10) {
      toast.error("Indica una fecha prevista de regreso (yyyy-mm-dd).");
      return;
    }

    setSaving(true);
    try {
      const otKeys = [...new Set(selectedRows.map((r) => normalizeOtRawToString(r.ot_numero)))];
      if (otKeys.length === 0) {
        throw new Error("No hay OTs seleccionadas.");
      }
      const { data: opData, error: opErr } = await supabase
        .from(TABLE_SEGUIMIENTO)
        .select("OT, num_operacion")
        .in("OT", otKeys);
      if (opErr) throw opErr;
      const maxOpByOt = new Map<string, number>();
      for (const r of (opData ?? []) as Array<{ OT?: string | null; num_operacion?: number | null }>) {
        const ot = normalizeOtRawToString(String(r.OT ?? ""));
        const n = Math.max(0, Math.trunc(Number(r.num_operacion ?? 0)));
        maxOpByOt.set(ot, Math.max(maxOpByOt.get(ot) ?? 0, n));
      }

      const fechaPrevIso = externosDateInputToTimestamptz(bulkFechaPrev);

      for (const row of selectedRows) {
        const otRaw = normalizeOtRawToString(row.ot_numero);
        const id_pedido = otRawToIdPedido(otRaw);
        const nextOp = (maxOpByOt.get(otRaw) ?? 0) + 1;
        maxOpByOt.set(otRaw, nextOp);

        const fEntIso = row.fecha_entrega
          ? externosDateInputToTimestamptz(row.fecha_entrega)
          : null;

        const { error } = await supabase.from(TABLE_SEGUIMIENTO).insert({
          id_pedido,
          OT: otRaw,
          num_operacion: nextOp,
          cliente_nombre: row.cliente.trim() || "—",
          trabajo_titulo: row.trabajo_titulo.trim() || "—",
          pedido_cliente: null,
          proveedor_id: bulkProv,
          acabado_id: bulkAcab,
          estado: "Pendiente",
          ot_paso_id: row.ot_paso_id,
          f_entrega_ot: fEntIso,
          dias_a_fEntOT:
            fEntIso != null ? externosComputeDiasHastaFEntregaOt(fEntIso) : null,
          fecha_envio: null,
          fecha_prevista: fechaPrevIso,
          notas_logistica: `Desde itinerario: ${row.proceso_nombre}`.trim(),
          unidades: null,
          prioridad: null,
          palets: null,
          observaciones: null,
        });
        if (error) throw error;
      }

      toast.success(
        `${selectedRows.length} envío(es) creado(s) en Pendiente. Puedes gestionarlos en Seguimiento.`,
      );
      onCreated();
      await loadQueue();
      onIrASeguimiento();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Error al crear seguimientos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-2 pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg text-[#002147]">
                <Route className="size-5 shrink-0 opacity-90" aria-hidden />
                OTs con paso externo
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Listado de OTs cuyo <strong>siguiente paso disponible</strong> del itinerario
                está marcado como externo en el catálogo de procesos. Al crear el envío se
                registra en <strong>Pendiente</strong> y se vincula al paso: al marcar{" "}
                <strong>Recibido</strong> en Seguimiento, el itinerario avanza solo al
                siguiente proceso (p. ej. troquelado).
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={loading}
              onClick={() => void loadQueue()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              <span className="ml-2">Actualizar cola</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {!proveedores.length ? (
            <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
              <AlertTitle>Sin colaboradores</AlertTitle>
              <AlertDescription>
                Necesitas al menos un proveedor en la pestaña Proveedores para crear envíos.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <NativeSelect
              label="Proveedor (todas las seleccionadas)"
              options={proveedorOptions}
              value={bulkProv}
              onChange={(e) => {
                setBulkProv(e.target.value);
                setBulkAcab("");
              }}
            />
            <NativeSelect
              label="Acabado"
              options={acabadoOptions}
              value={bulkAcab}
              onChange={(e) => setBulkAcab(e.target.value)}
              disabled={!bulkProv}
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#002147]">
                Fecha prevista regreso
              </Label>
              <Input
                type="date"
                value={bulkFechaPrev}
                onChange={(e) => setBulkFechaPrev(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full"
                disabled={
                  saving ||
                  selectedRows.length === 0 ||
                  !bulkProv ||
                  !bulkAcab ||
                  bulkFechaPrev.length !== 10
                }
                onClick={() => void crearPendientes()}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                <span className={saving ? "ml-2" : ""}>
                  Crear en seguimiento ({selectedRows.length})
                </span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Cargando cola desde itinerario…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay OTs pendientes de externo en este momento (o todas ya tienen seguimiento
              activo hasta Recibido).
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/90">
                    <TableHead className="w-10 px-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border"
                        checked={allSelected}
                        onChange={toggleAll}
                        title="Seleccionar todas"
                        aria-label="Seleccionar todas las OTs de la cola"
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-2">OT</TableHead>
                    <TableHead className="px-2">Próximo paso</TableHead>
                    <TableHead className="px-2">Cliente</TableHead>
                    <TableHead className="min-w-[10rem] px-2">Trabajo</TableHead>
                    <TableHead className="whitespace-nowrap px-2">Entrega OT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.ot_paso_id}>
                      <TableCell className="px-2 py-2">
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={selected.has(r.ot_paso_id)}
                          onChange={() => toggleOne(r.ot_paso_id)}
                          aria-label={`Seleccionar OT ${r.ot_numero}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2 py-2 font-semibold text-[#002147]">
                        {r.ot_numero}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-sm">{r.proceso_nombre || "—"}</TableCell>
                      <TableCell className="max-w-[12rem] truncate px-2 py-2 text-sm">
                        {r.cliente || "—"}
                      </TableCell>
                      <TableCell className="max-w-[18rem] truncate px-2 py-2 text-xs text-muted-foreground">
                        {r.trabajo_titulo || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2 py-2 text-sm">
                        {r.fecha_entrega
                          ? formatFechaEsCorta(externosDateInputToTimestamptz(r.fecha_entrega))
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
