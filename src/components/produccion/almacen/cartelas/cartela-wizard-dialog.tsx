"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ClipboardCopy,
  Loader2,
  Plus,
  Printer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecepcionFotosPanel } from "@/components/produccion/recepcion/recepcion-fotos-panel";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import {
  buildRefLote,
  enrichRecepcionLine,
  fetchOtMetadataMap,
  formatClienteTrabajo,
  type OtMetadataMap,
  resolveTrabajoTitulo,
} from "@/lib/cartelas-ot-metadata";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SANDBOX_ID_STOCK_MIN } from "@/lib/prod-stock-sandbox";
import {
  defaultReservasDurasUnaOt,
  repartirHojasEntrePalets,
  syncReservaDuraConCantidad,
} from "@/lib/cartela-wizard-reparto";
import type {
  AlbaranPendienteGroup,
  AlbaranRecepcionLine,
  ProdStockPaletConOts,
  StockTipo,
  WizardPaletInput,
} from "@/types/prod-stock";
import { UBICACIONES_FILA } from "@/types/prod-stock";

type WizardTab = "albaran" | "palet" | "resumen";

export type CartelaWizardCreatedInfo = {
  id_stock: number;
  es_prueba: boolean;
};

interface CartelaWizardDialogProps {
  open: boolean;
  grupo: AlbaranPendienteGroup | null;
  onClose: () => void;
  onCreated: (created: CartelaWizardCreatedInfo[]) => void;
  onPrintReady: (
    palets: ProdStockPaletConOts[],
    proveedorNombre?: string | null
  ) => void;
}

const EMPTY_PALET: WizardPaletInput = {
  material_nombre: "",
  gramaje: "",
  formato: "",
  cantidad_inicial: "",
  codigo_articulo: "",
  ots_referencia: [],
  reservas: {},
  stock_libre: false,
  ubicacion_fila: "",
  ref_lote_proveedor: "",
  coste: "",
  es_fsc: false,
  es_pefc: false,
  notas: "",
};

/** Tope de palets auto-creados desde muelle (evita explosión por typo). */
const MAX_PALETS_AUTO = 40;

function hojasTotalesGrupo(g: AlbaranPendienteGroup): number {
  if (g.hojas_recibidas_total > 0) return Math.trunc(g.hojas_recibidas_total);
  const linesOc = g.recepciones.filter((r) => r.tipo_recepcion !== "stock_libre");
  const first = linesOc[0] ?? g.recepciones[0];
  const h =
    first?.hojas_recibidas_muelle ?? first?.num_hojas_brutas ?? 0;
  return Math.max(0, Math.trunc(Number(h) || 0));
}

function plantillaPaletDesdeGrupo(g: AlbaranPendienteGroup): WizardPaletInput {
  const linesOc = g.recepciones.filter((r) => r.tipo_recepcion !== "stock_libre");
  const firstLine = linesOc[0] ?? g.recepciones[0];
  const esStock = firstLine?.tipo_recepcion === "stock_libre";
  const allOts = [...new Set(linesOc.map((r) => r.ot_numero).filter(Boolean))];
  const multiOtAlbaran = allOts.length > 1;
  return {
    ...EMPTY_PALET,
    material_nombre: firstLine?.material ?? "",
    gramaje: firstLine?.gramaje?.toString() ?? "",
    formato: firstLine?.tamano_hoja ?? "",
    ots_referencia: esStock
      ? []
      : multiOtAlbaran
        ? allOts
        : firstLine?.ot_numero
          ? [firstLine.ot_numero]
          : [],
    stock_libre: esStock,
    es_fsc: false,
  };
}

function buildInitialPalets(g: AlbaranPendienteGroup | null): WizardPaletInput[] {
  if (!g) return [{ ...EMPTY_PALET }];
  const plantilla = plantillaPaletDesdeGrupo(g);
  const totalHojas = hojasTotalesGrupo(g);
  const nRaw = g.palets_recibidos ?? 1;
  const nPalets = Math.min(
    MAX_PALETS_AUTO,
    Math.max(1, Math.trunc(Number(nRaw) || 1)),
  );
  const partes = repartirHojasEntrePalets(totalHojas, nPalets);
  return partes.map((h) => ({
    ...plantilla,
    cantidad_inicial: h > 0 ? String(h) : "",
    // 1 OT → dura = hojas del palet (ATP/badge coherentes). Multi-OT → blanda.
    reservas: defaultReservasDurasUnaOt(
      plantilla.ots_referencia,
      h,
      plantilla.stock_libre,
    ),
  }));
}
function parseReservaDura(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === "") return null;
  if (/^(todas?|all|\*)$/i.test(t)) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Suma de reservas duras del palet (hojas comprometidas a OTs con cantidad). */
function reservadaDuraTotal(p: WizardPaletInput): number {
  return p.ots_referencia.reduce((acc, ot) => {
    const dura = parseReservaDura(p.reservas[ot]);
    return acc + (dura ?? 0);
  }, 0);
}

/** Foto ATP del palet en el wizard (misma lógica que la vista stock_palets_atp). */
function atpDesglose(p: WizardPaletInput): {
  fisica: number;
  reservada: number;
  libre: number;
  hayReservaDura: boolean;
  excede: boolean;
} {
  const fisica = parseInt(p.cantidad_inicial, 10) || 0;
  const reservada = reservadaDuraTotal(p);
  const libre = Math.max(fisica - reservada, 0);
  return {
    fisica,
    reservada,
    libre,
    hayReservaDura: reservada > 0,
    excede: reservada > fisica && fisica > 0,
  };
}

// Modelo ATP (Bloque 9.2): un palet físico = UNA cartela. Las reservas (dura/
// blanda) son lógicas y viven en prod_stock_palet_ots.cantidad_reservada. NO se
// crea una segunda cartela para separar reservado de libre (ej. 1.600 OT + 200
// libres van en la MISMA cartela). Cartela nueva SOLO si el material se separa
// físicamente (split de palet — fase 9.3, con movimiento de traspaso).

export function CartelaWizardDialog({
  open,
  grupo,
  onClose,
  onCreated,
  onPrintReady,
}: CartelaWizardDialogProps) {
  const supabase = createSupabaseBrowserClient();

  const [palets, setPalets] = useState<WizardPaletInput[]>(() =>
    buildInitialPalets(grupo)
  );
  const [saving, setSaving] = useState(false);
  const [savedPalets, setSavedPalets] = useState<ProdStockPaletConOts[]>([]);
  const [otInput, setOtInput] = useState<string[]>([""]);
  const [hijasOts, setHijasOts] = useState<string[]>([]);
  const [contenedorPadres, setContenedorPadres] = useState<string[]>([]);
  const [loadingHijas, setLoadingHijas] = useState(false);
  const [otMetadata, setOtMetadata] = useState<OtMetadataMap>({});
  const [wizardTab, setWizardTab] = useState<WizardTab>("albaran");
  const [activePaletIdx, setActivePaletIdx] = useState(0);
  const [cartelaPrueba, setCartelaPrueba] = useState(false);

  useEffect(() => {
    if (open && grupo) {
      const initial = buildInitialPalets(grupo);
      setPalets(initial);
      setSavedPalets([]);
      setOtInput(initial.map(() => ""));
      setHijasOts([]);
      setContenedorPadres([]);
      setOtMetadata({});
      setWizardTab("albaran");
      setActivePaletIdx(0);
      setCartelaPrueba(false);
      void loadOtContext(grupo.recepciones);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, grupo]);

  async function loadOtContext(recepciones: AlbaranRecepcionLine[]) {
    const otNums = [...new Set(recepciones.map((r) => r.ot_numero).filter(Boolean))];
    if (otNums.length === 0) return;
    setLoadingHijas(true);
    try {
      const meta = await fetchOtMetadataMap(supabase, otNums);
      setOtMetadata(meta);
      await loadHijasIfNeeded(recepciones);
    } finally {
      setLoadingHijas(false);
    }
  }

  async function loadHijasIfNeeded(recepciones: AlbaranRecepcionLine[]) {
    const otNums = [...new Set(recepciones.map((r) => r.ot_numero).filter(Boolean))];
    if (otNums.length === 0) return;
    try {
      const { data: otRows } = await supabase
        .from("prod_ots_general")
        .select("num_pedido, ot_tipo, ot_padre_numero")
        .in("num_pedido", otNums);

      const padresSet = new Set<string>();
      for (const row of otRows ?? []) {
        const num = String(row.num_pedido ?? "").trim();
        if (!num) continue;
        if (row.ot_tipo === "contenedor") {
          padresSet.add(num);
        } else if (row.ot_padre_numero) {
          const padre = String(row.ot_padre_numero).trim();
          if (padre) padresSet.add(padre);
        }
      }

      if (padresSet.size === 0) return;

      const padres = [...padresSet];
      setContenedorPadres(padres);

      const { data: hijas } = await supabase
        .from("prod_ots_general")
        .select("num_pedido")
        .in("ot_padre_numero", padres)
        .order("num_pedido");

      const hijasList = (hijas ?? [])
        .map((r) => String(r.num_pedido ?? "").trim())
        .filter(Boolean);

      setHijasOts(hijasList);
    } catch {
      // hijas opcionales — no bloquear wizard
    }
  }

  function updatePalet(idx: number, field: keyof WizardPaletInput, value: unknown) {
    setPalets((prev) => {
      const next = [...prev];
      const cur = next[idx];
      if (field === "cantidad_inicial") {
        const cantidadNueva = parseInt(String(value), 10) || 0;
        const cantidadAnterior = parseInt(cur.cantidad_inicial, 10) || 0;
        next[idx] = {
          ...cur,
          cantidad_inicial: String(value),
          reservas: syncReservaDuraConCantidad({
            ots: cur.ots_referencia,
            reservas: cur.reservas,
            cantidadAnterior,
            cantidadNueva,
            stockLibre: cur.stock_libre,
          }),
        };
        return next;
      }
      next[idx] = { ...cur, [field]: value };
      return next;
    });
  }

  function setReserva(paletIdx: number, ot: string, value: string) {
    setPalets((prev) => {
      const next = [...prev];
      const reservas = { ...next[paletIdx].reservas };
      if (value.trim() === "") {
        delete reservas[ot];
      } else {
        reservas[ot] = value;
      }
      next[paletIdx] = { ...next[paletIdx], reservas };
      return next;
    });
  }

  function toggleOt(paletIdx: number, ot: string) {
    setPalets((prev) => {
      const arr = [...prev];
      const cur = arr[paletIdx];
      const isRemoving = cur.ots_referencia.includes(ot);
      const nextOts = isRemoving
        ? cur.ots_referencia.filter((o) => o !== ot)
        : [...cur.ots_referencia, ot];
      let reservas = { ...cur.reservas };
      if (isRemoving) delete reservas[ot];
      // Al quedar exactamente 1 OT: si no hay dura (o se acaba de añadir), default = hojas.
      if (!cur.stock_libre && nextOts.length === 1) {
        const only = nextOts[0]!;
        const raw = (reservas[only] ?? "").trim();
        const sinDura =
          raw === "" || /^(todas?|all|\*)$/i.test(raw);
        if (sinDura) {
          reservas = defaultReservasDurasUnaOt(
            nextOts,
            parseInt(cur.cantidad_inicial, 10) || 0,
            cur.stock_libre,
          );
        }
      }
      arr[paletIdx] = { ...cur, ots_referencia: nextOts, reservas };
      return arr;
    });
  }

  function addOtManual(paletIdx: number) {
    const raw = (otInput[paletIdx] ?? "").trim();
    if (!raw) return;
    setPalets((prev) => {
      const arr = [...prev];
      const cur = arr[paletIdx];
      if (cur.ots_referencia.includes(raw)) return prev;
      const nextOts = [...cur.ots_referencia, raw];
      let reservas = { ...cur.reservas };
      if (!cur.stock_libre && nextOts.length === 1) {
        reservas = defaultReservasDurasUnaOt(
          nextOts,
          parseInt(cur.cantidad_inicial, 10) || 0,
          cur.stock_libre,
        );
      }
      arr[paletIdx] = { ...cur, ots_referencia: nextOts, reservas };
      return arr;
    });
    setOtInput((prev) => {
      const n = [...prev];
      n[paletIdx] = "";
      return n;
    });
  }

  function removeOt(paletIdx: number, ot: string) {
    setPalets((prev) => {
      const next = [...prev];
      const cur = next[paletIdx];
      const nextOts = cur.ots_referencia.filter((o) => o !== ot);
      let reservas = { ...cur.reservas };
      delete reservas[ot];
      if (!cur.stock_libre && nextOts.length === 1) {
        const only = nextOts[0]!;
        const raw = (reservas[only] ?? "").trim();
        if (raw === "" || /^(todas?|all|\*)$/i.test(raw)) {
          reservas = defaultReservasDurasUnaOt(
            nextOts,
            parseInt(cur.cantidad_inicial, 10) || 0,
            cur.stock_libre,
          );
        }
      }
      next[paletIdx] = { ...cur, ots_referencia: nextOts, reservas };
      return next;
    });
  }

  function prefillPaletFromLine(paletIdx: number, line: AlbaranRecepcionLine) {
    const esStock = line.tipo_recepcion === "stock_libre";
    const hojas =
      line.hojas_recibidas_muelle?.toString() ??
      line.num_hojas_brutas?.toString() ??
      "";
    setPalets((prev) => {
      const next = [...prev];
      const cur = next[paletIdx];
      const cantidad = hojas || cur.cantidad_inicial;
      const ots = esStock
        ? []
        : line.ot_numero
          ? [line.ot_numero]
          : [];
      next[paletIdx] = {
        ...cur,
        material_nombre: line.material ?? cur.material_nombre,
        gramaje: line.gramaje?.toString() ?? cur.gramaje,
        formato: line.tamano_hoja ?? cur.formato,
        cantidad_inicial: cantidad,
        ots_referencia: ots,
        stock_libre: esStock,
        reservas: defaultReservasDurasUnaOt(
          ots,
          parseInt(cantidad, 10) || 0,
          esStock,
        ),
      };
      return next;
    });
    setActivePaletIdx(paletIdx);
    setWizardTab("palet");
  }

  function addPalet() {
    setPalets((prev) => {
      const last = prev[prev.length - 1] ?? EMPTY_PALET;
      const totalAlbaran = grupo ? hojasTotalesGrupo(grupo) : 0;
      const yaAsignadas = prev.reduce(
        (acc, p) => acc + (parseInt(p.cantidad_inicial, 10) || 0),
        0,
      );
      const resto =
        totalAlbaran > 0 ? Math.max(0, totalAlbaran - yaAsignadas) : 0;
      const ots = [...last.ots_referencia];
      const nuevo: WizardPaletInput = {
        ...EMPTY_PALET,
        material_nombre: last.material_nombre,
        gramaje: last.gramaje,
        formato: last.formato,
        codigo_articulo: last.codigo_articulo,
        ots_referencia: ots,
        reservas: defaultReservasDurasUnaOt(ots, resto, last.stock_libre),
        stock_libre: last.stock_libre,
        coste: last.coste,
        es_fsc: last.es_fsc,
        es_pefc: last.es_pefc,
        cantidad_inicial: resto > 0 ? String(resto) : "",
      };
      return [...prev, nuevo];
    });
    setOtInput((prev) => [...prev, ""]);
    setActivePaletIdx(palets.length);
    setWizardTab("palet");
  }

  function repartirEquitativo() {
    if (!grupo) return;
    const total = hojasTotalesGrupo(grupo);
    if (palets.length === 0 || total <= 0) {
      toast.message("No hay hojas de albarán para repartir.");
      return;
    }
    const partes = repartirHojasEntrePalets(total, palets.length);
    setPalets((prev) =>
      prev.map((p, i) => {
        const h = partes[i]! > 0 ? partes[i]! : 0;
        return {
          ...p,
          cantidad_inicial: h > 0 ? String(h) : "",
          // Tras repartir equitativo: 1 OT → dura alineada; multi-OT no se inventa split.
          reservas:
            p.ots_referencia.length === 1 && !p.stock_libre
              ? defaultReservasDurasUnaOt(p.ots_referencia, h, p.stock_libre)
              : p.reservas,
        };
      }),
    );
    toast.success(
      `Reparto: ${palets.length} palets · ${total.toLocaleString("es-ES")} h`,
    );
  }

  function removePalet(idx: number) {
    if (palets.length <= 1) return;
    setPalets((prev) => prev.filter((_, i) => i !== idx));
    setOtInput((prev) => prev.filter((_, i) => i !== idx));
    setActivePaletIdx((prev) => (prev >= idx && prev > 0 ? prev - 1 : prev));
  }

  async function handleSave() {
    if (!grupo) return;
    if (repartoAlbaran && repartoAlbaran.total > 0 && repartoAlbaran.quedan !== 0) {
      const ok = window.confirm(
        repartoAlbaran.quedan > 0
          ? `Las cartelas suman ${repartoAlbaran.asignadas.toLocaleString("es-ES")} h y el albarán tiene ${repartoAlbaran.total.toLocaleString("es-ES")} h (faltan ${repartoAlbaran.quedan.toLocaleString("es-ES")}). ¿Crear igual?`
          : `Las cartelas suman ${repartoAlbaran.asignadas.toLocaleString("es-ES")} h y el albarán solo tiene ${repartoAlbaran.total.toLocaleString("es-ES")} h. ¿Crear igual?`,
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const created: ProdStockPaletConOts[] = [];

      for (let i = 0; i < palets.length; i++) {
        const p = palets[i];
        const cantidad = parseInt(p.cantidad_inicial) || 0;
        // Estado legacy coherente con la vista ATP (la UI 9.2 usa estado_derivado).
        const reservadaDura = p.stock_libre ? 0 : reservadaDuraTotal(p);
        const libreCalc = Math.max(cantidad - reservadaDura, 0);
        const estadoCoherente: string =
          cantidad <= 0
            ? "consumido"
            : reservadaDura <= 0
              ? "disponible"
              : libreCalc <= 0
                ? "reservado"
                : "parcial";
        const costeNum = p.coste.trim() ? Number(p.coste.replace(",", ".")) : null;
        const primeraOt = p.ots_referencia[0] ?? null;
        const recepcionLine =
          grupo.recepciones.find((r) => r.ot_numero === primeraOt) ??
          grupo.recepciones[0];

        const trabajoTitulo = primeraOt
          ? resolveTrabajoTitulo(
              grupo.recepciones.find((r) => r.ot_numero === primeraOt) ?? {
                ot_numero: primeraOt,
                trabajo_titulo: null,
              },
              otMetadata
            )
          : null;
        const refLoteCalculado = buildRefLote(primeraOt, trabajoTitulo);

        let idStockExplicito: number | undefined;
        if (cartelaPrueba) {
          const { data: sandboxId, error: sandboxErr } = await supabase.rpc(
            "next_id_stock_sandbox"
          );
          if (sandboxErr || sandboxId == null) {
            toast.error(
              `No se pudo reservar Id de prueba: ${sandboxErr?.message ?? "sin respuesta"}`
            );
            setSaving(false);
            return;
          }
          idStockExplicito = Number(sandboxId);
        }

        const { data: paletRow, error: paletErr } = await supabase
          .from("prod_stock_palets")
          .insert({
            ...(idStockExplicito != null ? { id_stock: idStockExplicito } : {}),
            tipo_stock: "materia_prima",
            unidad: "hojas",
            recepcion_id: recepcionLine?.recepcion_id ?? null,
            compra_id: recepcionLine?.compra_id ?? null,
            codigo_articulo: p.codigo_articulo.trim() || null,
            material_nombre: p.material_nombre || null,
            gramaje: p.gramaje ? parseInt(p.gramaje) : null,
            formato: p.formato || null,
            cantidad_inicial: cantidad,
            cantidad_actual: cantidad,
            coste: costeNum,
            ot_destino_numero:
              p.ots_referencia.length === 1 ? p.ots_referencia[0] : null,
            estado: p.stock_libre ? "disponible" : estadoCoherente,
            ubicacion_fila: p.ubicacion_fila || null,
            nota_entrega: grupo.albaran_proveedor,
            ref_lote_proveedor: p.ref_lote_proveedor || null,
            ref_lote: refLoteCalculado,
            es_fsc: p.es_fsc,
            es_pefc: p.es_pefc,
            es_prueba: cartelaPrueba,
            notas: cartelaPrueba
              ? [p.notas, "Cartela de prueba (sandbox)"].filter(Boolean).join(" · ")
              : p.notas || null,
            created_by: user?.id ?? null,
          })
          .select()
          .single();

        if (paletErr || !paletRow) {
          toast.error(`Error al crear palet ${i + 1}: ${paletErr?.message}`);
          setSaving(false);
          return;
        }

        if (!p.stock_libre && p.ots_referencia.length > 0) {
          const otsRows = p.ots_referencia.map((ot) => ({
            palet_id: paletRow.id,
            ot_numero: ot,
            cantidad_reservada: parseReservaDura(p.reservas[ot]),
          }));
          const { error: otsErr } = await supabase
            .from("prod_stock_palet_ots")
            .insert(otsRows);
          if (otsErr) {
            toast.error(
              `Error al enlazar OTs del palet ${i + 1}: ${otsErr.message}`
            );
            setSaving(false);
            return;
          }
        }

        const otsReservas = p.stock_libre
          ? []
          : p.ots_referencia.map((ot) => ({
              ot_numero: ot,
              cantidad_reservada: parseReservaDura(p.reservas[ot]),
            }));
        created.push({ ...paletRow, tipo_stock: paletRow.tipo_stock as StockTipo, ots: p.ots_referencia, otsReservas } as ProdStockPaletConOts);
      }

      setSavedPalets(created);
      setWizardTab("resumen");
      toast.success(
        `${created.length} cartela${created.length !== 1 ? "s" : ""} creada${created.length !== 1 ? "s" : ""} — ID Stock ${created.map((c) => c.id_stock).join(", ")}`
      );
      onCreated(
        created.map((c) => ({
          id_stock: c.id_stock,
          es_prueba: c.es_prueba,
        })),
      );
    } catch (e) {
      toast.error(
        `Error inesperado: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setSaving(false);
    }
  }

  const hasDuplicate = grupo && grupo.cartelas_existentes > 0;
  const canSave =
    palets.every(
      (p) => p.cantidad_inicial !== "" && parseInt(p.cantidad_inicial) >= 0
    ) && savedPalets.length === 0;

  const repartoAlbaran = useMemo(() => {
    if (!grupo) return null;
    const total = hojasTotalesGrupo(grupo);
    const asignadas = palets.reduce(
      (acc, p) => acc + (parseInt(p.cantidad_inicial, 10) || 0),
      0,
    );
    const quedan = total - asignadas;
    return { total, asignadas, quedan };
  }, [grupo, palets]);

  const otsAlbaran = grupo
    ? [...new Set(grupo.recepciones.map((r) => r.ot_numero).filter(Boolean))]
    : [];

  const otsSugeridas = useMemo(() => {
    const padres = new Set(contenedorPadres);
    const filteredAlbaran = otsAlbaran.filter((ot) => {
      if (hijasOts.length > 0 && padres.has(ot)) return false;
      return true;
    });
    return [...new Set([...filteredAlbaran, ...hijasOts])];
  }, [otsAlbaran, hijasOts, contenedorPadres]);

  const lineasEnriquecidas = grupo
    ? grupo.recepciones.map((line) =>
        line.tipo_recepcion === "stock_libre"
          ? line
          : enrichRecepcionLine(line, otMetadata)
      )
    : [];

  const activeIdx = Math.min(activePaletIdx, palets.length - 1);

  function renderPaletForm(idx: number) {
    const p = palets[idx];
    return (
      <div className="border rounded-lg p-4 sm:p-5 space-y-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Material</Label>
            <Input
              value={p.material_nombre}
              onChange={(e) => updatePalet(idx, "material_nombre", e.target.value)}
              placeholder="Ej: TP WHITE"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Formato</Label>
            <Input
              value={p.formato}
              onChange={(e) => updatePalet(idx, "formato", e.target.value)}
              placeholder="Ej: 58×92"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Gramaje (gr/m²)</Label>
            <Input
              value={p.gramaje}
              onChange={(e) => updatePalet(idx, "gramaje", e.target.value)}
              placeholder="350"
              type="number"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Cantidad hojas *</Label>
            <Input
              value={p.cantidad_inicial}
              onChange={(e) =>
                updatePalet(idx, "cantidad_inicial", e.target.value)
              }
              placeholder="1.500"
              type="number"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Cód. artículo</Label>
            <Input
              value={p.codigo_articulo}
              onChange={(e) =>
                updatePalet(idx, "codigo_articulo", e.target.value)
              }
              placeholder="Ej: PHFOAL235072001020"
              className="h-9 text-sm font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Ubicación fila</Label>
            <Select
              value={p.ubicacion_fila}
              onValueChange={(v) => updatePalet(idx, "ubicacion_fila", v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {UBICACIONES_FILA.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Lote proveedor</Label>
            <Input
              value={p.ref_lote_proveedor}
              onChange={(e) =>
                updatePalet(idx, "ref_lote_proveedor", e.target.value)
              }
              placeholder="Ej: 3238711"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Coste (€)</Label>
            <Input
              value={p.coste}
              onChange={(e) => updatePalet(idx, "coste", e.target.value)}
              placeholder="Total palet · opcional"
              type="number"
              step="0.01"
              min="0"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1 block">OT(s) referencia (sin cantidad)</Label>
          {hijasOts.length > 0 && (
            <p className="text-xs text-slate-500 mb-2">
              Barco detectado — selecciona las hijas que comparten este palet.
            </p>
          )}
          {otsSugeridas.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {loadingHijas && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> cargando hijas…
                </span>
              )}
              {otsSugeridas.map((ot) => (
                <label
                  key={ot}
                  className="flex items-center gap-1.5 text-sm cursor-pointer bg-slate-50 border rounded-md px-2.5 py-1.5 hover:bg-slate-100"
                >
                  <Checkbox
                    checked={p.ots_referencia.includes(ot)}
                    onCheckedChange={() => toggleOt(idx, ot)}
                  />
                  <span className="font-mono">{ot}</span>
                </label>
              ))}
            </div>
          )}
          {grupo && grupo.recepciones.filter((r) => r.ot_numero).length > 1 && (
            <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mb-3">
              Albarán con {grupo.recepciones.length} OTs — cantidad por defecto:{" "}
              <strong>
                {grupo.hojas_recibidas_total.toLocaleString("es-ES")} h
              </strong>{" "}
              (suma muelle). Si es <strong>1 palet físico</strong> compartido, deja
              esa cantidad total y marca las OTs; con varias OTs las reservas
              empiezan blandas — reparte a mano si hace falta.
            </p>
          )}

          {p.ots_referencia.length > 0 && !p.stock_libre && (
            <div className="space-y-1.5 mb-2">
              <p className="text-[11px] text-slate-400">
                Hojas reservadas por OT. Con 1 OT se rellena sola (dura = todo el
                palet → «reservado»). Vacío o «todas» = blanda (badge «disponible»).
              </p>
              {p.ots_referencia.map((ot) => (
                <div key={ot} className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="gap-1 cursor-pointer shrink-0 font-mono"
                    onClick={() => removeOt(idx, ot)}
                    title="Quitar OT"
                  >
                    {ot} <X className="size-2.5" />
                  </Badge>
                  <Input
                    value={p.reservas[ot] ?? ""}
                    onChange={(e) => setReserva(idx, ot, e.target.value)}
                    placeholder="todas"
                    type="number"
                    min="0"
                    className="h-8 text-sm w-28"
                  />
                  <span className="text-xs text-slate-400">h reservadas</span>
                </div>
              ))}
              {(() => {
                const d = atpDesglose(p);
                if (!d.hayReservaDura) return null;
                return (
                  <p
                    className={`text-xs ${d.excede ? "text-amber-600" : "text-slate-600"}`}
                  >
                    {d.fisica.toLocaleString("es-ES")} h en este palet ·{" "}
                    {d.reservada.toLocaleString("es-ES")} reservadas ·{" "}
                    <span className="font-semibold text-emerald-700">
                      {d.libre.toLocaleString("es-ES")} libres (ATP)
                    </span>
                    {d.excede && (
                      <span className="ml-1 font-medium">
                        ⚠ las reservas superan las hojas del palet
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
          )}
          {p.ots_referencia.length > 0 && p.stock_libre && (
            <div className="flex gap-1 flex-wrap mb-2">
              {p.ots_referencia.map((ot) => (
                <Badge
                  key={ot}
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => removeOt(idx, ot)}
                >
                  {ot} <X className="size-2.5" />
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <Input
              value={otInput[idx] ?? ""}
              onChange={(e) =>
                setOtInput((prev) => {
                  const n = [...prev];
                  n[idx] = e.target.value;
                  return n;
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOtManual(idx);
                }
              }}
              placeholder="Otra OT + Enter"
              className="h-8 text-sm flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={() => addOtManual(idx)}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={p.stock_libre}
              onCheckedChange={(v) => {
                const libre = !!v;
                setPalets((prev) => {
                  const next = [...prev];
                  const cur = next[idx];
                  next[idx] = {
                    ...cur,
                    stock_libre: libre,
                    reservas: libre
                      ? {}
                      : defaultReservasDurasUnaOt(
                          cur.ots_referencia,
                          parseInt(cur.cantidad_inicial, 10) || 0,
                          false,
                        ),
                  };
                  return next;
                });
              }}
            />
            Stock libre (sin OT)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={p.es_fsc}
              onCheckedChange={(v) => updatePalet(idx, "es_fsc", !!v)}
            />
            FSC
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={p.es_pefc}
              onCheckedChange={(v) => updatePalet(idx, "es_pefc", !!v)}
            />
            PEFC
          </label>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3">
          <DialogTitle>
            Cartelar albarán{" "}
            <span className="font-black">{grupo?.albaran_proveedor}</span>
          </DialogTitle>
          {grupo && (
            <DialogDescription>
              {grupo.proveedor_nombre} · {grupo.recepciones.length} OC
              {grupo.recepciones.length !== 1 ? "s" : ""} ·{" "}
              {grupo.palets_recibidos ?? "?"} palet
              {(grupo.palets_recibidos ?? 0) !== 1 ? "s" : ""} ·{" "}
              {grupo.hojas_recibidas_total.toLocaleString("es-ES")} hojas
            </DialogDescription>
          )}
        </DialogHeader>

        {hasDuplicate && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-300 px-4 py-2 text-sm text-amber-800 shrink-0 mx-6">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>
              Este albarán ya tiene{" "}
              <strong>{grupo!.cartelas_existentes}</strong> cartela
              {grupo!.cartelas_existentes !== 1 ? "s" : ""} creada
              {grupo!.cartelas_existentes !== 1 ? "s" : ""}. Revisa antes de
              continuar.
            </span>
          </div>
        )}

        <Tabs
          value={wizardTab}
          onValueChange={(v) => setWizardTab(v as WizardTab)}
          className="flex-1 flex flex-col min-h-0 px-6"
        >
          <TabsList className="w-full grid grid-cols-3 shrink-0">
            <TabsTrigger value="albaran">Albarán</TabsTrigger>
            <TabsTrigger value="palet">
              Palet{palets.length > 1 ? ` (${palets.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
          </TabsList>

          <TabsContent
            value="albaran"
            className="flex-1 overflow-y-auto mt-4 pb-4 min-h-0 data-[state=inactive]:hidden"
          >
            {grupo && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border bg-slate-50 p-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Proveedor
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {grupo.proveedor_nombre ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Albarán
                    </p>
                    <p className="text-sm font-mono mt-0.5">
                      {grupo.albaran_proveedor}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Recibido
                    </p>
                    <p className="text-sm mt-0.5">
                      {formatFechaEsCorta(grupo.fecha_recepcion)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Palets / Hojas
                    </p>
                    <p className="text-sm mt-0.5">
                      {grupo.palets_recibidos ?? "?"} ·{" "}
                      {grupo.hojas_recibidas_total.toLocaleString("es-ES")} h
                    </p>
                  </div>
                </div>

                {grupo.foto_urls.length > 0 ? (
                  <RecepcionFotosPanel
                    urls={grupo.foto_urls}
                    subtitle={`${grupo.proveedor_nombre ?? "Proveedor"} · ${grupo.albaran_proveedor}`}
                    variant="inline"
                  />
                ) : null}

                <Separator />

                <div>
                  <p className="text-sm font-semibold text-[#002147]">
                    Líneas del albarán
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-3">
                    Toca una línea para copiarla al palet activo y pasar al
                    formulario. Las hojas mostradas son las que Juan registró en
                    muelle.
                  </p>
                  <div className="space-y-2">
                    {lineasEnriquecidas.map((line) => (
                      <button
                        key={line.recepcion_id}
                        type="button"
                        onClick={() =>
                          prefillPaletFromLine(activeIdx, line)
                        }
                        className="w-full text-left rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {line.tipo_recepcion === "stock_libre" ? (
                              <Badge
                                variant="outline"
                                className="mb-1 text-[10px] border-emerald-300 text-emerald-800 bg-emerald-50"
                              >
                                STOCK libre
                              </Badge>
                            ) : (
                              <span className="block text-sm font-mono font-semibold text-[#002147]">
                                OT {line.ot_numero}
                              </span>
                            )}
                            {line.tipo_recepcion !== "stock_libre" ? (
                              <span className="block text-sm text-slate-700 mt-1">
                                {formatClienteTrabajo(
                                  line.cliente_nombre,
                                  line.trabajo_titulo
                                )}
                              </span>
                            ) : null}
                            <span className="block text-sm text-slate-500 mt-0.5">
                              {line.material}
                              {line.gramaje ? ` ${line.gramaje}gr` : ""}
                              {line.tamano_hoja ? ` · ${line.tamano_hoja}` : ""}
                              {line.hojas_recibidas_muelle != null
                                ? ` · ${line.hojas_recibidas_muelle.toLocaleString("es-ES")} h (muelle)`
                                : line.num_hojas_brutas
                                  ? ` · ${line.num_hojas_brutas.toLocaleString("es-ES")} h`
                                  : ""}
                              {line.palets_recibidos_muelle != null
                                ? ` · ${line.palets_recibidos_muelle} palet${line.palets_recibidos_muelle !== 1 ? "s" : ""}`
                                : ""}
                            </span>
                            {line.notas_muelle ? (
                              <span className="block text-xs text-amber-700 mt-1">
                                Muelle: {line.notas_muelle}
                              </span>
                            ) : null}
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 shrink-0 mt-1">
                            <ClipboardCopy className="size-3" /> usar
                          </span>
                        </div>
                        {line.foto_urls.length > 0 ? (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <RecepcionFotosPanel
                              urls={line.foto_urls}
                              subtitle={`OT ${line.ot_numero || "STOCK"}`}
                              variant="compact"
                            />
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="palet"
            className="flex-1 overflow-y-auto mt-4 pb-4 min-h-0 data-[state=inactive]:hidden"
          >
            {savedPalets.length === 0 && (
              <div className="space-y-4">
                {repartoAlbaran && repartoAlbaran.total > 0 ? (
                  <div
                    className={`rounded-md border px-3 py-2 text-xs ${
                      repartoAlbaran.quedan === 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : repartoAlbaran.quedan > 0
                          ? "border-amber-200 bg-amber-50 text-amber-950"
                          : "border-red-200 bg-red-50 text-red-900"
                    }`}
                  >
                    <p>
                      <strong>Albarán:</strong>{" "}
                      {repartoAlbaran.total.toLocaleString("es-ES")} h ·{" "}
                      <strong>en palets:</strong>{" "}
                      {repartoAlbaran.asignadas.toLocaleString("es-ES")} h
                      {repartoAlbaran.quedan === 0 ? (
                        <span> · cuadrado ✓</span>
                      ) : repartoAlbaran.quedan > 0 ? (
                        <span>
                          {" "}
                          · faltan{" "}
                          <strong>
                            {repartoAlbaran.quedan.toLocaleString("es-ES")} h
                          </strong>{" "}
                          por asignar
                        </span>
                      ) : (
                        <span>
                          {" "}
                          · sobran{" "}
                          <strong>
                            {Math.abs(repartoAlbaran.quedan).toLocaleString(
                              "es-ES",
                            )}{" "}
                            h
                          </strong>{" "}
                          (más que el albarán)
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] opacity-90">
                      Cada palet = 1 cartela física. «Cantidad hojas» es de{" "}
                      <em>ese</em> palet (no el total del albarán). Las «libres»
                      de abajo son ATP del palet (hojas − reservas), no el resto
                      del albarán.
                    </p>
                    {palets.length >= 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 text-[11px]"
                        onClick={repartirEquitativo}
                      >
                        Repartir albarán a partes iguales (
                        {palets.length} palet{palets.length !== 1 ? "s" : ""})
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {palets.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {palets.map((_, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant={activeIdx === idx ? "default" : "outline"}
                        onClick={() => setActivePaletIdx(idx)}
                        className="text-xs"
                      >
                        Palet {idx + 1}
                        {palets[idx].cantidad_inicial
                          ? ` · ${parseInt(palets[idx].cantidad_inicial).toLocaleString("es-ES")} h`
                          : ""}
                      </Button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#002147]">
                    Palet {activeIdx + 1} de {palets.length}
                  </span>
                  {palets.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-600"
                      onClick={() => removePalet(activeIdx)}
                    >
                      <X className="size-3 mr-1" /> Quitar palet
                    </Button>
                  )}
                </div>

                {renderPaletForm(activeIdx)}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPalet}
                  className="w-full"
                >
                  <Plus className="size-4 mr-2" />
                  Añadir otro palet
                  {repartoAlbaran && repartoAlbaran.quedan > 0
                    ? ` (sugerido: ${repartoAlbaran.quedan.toLocaleString("es-ES")} h)`
                    : ""}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="resumen"
            className="flex-1 overflow-y-auto mt-4 pb-4 min-h-0 data-[state=inactive]:hidden"
          >
            {savedPalets.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-700 font-medium">
                  ✓ Cartelas creadas correctamente
                </p>
                {savedPalets.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 border px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-black text-lg mr-2">
                        #{p.id_stock}
                      </span>
                      {p.material_nombre} ·{" "}
                      {p.cantidad_actual.toLocaleString("es-ES")} h
                      {p.ref_lote && (
                        <span className="ml-2 text-slate-400 text-xs">
                          · {p.ref_lote}
                        </span>
                      )}
                    </span>
                    <Badge
                      variant={
                        p.estado === "reservado" ? "default" : "secondary"
                      }
                    >
                      {p.estado}
                    </Badge>
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  Pulsa Imprimir para obtener 1 copia de cada cartela.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Revisa antes de crear. Se generarán{" "}
                  <strong>{palets.length}</strong> cartela
                  {palets.length !== 1 ? "s" : ""} para{" "}
                  <strong>{grupo?.albaran_proveedor}</strong>.
                </p>
                {palets.map((p, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border px-4 py-3 space-y-1 text-sm"
                  >
                    <div className="font-semibold text-[#002147]">
                      Palet {idx + 1}
                    </div>
                    <div>
                      {p.material_nombre || "—"}
                      {p.gramaje ? ` ${p.gramaje}gr` : ""}
                      {p.formato ? ` · ${p.formato}` : ""}
                    </div>
                    <div className="text-slate-600">
                      {parseInt(p.cantidad_inicial || "0").toLocaleString(
                        "es-ES"
                      )}{" "}
                      hojas
                      {p.codigo_articulo
                        ? ` · Cód. ${p.codigo_articulo}`
                        : ""}
                      {p.coste.trim()
                        ? ` · ${Number(p.coste.replace(",", ".")).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`
                        : ""}
                    </div>
                    <div className="font-mono text-xs text-slate-500">
                      OT:{" "}
                      {p.stock_libre
                        ? "(stock libre)"
                        : p.ots_referencia.length > 0
                          ? p.ots_referencia.join(" · ")
                          : "—"}
                    </div>
                    {!p.stock_libre &&
                      (() => {
                        const d = atpDesglose(p);
                        if (!d.hayReservaDura) return null;
                        const detalles = p.ots_referencia
                          .map((ot) => {
                            const dura = parseReservaDura(p.reservas[ot]);
                            return dura != null
                              ? `${dura.toLocaleString("es-ES")} → OT ${ot}`
                              : null;
                          })
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <div className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1 mt-0.5">
                            {d.fisica.toLocaleString("es-ES")} h ·{" "}
                            <span className="text-blue-700">
                              {d.reservada.toLocaleString("es-ES")} reservadas
                            </span>
                            {detalles ? ` (${detalles})` : ""} ·{" "}
                            <span className="font-semibold text-emerald-700">
                              {d.libre.toLocaleString("es-ES")} libres
                            </span>
                          </div>
                        );
                      })()}
                    {p.ubicacion_fila && (
                      <div className="text-xs text-slate-500">
                        Fila: {p.ubicacion_fila}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 shrink-0 px-6 py-4 border-t bg-slate-50/50 flex-col sm:flex-row sm:items-center sm:justify-between">
          {savedPalets.length === 0 && wizardTab !== "albaran" ? (
            <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer sm:max-w-[55%]">
              <Checkbox
                checked={cartelaPrueba}
                onCheckedChange={(v) => setCartelaPrueba(v === true)}
                disabled={saving}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-amber-800">
                  Cartela de prueba
                </span>
                <span className="block text-xs text-slate-500">
                  Id ≥ {SANDBOX_ID_STOCK_MIN.toLocaleString("es-ES")} — no usar
                  en planta; no la machaca el import Optimus.
                </span>
              </span>
            </label>
          ) : (
            <div />
          )}
          <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
          {savedPalets.length > 0 ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  onPrintReady(savedPalets, grupo?.proveedor_nombre);
                  onClose();
                }}
              >
                <Printer className="size-4 mr-2" />
                Imprimir cartelas (1 copia)
              </Button>
            </>
          ) : wizardTab === "albaran" ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={() => setWizardTab("palet")}>
                Continuar al palet
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </>
          ) : wizardTab === "palet" ? (
            <>
              <Button
                variant="outline"
                onClick={() => setWizardTab("albaran")}
                disabled={saving}
              >
                <ArrowLeft className="size-4 mr-2" />
                Albarán
              </Button>
              <Button onClick={() => setWizardTab("resumen")}>
                Ver resumen
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setWizardTab("palet")}
                disabled={saving}
              >
                <ArrowLeft className="size-4 mr-2" />
                Editar palet
              </Button>
              <Button onClick={handleSave} disabled={saving || !canSave}>
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                Crear {palets.length} cartela{palets.length !== 1 ? "s" : ""}
              </Button>
            </>
          )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
