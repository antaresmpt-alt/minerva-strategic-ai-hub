"use client";

import { Camera, Loader2, Plus, X } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadRecepcionFotos } from "@/lib/recepcion-fotos-upload";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AlbaranPendienteGroup } from "@/types/prod-stock";

const supabase = createSupabaseBrowserClient();

type ProveedorOption = { id: string; nombre: string };

function buildStockGrupo(
  recepcionId: string,
  proveedorNombre: string | null,
  albaran: string,
  material: string,
  gramaje: number | null,
  formato: string,
  hojas: number,
  palets: number
): AlbaranPendienteGroup {
  return {
    albaran_proveedor: albaran,
    proveedor_nombre: proveedorNombre,
    fecha_recepcion: new Date().toISOString(),
    palets_recibidos: palets,
    hojas_recibidas_total: hojas,
    foto_urls: [],
    cartelas_existentes: 0,
    cartelas_prueba_existentes: 0,
    recepciones: [
      {
        recepcion_id: recepcionId,
        compra_id: null,
        tipo_recepcion: "stock_libre",
        ot_numero: "",
        material,
        gramaje,
        tamano_hoja: formato,
        hojas_recibidas_muelle: hojas,
        palets_recibidos_muelle: palets,
        notas_muelle: null,
        num_hojas_brutas: null,
        cliente_nombre: null,
        trabajo_titulo: null,
        proveedor_nombre: proveedorNombre,
        foto_urls: [],
      },
    ],
  };
}

export function RecepcionStockDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (grupo: AlbaranPendienteGroup) => void;
}) {
  const [proveedores, setProveedores] = useState<ProveedorOption[]>([]);
  const [loadingProv, setLoadingProv] = useState(false);
  const [saving, setSaving] = useState(false);

  const [proveedorId, setProveedorId] = useState("");
  const [albaran, setAlbaran] = useState("");
  const [material, setMaterial] = useState("");
  const [gramaje, setGramaje] = useState("");
  const [formato, setFormato] = useState("");
  const [hojas, setHojas] = useState("");
  const [palets, setPalets] = useState("1");
  const [notas, setNotas] = useState("");
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);

  const proveedorNombre = useMemo(
    () => proveedores.find((p) => p.id === proveedorId)?.nombre ?? null,
    [proveedores, proveedorId]
  );

  const resetForm = useCallback(() => {
    setProveedorId("");
    setAlbaran("");
    setMaterial("");
    setGramaje("");
    setFormato("");
    setHojas("");
    setPalets("1");
    setNotas("");
    for (const u of fotoPreviews) URL.revokeObjectURL(u);
    setFotoFiles([]);
    setFotoPreviews([]);
  }, [fotoPreviews]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProv(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("prod_proveedores")
          .select("id, nombre")
          .order("nombre");
        if (error) throw error;
        if (cancelled) return;
        setProveedores(
          (data ?? []).map((r) => ({
            id: String(r.id),
            nombre: String(r.nombre ?? "").trim(),
          }))
        );
      } catch (e) {
        if (!cancelled) {
          toast.error(
            `Error cargando proveedores: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      } finally {
        if (!cancelled) setLoadingProv(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const onPickFotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...fotoFiles];
    const urls = [...fotoPreviews];
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i);
      if (!f || !f.type.startsWith("image/")) continue;
      next.push(f);
      urls.push(URL.createObjectURL(f));
    }
    setFotoFiles(next);
    setFotoPreviews(urls);
  };

  const removeFotoAt = (idx: number) => {
    setFotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setFotoPreviews((prev) => {
      const u = prev[idx];
      if (u) URL.revokeObjectURL(u);
      return prev.filter((_, i) => i !== idx);
    });
  };

  async function handleSave() {
    const alb = albaran.trim();
    if (!alb) {
      toast.error("Indica el nº de albarán del proveedor.");
      return;
    }
    if (!material.trim()) {
      toast.error("Indica el material (ej. OFFSET, Folding).");
      return;
    }
    const hojasNum = parseInt(hojas.replace(/\D/g, ""), 10);
    if (!Number.isFinite(hojasNum) || hojasNum <= 0) {
      toast.error("Indica las hojas recibidas (entero > 0).");
      return;
    }
    const paletsNum = parseInt(palets.replace(/\D/g, ""), 10);
    const paletsInt = Number.isFinite(paletsNum) && paletsNum > 0 ? paletsNum : 1;
    const gramajeNum = gramaje.trim() ? parseInt(gramaje, 10) : null;

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const recepcionadoPorUuid =
        typeof user?.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id.trim())
          ? user.id.trim()
          : null;

      const { data: recepIns, error: rErr } = await supabase
        .from("prod_recepciones_material")
        .insert({
          compra_id: null,
          tipo_recepcion: "stock_libre",
          proveedor_id: proveedorId || null,
          material_nombre: material.trim(),
          gramaje: gramajeNum,
          formato: formato.trim() || null,
          fecha_recepcion: new Date().toISOString(),
          albaran_proveedor: alb,
          hojas_recibidas: hojasNum,
          palets_recibidos: paletsInt,
          estado_recepcion: "Total",
          notas: notas.trim() || null,
          recepcionado_por: recepcionadoPorUuid,
          recepcionado_por_email: user?.email ?? null,
          recepcionado_por_nombre:
            (user?.user_metadata?.full_name as string | undefined)?.trim() ||
            (user?.user_metadata?.name as string | undefined)?.trim() ||
            null,
        })
        .select("id")
        .single();

      if (rErr) throw rErr;
      const recepcionId = String((recepIns as { id: string }).id);

      if (fotoFiles.length > 0) {
        await uploadRecepcionFotos(supabase, recepcionId, fotoFiles);
      }

      const grupo = buildStockGrupo(
        recepcionId,
        proveedorNombre,
        alb,
        material.trim(),
        gramajeNum,
        formato.trim(),
        hojasNum,
        paletsInt
      );

      toast.success("Recepción STOCK registrada — abre el wizard para cartelar.");
      resetForm();
      onCreated(grupo);
      onClose();
    } catch (e) {
      toast.error(
        `Error al guardar: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#002147]">Recepción STOCK (sin OC)</DialogTitle>
          <DialogDescription>
            Material sin pedido/OT — Papers Tordera y casos similares. Después
            cartelarás como stock libre.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Proveedor</Label>
            <Select
              value={proveedorId || "__none__"}
              onValueChange={(v) =>
                setProveedorId(v === "__none__" || !v ? "" : v)
              }
              disabled={loadingProv}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingProv ? "Cargando…" : "Opcional"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sin proveedor —</SelectItem>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Nº albarán proveedor *</Label>
            <Input
              value={albaran}
              onChange={(e) => setAlbaran(e.target.value)}
              placeholder="AV26-04179"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2 col-span-2 sm:col-span-1">
              <Label>Material *</Label>
              <Input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="OFFSET"
              />
            </div>
            <div className="grid gap-2">
              <Label>Gramaje</Label>
              <Input
                value={gramaje}
                onChange={(e) => setGramaje(e.target.value)}
                placeholder="200"
              />
            </div>
            <div className="grid gap-2 col-span-2 sm:col-span-1">
              <Label>Formato</Label>
              <Input
                value={formato}
                onChange={(e) => setFormato(e.target.value)}
                placeholder="102×72"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Hojas recibidas *</Label>
              <Input
                value={hojas}
                onChange={(e) => setHojas(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="grid gap-2">
              <Label>Palets</Label>
              <Input
                value={palets}
                onChange={(e) => setPalets(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Notas</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="STOCK — sin OT asignada"
            />
          </div>

          <div className="grid gap-2">
            <Label>Foto albarán (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              {fotoPreviews.map((url, i) => (
                <div key={url} className="relative size-16 rounded border overflow-hidden">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-0 right-0 bg-black/50 text-white p-0.5"
                    onClick={() => removeFotoAt(i)}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <label className="flex size-16 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 hover:bg-slate-50">
                <Camera className="size-5 text-slate-400" />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => onPickFotos(e.target.files)}
                />
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Guardando…
              </>
            ) : (
              <>
                <Plus className="size-4 mr-2" />
                Registrar y cartelar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
