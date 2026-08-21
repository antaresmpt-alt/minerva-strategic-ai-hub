"use client";

import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";

const TABLE_COMPRA = "prod_compra_material";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_COMPRAS_COMUNICACION = "prod_compras_material_comunicacion";

type CompraComunicacionLogRow = {
  id: string;
  compra_ids: string[] | null;
  proveedor_id: string | null;
  asunto: string | null;
  cuerpo: string | null;
  enviado_por: string | null;
  created_at: string;
};

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function numStr(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? String(n) : "";
}

function parseOptionalDecimalInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseOptionalIntInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

type Props = {
  open: boolean;
  row: ComprasMaterialTableRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

/**
 * Modal aislado: el estado de los inputs vive aquí.
 * Así cada tecla no re-renderiza la matriz TanStack (~400 filas) del padre.
 */
export function ComprasMaterialEditDialog({
  open,
  row,
  onOpenChange,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [material, setMaterial] = useState("");
  const [gramaje, setGramaje] = useState("");
  const [tamano, setTamano] = useState("");
  const [brutas, setBrutas] = useState("");
  const [fecha, setFecha] = useState("");
  const [albaran, setAlbaran] = useState("");
  const [notasCompra, setNotasCompra] = useState("");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<CompraComunicacionLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setMaterial(row.material?.trim() ?? "");
    setGramaje(numStr(row.gramaje));
    setTamano(row.tamano_hoja?.trim() ?? "");
    setBrutas(numStr(row.num_hojas_brutas));
    setFecha(toDateInputValue(row.fecha_prevista_recepcion));
    setAlbaran(row.albaran_proveedor?.trim() ?? "");
    setNotasCompra(row.notas?.trim() ?? "");
  }, [open, row]);

  useEffect(() => {
    if (!open || !row) {
      setLogs([]);
      setLogsLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLogsLoading(true);
      const { data, error } = await supabase
        .from(TABLE_COMPRAS_COMUNICACION)
        .select("*")
        .contains("compra_ids", [row.id])
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setLogsLoading(false);
      if (error) {
        console.error("[prod_compras_material_comunicacion]", error);
        setLogs([]);
        return;
      }
      setLogs((data ?? []) as CompraComunicacionLogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row, supabase]);

  const handleSave = useCallback(async () => {
    if (!row) return;
    setSaving(true);
    const ot = String(row.ot_numero ?? "").trim();
    const payloadTecnico = {
      material: material.trim() || null,
      gramaje: parseOptionalDecimalInput(gramaje),
      tamano_hoja: tamano.trim() || null,
      num_hojas_brutas: parseOptionalIntInput(brutas),
    };
    const fechaVal = fecha.trim() === "" ? null : fecha.trim();
    const albaranVal = albaran.trim() === "" ? null : albaran.trim();
    const notas = notasCompra.trim() || null;

    try {
      if (ot) {
        const { error: errDesp } = await supabase
          .from(TABLE_DESPACHADAS)
          .update(payloadTecnico)
          .eq("ot_numero", ot);
        if (errDesp) throw errDesp;
      }

      const { error: errCompra } = await supabase
        .from(TABLE_COMPRA)
        .update({
          ...payloadTecnico,
          fecha_prevista_recepcion: fechaVal,
          albaran_proveedor: albaranVal,
          notas,
        })
        .eq("id", row.id);
      if (errCompra) throw errCompra;

      toast.success(
        ot ? "Compra y despacho actualizados." : "Compra actualizada."
      );
      onOpenChange(false);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar los cambios."
      );
    } finally {
      setSaving(false);
    }
  }, [
    albaran,
    brutas,
    fecha,
    gramaje,
    material,
    notasCompra,
    onOpenChange,
    onSaved,
    row,
    supabase,
    tamano,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,640px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3">
          <DialogTitle className="text-base">Editar compra</DialogTitle>
          <DialogDescription className="text-xs">
            {row ? (
              <>
                OT{" "}
                <span className="font-mono font-normal">
                  {row.ot_numero || "—"}
                </span>{" "}
                · {row.num_compra}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,480px)] space-y-4 overflow-y-auto px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Material acordado
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1 sm:col-span-1">
                <Label htmlFor="edit-compra-material" className="text-xs">
                  Material
                </Label>
                <Input
                  id="edit-compra-material"
                  className="h-8 text-xs"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="Ej. Estucado mate"
                />
              </div>
              <div className="grid gap-1 sm:col-span-1">
                <Label htmlFor="edit-compra-gramaje" className="text-xs">
                  Gramaje (g/m²)
                </Label>
                <Input
                  id="edit-compra-gramaje"
                  type="number"
                  step="any"
                  className="h-8 text-xs"
                  value={gramaje}
                  onChange={(e) => setGramaje(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="grid gap-1 sm:col-span-1">
                <Label htmlFor="edit-compra-formato" className="text-xs">
                  Formato
                </Label>
                <Input
                  id="edit-compra-formato"
                  className="h-8 text-xs"
                  value={tamano}
                  onChange={(e) => setTamano(e.target.value)}
                  placeholder="Ej. 72×102"
                />
              </div>
              <div className="grid gap-1 sm:col-span-1">
                <Label htmlFor="edit-compra-brutas" className="text-xs">
                  Hojas brutas
                </Label>
                <Input
                  id="edit-compra-brutas"
                  type="number"
                  inputMode="numeric"
                  className="h-8 text-xs"
                  value={brutas}
                  onChange={(e) => setBrutas(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Seguimiento
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor="edit-fecha-prev" className="text-xs">
                  Fecha prevista recepción
                </Label>
                <Input
                  id="edit-fecha-prev"
                  type="date"
                  className="h-8 text-xs"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="edit-albaran" className="text-xs">
                  Albarán proveedor
                </Label>
                <Input
                  id="edit-albaran"
                  type="text"
                  className="h-8 text-xs"
                  value={albaran}
                  onChange={(e) => setAlbaran(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="mt-3 grid gap-1">
              <Label htmlFor="edit-notas-compra" className="text-xs">
                Notas compra (Jordi)
              </Label>
              <Textarea
                id="edit-notas-compra"
                rows={3}
                value={notasCompra}
                onChange={(e) => setNotasCompra(e.target.value)}
                placeholder="Instrucciones o comentarios para muelle"
                className="resize-y text-xs leading-snug"
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Historial de comunicación
            </p>
            {logsLoading ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Cargando historial...
              </div>
            ) : logs.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Sin logs para esta compra.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-md border border-slate-200 bg-slate-50/70 p-2"
                  >
                    <p className="text-[11px] font-medium text-[#002147]">
                      {log.asunto?.trim() || "Sin asunto"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatFechaEsCorta(log.created_at)} ·{" "}
                      {log.enviado_por?.trim() || "usuario no identificado"}
                    </p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-700">
                      {log.cuerpo?.trim() || "Sin cuerpo"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !row}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
