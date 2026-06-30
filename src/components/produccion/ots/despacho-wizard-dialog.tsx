"use client";

import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DespachoItinerarioPicker,
  type DespachoItinerarioSlot,
} from "@/components/produccion/ots/despacho-itinerario-picker";
import {
  ReferenciaMinervaPicker,
  type ReferenciaMinervaValue,
} from "@/components/produccion/ots/referencia-minerva-picker";
import { TroquelPickerField } from "@/components/produccion/ots/troquel-picker-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  applyClonePrefill,
  buildDatosProcesoSeed,
  DESPACHO_CLONE_SELECT,
  DESPACHO_WIZARD_TABS,
  emptyDespachoForm,
  emptyDespachoMeta,
  emptyDespachoWizardProcesoDatos,
  estuchesEstimadosDespacho,
  formatFechaEntregaCorta,
  hojasBrutasCompraDespacho,
  hojasBrutasImpresionDespacho,
  integerOrZeroForDespacho,
  numberOrZeroForDespacho,
  parseDescripcionReferenciaFromTitulo,
  parseOptionalDecimalInput,
  parseProcesoDatosFromPasos,
  parseReferenciaClienteFromTitulo,
  PROCESO_CTP_ID,
  PROCESO_DESBROCE_ID,
  PROCESO_DIGITAL_ID,
  PROCESO_ENGOMADO_ID,
  PROCESO_EXTERNO_IDS,
  PROCESO_GUILLOTINA_ID,
  PROCESO_MANIPULADOS_ID,
  PROCESO_OFFSET_ID,
  PROCESO_TROQUEL_ID,
  TABLE_COMPRA,
  TABLE_OT_DESPACHADAS,
  TABLE_OT_PASOS,
  TABLE_OTS,
  type DespachoCatalogItem,
  type DespachoFormState,
  type DespachoMeta,
  type DespachoSeleccion,
  type DespachoWizardTab,
  type DespachoWizardProcesoDatos,
  type ReferenciaHistorialRow,
} from "@/lib/despacho-wizard-shared";
import { CTP_REQUISITO_DEFS, buildCtpRequisitosSeedFromWizard, formatCtpRequisitosResumen, mergeDatosProcesoSeed } from "@/lib/ctp-despacho";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type { ProdReferenciaRow } from "@/types/prod-referencias";

export type DespachoWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** OT precargada al abrir (p. ej. fila seleccionada en maestro). */
  initialOt?: string | null;
  /** Racha Tiburón: mantener modal tras guardar. Default on sin initialOt. */
  batchModeDefault?: boolean;
  onDespachado?: (info: { ot: string; rowId: string }) => void;
};

function tabIndex(tab: DespachoWizardTab): number {
  return DESPACHO_WIZARD_TABS.findIndex((t) => t.id === tab);
}

function nextTab(tab: DespachoWizardTab): DespachoWizardTab | null {
  const i = tabIndex(tab);
  return DESPACHO_WIZARD_TABS[i + 1]?.id ?? null;
}

function prevTab(tab: DespachoWizardTab): DespachoWizardTab | null {
  const i = tabIndex(tab);
  return i > 0 ? DESPACHO_WIZARD_TABS[i - 1]!.id : null;
}

export function DespachoWizardDialog({
  open,
  onOpenChange,
  initialOt,
  batchModeDefault = false,
  onDespachado,
}: DespachoWizardDialogProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const otInputRef = useRef<HTMLInputElement | null>(null);

  const [wizardTab, setWizardTab] = useState<DespachoWizardTab>("cabecera");
  const [otInput, setOtInput] = useState("");
  const [seleccion, setSeleccion] = useState<DespachoSeleccion | null>(null);
  const [meta, setMeta] = useState<DespachoMeta>(emptyDespachoMeta);
  const [yaDespachada, setYaDespachada] = useState(false);
  const [compraGenerada, setCompraGenerada] = useState(false);
  const [loadingOt, setLoadingOt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchMode, setBatchMode] = useState(batchModeDefault);
  const [form, setForm] = useState<DespachoFormState>(() => emptyDespachoForm());
  const [itinerarioSlots, setItinerarioSlots] = useState<DespachoItinerarioSlot[]>(
    []
  );
  const [procesoDatos, setProcesoDatos] = useState<DespachoWizardProcesoDatos>(
    () => emptyDespachoWizardProcesoDatos()
  );
  const [catalog, setCatalog] = useState<DespachoCatalogItem[]>([]);
  const [referenciaHistorial, setReferenciaHistorial] = useState<
    ReferenciaHistorialRow[]
  >([]);
  const [referenciaHistorialLoading, setReferenciaHistorialLoading] =
    useState(false);

  const resetWizard = useCallback(() => {
    setWizardTab("cabecera");
    setOtInput("");
    setSeleccion(null);
    setMeta(emptyDespachoMeta());
    setYaDespachada(false);
    setCompraGenerada(false);
    setForm(emptyDespachoForm());
    setItinerarioSlots([]);
    setProcesoDatos(emptyDespachoWizardProcesoDatos());
    setReferenciaHistorial([]);
  }, []);

  const hydrateForOt = useCallback(
    async (otRaw: string) => {
      const ot = String(otRaw ?? "").trim();
      if (!ot) {
        toast.error("Indica una OT válida.");
        return;
      }
      setLoadingOt(true);
      try {
        const { data: masterRow, error: masterErr } = await supabase
          .from(TABLE_OTS)
          .select(
            "id, num_pedido, despachado, cliente, titulo, cantidad, pedido_cliente, fecha_entrega"
          )
          .eq("num_pedido", ot)
          .maybeSingle();
        if (masterErr) throw masterErr;
        if (!masterRow || typeof masterRow.id !== "string") {
          toast.error(`No existe la OT ${ot} en maestro.`);
          setSeleccion(null);
          setYaDespachada(false);
          setCompraGenerada(false);
          setMeta(emptyDespachoMeta());
          setItinerarioSlots([]);
          setForm(emptyDespachoForm());
          setProcesoDatos(emptyDespachoWizardProcesoDatos());
          return;
        }
        const sel: DespachoSeleccion = {
          id: String(masterRow.id),
          num_pedido: String(masterRow.num_pedido ?? ot).trim(),
        };
        setSeleccion(sel);
        setOtInput(sel.num_pedido);
        setMeta({
          cliente: String(
            (masterRow as { cliente?: string | null }).cliente ?? ""
          ).trim(),
          trabajo: String(
            (masterRow as { titulo?: string | null }).titulo ?? ""
          ).trim(),
          cantidad:
            (masterRow as { cantidad?: number | null }).cantidad == null
              ? ""
              : String((masterRow as { cantidad?: number | null }).cantidad),
          pedido_cliente: String(
            (masterRow as { pedido_cliente?: string | null }).pedido_cliente ??
              ""
          ).trim(),
          fecha_entrega: String(
            (masterRow as { fecha_entrega?: string | null }).fecha_entrega ?? ""
          ).trim(),
        });

        const [
          { data: despachoRow, error: despachoErr },
          { data: pasosRows, error: pasosErr },
          { data: catRows, error: catErr },
          { data: compraRows, error: compraErr },
        ] = await Promise.all([
          supabase
            .from(TABLE_OT_DESPACHADAS)
            .select(
              "tintas, material, tamano_hoja, gramaje, num_hojas_brutas, num_hojas_netas, horas_entrada, horas_tiraje, horas_estimadas_troquelado, horas_estimadas_engomado, tipo_engomado, troquel, poses, acabado_pral, notas, referencia_id, ot_anterior_numero, ot_anterior_id"
            )
            .eq("ot_numero", sel.num_pedido)
            .maybeSingle(),
          supabase
            .from(TABLE_OT_PASOS)
            .select("proceso_id, orden, datos_proceso")
            .eq("ot_id", sel.id)
            .order("orden", { ascending: true }),
          supabase.from("prod_procesos_cat").select("id, nombre"),
          supabase
            .from(TABLE_COMPRA)
            .select("id")
            .eq("ot_numero", sel.num_pedido)
            .limit(1),
        ]);
        if (despachoErr) throw despachoErr;
        if (pasosErr) throw pasosErr;
        if (catErr) throw catErr;
        if (compraErr) throw compraErr;

        const d = (despachoRow ?? {}) as Record<string, unknown>;
        setYaDespachada(
          Boolean((masterRow as { despachado?: boolean | null }).despachado) ||
            despachoRow != null
        );
        setCompraGenerada(Boolean((compraRows ?? []).length > 0));
        setForm({
          tintas: String(d.tintas ?? ""),
          material: String(d.material ?? ""),
          tamano_hoja: String(d.tamano_hoja ?? ""),
          gramaje: d.gramaje == null ? "" : String(d.gramaje),
          num_hojas_brutas:
            d.num_hojas_brutas == null ? "" : String(d.num_hojas_brutas),
          num_hojas_netas:
            d.num_hojas_netas == null ? "" : String(d.num_hojas_netas),
          horas_entrada: d.horas_entrada == null ? "" : String(d.horas_entrada),
          horas_tiraje: d.horas_tiraje == null ? "" : String(d.horas_tiraje),
          horas_estimadas_troquelado:
            d.horas_estimadas_troquelado == null
              ? ""
              : String(d.horas_estimadas_troquelado),
          horas_estimadas_engomado:
            d.horas_estimadas_engomado == null
              ? ""
              : String(d.horas_estimadas_engomado),
          tipo_engomado: String(d.tipo_engomado ?? ""),
          troquel: String(d.troquel ?? ""),
          poses: d.poses == null ? "" : String(d.poses),
          acabado_pral: String(d.acabado_pral ?? ""),
          notas: String(d.notas ?? ""),
          referencia_id:
            typeof d.referencia_id === "string" ? d.referencia_id : null,
          referencia_codigo: "",
          ot_anterior_numero: String(d.ot_anterior_numero ?? ""),
          ot_anterior_id:
            typeof d.ot_anterior_id === "string" ? d.ot_anterior_id : null,
        });

        if (typeof d.referencia_id === "string" && d.referencia_id) {
          void supabase
            .from("prod_referencias")
            .select("codigo")
            .eq("id", d.referencia_id)
            .maybeSingle()
            .then(({ data: refRow }) => {
              const codigo = String(
                (refRow as { codigo?: string | null } | null)?.codigo ?? ""
              ).trim();
              if (codigo) {
                setForm((f) => ({ ...f, referencia_codigo: codigo }));
              }
            });
        }

        const nombreById = new Map<number, string>();
        for (const c of (catRows ?? []) as Array<{
          id: number;
          nombre: string | null;
        }>) {
          nombreById.set(c.id, String(c.nombre ?? `Proceso #${c.id}`));
        }
        const nextSlots: DespachoItinerarioSlot[] = (
          (pasosRows ?? []) as Array<{ proceso_id: number; orden: number }>
        )
          .sort((a, b) => a.orden - b.orden)
          .map((p) => ({
            key: crypto.randomUUID(),
            procesoId: p.proceso_id,
            nombre: nombreById.get(p.proceso_id) ?? `Proceso #${p.proceso_id}`,
          }));
        setItinerarioSlots(nextSlots);

        const parsedProceso = parseProcesoDatosFromPasos(
          (pasosRows ?? []) as Array<{
            proceso_id: number;
            datos_proceso?: unknown;
          }>
        );
        const hojasBrutasCompra = String(d.num_hojas_brutas ?? "");
        if (!parsedProceso.guillotina.hojas_iniciales && hojasBrutasCompra) {
          parsedProceso.guillotina.hojas_iniciales = hojasBrutasCompra;
        }
        if (
          !parsedProceso.impresion.hojas_brutas &&
          parsedProceso.guillotina.hojas_finales
        ) {
          parsedProceso.impresion.hojas_brutas =
            parsedProceso.guillotina.hojas_finales;
        }
        if (
          !parsedProceso.impresion.formato_hojas &&
          parsedProceso.guillotina.tamano_final
        ) {
          parsedProceso.impresion.formato_hojas =
            parsedProceso.guillotina.tamano_final;
        }
        setProcesoDatos(parsedProceso);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo cargar la OT.");
      } finally {
        setLoadingOt(false);
      }
    },
    [supabase]
  );

  const loadItinerarioFromOtNumero = useCallback(
    async (otNumero: string): Promise<DespachoItinerarioSlot[]> => {
      const ot = String(otNumero ?? "").trim();
      if (!ot) return [];
      const { data: masterRow, error: masterErr } = await supabase
        .from(TABLE_OTS)
        .select("id")
        .eq("num_pedido", ot)
        .maybeSingle();
      if (masterErr) throw masterErr;
      const masterId =
        typeof (masterRow as { id?: string | null } | null)?.id === "string"
          ? String((masterRow as { id?: string | null }).id)
          : null;
      if (!masterId) return [];
      const [
        { data: pasosRows, error: pasosErr },
        { data: catRows, error: catErr },
      ] = await Promise.all([
        supabase
          .from(TABLE_OT_PASOS)
          .select("proceso_id, orden")
          .eq("ot_id", masterId)
          .order("orden", { ascending: true }),
        supabase.from("prod_procesos_cat").select("id, nombre"),
      ]);
      if (pasosErr) throw pasosErr;
      if (catErr) throw catErr;
      const nombreById = new Map<number, string>();
      for (const c of (catRows ?? []) as Array<{
        id: number;
        nombre: string | null;
      }>) {
        nombreById.set(c.id, String(c.nombre ?? `Proceso #${c.id}`));
      }
      return (
        (pasosRows ?? []) as Array<{ proceso_id: number; orden: number }>
      )
        .sort((a, b) => a.orden - b.orden)
        .map((p) => ({
          key: crypto.randomUUID(),
          procesoId: p.proceso_id,
          nombre: nombreById.get(p.proceso_id) ?? `Proceso #${p.proceso_id}`,
        }));
    },
    [supabase]
  );

  const handleReferenciaPicked = useCallback(
    async (row: ProdReferenciaRow) => {
      try {
        const { data, error } = await supabase
          .from(TABLE_OT_DESPACHADAS)
          .select(`ot_numero, ${DESPACHO_CLONE_SELECT}`)
          .eq("referencia_id", row.id)
          .order("despachado_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        const tipoEngomadoHabitual = String(
          (row as { tipo_engomado_habitual?: string | null })
            .tipo_engomado_habitual ?? ""
        ).trim();
        setForm((f) => {
          const base: DespachoFormState = {
            ...f,
            referencia_id: row.id,
            referencia_codigo: row.codigo,
          };
          const next = data
            ? applyClonePrefill(base, data as Record<string, unknown>).next
            : base;
          if (!next.tipo_engomado && tipoEngomadoHabitual) {
            return { ...next, tipo_engomado: tipoEngomadoHabitual };
          }
          return next;
        });
        if (!data) {
          toast.info(
            `Referencia ${row.codigo} sin histórico todavía: nada que heredar.`
          );
          return;
        }
        toast.success(
          `Datos heredados de la referencia ${row.codigo} (solo campos vacíos).`
        );
        const sourceOt = String(
          (data as { ot_numero?: string | null }).ot_numero ?? ""
        ).trim();
        if (!sourceOt) return;
        const slots = await loadItinerarioFromOtNumero(sourceOt);
        if (slots.length === 0) return;
        let applied = false;
        setItinerarioSlots((prev) => {
          if (prev.length > 0) return prev;
          applied = true;
          return slots;
        });
        if (applied) {
          toast.success(
            `Itinerario heredado de la OT ${sourceOt} (${slots.length} procesos).`
          );
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "No se pudo clonar de la referencia."
        );
      }
    },
    [loadItinerarioFromOtNumero, supabase]
  );

  const cloneFromOtAnterior = useCallback(
    async (otRaw: string) => {
      const ot = String(otRaw ?? "").trim();
      if (!ot) return;
      try {
        const [{ data: masterRow }, { data, error }] = await Promise.all([
          supabase.from(TABLE_OTS).select("id").eq("num_pedido", ot).maybeSingle(),
          supabase
            .from(TABLE_OT_DESPACHADAS)
            .select(DESPACHO_CLONE_SELECT)
            .eq("ot_numero", ot)
            .maybeSingle(),
        ]);
        if (error) throw error;
        if (!data) {
          toast.info(`La OT ${ot} no tiene despacho registrado para clonar.`);
          return;
        }
        const resolvedId =
          typeof (masterRow as { id?: string | null } | null)?.id === "string"
            ? String((masterRow as { id?: string | null }).id)
            : null;
        setForm((f) => {
          const base: DespachoFormState = {
            ...f,
            ot_anterior_numero: ot,
            ot_anterior_id: resolvedId ?? f.ot_anterior_id,
          };
          return applyClonePrefill(base, data as Record<string, unknown>).next;
        });
        toast.success(`Datos heredados de la OT ${ot} (solo campos vacíos).`);
        const slots = await loadItinerarioFromOtNumero(ot);
        if (slots.length === 0) return;
        let applied = false;
        setItinerarioSlots((prev) => {
          if (prev.length > 0) return prev;
          applied = true;
          return slots;
        });
        if (applied) {
          toast.success(
            `Itinerario heredado de la OT ${ot} (${slots.length} procesos).`
          );
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "No se pudo clonar de la OT anterior."
        );
      }
    },
    [loadItinerarioFromOtNumero, supabase]
  );

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }
    setBatchMode(batchModeDefault);
    setWizardTab("cabecera");
    const ot = String(initialOt ?? "").trim();
    if (ot) {
      setOtInput(ot);
      void hydrateForOt(ot);
    } else {
      resetWizard();
      setBatchMode(batchModeDefault);
      const t = window.setTimeout(() => otInputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [open, initialOt, batchModeDefault, hydrateForOt, resetWizard]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("prod_despacho_catalogo")
        .select("id, tipo, label")
        .eq("activo", true)
        .order("tipo", { ascending: true })
        .order("orden", { ascending: true })
        .order("label", { ascending: true });
      if (cancelled) return;
      if (error) return;
      setCatalog((data ?? []) as DespachoCatalogItem[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  useEffect(() => {
    const referenciaId = form.referencia_id;
    if (!open || !referenciaId) {
      setReferenciaHistorial([]);
      setReferenciaHistorialLoading(false);
      return;
    }
    let cancelled = false;
    setReferenciaHistorialLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from(TABLE_OT_DESPACHADAS)
          .select(
            "ot_numero, despachado_at, material, gramaje, tamano_hoja, troquel, poses, acabado_pral"
          )
          .eq("referencia_id", referenciaId)
          .order("despachado_at", { ascending: false })
          .limit(8);
        if (error) throw error;
        if (cancelled) return;
        const activeOt = seleccion?.num_pedido?.trim() ?? "";
        setReferenciaHistorial(
          ((data ?? []) as ReferenciaHistorialRow[])
            .filter((row) => row.ot_numero.trim() !== activeOt)
            .slice(0, 6)
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) setReferenciaHistorial([]);
      } finally {
        if (!cancelled) setReferenciaHistorialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.referencia_id, open, seleccion?.num_pedido, supabase]);

  const despachoStatus = useMemo(() => {
    if (!seleccion) return "none" as const;
    if (!yaDespachada) return "none" as const;
    return compraGenerada
      ? ("despachada_con_compra" as const)
      : ("despachada_sin_compra" as const);
  }, [compraGenerada, seleccion, yaDespachada]);

  const materialSuggestions = useMemo(
    () => catalog.filter((x) => x.tipo === "material").map((x) => x.label),
    [catalog]
  );
  const acabadoSuggestions = useMemo(
    () => catalog.filter((x) => x.tipo === "acabado_pral").map((x) => x.label),
    [catalog]
  );
  const engomadoSuggestions = useMemo(
    () =>
      catalog.filter((x) => x.tipo === "tipo_engomado").map((x) => x.label),
    [catalog]
  );

  const procesoIdsInRoute = useMemo(
    () => new Set(itinerarioSlots.map((s) => s.procesoId)),
    [itinerarioSlots]
  );

  const estuchesEstimados = useMemo(
    () => estuchesEstimadosDespacho(form, procesoDatos, procesoIdsInRoute),
    [form, procesoDatos, procesoIdsInRoute]
  );

  const hojasCadenaLabel = useMemo(() => {
    if (
      procesoIdsInRoute.has(PROCESO_OFFSET_ID) ||
      procesoIdsInRoute.has(PROCESO_DIGITAL_ID)
    ) {
      const fmt = procesoDatos.impresion.formato_hojas.trim();
      return fmt
        ? `netas impresión (${fmt})`
        : "netas impresión (post guillotina)";
    }
    if (procesoIdsInRoute.has(PROCESO_GUILLOTINA_ID)) {
      const hf = integerOrZeroForDespacho(procesoDatos.guillotina.hojas_finales);
      if (hf > 0) {
        return procesoDatos.guillotina.tamano_final.trim()
          ? `post guillotina (${procesoDatos.guillotina.tamano_final.trim()})`
          : "post guillotina";
      }
    }
    return "formato compra";
  }, [procesoDatos, procesoIdsInRoute]);

  const hojasBrutasImpresion = useMemo(
    () => hojasBrutasImpresionDespacho(form, procesoDatos, procesoIdsInRoute),
    [form, procesoDatos, procesoIdsInRoute]
  );

  /** Sincroniza hojas brutas compra → guillotina iniciales cuando aún vacío. */
  useEffect(() => {
    const brutas = hojasBrutasCompraDespacho(form);
    if (!brutas) return;
    setProcesoDatos((prev) => {
      if (prev.guillotina.hojas_iniciales.trim()) return prev;
      return {
        ...prev,
        guillotina: { ...prev.guillotina, hojas_iniciales: String(brutas) },
      };
    });
  }, [form.num_hojas_brutas]);

  /** Sincroniza salida guillotina → impresión brutas y formato. */
  useEffect(() => {
    const finales = procesoDatos.guillotina.hojas_finales.trim();
    const formato = procesoDatos.guillotina.tamano_final.trim();
    if (!finales && !formato) return;
    setProcesoDatos((prev) => {
      let changed = false;
      const imp = { ...prev.impresion };
      if (finales && !imp.hojas_brutas.trim()) {
        imp.hojas_brutas = finales;
        changed = true;
      }
      if (formato && !imp.formato_hojas.trim()) {
        imp.formato_hojas = formato;
        changed = true;
      }
      return changed ? { ...prev, impresion: imp } : prev;
    });
  }, [
    procesoDatos.guillotina.hojas_finales,
    procesoDatos.guillotina.tamano_final,
  ]);

  const canGoNext = useMemo(() => {
    if (wizardTab === "cabecera") return Boolean(seleccion);
    return true;
  }, [seleccion, wizardTab]);

  const submitDespacho = useCallback(async () => {
    if (!seleccion) return;
    if (despachoStatus === "despachada_con_compra") {
      toast.error(
        "OT despachada con compra generada. Modifica desde Compras."
      );
      return;
    }
    setSaving(true);
    const selectedRowId = seleccion.id;
    const selectedOt = seleccion.num_pedido.trim();
    try {
      if (!selectedOt) throw new Error("OT inválida.");

      if (itinerarioSlots.length > 0) {
        const { data: existingPasos, error: errLoadPasos } = await supabase
          .from(TABLE_OT_PASOS)
          .select("id, orden, proceso_id, datos_proceso")
          .eq("ot_id", selectedRowId)
          .order("orden", { ascending: true });
        if (errLoadPasos) throw errLoadPasos;

        const sameItinerario =
          (existingPasos?.length ?? 0) === itinerarioSlots.length &&
          itinerarioSlots.every(
            (s, i) => existingPasos?.[i]?.proceso_id === s.procesoId,
          );

        if (sameItinerario && existingPasos && existingPasos.length > 0) {
          for (let i = 0; i < itinerarioSlots.length; i++) {
            const slot = itinerarioSlots[i]!;
            const paso = existingPasos[i]!;
            const seed = buildDatosProcesoSeed(
              slot.procesoId,
              form,
              procesoDatos,
              procesoIdsInRoute,
            );
            const merged = mergeDatosProcesoSeed(
              paso.datos_proceso as Record<string, unknown> | null,
              seed ??
                (slot.procesoId === PROCESO_CTP_ID
                  ? buildCtpRequisitosSeedFromWizard(procesoDatos.ctp)
                  : null),
              slot.procesoId,
            );
            const { error: errUpd } = await supabase
              .from(TABLE_OT_PASOS)
              .update({
                orden: i + 1,
                ...(merged ? { datos_proceso: merged } : { datos_proceso: null }),
              })
              .eq("id", paso.id);
            if (errUpd) throw errUpd;
          }
        } else {
          const { error: errDelPasos } = await supabase
            .from(TABLE_OT_PASOS)
            .delete()
            .eq("ot_id", selectedRowId);
          if (errDelPasos) throw errDelPasos;
          const pasoRows = itinerarioSlots.map((s, i) => {
            const datos = buildDatosProcesoSeed(
              s.procesoId,
              form,
              procesoDatos,
              procesoIdsInRoute,
            );
            return {
              ot_id: selectedRowId,
              orden: i + 1,
              proceso_id: s.procesoId,
              estado: i === 0 ? "disponible" : "pendiente",
              ...(datos ? { datos_proceso: datos } : {}),
            };
          });
          const { error: errInsPasos } = await supabase
            .from(TABLE_OT_PASOS)
            .insert(pasoRows);
          if (errInsPasos) throw errInsPasos;
        }
      }

      const dataToInsert = {
        ot_numero: selectedOt,
        tintas: form.tintas.trim() || null,
        material: form.material.trim() || null,
        tamano_hoja: form.tamano_hoja.trim() || null,
        gramaje: parseOptionalDecimalInput(form.gramaje),
        num_hojas_brutas: integerOrZeroForDespacho(form.num_hojas_brutas),
        num_hojas_netas: integerOrZeroForDespacho(form.num_hojas_netas),
        horas_entrada: numberOrZeroForDespacho(form.horas_entrada),
        horas_tiraje: numberOrZeroForDespacho(form.horas_tiraje),
        horas_estimadas_troquelado: parseOptionalDecimalInput(
          form.horas_estimadas_troquelado
        ),
        horas_estimadas_engomado: parseOptionalDecimalInput(
          form.horas_estimadas_engomado
        ),
        tipo_engomado: form.tipo_engomado.trim() || null,
        troquel: form.troquel.trim() || null,
        poses: integerOrZeroForDespacho(form.poses),
        acabado_pral: form.acabado_pral.trim() || null,
        notas: form.notas.trim() || null,
        referencia_id: form.referencia_id,
        ot_anterior_numero: form.ot_anterior_numero.trim() || null,
        ot_anterior_id: form.ot_anterior_id,
        despachado_at: new Date().toISOString(),
      };

      const { error: errDespacho } = await supabase
        .from(TABLE_OT_DESPACHADAS)
        .upsert(dataToInsert, { onConflict: "ot_numero" });
      if (errDespacho) throw errDespacho;

      const { error: errMaster } = await supabase
        .from(TABLE_OTS)
        .update({
          despachado: true,
          updated_at: new Date().toISOString(),
        })
        .eq("num_pedido", selectedOt);
      if (errMaster) throw errMaster;

      toast.success("OT despachada correctamente");
      onDespachado?.({ ot: selectedOt, rowId: selectedRowId });

      if (batchMode) {
        setForm(emptyDespachoForm());
        setSeleccion(null);
        setYaDespachada(false);
        setCompraGenerada(false);
        setMeta(emptyDespachoMeta());
        setOtInput("");
        setItinerarioSlots([]);
        setProcesoDatos(emptyDespachoWizardProcesoDatos());
        setWizardTab("cabecera");
        window.setTimeout(() => otInputRef.current?.focus(), 80);
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al despachar.");
    } finally {
      setSaving(false);
    }
  }, [
    batchMode,
    despachoStatus,
    form,
    itinerarioSlots,
    onDespachado,
    onOpenChange,
    procesoDatos,
    procesoIdsInRoute,
    seleccion,
    supabase,
  ]);

  function goNext() {
    if (!canGoNext) {
      toast.error("Carga una OT válida antes de continuar.");
      return;
    }
    const n = nextTab(wizardTab);
    if (n) setWizardTab(n);
  }

  function goPrev() {
    const p = prevTab(wizardTab);
    if (p) setWizardTab(p);
  }

  function renderProcesoSection(slot: DespachoItinerarioSlot) {
    const pid = slot.procesoId;
    if (pid === PROCESO_CTP_ID) {
      const ctp = procesoDatos.ctp;
      return (
        <section
          key={slot.key}
          className="rounded-lg border border-violet-200 bg-violet-50/30 p-4"
        >
          <h4 className="mb-1 text-sm font-semibold text-[#002147]">
            {slot.nombre}
          </h4>
          <p className="mb-3 text-[11px] text-slate-600">
            Instrucciones para Gemma/Marc. Marca lo que deben hacer; lo no marcado
            no se exige. Planchas y horas reales se registran en mesa CTP.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CTP_REQUISITO_DEFS.map((def) => {
              const id = `wiz-ctp-${def.hechoKey}`;
              return (
                <label
                  key={def.hechoKey}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-violet-100 bg-white px-2.5 py-2 text-xs"
                >
                  <Checkbox
                    id={id}
                    checked={ctp[def.hechoKey]}
                    onCheckedChange={(v) =>
                      setProcesoDatos((prev) => ({
                        ...prev,
                        ctp: {
                          ...prev.ctp,
                          [def.hechoKey]: v === true,
                        },
                      }))
                    }
                  />
                  <span className="text-slate-800">{def.label}</span>
                </label>
              );
            })}
          </div>
        </section>
      );
    }
    if (pid === PROCESO_GUILLOTINA_ID) {
      const g = procesoDatos.guillotina;
      return (
        <section
          key={slot.key}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h4 className="mb-3 text-sm font-semibold text-[#002147]">
            {slot.nombre}
          </h4>
          <p className="mb-3 text-[11px] text-slate-500">
            Lo que definas aquí pre-rellena la mesa de Miguel (guillotina). Podrá
            ajustar al ejecutar.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs">Formato inicial (compra)</Label>
              <Input
                className="h-8 text-xs"
                value={form.tamano_hoja}
                readOnly
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Hojas iniciales (brutas compra)</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                value={g.hojas_iniciales}
                onChange={(e) =>
                  setProcesoDatos((prev) => ({
                    ...prev,
                    guillotina: {
                      ...prev.guillotina,
                      hojas_iniciales: e.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Patrón corte guillotina</Label>
              <Input
                className="h-8 text-xs"
                placeholder="ej: Medio · 2 salidas"
                value={g.patron_corte}
                onChange={(e) =>
                  setProcesoDatos((prev) => ({
                    ...prev,
                    guillotina: {
                      ...prev.guillotina,
                      patron_corte: e.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Formato final (salida)</Label>
              <Input
                className="h-8 text-xs"
                placeholder="ej: 51×72 cm"
                value={g.tamano_final}
                onChange={(e) =>
                  setProcesoDatos((prev) => ({
                    ...prev,
                    guillotina: {
                      ...prev.guillotina,
                      tamano_final: e.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="grid gap-1 sm:col-span-2 lg:col-span-2">
              <Label className="text-xs">Hojas finales (post corte)</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                placeholder="ej: 1500 (750 compra × 2 salidas)"
                value={g.hojas_finales}
                onChange={(e) =>
                  setProcesoDatos((prev) => ({
                    ...prev,
                    guillotina: {
                      ...prev.guillotina,
                      hojas_finales: e.target.value,
                    },
                  }))
                }
              />
              <p className="text-[10px] text-slate-400">
                Salida alimenta impresión (brutas). Desbroce usa netas tras
                imprimir.
              </p>
            </div>
          </div>
        </section>
      );
    }
    if (pid === PROCESO_OFFSET_ID || pid === PROCESO_DIGITAL_ID) {
      const imp = procesoDatos.impresion;
      return (
        <section
          key={slot.key}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[#002147]">
              {slot.nombre}
            </h4>
            <Badge variant="secondary" className="text-[10px]">
              {pid === PROCESO_DIGITAL_ID ? "Digital" : "Offset"}
            </Badge>
          </div>
          <p className="mb-3 text-[11px] text-slate-500">
            Formato = salida del paso anterior (guillotina). Brutas entran al
            troquel; netas alimentan desbroce.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs">
                Hojas brutas entrada (post guillotina)
              </Label>
              <Input
                className="h-8 text-xs"
                type="number"
                placeholder={
                  hojasBrutasImpresion > 0
                    ? String(hojasBrutasImpresion)
                    : "ej: 1200"
                }
                value={imp.hojas_brutas}
                onChange={(e) =>
                  setProcesoDatos((prev) => ({
                    ...prev,
                    impresion: {
                      ...prev.impresion,
                      hojas_brutas: e.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">
                Hojas netas previstas (plan impresión)
              </Label>
              <Input
                className="h-8 text-xs"
                type="number"
                placeholder="ej: 950 (brutas − merma)"
                value={imp.hojas_netas}
                onChange={(e) =>
                  setProcesoDatos((prev) => ({
                    ...prev,
                    impresion: {
                      ...prev.impresion,
                      hojas_netas: e.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Formato hojas impresión</Label>
              <Input
                className="h-8 text-xs"
                placeholder="ej: 51×72 cm"
                value={imp.formato_hojas}
                onChange={(e) =>
                  setProcesoDatos((prev) => ({
                    ...prev,
                    impresion: {
                      ...prev.impresion,
                      formato_hojas: e.target.value,
                    },
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="wiz-horas-entrada" className="text-xs">
                Horas entrada estimadas
              </Label>
              <Input
                id="wiz-horas-entrada"
                className="h-8 text-xs"
                type="number"
                step="0.1"
                value={form.horas_entrada}
                onChange={(e) =>
                  setForm((f) => ({ ...f, horas_entrada: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="wiz-horas-tiraje" className="text-xs">
                Horas tiraje estimadas
              </Label>
              <Input
                id="wiz-horas-tiraje"
                className="h-8 text-xs"
                type="number"
                step="0.1"
                value={form.horas_tiraje}
                onChange={(e) =>
                  setForm((f) => ({ ...f, horas_tiraje: e.target.value }))
                }
              />
            </div>
          </div>
        </section>
      );
    }
    if (PROCESO_EXTERNO_IDS.has(pid)) {
      return (
        <section
          key={slot.key}
          className="rounded-lg border border-amber-200/80 bg-amber-50/30 p-4"
        >
          <h4 className="mb-2 text-sm font-semibold text-[#002147]">
            {slot.nombre}
          </h4>
          <p className="text-xs text-slate-600">
            Proveedor, hojas enviadas/recibidas y acabado se detallan en
            ejecución y seguimiento externos.
          </p>
        </section>
      );
    }
    if (pid === PROCESO_TROQUEL_ID) {
      return (
        <section
          key={slot.key}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h4 className="mb-3 text-sm font-semibold text-[#002147]">
            {slot.nombre}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TroquelPickerField
                id="wiz-troquel"
                value={form.troquel}
                onChange={(v) => setForm((f) => ({ ...f, troquel: v }))}
                onTroquelPicked={(picked) =>
                  setForm((f) => ({
                    ...f,
                    troquel: picked.num_troquel,
                    poses: picked.num_figuras?.trim()
                      ? picked.num_figuras.trim()
                      : f.poses,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="wiz-poses" className="text-xs">
                Poses
              </Label>
              <Input
                id="wiz-poses"
                className="h-8 text-xs"
                value={form.poses}
                onChange={(e) =>
                  setForm((f) => ({ ...f, poses: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="wiz-horas-troquel" className="text-xs">
                Horas troquelado estimadas
              </Label>
              <Input
                id="wiz-horas-troquel"
                className="h-8 text-xs"
                type="number"
                step="0.1"
                value={form.horas_estimadas_troquelado}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    horas_estimadas_troquelado: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </section>
      );
    }
    if (pid === PROCESO_DESBROCE_ID) {
      return (
        <section
          key={slot.key}
          className="rounded-lg border border-orange-200 bg-orange-50/40 p-4"
        >
          <h4 className="mb-2 text-sm font-semibold text-[#002147]">
            {slot.nombre}
          </h4>
          {estuchesEstimados != null ? (
            <p className="text-sm text-orange-900">
              Estuches estimados tras troquel:{" "}
              <strong>
                {estuchesEstimados.estuches.toLocaleString("es-ES")}
              </strong>
              <span className="mt-1 block text-xs font-normal text-orange-800">
                {estuchesEstimados.hojas.toLocaleString("es-ES")} hojas (
                {hojasCadenaLabel}) × {estuchesEstimados.poses} poses
              </span>
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              Indica hojas netas previstas en impresión (plan) y poses en
              troquelado.
            </p>
          )}
        </section>
      );
    }
    if (pid === PROCESO_ENGOMADO_ID) {
      return (
        <section
          key={slot.key}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <h4 className="mb-3 text-sm font-semibold text-[#002147]">
            {slot.nombre}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="wiz-tipo-engomado" className="text-xs">
                Tipo de engomado
              </Label>
              <Input
                id="wiz-tipo-engomado"
                className="h-8 text-xs"
                list="wiz-engomado-suggestions"
                value={form.tipo_engomado}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo_engomado: e.target.value }))
                }
              />
              <datalist id="wiz-engomado-suggestions">
                {engomadoSuggestions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="wiz-horas-engomado" className="text-xs">
                Horas engomado estimadas
              </Label>
              <Input
                id="wiz-horas-engomado"
                className="h-8 text-xs"
                type="number"
                step="0.1"
                value={form.horas_estimadas_engomado}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    horas_estimadas_engomado: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </section>
      );
    }
    if (pid === PROCESO_MANIPULADOS_ID) {
      return (
        <section
          key={slot.key}
          className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
        >
          <h4 className="mb-2 text-sm font-semibold text-[#002147]">
            {slot.nombre}
          </h4>
          <p className="text-xs text-slate-600">
            Etiquetado, retractilado y paquetes se capturan en mesa de
            ejecución.
          </p>
        </section>
      );
    }
    return (
      <section
        key={slot.key}
        className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
      >
        <h4 className="text-sm font-semibold text-[#002147]">{slot.nombre}</h4>
      </section>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(94vh,920px)] w-[calc(100%-1rem)] !max-w-[min(96vw,1800px)] flex-col gap-0 overflow-hidden p-0 sm:!max-w-[min(96vw,1800px)]">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="size-5 text-emerald-700" aria-hidden />
            Despachar OT
            {seleccion ? (
              <span className="font-mono text-base font-semibold text-[#002147]">
                {seleccion.num_pedido}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Wizard de despacho — cabecera, material, itinerario y datos por
            proceso. Ctrl+Enter guarda en la pestaña Resumen.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={wizardTab}
          onValueChange={(v) => setWizardTab(v as DespachoWizardTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 border-b border-slate-100 px-6 pt-2">
            <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
              {DESPACHO_WIZARD_TABS.map((t, i) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className={cn(
                    "rounded-md border border-transparent px-3 py-1.5 text-xs data-[state=active]:border-[#002147]/20 data-[state=active]:bg-[#002147]/5 data-[state=active]:text-[#002147]"
                  )}
                >
                  <span className="mr-1.5 font-mono text-[10px] text-slate-400">
                    {i + 1}
                  </span>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
            onKeyDown={(e) => {
              if (
                wizardTab === "resumen" &&
                (e.ctrlKey || e.metaKey) &&
                e.key === "Enter" &&
                !saving
              ) {
                e.preventDefault();
                void submitDespacho();
              }
            }}
          >
            {wizardTab === "cabecera" ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 pb-3">
                  <div className="flex min-w-[12rem] flex-1 items-center gap-2">
                    <Label
                      htmlFor="wiz-ot-input"
                      className="shrink-0 text-xs text-slate-600"
                    >
                      Nº OT
                    </Label>
                    <Input
                      id="wiz-ot-input"
                      ref={otInputRef}
                      className="h-8 max-w-[8rem] font-mono text-sm"
                      value={otInput}
                      onChange={(e) => setOtInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void hydrateForOt(otInput);
                        }
                      }}
                      placeholder="99905"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={loadingOt || !otInput.trim()}
                      onClick={() => void hydrateForOt(otInput)}
                    >
                      {loadingOt ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Cargar"
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Enter · Resumen: Ctrl+Enter guarda
                  </p>
                  {despachoStatus === "despachada_sin_compra" ? (
                    <p className="w-full rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                      OT ya despachada sin compra: puedes modificar.
                    </p>
                  ) : null}
                  {despachoStatus === "despachada_con_compra" ? (
                    <p className="w-full rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
                      OT con compra generada: despacho bloqueado.
                    </p>
                  ) : null}
                </div>

                {seleccion ? (
                  <div className="rounded-lg border border-[#002147]/20 bg-gradient-to-br from-[#002147]/[0.04] to-white px-5 py-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Cliente
                        </p>
                        <p className="text-sm font-semibold leading-snug text-[#002147]">
                          {meta.cliente || "—"}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-lg border border-[#C69C2B]/40 bg-amber-50/80 px-4 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
                          Cantidad pedida
                        </p>
                        <p className="font-mono text-2xl font-bold tabular-nums text-[#002147]">
                          {meta.cantidad
                            ? Number(meta.cantidad).toLocaleString("es-ES")
                            : "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-600">
                        <p>
                          <span className="font-semibold text-[#002147]">
                            Entrega:
                          </span>{" "}
                          {formatFechaEntregaCorta(meta.fecha_entrega) || "—"}
                        </p>
                        {meta.pedido_cliente ? (
                          <p className="mt-0.5">
                            <span className="font-semibold text-[#002147]">
                              Pedido:
                            </span>{" "}
                            {meta.pedido_cliente}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Trabajo
                      </p>
                      <p className="text-sm leading-relaxed text-slate-800">
                        {meta.trabajo || "—"}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <ReferenciaMinervaPicker
                    value={
                      {
                        id: form.referencia_id,
                        codigo: form.referencia_codigo,
                      } as ReferenciaMinervaValue
                    }
                    onChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        referencia_id: v.id,
                        referencia_codigo: v.codigo,
                      }))
                    }
                    onReferenciaPicked={(row) => void handleReferenciaPicked(row)}
                    createDefaults={{
                      cliente: meta.cliente || null,
                      descripcion: parseDescripcionReferenciaFromTitulo(
                        meta.trabajo
                      ),
                      referenciaCliente: parseReferenciaClienteFromTitulo(
                        meta.trabajo
                      ),
                    }}
                    disabled={saving || !seleccion}
                  />
                  <div className="grid gap-1">
                    <Label htmlFor="wiz-ot-anterior" className="text-xs">
                      OT anterior (clonar)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="wiz-ot-anterior"
                        className="h-8 text-xs font-mono"
                        value={form.ot_anterior_numero}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            ot_anterior_numero: e.target.value,
                            ot_anterior_id: null,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void cloneFromOtAnterior(form.ot_anterior_numero);
                          }
                        }}
                        placeholder="Nº OT anterior"
                        disabled={!seleccion}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={saving || !form.ot_anterior_numero.trim()}
                        onClick={() =>
                          void cloneFromOtAnterior(form.ot_anterior_numero)
                        }
                      >
                        Clonar
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Solo rellena campos vacíos del formulario actual.
                    </p>
                  </div>
                  {form.referencia_id ? (
                    <div className="rounded-md border border-slate-200 bg-white/70 p-3 lg:col-span-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-[#002147]">
                          Historial de esta referencia
                        </p>
                        {referenciaHistorialLoading ? (
                          <span className="text-[10px] text-slate-500">
                            Cargando…
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            {referenciaHistorial.length} OT
                          </span>
                        )}
                      </div>
                      {referenciaHistorial.length === 0 &&
                      !referenciaHistorialLoading ? (
                        <p className="text-[11px] text-slate-500">
                          Sin despachos anteriores con esta referencia.
                        </p>
                      ) : (
                        <div className="grid gap-1">
                          {referenciaHistorial.map((h) => (
                            <div
                              key={h.ot_numero}
                              className="grid gap-1 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]"
                            >
                              <span className="font-mono font-semibold text-[#002147]">
                                {h.ot_numero}
                              </span>
                              <span className="truncate">
                                {h.material || "—"}
                                {h.gramaje != null ? ` ${h.gramaje}g` : ""}
                                {h.tamano_hoja ? ` · ${h.tamano_hoja}` : ""}
                              </span>
                              <span className="truncate">
                                Troquel {h.troquel || "—"}
                                {h.poses != null ? ` · ${h.poses} poses` : ""}
                              </span>
                              <span className="truncate">
                                {h.acabado_pral || "Sin acabado"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <p className="text-xs text-slate-500">
                  OT contenedor con formas múltiples: próximamente (Bloque 8.2
                  v2).
                </p>
              </div>
            ) : null}

            {wizardTab === "material" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="wiz-material" className="text-xs">
                    Material
                  </Label>
                  <Input
                    id="wiz-material"
                    className="h-8 text-xs"
                    list="wiz-material-suggestions"
                    value={form.material}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, material: e.target.value }))
                    }
                  />
                  <datalist id="wiz-material-suggestions">
                    {materialSuggestions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="wiz-gramaje" className="text-xs">
                    Gramaje
                  </Label>
                  <Input
                    id="wiz-gramaje"
                    className="h-8 text-xs"
                    type="number"
                    value={form.gramaje}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gramaje: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label htmlFor="wiz-tamano" className="text-xs">
                    Formato compra (pliego proveedor)
                  </Label>
                  <Input
                    id="wiz-tamano"
                    className="h-8 text-xs"
                    placeholder="ej: 72×102 cm"
                    value={form.tamano_hoja}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tamano_hoja: e.target.value }))
                    }
                  />
                  <p className="text-[10px] text-slate-400">
                    En producción el formato se encadena paso a paso en cada
                    proceso.
                  </p>
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Hojas del formato compra
                  </p>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="wiz-brutas" className="text-xs">
                    Hojas brutas (compra)
                  </Label>
                  <Input
                    id="wiz-brutas"
                    className="h-8 text-xs"
                    type="number"
                    value={form.num_hojas_brutas}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        num_hojas_brutas: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="wiz-netas" className="text-xs">
                    Hojas netas (compra)
                  </Label>
                  <Input
                    id="wiz-netas"
                    className="h-8 text-xs"
                    type="number"
                    value={form.num_hojas_netas}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        num_hojas_netas: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="wiz-tintas" className="text-xs">
                    Tintas
                  </Label>
                  <Input
                    id="wiz-tintas"
                    className="h-8 text-xs"
                    value={form.tintas}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tintas: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="wiz-acabado" className="text-xs">
                    Acabado PRAL
                  </Label>
                  <Input
                    id="wiz-acabado"
                    className="h-8 text-xs"
                    list="wiz-acabado-suggestions"
                    value={form.acabado_pral}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, acabado_pral: e.target.value }))
                    }
                  />
                  <datalist id="wiz-acabado-suggestions">
                    {acabadoSuggestions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label htmlFor="wiz-notas" className="text-xs">
                    Notas generales
                  </Label>
                  <Textarea
                    id="wiz-notas"
                    className="min-h-[80px] text-xs"
                    value={form.notas}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notas: e.target.value }))
                    }
                  />
                </div>
              </div>
            ) : null}

            {wizardTab === "itinerario" ? (
              <div>
                <p className="mb-3 text-xs text-slate-600">
                  Define la ruta de procesos. Las pestañas siguientes se adaptan
                  a los pasos que incluyas.
                </p>
                <DespachoItinerarioPicker
                  open={open && wizardTab === "itinerario"}
                  supabase={supabase}
                  disabled={saving}
                  slots={itinerarioSlots}
                  onSlotsChange={setItinerarioSlots}
                  layout="wide"
                  embedded
                />
              </div>
            ) : null}

            {wizardTab === "produccion" ? (
              <div className="grid gap-4">
                {itinerarioSlots.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No hay itinerario definido. Vuelve a la pestaña Itinerario
                    o carga una OT que ya tenga ruta.
                  </p>
                ) : (
                  itinerarioSlots.map((slot) => renderProcesoSection(slot))
                )}
                {!procesoIdsInRoute.has(PROCESO_TROQUEL_ID) &&
                (form.troquel || form.poses) ? (
                  <p className="text-xs text-slate-500">
                    Troquel/poses rellenados pero no hay paso Troquelado en el
                    itinerario — se guardan igual en el despacho.
                  </p>
                ) : null}
                {!procesoIdsInRoute.has(PROCESO_TROQUEL_ID) &&
                !procesoIdsInRoute.has(PROCESO_OFFSET_ID) &&
                !procesoIdsInRoute.has(PROCESO_DIGITAL_ID) ? (
                  <div className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-4 sm:grid-cols-2">
                    <p className="text-xs text-slate-500 sm:col-span-2">
                      Sin impresión/troquel en ruta — horas y troquel opcionales:
                    </p>
                    <div className="grid gap-1">
                      <Label className="text-xs">Troquel</Label>
                      <Input
                        className="h-8 text-xs"
                        value={form.troquel}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, troquel: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Poses</Label>
                      <Input
                        className="h-8 text-xs"
                        value={form.poses}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, poses: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {wizardTab === "resumen" ? (
              <div className="grid gap-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm">
                  <p className="font-semibold text-[#002147]">
                    {seleccion?.num_pedido ?? "—"} · {meta.cliente || "Sin cliente"}
                  </p>
                  <p className="text-xs text-slate-600">{meta.trabajo}</p>
                  <Separator className="my-3" />
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <p>
                      <span className="text-slate-500">Material:</span>{" "}
                      {form.material || "—"}
                      {form.gramaje ? ` · ${form.gramaje} g` : ""}
                    </p>
                    <p>
                      <span className="text-slate-500">Formato compra:</span>{" "}
                      {form.tamano_hoja || "—"}
                    </p>
                    <p>
                      <span className="text-slate-500">Hojas compra:</span>{" "}
                      {form.num_hojas_brutas || "0"} brutas /{" "}
                      {form.num_hojas_netas || "0"} netas
                      {form.tamano_hoja ? ` · ${form.tamano_hoja}` : ""}
                    </p>
                    {procesoDatos.guillotina.hojas_finales ? (
                      <p>
                        <span className="text-slate-500">Post guillotina:</span>{" "}
                        {procesoDatos.guillotina.hojas_finales} hojas brutas
                        {procesoDatos.guillotina.tamano_final
                          ? ` · ${procesoDatos.guillotina.tamano_final}`
                          : ""}
                      </p>
                    ) : null}
                    {procesoDatos.impresion.hojas_netas ? (
                      <p>
                        <span className="text-slate-500">Impresión netas:</span>{" "}
                        {procesoDatos.impresion.hojas_netas}
                        {procesoDatos.impresion.hojas_brutas
                          ? ` (de ${procesoDatos.impresion.hojas_brutas} brutas)`
                          : ""}
                        {procesoDatos.impresion.formato_hojas
                          ? ` · ${procesoDatos.impresion.formato_hojas}`
                          : ""}
                      </p>
                    ) : null}
                    {estuchesEstimados ? (
                      <p>
                        <span className="text-slate-500">Estuches est.:</span>{" "}
                        {estuchesEstimados.estuches.toLocaleString("es-ES")} (
                        {estuchesEstimados.hojas.toLocaleString("es-ES")} netas
                        × {estuchesEstimados.poses})
                      </p>
                    ) : null}
                    <p>
                      <span className="text-slate-500">Troquel:</span>{" "}
                      {form.troquel || "—"}
                      {form.poses ? ` · ${form.poses} poses` : ""}
                    </p>
                    {formatCtpRequisitosResumen(procesoDatos.ctp) ? (
                      <p className="sm:col-span-2">
                        <span className="text-slate-500">CTP:</span>{" "}
                        {formatCtpRequisitosResumen(procesoDatos.ctp)}
                      </p>
                    ) : null}
                    {form.tipo_engomado || form.horas_estimadas_engomado ? (
                      <p>
                        <span className="text-slate-500">Engomado:</span>{" "}
                        {form.tipo_engomado || "—"}
                        {form.horas_estimadas_engomado
                          ? ` · ${form.horas_estimadas_engomado} h est.`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <Separator className="my-3" />
                  <p className="text-xs font-medium text-slate-700">
                    Itinerario ({itinerarioSlots.length} pasos)
                  </p>
                  {itinerarioSlots.length === 0 ? (
                    <p className="text-xs text-amber-700">Sin itinerario</p>
                  ) : (
                    <ol className="mt-1 list-decimal pl-4 text-xs text-slate-700">
                      {itinerarioSlots.map((s) => (
                        <li key={s.key}>{s.nombre}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center">
          <label className="mr-auto flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <Checkbox
              id="wiz-batch-mode"
              checked={batchMode}
              onCheckedChange={(v) => setBatchMode(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-slate-700">
              <span className="font-medium">Seguir con otra OT</span>
              <br />
              <span className="text-slate-500">
                Mantiene el wizard abierto tras guardar (racha Tiburón)
              </span>
            </span>
          </label>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {prevTab(wizardTab) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={saving}
              >
                <ArrowLeft className="mr-1 size-4" />
                Anterior
              </Button>
            ) : null}
            {wizardTab !== "resumen" ? (
              <Button
                type="button"
                size="sm"
                onClick={goNext}
                disabled={saving || !canGoNext}
                className="bg-[#002147] text-white hover:bg-[#001a38]"
              >
                Siguiente
                <ArrowRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={
                  saving ||
                  !seleccion ||
                  despachoStatus === "despachada_con_compra"
                }
                className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={() => void submitDespacho()}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Despachar OT"
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
