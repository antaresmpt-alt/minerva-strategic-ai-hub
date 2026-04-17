"use client";

import { Camera, Loader2, Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useSysParametrosOtsCompras } from "@/hooks/use-sys-parametros-ots-compras";
import { normalizeCompraEstado } from "@/lib/compras-material-estados";
import { isCompraVisibleEnMuelle } from "@/lib/muelle-compras";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const TABLE_COMPRA = "prod_compra_material";
const TABLE_MASTER = "prod_ots_general";
const TABLE_PROVEEDORES = "prod_proveedores";
const TABLE_RECEPCION = "prod_recepciones_material";
const TABLE_RECEPCION_FOTOS = "prod_recepciones_fotos";
const BUCKET_FOTOS = "recepciones-fotos";
/** En BD: `prod_seguimiento_externos` (equivalente operativo a «prod_externos» del prompt). */
const TABLE_SEGUIMIENTO_EXTERNOS = "prod_seguimiento_externos";
const TABLE_ACABADOS = "prod_cat_acabados";
const MUELLE_EXTERNO_ESTADOS = [
  "Enviado",
  "En Proveedor",
  "Retrasado",
  "Acabado en Proveedor",
  "Parcial",
] as const;

function logGuardarRecepcionError(context: string, e: unknown): void {
  const o =
    e && typeof e === "object"
      ? (e as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        })
      : null;
  const message = o?.message ?? (e instanceof Error ? e.message : String(e));
  console.error(`[Muelle guardarRecepcion] ${context}`, {
    message,
    ...(o?.details != null && o.details !== "" ? { details: o.details } : {}),
    ...(o?.hint != null && o.hint !== "" ? { hint: o.hint } : {}),
    ...(o?.code != null && o.code !== "" ? { code: o.code } : {}),
    raw: e,
  });
}

type MuelleCardRow = {
  id: string;
  ot_numero: string;
  num_compra: string;
  material: string | null;
  gramaje: number | null;
  tamano_hoja: string | null;
  num_hojas_brutas: number | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  estado: string | null;
  fecha_entrega_maestro: string | null;
};

type MuelleExternoCardRow = {
  id: string;
  ot_numero: string;
  cliente_nombre: string;
  trabajo_titulo: string;
  estado: string;
  proveedor_nombre: string | null;
  acabado_nombre: string | null;
  fecha_prevista: string | null;
  f_entrega_ot: string | null;
  notas_logistica: string | null;
};

function otDisplayFromSeguimientoRaw(raw: Record<string, unknown>): string {
  const o = String(raw.OT ?? "").trim();
  if (o) return o;
  const idPed = raw.id_pedido;
  if (idPed != null && idPed !== "") return String(idPed);
  return "";
}

function rawNumHojas(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : null;
  if (v != null && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function parseGramajeMuelle(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function gramajeTextoGg(g: number): string {
  return Number.isInteger(g) ? String(Math.trunc(g)) : String(g);
}

/** Resumen «300g · 72x102» solo con datos disponibles. */
function gramajeFormatoResumenLine(
  gramaje: number | null,
  tamanoHoja: string | null | undefined
): string | null {
  const parts: string[] = [];
  if (gramaje != null && Number.isFinite(gramaje)) {
    parts.push(`${gramajeTextoGg(gramaje)}g`);
  }
  const fmt = tamanoHoja?.trim();
  if (fmt) parts.push(fmt);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function extFromFile(f: File): string {
  const n = f.name.toLowerCase();
  if (n.endsWith(".png")) return "png";
  if (n.endsWith(".webp")) return "webp";
  if (n.endsWith(".heic")) return "heic";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  return "jpg";
}

export function MuelleRecepcionPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { umbrales: umbralesOtsCompras } = useSysParametrosOtsCompras();
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<MuelleCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [muelleTab, setMuelleTab] = useState<"materiales" | "externos">(
    "materiales"
  );
  const [externoRows, setExternoRows] = useState<MuelleExternoCardRow[]>([]);
  const [loadingExternos, setLoadingExternos] = useState(false);

  const [sheetKind, setSheetKind] = useState<"none" | "material" | "externo">(
    "none"
  );
  const [activeMaterial, setActiveMaterial] = useState<MuelleCardRow | null>(
    null
  );
  const [activeExterno, setActiveExterno] =
    useState<MuelleExternoCardRow | null>(null);
  const sheetOpen = sheetKind !== "none";
  const [saving, setSaving] = useState(false);

  const [externoAlbaran, setExternoAlbaran] = useState("");
  const [externoNotas, setExternoNotas] = useState("");
  const [externoSaving, setExternoSaving] = useState(false);

  const [albaran, setAlbaran] = useState("");
  const [hojasRecibidas, setHojasRecibidas] = useState("");
  const [palets, setPalets] = useState("");
  const [notas, setNotas] = useState("");
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data: compras, error: cErr } = await supabase
        .from(TABLE_COMPRA)
        .select(
          "id, ot_numero, num_compra, material, gramaje, tamano_hoja, num_hojas_brutas, proveedor_id, estado"
        )
        .order("created_at", { ascending: false })
        .limit(800);
      if (cErr) throw cErr;

      const list = (compras ?? []) as Record<string, unknown>[];
      const filtradas = list.filter((r) =>
        isCompraVisibleEnMuelle(r.estado as string | null)
      );
      const otKeys = [
        ...new Set(
          filtradas
            .map((r) => String(r.ot_numero ?? "").trim())
            .filter(Boolean)
        ),
      ];
      const masterByOt = new Map<string, { fecha_entrega: string | null }>();
      if (otKeys.length > 0) {
        const { data: masters, error: mErr } = await supabase
          .from(TABLE_MASTER)
          .select("num_pedido, fecha_entrega")
          .in("num_pedido", otKeys);
        if (mErr) throw mErr;
        for (const m of masters ?? []) {
          const row = m as { num_pedido: string | null; fecha_entrega: string | null };
          const k = String(row.num_pedido ?? "").trim();
          if (k) masterByOt.set(k, { fecha_entrega: row.fecha_entrega ?? null });
        }
      }

      const provIds = [
        ...new Set(
          filtradas
            .map((r) => r.proveedor_id as string | null)
            .filter((x): x is string => Boolean(x))
        ),
      ];
      const provById = new Map<string, string>();
      if (provIds.length > 0) {
        const { data: provs, error: pErr } = await supabase
          .from(TABLE_PROVEEDORES)
          .select("id, nombre")
          .in("id", provIds);
        if (pErr) throw pErr;
        for (const p of provs ?? []) {
          const row = p as { id: string; nombre: string | null };
          provById.set(row.id, String(row.nombre ?? "").trim());
        }
      }

      const merged: MuelleCardRow[] = filtradas.map((raw) => {
        const ot = String(raw.ot_numero ?? "").trim();
        const pid = raw.proveedor_id as string | null;
        const m = masterByOt.get(ot);
        return {
          id: String(raw.id ?? ""),
          ot_numero: ot,
          num_compra: String(raw.num_compra ?? ""),
          material: (raw.material as string | null) ?? null,
          gramaje: parseGramajeMuelle(raw.gramaje),
          tamano_hoja: (raw.tamano_hoja as string | null) ?? null,
          num_hojas_brutas: rawNumHojas(raw.num_hojas_brutas),
          proveedor_id: pid,
          proveedor_nombre:
            pid && provById.has(pid) ? provById.get(pid)! : null,
          estado: (raw.estado as string | null) ?? null,
          fecha_entrega_maestro: m?.fecha_entrega ?? null,
        };
      });

      setRows(merged);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar compras para muelle."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const loadExternoRows = useCallback(async () => {
    setLoadingExternos(true);
    try {
      const { data: seg, error: sErr } = await supabase
        .from(TABLE_SEGUIMIENTO_EXTERNOS)
        .select(
          "id, OT, id_pedido, cliente_nombre, trabajo_titulo, estado, proveedor_id, acabado_id, fecha_prevista, f_entrega_ot, notas_logistica, updated_at, created_at"
        )
        .in("estado", [...MUELLE_EXTERNO_ESTADOS])
        .order("updated_at", { ascending: false })
        .limit(500);
      if (sErr) throw sErr;
      const list = (seg ?? []) as Record<string, unknown>[];

      const provIds = [
        ...new Set(
          list
            .map((r) => r.proveedor_id as string | null | undefined)
            .filter((x): x is string => typeof x === "string" && x.length > 0)
        ),
      ];
      const acabIds = [
        ...new Set(
          list
            .map((r) => r.acabado_id as string | null | undefined)
            .filter((x): x is string => typeof x === "string" && x.length > 0)
        ),
      ];
      const provById = new Map<string, string>();
      if (provIds.length > 0) {
        const { data: provs, error: pErr } = await supabase
          .from(TABLE_PROVEEDORES)
          .select("id, nombre")
          .in("id", provIds);
        if (pErr) throw pErr;
        for (const p of provs ?? []) {
          const row = p as { id: string; nombre: string | null };
          provById.set(row.id, String(row.nombre ?? "").trim());
        }
      }
      const acabById = new Map<string, string>();
      if (acabIds.length > 0) {
        const { data: acs, error: aErr } = await supabase
          .from(TABLE_ACABADOS)
          .select("id, nombre")
          .in("id", acabIds);
        if (aErr) throw aErr;
        for (const a of acs ?? []) {
          const row = a as { id: string; nombre: string | null };
          acabById.set(row.id, String(row.nombre ?? "").trim());
        }
      }

      const merged: MuelleExternoCardRow[] = list.map((raw) => {
        const pid = raw.proveedor_id as string | null;
        const aid = raw.acabado_id as string | null;
        return {
          id: String(raw.id ?? ""),
          ot_numero: otDisplayFromSeguimientoRaw(raw),
          cliente_nombre: String(raw.cliente_nombre ?? "").trim() || "—",
          trabajo_titulo: String(raw.trabajo_titulo ?? "").trim() || "—",
          estado: String(raw.estado ?? "").trim() || "—",
          proveedor_nombre:
            pid && provById.has(pid) ? provById.get(pid)! : null,
          acabado_nombre: aid && acabById.has(aid) ? acabById.get(aid)! : null,
          fecha_prevista: (raw.fecha_prevista as string | null) ?? null,
          f_entrega_ot: (raw.f_entrega_ot as string | null) ?? null,
          notas_logistica: (raw.notas_logistica as string | null) ?? null,
        };
      });
      setExternoRows(merged);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar externos en muelle."
      );
      setExternoRows([]);
    } finally {
      setLoadingExternos(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (muelleTab === "externos") void loadExternoRows();
  }, [muelleTab, loadExternoRows]);

  const clearFotos = useCallback(() => {
    setFotoPreviews((prev) => {
      for (const u of prev) URL.revokeObjectURL(u);
      return [];
    });
    setFotoFiles([]);
  }, []);

  const clearForm = useCallback(() => {
    setAlbaran("");
    setHojasRecibidas("");
    setPalets("");
    setNotas("");
    clearFotos();
  }, [clearFotos]);

  const openMaterialSheet = (row: MuelleCardRow) => {
    clearForm();
    setExternoAlbaran("");
    setExternoNotas("");
    setActiveMaterial(row);
    setActiveExterno(null);
    setSheetKind("material");
  };

  const openExternoSheet = (row: MuelleExternoCardRow) => {
    clearForm();
    setExternoAlbaran("");
    setExternoNotas("");
    setActiveExterno(row);
    setActiveMaterial(null);
    setSheetKind("externo");
  };

  const onSheetOpenChange = (open: boolean) => {
    if (!open) {
      clearForm();
      setActiveMaterial(null);
      setActiveExterno(null);
      setSheetKind("none");
      setExternoAlbaran("");
      setExternoNotas("");
    }
  };

  const hojasEsperadas = activeMaterial?.num_hojas_brutas ?? null;
  const hojasRecNum = useMemo(() => {
    const t = hojasRecibidas.trim();
    if (!t) return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }, [hojasRecibidas]);

  const paletsNum = useMemo(() => {
    const t = palets.trim();
    if (!t) return 0;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }, [palets]);

  /** Cierre operativo: albarán + hojas informadas (≥ 0); no se exige igualar el total pedido. */
  const puedeFinalizarRecepcionMaterial = useMemo(() => {
    if (!albaran.trim()) return false;
    if (hojasRecNum === null || hojasRecNum < 0) return false;
    return true;
  }, [albaran, hojasRecNum]);

  const esCompraRecibidoParcial = useMemo(
    () =>
      activeMaterial != null &&
      normalizeCompraEstado(activeMaterial.estado) === "recibido parcial",
    [activeMaterial]
  );

  /** Parcial: albarán + hojas &gt; 0 y menores que el pendiente (si hay total esperado). */
  const puedeRecepcionParcial = useMemo(() => {
    if (!albaran.trim()) return false;
    if (hojasRecNum === null || hojasRecNum <= 0) return false;
    if (hojasEsperadas == null) return true;
    return hojasRecNum < hojasEsperadas;
  }, [albaran, hojasRecNum, hojasEsperadas]);

  const puedeExternoParcial = useMemo(
    () => externoAlbaran.trim().length > 0 || externoNotas.trim().length > 0,
    [externoAlbaran, externoNotas]
  );

  const puedeExternoFinalizar = useMemo(
    () => externoAlbaran.trim().length > 0,
    [externoAlbaran]
  );

  const esExternoEnParcial = useMemo(
    () => activeExterno != null && activeExterno.estado === "Parcial",
    [activeExterno]
  );

  const onPickFotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next: File[] = [...fotoFiles];
    const urls: string[] = [...fotoPreviews];
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

  const guardarRecepcion = async (modo: "total" | "parcial") => {
    if (!activeMaterial) return;
    const alb = albaran.trim();
    if (!alb) {
      toast.error("El nº de albarán es obligatorio.");
      return;
    }
    if (hojasRecNum === null || hojasRecNum < 0) {
      toast.error("Indica las hojas recibidas (número entero ≥ 0).");
      return;
    }
    if (modo === "total" && !puedeFinalizarRecepcionMaterial) {
      toast.error(
        "Para finalizar la recepción indica albarán y hojas recibidas (entero ≥ 0)."
      );
      return;
    }
    if (modo === "parcial" && !puedeRecepcionParcial) {
      toast.error(
        "Recepción parcial: indica albarán y hojas recibidas (mayor que 0 y menores que las esperadas si hay total)."
      );
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const recepcionadoPorUuid =
        typeof user?.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id.trim())
          ? user.id.trim()
          : null;

      const hojasInt = Math.trunc(Number(hojasRecNum));
      const paletsInt = Math.trunc(Number(paletsNum));

      const ahora = new Date().toISOString();
      const estadoRecepcion = modo === "total" ? "Total" : "Parcial";

      const cerrandoMaterialDesdeParcial =
        modo === "total" &&
        normalizeCompraEstado(activeMaterial.estado) === "recibido parcial";
      const rawNotas = notas.trim();
      const notasPayload =
        modo === "total" && cerrandoMaterialDesdeParcial
          ? rawNotas
            ? `[Cierre final]: ${rawNotas}`
            : "[Cierre final]: "
          : rawNotas || null;

      const insertRow = {
        compra_id: activeMaterial.id,
        fecha_recepcion: ahora,
        albaran_proveedor: alb,
        hojas_recibidas: hojasInt,
        palets_recibidos: paletsInt,
        estado_recepcion: estadoRecepcion,
        notas: notasPayload,
        recepcionado_por: recepcionadoPorUuid,
      };

      // 1) Insertar fila de recepción (obtiene `recepcion_id` para fotos).
      const { data: recepIns, error: rErr } = await supabase
        .from(TABLE_RECEPCION)
        .insert(insertRow)
        .select("id")
        .single();
      if (rErr) throw rErr;
      const recepcionId = String((recepIns as { id: string }).id);

      // 2) Subir fotos e insertar en `prod_recepciones_fotos`.
      for (let i = 0; i < fotoFiles.length; i++) {
        const f = fotoFiles[i]!;
        const path = `${recepcionId}/${crypto.randomUUID()}.${extFromFile(f)}`;
        const { error: uErr } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(path, f, {
            cacheControl: "3600",
            upsert: false,
            contentType: f.type || "image/jpeg",
          });
        if (uErr) throw uErr;
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path);
        const { error: fErr } = await supabase.from(TABLE_RECEPCION_FOTOS).insert({
          recepcion_id: recepcionId,
          foto_url: publicUrl,
        });
        if (fErr) throw fErr;
      }

      // 3) Actualizar `prod_compra_material` solo después de persistir la recepción (y fotos).
      if (modo === "total") {
        const { error: upErr } = await supabase
          .from(TABLE_COMPRA)
          .update({
            estado: "Recibido",
            albaran_proveedor: alb,
            fecha_recepcion: ahora,
          })
          .eq("id", activeMaterial.id);
        if (upErr) throw upErr;
      } else {
        const { error: upErr } = await supabase
          .from(TABLE_COMPRA)
          .update({
            estado: "Recibido Parcial",
            albaran_proveedor: alb,
          })
          .eq("id", activeMaterial.id);
        if (upErr) throw upErr;
      }

      toast.success(
        modo === "total"
          ? "Recepción finalizada. Compra en estado Recibido."
          : "Recepción parcial registrada."
      );
      onSheetOpenChange(false);
      await loadRows();
    } catch (e) {
      logGuardarRecepcionError("guardarRecepcion", e);
      const o =
        e && typeof e === "object"
          ? (e as { message?: string; details?: string })
          : null;
      const toastMsg =
        [o?.message, o?.details].filter((x) => x && String(x).trim()).join(" — ") ||
        (e instanceof Error ? e.message : "Error al guardar la recepción.");
      toast.error(toastMsg);
    } finally {
      setSaving(false);
    }
  };

  const guardarRecepcionExternoParcial = async () => {
    if (!activeExterno) return;
    if (!externoAlbaran.trim() && !externoNotas.trim()) {
      toast.error("Indica albarán y/o notas para registrar la recepción parcial.");
      return;
    }
    setExternoSaving(true);
    try {
      const alb = externoAlbaran.trim();
      const extra = externoNotas.trim();
      const prev = (activeExterno.notas_logistica ?? "").trim();
      const bloques: string[] = [];
      if (prev) bloques.push(prev);
      if (alb) bloques.push(`[Muelle parcial] Albarán: ${alb}`);
      if (extra) bloques.push(`[Muelle parcial] ${extra}`);
      const notas_logistica = bloques.length > 0 ? bloques.join("\n") : null;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLE_SEGUIMIENTO_EXTERNOS)
        .update({
          estado: "Parcial",
          notas_logistica,
          updated_at: now,
        })
        .eq("id", activeExterno.id);
      if (error) throw error;
      toast.success("Recepción parcial registrada (sigue en muelle hasta el cierre).");
      onSheetOpenChange(false);
      await loadExternoRows();
    } catch (e) {
      logGuardarRecepcionError("guardarRecepcionExternoParcial", e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo registrar la recepción."
      );
    } finally {
      setExternoSaving(false);
    }
  };

  const guardarRecepcionExternoFinalizar = async () => {
    if (!activeExterno) return;
    if (!externoAlbaran.trim()) {
      toast.error("Indica el nº de albarán para finalizar la recepción.");
      return;
    }
    setExternoSaving(true);
    try {
      const alb = externoAlbaran.trim();
      const extra = externoNotas.trim();
      const prev = (activeExterno.notas_logistica ?? "").trim();
      const bloques: string[] = [];
      if (prev) bloques.push(prev);
      bloques.push(`[Muelle] Albarán: ${alb}`);
      if (activeExterno.estado === "Parcial") {
        bloques.push(
          extra ? `[Cierre final]: ${extra}` : "[Cierre final]: "
        );
      } else if (extra) {
        bloques.push(extra);
      }
      const notas_logistica = bloques.length > 0 ? bloques.join("\n") : null;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLE_SEGUIMIENTO_EXTERNOS)
        .update({
          estado: "Recibido",
          notas_logistica,
          updated_at: now,
        })
        .eq("id", activeExterno.id);
      if (error) throw error;
      toast.success("Recepción finalizada. Trabajo en estado Recibido.");
      onSheetOpenChange(false);
      await loadExternoRows();
    } catch (e) {
      logGuardarRecepcionError("guardarRecepcionExternoFinalizar", e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo registrar la recepción."
      );
    } finally {
      setExternoSaving(false);
    }
  };

  const tabTriggerClass =
    "rounded-md px-3 py-1.5 text-sm data-active:bg-[#C69C2B]/20 data-active:font-semibold data-active:text-[#002147] data-active:shadow-sm";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 sm:px-4 md:py-6">
      <header className="space-y-1">
        <h1 className="font-heading text-xl font-bold text-[#002147] md:text-2xl">
          Muelle
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Recepción en planta: material desde compras y trabajos externos en curso.
        </p>
      </header>

      <Tabs
        value={muelleTab}
        onValueChange={(v) => {
          if (v === "materiales" || v === "externos") {
            setMuelleTab(v);
            onSheetOpenChange(false);
          }
        }}
        className="w-full space-y-4"
      >
        <TabsList className="inline-flex h-auto w-fit flex-wrap gap-1 rounded-lg border border-slate-200/90 bg-slate-50/90 p-1">
          <TabsTrigger value="materiales" className={tabTriggerClass}>
            Materiales
          </TabsTrigger>
          <TabsTrigger value="externos" className={tabTriggerClass}>
            Externos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materiales" className="mt-0 outline-none">
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-8 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Cargando compras…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
              No hay líneas pendientes de recepción con los estados configurados.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => {
                const techLine = gramajeFormatoResumenLine(
                  row.gramaje,
                  row.tamano_hoja
                );
                return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openMaterialSheet(row)}
                  className={cn(
                    "text-left transition hover:ring-2 hover:ring-[#C69C2B]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002147]/30"
                  )}
                >
                  <Card className="h-full min-h-[11rem] border-slate-200/90 bg-white shadow-sm">
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <OtNumeroSemaforoBadge
                          otNumero={row.ot_numero}
                          fechaEntregaIso={row.fecha_entrega_maestro}
                          umbrales={umbralesOtsCompras}
                        />
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                          {row.estado?.trim() || "—"}
                        </span>
                      </div>
                      <CardTitle className="text-base leading-snug text-[#002147] md:text-lg">
                        {row.material?.trim() || "Material sin descripción"}
                      </CardTitle>
                      {techLine ? (
                        <p className="text-xs font-medium tabular-nums tracking-tight text-slate-700">
                          {techLine}
                        </p>
                      ) : null}
                      <CardDescription className="text-xs sm:text-sm">
                        Nº compra{" "}
                        <span className="font-mono font-medium text-foreground">
                          {row.num_compra || "—"}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-3">
                        <span className="text-muted-foreground">
                          Hojas esperadas
                        </span>
                        <span className="text-lg font-semibold tabular-nums text-[#002147]">
                          {row.num_hojas_brutas != null
                            ? row.num_hojas_brutas
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">
                          Proveedor
                        </span>
                        <span className="min-w-0 text-right font-medium leading-snug text-foreground">
                          {row.proveedor_nombre?.trim() || "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                        <Package className="size-3.5 shrink-0" aria-hidden />
                        Toca para recepcionar
                      </div>
                    </CardContent>
                  </Card>
                </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="externos" className="mt-0 outline-none">
          <p className="mb-3 max-w-2xl text-xs text-muted-foreground">
            Trabajos en curso (Enviado, En proveedor, Retrasado, Acabado en
            proveedor o Parcial). «Recepción parcial» deja el seguimiento en
            Parcial; «Finalizar recepción» pasa a Recibido y quita la tarjeta del
            muelle.
          </p>
          {loadingExternos ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-8 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Cargando externos…
            </div>
          ) : externoRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
              No hay trabajos externos pendientes de recepción con los estados
              indicados.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {externoRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openExternoSheet(row)}
                  className={cn(
                    "text-left transition hover:ring-2 hover:ring-[#C69C2B]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002147]/30"
                  )}
                >
                  <Card className="h-full min-h-[11rem] border-slate-200/90 bg-white shadow-sm">
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <OtNumeroSemaforoBadge
                          otNumero={row.ot_numero}
                          fechaEntregaIso={row.f_entrega_ot}
                          umbrales={umbralesOtsCompras}
                        />
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                          {row.estado?.trim() || "—"}
                        </span>
                      </div>
                      <CardTitle className="text-base leading-snug text-[#002147] md:text-lg">
                        {row.trabajo_titulo?.trim() || "Sin título"}
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Cliente{" "}
                        <span className="font-medium text-foreground">
                          {row.cliente_nombre?.trim() || "—"}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-3">
                        <span className="text-muted-foreground">
                          F. prevista
                        </span>
                        <span className="text-right font-semibold tabular-nums text-[#002147]">
                          {row.fecha_prevista
                            ? formatFechaEsCorta(row.fecha_prevista)
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">
                          Proveedor
                        </span>
                        <span className="min-w-0 text-right font-medium leading-snug text-foreground">
                          {row.proveedor_nombre?.trim() || "—"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">Acabado</span>
                        <span className="min-w-0 text-right text-foreground">
                          {row.acabado_nombre?.trim() || "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                        <Package className="size-3.5 shrink-0" aria-hidden />
                        Toca para recepcionar
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          onPickFotos(e.target.files);
          e.target.value = "";
        }}
      />

      <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[min(92vh,720px)] overflow-y-auto rounded-t-2xl sm:max-w-lg sm:rounded-t-2xl md:left-auto md:right-4 md:top-4 md:h-[min(92vh,680px)] md:max-h-none md:w-full md:max-w-md md:rounded-xl"
        >
          {sheetKind === "material" && activeMaterial ? (
            <>
              <SheetHeader className="border-b border-slate-100 pb-3 text-left">
                <SheetTitle className="text-lg">
                  Recepción · OT{" "}
                  <span className="font-mono font-semibold text-[#002147]">
                    {activeMaterial.ot_numero}
                  </span>
                </SheetTitle>
                <SheetDescription className="text-left text-xs sm:text-sm">
                  {activeMaterial.material?.trim() || "—"} · Esperadas:{" "}
                  {activeMaterial.num_hojas_brutas != null
                    ? activeMaterial.num_hojas_brutas
                    : "—"}{" "}
                  hojas
                </SheetDescription>
              </SheetHeader>

              <div
                className="mx-1 mt-3 rounded-lg border border-[#002147]/20 bg-[#002147]/[0.04] px-3 py-2.5 text-sm leading-snug text-[#002147] shadow-inner"
                role="region"
                aria-label="Datos técnicos pedido"
              >
                <span className="font-semibold">Gramaje pedido:</span>{" "}
                <span className="tabular-nums">
                  {activeMaterial.gramaje != null &&
                  Number.isFinite(activeMaterial.gramaje)
                    ? `${gramajeTextoGg(activeMaterial.gramaje)}g`
                    : "—"}
                </span>
                <span className="mx-1.5 text-slate-400" aria-hidden>
                  |
                </span>
                <span className="font-semibold">Formato pedido:</span>{" "}
                <span className="font-mono text-[13px]">
                  {activeMaterial.tamano_hoja?.trim() || "—"}
                </span>
              </div>

              <div className="flex flex-col gap-4 px-1 py-4">
                <div className="space-y-2">
                  <Label htmlFor="muelle-albaran">Nº albarán proveedor</Label>
                  <Input
                    id="muelle-albaran"
                    value={albaran}
                    onChange={(e) => setAlbaran(e.target.value)}
                    placeholder="Obligatorio"
                    autoComplete="off"
                    className="text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="muelle-hojas">Hojas recibidas</Label>
                    <Input
                      id="muelle-hojas"
                      inputMode="numeric"
                      value={hojasRecibidas}
                      onChange={(e) => setHojasRecibidas(e.target.value)}
                      placeholder="0"
                      className="tabular-nums"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="muelle-palets">Palets</Label>
                    <Input
                      id="muelle-palets"
                      inputMode="numeric"
                      value={palets}
                      onChange={(e) => setPalets(e.target.value)}
                      placeholder="0"
                      className="tabular-nums"
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border-2 border-[#002147]/20 bg-slate-50/80 p-3 ring-1 ring-slate-200/80">
                  <Label
                    htmlFor="muelle-notas"
                    className="text-sm font-semibold text-[#002147]"
                  >
                    Notas (recepción)
                  </Label>
                  <Textarea
                    id="muelle-notas"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder={
                      esCompraRecibidoParcial
                        ? "Al finalizar desde «Recibido Parcial», se antepondrá [Cierre final]: a lo que escribas."
                        : "Incidencias, bultos, observaciones… (recomendado en parciales)"
                    }
                    rows={5}
                    className="resize-y border-slate-300 bg-white text-base shadow-inner"
                  />
                  {hojasEsperadas != null &&
                  hojasRecNum !== null &&
                  hojasRecNum < hojasEsperadas ? (
                    <p className="text-xs text-amber-800">
                      Hojas por debajo de las esperadas: usa «Recepción parcial»,
                      o «Finalizar recepción» si ya cierras el pedido aunque no
                      cuadren con el total.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      «Finalizar recepción» cierra la compra en Recibido aunque las
                      hojas no coincidan con el pedido original.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Fotos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2 border-dashed py-6 text-base"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="size-5 shrink-0" aria-hidden />
                    Añadir foto
                  </Button>
                  {fotoPreviews.length > 0 ? (
                    <ul className="grid grid-cols-3 gap-2">
                      {fotoPreviews.map((src, i) => (
                        <li
                          key={src}
                          className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <img
                            src={src}
                            alt={`Foto ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute right-1 bottom-1 h-7 px-2 text-[10px]"
                            onClick={() => removeFotoAt(i)}
                          >
                            Quitar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <SheetFooter className="flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-col">
                <Button
                  type="button"
                  className="w-full bg-emerald-700 text-white hover:bg-emerald-800"
                  disabled={saving || !puedeFinalizarRecepcionMaterial}
                  onClick={() => void guardarRecepcion("total")}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : esCompraRecibidoParcial ? (
                    "Finalizar recepción (Cerrar)"
                  ) : (
                    "Finalizar recepción"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={saving || !puedeRecepcionParcial}
                  onClick={() => void guardarRecepcion("parcial")}
                >
                  Recepción parcial
                </Button>
              </SheetFooter>
            </>
          ) : null}

          {sheetKind === "externo" && activeExterno ? (
            <>
              <SheetHeader className="border-b border-slate-100 pb-3 text-left">
                <SheetTitle className="text-lg">
                  Recepción externo · OT{" "}
                  <span className="font-mono font-semibold text-[#002147]">
                    {activeExterno.ot_numero}
                  </span>
                </SheetTitle>
                <SheetDescription className="text-left text-xs sm:text-sm">
                  {activeExterno.trabajo_titulo?.trim() || "—"} ·{" "}
                  {activeExterno.cliente_nombre?.trim() || "—"}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-1 py-4">
                <div className="space-y-2">
                  <Label htmlFor="muelle-ext-alb">
                    Nº albarán{" "}
                    <span className="font-normal text-muted-foreground">
                      (obligatorio al finalizar)
                    </span>
                  </Label>
                  <Input
                    id="muelle-ext-alb"
                    value={externoAlbaran}
                    onChange={(e) => setExternoAlbaran(e.target.value)}
                    placeholder="Ej. albarán proveedor"
                    autoComplete="off"
                    className="text-base"
                  />
                </div>
                <div className="space-y-2 rounded-lg border-2 border-[#002147]/20 bg-slate-50/80 p-3 ring-1 ring-slate-200/80">
                  <Label
                    htmlFor="muelle-ext-notas"
                    className="text-sm font-semibold text-[#002147]"
                  >
                    Notas (recepción)
                  </Label>
                  <Textarea
                    id="muelle-ext-notas"
                    value={externoNotas}
                    onChange={(e) => setExternoNotas(e.target.value)}
                    placeholder={
                      esExternoEnParcial
                        ? "Al finalizar desde Parcial se antepondrá [Cierre final]: a lo que escribas."
                        : "Ej. 2 palets de 5 recibidos, incidencias…"
                    }
                    rows={5}
                    className="resize-y border-slate-300 bg-white text-base shadow-inner"
                  />
                  <p className="text-xs text-muted-foreground">
                    Parcial: basta albarán o notas. Finalizar: albarán obligatorio;
                    si venías de Parcial, el cierre añade el prefijo [Cierre final]:.
                  </p>
                </div>
              </div>
              <SheetFooter className="flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-col">
                <Button
                  type="button"
                  className="w-full bg-emerald-700 text-white hover:bg-emerald-800"
                  disabled={externoSaving || !puedeExternoFinalizar}
                  onClick={() => void guardarRecepcionExternoFinalizar()}
                >
                  {externoSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : esExternoEnParcial ? (
                    "Finalizar recepción (Cerrar)"
                  ) : (
                    "Finalizar recepción"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={externoSaving || !puedeExternoParcial}
                  onClick={() => void guardarRecepcionExternoParcial()}
                >
                  Recepción parcial
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
