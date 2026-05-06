"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
} from "@tanstack/react-table";
import { Camera, Loader2, Package, X } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** Cliente de la OT (`prod_ots_general.cliente`). */
  cliente_nombre: string | null;
  estado: string | null;
  fecha_entrega_maestro: string | null;
  /** Notas de compra (Jordi), visibles al recepcionar. */
  notas: string | null;
};

type MuelleExternoCardRow = {
  id: string;
  ot_numero: string;
  /** Cantidad pedida (`prod_seguimiento_externos.unidades`). */
  unidades: number | null;
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

const muelleMaterialesGlobalFilterFn: FilterFn<MuelleCardRow> = (
  row,
  _columnId,
  filterValue
) => {
  const q = String(filterValue ?? "").trim().toLowerCase();
  if (!q) return true;
  const r = row.original;
  const parts = [r.ot_numero, r.proveedor_nombre, r.material, r.cliente_nombre].map(
    (x) => String(x ?? "").toLowerCase()
  );
  return parts.some((s) => s.includes(q));
};

function MuelleSearchField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-4 max-w-md">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-muted-foreground"
        aria-hidden
      >
        🔍
      </span>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 pr-10 pl-9"
        autoComplete="off"
      />
      {value.trim() ? (
        <button
          type="button"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
        >
          <X className="size-4 shrink-0" aria-hidden />
        </button>
      ) : null}
    </div>
  );
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
  const [materialesGlobalFilter, setMaterialesGlobalFilter] = useState("");
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");

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
  const [externoCantidadRecibida, setExternoCantidadRecibida] = useState("");
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
          "id, ot_numero, num_compra, material, gramaje, tamano_hoja, num_hojas_brutas, proveedor_id, estado, notas"
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
      const masterByOt = new Map<
        string,
        { fecha_entrega: string | null; cliente: string | null }
      >();
      if (otKeys.length > 0) {
        const { data: masters, error: mErr } = await supabase
          .from(TABLE_MASTER)
          .select("num_pedido, fecha_entrega, cliente")
          .in("num_pedido", otKeys);
        if (mErr) throw mErr;
        for (const m of masters ?? []) {
          const row = m as {
            num_pedido: string | null;
            fecha_entrega: string | null;
            cliente: string | null;
          };
          const k = String(row.num_pedido ?? "").trim();
          if (k)
            masterByOt.set(k, {
              fecha_entrega: row.fecha_entrega ?? null,
              cliente: row.cliente ?? null,
            });
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
        const clienteRaw = m?.cliente;
        const clienteTrim =
          clienteRaw != null && String(clienteRaw).trim() !== ""
            ? String(clienteRaw).trim()
            : null;
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
          cliente_nombre: clienteTrim,
          estado: (raw.estado as string | null) ?? null,
          fecha_entrega_maestro: m?.fecha_entrega ?? null,
          notas: String((raw.notas as string | null | undefined) ?? "").trim() || null,
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
          "id, OT, id_pedido, cliente_nombre, trabajo_titulo, estado, proveedor_id, acabado_id, fecha_prevista, f_entrega_ot, notas_logistica, unidades, updated_at, created_at"
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
        const uRaw = raw.unidades;
        const unidadesParsed =
          typeof uRaw === "number"
            ? Number.isFinite(uRaw)
              ? Math.trunc(uRaw)
              : null
            : uRaw != null && uRaw !== ""
              ? (() => {
                  const n = Number(uRaw);
                  return Number.isFinite(n) ? Math.trunc(n) : null;
                })()
              : null;
        return {
          id: String(raw.id ?? ""),
          ot_numero: otDisplayFromSeguimientoRaw(raw),
          unidades: unidadesParsed,
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
    setExternoCantidadRecibida("");
    setActiveMaterial(row);
    setActiveExterno(null);
    setSheetKind("material");
  };

  const openExternoSheet = (row: MuelleExternoCardRow) => {
    clearForm();
    setExternoAlbaran("");
    setExternoNotas("");
    setExternoCantidadRecibida("");
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
      setExternoCantidadRecibida("");
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

  /** Cierre operativo: hojas informadas (≥ 0); no se exige albarán ni igualar el total pedido. */
  const puedeFinalizarRecepcionMaterial = useMemo(() => {
    if (hojasRecNum === null || hojasRecNum < 0) return false;
    return true;
  }, [hojasRecNum]);

  const esCompraRecibidoParcial = useMemo(
    () =>
      activeMaterial != null &&
      normalizeCompraEstado(activeMaterial.estado) === "recibido parcial",
    [activeMaterial]
  );

  /** Parcial: hojas &gt; 0 y menores que el pendiente (si hay total esperado). */
  const puedeRecepcionParcial = useMemo(() => {
    if (hojasRecNum === null || hojasRecNum <= 0) return false;
    if (hojasEsperadas == null) return true;
    return hojasRecNum < hojasEsperadas;
  }, [hojasRecNum, hojasEsperadas]);

  const externoCantEsperada = activeExterno?.unidades ?? null;
  const externoCantRecNum = useMemo(() => {
    const t = externoCantidadRecibida.trim();
    if (!t) return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }, [externoCantidadRecibida]);

  /** Parcial: cantidad recibida &gt; 0 y menor que la pedida (si hay pedido). */
  const puedeExternoParcial = useMemo(() => {
    if (externoCantRecNum === null || externoCantRecNum <= 0) return false;
    if (externoCantEsperada == null) return true;
    return externoCantRecNum < externoCantEsperada;
  }, [externoCantRecNum, externoCantEsperada]);

  /** Finalizar: cantidad recibida informada (≥ 0); cierre manual sin exigir albarán ni cuadrar. */
  const puedeExternoFinalizar = useMemo(() => {
    if (externoCantRecNum === null || externoCantRecNum < 0) return false;
    return true;
  }, [externoCantRecNum]);

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
    if (hojasRecNum === null || hojasRecNum < 0) {
      toast.error("Indica las hojas recibidas (número entero ≥ 0).");
      return;
    }
    if (modo === "total" && !puedeFinalizarRecepcionMaterial) {
      toast.error(
        "Para finalizar la recepción indica hojas recibidas (entero ≥ 0)."
      );
      return;
    }
    if (modo === "parcial" && !puedeRecepcionParcial) {
      toast.error(
        "Recepción parcial: indica hojas recibidas (mayor que 0 y menores que las esperadas si hay total)."
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
      const recepcionadoPorEmail =
        typeof user?.email === "string" && user.email.trim().length > 0
          ? user.email.trim()
          : null;
      const recepcionadoPorNombre =
        typeof user?.user_metadata?.full_name === "string" &&
        user.user_metadata.full_name.trim().length > 0
          ? user.user_metadata.full_name.trim()
          : typeof user?.user_metadata?.name === "string" &&
              user.user_metadata.name.trim().length > 0
            ? user.user_metadata.name.trim()
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
        albaran_proveedor: alb || null,
        hojas_recibidas: hojasInt,
        palets_recibidos: paletsInt,
        estado_recepcion: estadoRecepcion,
        notas: notasPayload,
        recepcionado_por: recepcionadoPorUuid,
        recepcionado_por_email: recepcionadoPorEmail,
        recepcionado_por_nombre: recepcionadoPorNombre,
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
            albaran_proveedor: alb || null,
            fecha_recepcion: ahora,
          })
          .eq("id", activeMaterial.id);
        if (upErr) throw upErr;
      } else {
        const { error: upErr } = await supabase
          .from(TABLE_COMPRA)
          .update({
            estado: "Recibido Parcial",
            albaran_proveedor: alb || null,
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
    if (!puedeExternoParcial) {
      toast.error(
        "Recepción parcial: indica cantidad recibida (mayor que 0 y menor que la esperada si hay cantidad pedida)."
      );
      return;
    }
    const rec = externoCantRecNum!;
    setExternoSaving(true);
    try {
      const alb = externoAlbaran.trim();
      const extra = externoNotas.trim();
      const prev = (activeExterno.notas_logistica ?? "").trim();
      const bloques: string[] = [];
      if (prev) bloques.push(prev);
      if (alb) bloques.push(`[Muelle parcial] Albarán: ${alb}`);
      const esp = activeExterno.unidades;
      bloques.push(
        esp != null && Number.isFinite(esp)
          ? `[Muelle parcial] Cant. recibida: ${rec} uds (pedidas: ${esp})`
          : `[Muelle parcial] Cant. recibida: ${rec} uds`
      );
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
    if (!puedeExternoFinalizar) {
      toast.error(
        "Para finalizar indica cantidad recibida (número entero ≥ 0)."
      );
      return;
    }
    const rec = externoCantRecNum!;
    setExternoSaving(true);
    try {
      const alb = externoAlbaran.trim();
      const extra = externoNotas.trim();
      const prev = (activeExterno.notas_logistica ?? "").trim();
      const bloques: string[] = [];
      if (prev) bloques.push(prev);
      if (alb) bloques.push(`[Muelle] Albarán: ${alb}`);
      bloques.push(`[Muelle] Cant. recibida: ${rec} uds`);
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

  const materialesColumns = useMemo<ColumnDef<MuelleCardRow>[]>(
    () => [{ accessorKey: "ot_numero", header: "OT" }],
    []
  );

  const materialesTable = useReactTable({
    data: rows,
    columns: materialesColumns,
    state: { globalFilter: materialesGlobalFilter },
    onGlobalFilterChange: setMaterialesGlobalFilter,
    globalFilterFn: muelleMaterialesGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const materialesFilteredRows = materialesTable.getRowModel().rows;

  const externoRowsFiltered = useMemo(() => {
    const q = globalSearchTerm.trim().toLowerCase();
    if (!q) return externoRows;
    return externoRows.filter((row) => {
      const parts = [
        row.ot_numero,
        row.cliente_nombre,
        row.proveedor_nombre,
        row.trabajo_titulo,
      ].map((x) => String(x ?? "").toLowerCase());
      return parts.some((s) => s.includes(q));
    });
  }, [externoRows, globalSearchTerm]);

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
            <>
              <MuelleSearchField
                id="muelle-materiales-buscar"
                value={materialesGlobalFilter}
                onChange={setMaterialesGlobalFilter}
                placeholder="Buscar por OT, proveedor, material o cliente…"
              />
              {materialesFilteredRows.length === 0 ? (
                <div className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
                  Ningún resultado coincide con la búsqueda. Prueba con otro
                  término o limpia el filtro.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {materialesFilteredRows.map((tr) => {
                    const row = tr.original;
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
                                className="[&>span:first-child]:text-[15px]"
                              />
                              <span className="max-w-full truncate text-xs font-medium text-slate-600 sm:text-sm">
                                - {row.cliente_nombre?.trim() || "—"}
                              </span>
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
            </>
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
            <>
              <MuelleSearchField
                id="muelle-externos-buscar"
                value={globalSearchTerm}
                onChange={setGlobalSearchTerm}
                placeholder="Buscar por OT, cliente, taller o descripción…"
              />
              {externoRowsFiltered.length === 0 ? (
                <div className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
                  Ningún resultado coincide con la búsqueda. Prueba con otro
                  término o limpia el filtro.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {externoRowsFiltered.map((row) => (
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
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <OtNumeroSemaforoBadge
                                otNumero={row.ot_numero}
                                fechaEntregaIso={row.f_entrega_ot}
                                umbrales={umbralesOtsCompras}
                              />
                              <span
                                className="shrink-0 rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#002147]"
                                title="Cantidad pedida"
                              >
                                {row.unidades != null &&
                                Number.isFinite(row.unidades)
                                  ? `${row.unidades} uds`
                                  : "Sin cant."}
                              </span>
                            </div>
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
            </>
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

      <Dialog open={sheetOpen} onOpenChange={onSheetOpenChange}>
        <DialogContent
          className="max-h-[min(92vh,720px)] w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl sm:max-w-2xl"
        >
          {sheetKind === "material" && activeMaterial ? (
            <>
              <DialogHeader className="border-b border-slate-100 pb-3 text-left">
                <DialogTitle className="text-lg">
                  Recepción · OT{" "}
                  <span className="font-mono font-semibold text-[#002147]">
                    {activeMaterial.ot_numero}
                  </span>
                  <span className="ml-2 text-sm font-medium text-slate-600">
                    - {activeMaterial.cliente_nombre?.trim() || "—"}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-left text-xs sm:text-sm">
                  {activeMaterial.material?.trim() || "—"} · Esperadas:{" "}
                  {activeMaterial.num_hojas_brutas != null
                    ? activeMaterial.num_hojas_brutas
                    : "—"}{" "}
                  hojas
                </DialogDescription>
              </DialogHeader>

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
              {activeMaterial.notas?.trim() ? (
                <div
                  className="mx-1 mt-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm leading-snug text-amber-950 shadow-inner"
                  role="region"
                  aria-label="Notas de compra"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                    Notas compra (Jordi)
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{activeMaterial.notas}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 px-1 py-4">
                <div className="space-y-2">
                  <Label htmlFor="muelle-albaran">Nº albarán proveedor</Label>
                  <Input
                    id="muelle-albaran"
                    value={albaran}
                    onChange={(e) => setAlbaran(e.target.value)}
                    placeholder="Opcional"
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

              <DialogFooter className="flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-col">
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
              </DialogFooter>
            </>
          ) : null}

          {sheetKind === "externo" && activeExterno ? (
            <>
              <DialogHeader className="border-b border-slate-100 pb-3 text-left">
                <DialogTitle className="text-lg">
                  Recepción externo · OT{" "}
                  <span className="font-mono font-semibold text-[#002147]">
                    {activeExterno.ot_numero}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-left text-xs sm:text-sm">
                  {activeExterno.trabajo_titulo?.trim() || "—"} ·{" "}
                  {activeExterno.cliente_nombre?.trim() || "—"}
                </DialogDescription>
              </DialogHeader>

              <div
                className="mx-1 mt-3 rounded-lg border border-[#002147]/20 bg-[#002147]/[0.04] px-3 py-2.5 text-sm leading-snug text-[#002147] shadow-inner"
                role="region"
                aria-label="Cantidad pedida"
              >
                <span className="font-semibold">Cantidad esperada:</span>{" "}
                <span className="tabular-nums">
                  {activeExterno.unidades != null &&
                  Number.isFinite(activeExterno.unidades)
                    ? `${activeExterno.unidades} unidades`
                    : "— (sin dato en sistema)"}
                </span>
              </div>

              <div className="flex flex-col gap-4 px-1 py-4">
                <div className="space-y-2">
                  <Label htmlFor="muelle-ext-alb">Nº albarán proveedor</Label>
                  <Input
                    id="muelle-ext-alb"
                    value={externoAlbaran}
                    onChange={(e) => setExternoAlbaran(e.target.value)}
                    placeholder="Opcional"
                    autoComplete="off"
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="muelle-ext-cant">Cantidad recibida</Label>
                  <Input
                    id="muelle-ext-cant"
                    inputMode="numeric"
                    value={externoCantidadRecibida}
                    onChange={(e) => setExternoCantidadRecibida(e.target.value)}
                    placeholder="0"
                    className="tabular-nums text-base"
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
                        : "Incidencias, bultos, observaciones… (recomendado en parciales)"
                    }
                    rows={5}
                    className="resize-y border-slate-300 bg-white text-base shadow-inner"
                  />
                  {activeExterno.unidades != null &&
                  Number.isFinite(activeExterno.unidades) &&
                  externoCantRecNum !== null &&
                  externoCantRecNum < activeExterno.unidades ? (
                    <p className="text-xs text-amber-800">
                      Cantidad por debajo de la pedida: usa «Recepción parcial», o
                      «Finalizar recepción» si cierras el trabajo aunque no cuadre
                      con el total.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      «Finalizar recepción» pasa a Recibido aunque la cantidad no
                      coincida con la pedida (cierre manual).
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-col">
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
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
