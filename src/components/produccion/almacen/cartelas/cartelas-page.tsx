"use client";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Link2,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Unlink,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  openCartelaPrintWindow,
  printCartelasWindow,
  writeCartelasToWindow,
} from "@/lib/cartela-print-html";
import {
  enrichRecepcionLine,
  fetchOtMetadataMap,
  formatClienteTrabajo,
  otTitulosFromMetadata,
} from "@/lib/cartelas-ot-metadata";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { fetchFotosByRecepcionIds, mergeFotoUrls } from "@/lib/recepcion-fotos-fetch";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  deriveEstadoDerivado,
  estadoDerivadoLabelCartelas,
  sumReservaDuraTotal,
} from "@/lib/stock-atp-derive";
import type {
  AlbaranPendienteGroup,
  AlbaranRecepcionLine,
  ProdStockPaletConOts,
  ProdStockPaletRow,
  RecepcionTipo,
} from "@/types/prod-stock";
import { CartelaWizardDialog, type CartelaWizardCreatedInfo } from "./cartela-wizard-dialog";
import { RecepcionStockDialog } from "./recepcion-stock-dialog";
import { RecepcionFotosPanel } from "@/components/produccion/recepcion/recepcion-fotos-panel";
import { OtDestinoSearchInput } from "@/components/produccion/almacen/ot-destino-search-input";

const ROLES_LIBERAR = new Set(["admin", "oficina_tecnica", "gerencia"]);

const supabase = createSupabaseBrowserClient();

/**
 * Filtro PostgREST para id_stock por prefijo numérico (sin cast text).
 * "106" → eq 106 + rangos 1060–1069, 10600–10699, … → incluye #10673.
 * Capado a int4 Postgres (2^31-1) — si no, "1067" → 10670000000 revienta (22003).
 */
function idStockPrefixOrFilter(digits: string): string | null {
  if (!/^\d+$/.test(digits)) return null;
  const base = Number(digits);
  if (!Number.isInteger(base) || base < 0) return null;
  const PG_INT4_MAX = 2_147_483_647;
  const parts: string[] = [`id_stock.eq.${base}`];
  for (let extra = 1; extra <= 7; extra++) {
    const gte = base * 10 ** extra;
    if (gte > PG_INT4_MAX) break;
    const lt = (base + 1) * 10 ** extra;
    if (lt > PG_INT4_MAX) {
      parts.push(`and(id_stock.gte.${gte},id_stock.lte.${PG_INT4_MAX})`);
      break;
    }
    parts.push(`and(id_stock.gte.${gte},id_stock.lt.${lt})`);
  }
  return parts.join(",");
}

const ESTADO_COLORS: Record<string, string> = {
  disponible: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reservado: "bg-blue-100 text-blue-800 border-blue-200",
  parcial: "bg-amber-100 text-amber-800 border-amber-200",
  consumido: "bg-slate-100 text-slate-500 border-slate-200",
  agotado: "bg-slate-100 text-slate-500 border-slate-200",
};

/** PostgREST puede tipar joins FK como objeto o array según los tipos generados. */
function unwrapJoinRow(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return first != null && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function CartelasPage() {
  const [tab, setTab] = useState<"pendientes" | "cartelas">("pendientes");
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  const [loadingCartelas, setLoadingCartelas] = useState(false);
  const [pendientes, setPendientes] = useState<AlbaranPendienteGroup[]>([]);
  const [cartelas, setCartelas] = useState<ProdStockPaletConOts[]>([]);
  const [mostrarPruebas, setMostrarPruebas] = useState(false);
  const [filterIdStock, setFilterIdStock] = useState("");
  const [filterAlbOt, setFilterAlbOt] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("");

  // Filtros bandeja pendientes
  const [searchPendientes, setSearchPendientes] = useState("");
  const [ocultarSinAlbaran, setOcultarSinAlbaran] = useState(true);
  const [soloUltimos30, setSoloUltimos30] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardGrupo, setWizardGrupo] = useState<AlbaranPendienteGroup | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);

  // ── Bloque 9.8.1 — Liberar reserva ───────────────────────────────────────
  const [userRole, setUserRole] = useState<string | null>(null);
  const [liberarPalet, setLiberarPalet] = useState<ProdStockPaletConOts | null>(null);
  const [liberarOtNumero, setLiberarOtNumero] = useState<string>("");
  const [liberarDialogOpen, setLiberarDialogOpen] = useState(false);
  // ── Bloque 9.8.4 — Asignar stock libre a OT ──────────────────────────────
  const [asignarPalet, setAsignarPalet] = useState<ProdStockPaletConOts | null>(null);
  const [asignarDialogOpen, setAsignarDialogOpen] = useState(false);

  // ── Carga bandeja pendientes ──────────────────────────────────────────
  const loadPendientes = useCallback(async () => {
    setLoadingPendientes(true);
    try {
      const { data: receps, error } = await supabase
        .from("prod_recepciones_material")
        .select(
          `id, albaran_proveedor, fecha_recepcion, palets_recibidos, hojas_recibidas, notas,
           compra_id, tipo_recepcion, material_nombre, gramaje, formato,
           prod_proveedores(nombre),
           prod_compra_material(
             id, ot_numero, material, gramaje, tamano_hoja, num_hojas_brutas,
             cliente_nombre, trabajo_titulo,
             prod_proveedores(nombre)
           )`
        )
        .order("fecha_recepcion", { ascending: false });

      if (error) throw error;

      if (!receps || receps.length === 0) {
        setPendientes([]);
        return;
      }

      const recepIds = receps.map((r) => String(r.id ?? ""));
      const fotosByRecepcion = await fetchFotosByRecepcionIds(supabase, recepIds);

      const { data: stockCounts } = await supabase
        .from("prod_stock_palets")
        .select("recepcion_id, es_prueba")
        .in("recepcion_id", recepIds);

      const cartelasByRecepcion: Record<string, number> = {};
      const cartelasPruebaByRecepcion: Record<string, number> = {};
      for (const sc of stockCounts ?? []) {
        if (!sc.recepcion_id) continue;
        if (sc.es_prueba) {
          cartelasPruebaByRecepcion[sc.recepcion_id] =
            (cartelasPruebaByRecepcion[sc.recepcion_id] ?? 0) + 1;
        } else {
          cartelasByRecepcion[sc.recepcion_id] =
            (cartelasByRecepcion[sc.recepcion_id] ?? 0) + 1;
        }
      }

      const byAlbaran = new Map<string, AlbaranPendienteGroup>();
      for (const raw of receps as Record<string, unknown>[]) {
        const r = raw;
        const tipoRecepcion = (String(r.tipo_recepcion ?? "oc") as RecepcionTipo) || "oc";
        const esStock = tipoRecepcion === "stock_libre";
        const compra = unwrapJoinRow(r.prod_compra_material);
        const proveedorRecepcion = unwrapJoinRow(r.prod_proveedores);
        const proveedorCompra = compra
          ? unwrapJoinRow(compra.prod_proveedores)
          : null;
        const proveedor =
          (typeof proveedorRecepcion?.nombre === "string"
            ? proveedorRecepcion.nombre
            : null) ??
          (typeof proveedorCompra?.nombre === "string"
            ? proveedorCompra.nombre
            : null);

        const key =
          typeof r.albaran_proveedor === "string" && r.albaran_proveedor.trim()
            ? r.albaran_proveedor.trim()
            : "(sin albarán)";

        const recepcionId = String(r.id ?? "");
        const fechaRecepcion = String(r.fecha_recepcion ?? "");
        const paletsRecibidos =
          typeof r.palets_recibidos === "number" ? r.palets_recibidos : null;
        const hojasRecibidas =
          typeof r.hojas_recibidas === "number" ? r.hojas_recibidas : 0;
        const notasMuelle =
          typeof r.notas === "string" && r.notas.trim() ? r.notas.trim() : null;
        const lineFotos = fotosByRecepcion[recepcionId] ?? [];

        if (!byAlbaran.has(key)) {
          byAlbaran.set(key, {
            albaran_proveedor: key,
            proveedor_nombre: proveedor ?? null,
            fecha_recepcion: fechaRecepcion,
            palets_recibidos: 0,
            hojas_recibidas_total: 0,
            foto_urls: [...lineFotos],
            recepciones: [],
            cartelas_existentes: cartelasByRecepcion[recepcionId] ?? 0,
            cartelas_prueba_existentes: cartelasPruebaByRecepcion[recepcionId] ?? 0,
          });
        }

        const group = byAlbaran.get(key)!;
        if (new Date(fechaRecepcion) > new Date(group.fecha_recepcion)) {
          group.fecha_recepcion = fechaRecepcion;
        }
        if (!group.proveedor_nombre && proveedor) {
          group.proveedor_nombre = proveedor;
        }
        group.hojas_recibidas_total += hojasRecibidas;
        if (paletsRecibidos != null) {
          group.palets_recibidos =
            (group.palets_recibidos ?? 0) + paletsRecibidos;
        }
        group.foto_urls = mergeFotoUrls(group.foto_urls, lineFotos);
        group.cartelas_existentes += cartelasByRecepcion[recepcionId] ?? 0;
        group.cartelas_prueba_existentes +=
          cartelasPruebaByRecepcion[recepcionId] ?? 0;

        const compraOt = String(compra?.ot_numero ?? "").trim();
        const sinOtCompra = !esStock && !compraOt;
        const line: AlbaranRecepcionLine = {
          recepcion_id: recepcionId,
          compra_id: r.compra_id ? String(r.compra_id) : compra?.id ? String(compra.id) : null,
          tipo_recepcion: esStock || sinOtCompra ? "stock_libre" : "oc",
          ot_numero: esStock || sinOtCompra ? "" : compraOt,
          material: esStock
            ? typeof r.material_nombre === "string"
              ? r.material_nombre
              : null
            : typeof compra?.material === "string"
              ? compra.material
              : null,
          gramaje: esStock
            ? typeof r.gramaje === "number"
              ? r.gramaje
              : null
            : typeof compra?.gramaje === "number"
              ? compra.gramaje
              : null,
          tamano_hoja: esStock
            ? typeof r.formato === "string"
              ? r.formato
              : null
            : typeof compra?.tamano_hoja === "string"
              ? compra.tamano_hoja
              : null,
          hojas_recibidas_muelle: hojasRecibidas,
          palets_recibidos_muelle: paletsRecibidos,
          notas_muelle: notasMuelle,
          num_hojas_brutas:
            typeof compra?.num_hojas_brutas === "number"
              ? compra.num_hojas_brutas
              : null,
          cliente_nombre:
            typeof compra?.cliente_nombre === "string"
              ? compra.cliente_nombre
              : null,
          trabajo_titulo:
            typeof compra?.trabajo_titulo === "string"
              ? compra.trabajo_titulo
              : null,
          proveedor_nombre: proveedor ?? null,
          foto_urls: lineFotos,
        };
        group.recepciones.push(line);
      }

      const allOtNums = Array.from(byAlbaran.values()).flatMap((g) =>
        g.recepciones.map((r) => r.ot_numero).filter(Boolean)
      );
      const otMeta = await fetchOtMetadataMap(supabase, allOtNums);
      for (const group of byAlbaran.values()) {
        group.recepciones = group.recepciones.map((line) =>
          line.tipo_recepcion === "stock_libre"
            ? line
            : enrichRecepcionLine(line, otMeta)
        );
      }

      setPendientes(
        Array.from(byAlbaran.values()).sort(
          (a, b) =>
            new Date(b.fecha_recepcion).getTime() -
            new Date(a.fecha_recepcion).getTime()
        )
      );
    } catch (e) {
      toast.error(`Error al cargar pendientes: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingPendientes(false);
    }
  }, []);

  // ── Carga listado de cartelas ─────────────────────────────────────────
  const loadCartelas = useCallback(async () => {
    setLoadingCartelas(true);
    try {
      const idQ = filterIdStock.trim();
      const refQ = filterAlbOt.trim();
      const matQ = filterMaterial.trim();
      const hasFilter = Boolean(idQ || refQ || matQ);

      const selectCols = `*,
           prod_recepciones_material(
             prod_proveedores(nombre),
             prod_compra_material(prod_proveedores(nombre))
           )`;

      const escapeIlike = (s: string) =>
        s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

      const byId = new Map<string, Record<string, unknown>>();
      const addRows = (rows: Record<string, unknown>[] | null | undefined) => {
        for (const row of rows ?? []) {
          const id = String((row as { id?: string }).id ?? "").trim();
          if (id) byId.set(id, row);
        }
      };
      const rowsToMap = (rows: Record<string, unknown>[]) => {
        const m = new Map<string, Record<string, unknown>>();
        for (const row of rows) {
          const id = String((row as { id?: string }).id ?? "").trim();
          if (id) m.set(id, row);
        }
        return m;
      };

      let palets: Record<string, unknown>[] = [];

      if (!hasFilter) {
        const { data, error } = await supabase
          .from("prod_stock_palets")
          .select(selectCols)
          .order("id_stock", { ascending: false })
          .limit(200);
        if (error) throw error;
        palets = (data as Record<string, unknown>[]) ?? [];
      } else {
        // Tres filtros independientes; AND entre los que tengan valor.
        const maps: Map<string, Record<string, unknown>>[] = [];

        if (idQ) {
          const idOr = idStockPrefixOrFilter(idQ);
          if (!idOr) {
            toast.error("ID cartela: usa solo dígitos (ej. 10673 o 106).");
            setCartelas([]);
            return;
          }
          const { data, error } = await supabase
            .from("prod_stock_palets")
            .select(selectCols)
            .or(idOr)
            .limit(200);
          if (error) throw error;
          maps.push(rowsToMap((data as Record<string, unknown>[]) ?? []));
        }

        if (refQ) {
          const pattern = `%${escapeIlike(refQ)}%`;
          const refMap = new Map<string, Record<string, unknown>>();
          const [otsMatchRes, albRes] = await Promise.all([
            supabase
              .from("prod_stock_palet_ots")
              .select("palet_id")
              .ilike("ot_numero", pattern)
              .limit(500),
            supabase
              .from("prod_stock_palets")
              .select(selectCols)
              .ilike("nota_entrega", pattern)
              .limit(200),
          ]);
          if (otsMatchRes.error) throw otsMatchRes.error;
          if (albRes.error) throw albRes.error;
          for (const row of (albRes.data as Record<string, unknown>[]) ?? []) {
            const id = String((row as { id?: string }).id ?? "").trim();
            if (id) refMap.set(id, row);
          }
          const missing = [
            ...new Set(
              (otsMatchRes.data ?? [])
                .map((r) => String(r.palet_id ?? "").trim())
                .filter(Boolean),
            ),
          ].filter((id) => !refMap.has(id));
          for (let i = 0; i < missing.length; i += 200) {
            const chunk = missing.slice(i, i + 200);
            const { data: byOt, error: otErr } = await supabase
              .from("prod_stock_palets")
              .select(selectCols)
              .in("id", chunk);
            if (otErr) throw otErr;
            for (const row of (byOt as Record<string, unknown>[]) ?? []) {
              const id = String((row as { id?: string }).id ?? "").trim();
              if (id) refMap.set(id, row);
            }
          }
          maps.push(refMap);
        }

        if (matQ) {
          const pattern = `%${escapeIlike(matQ)}%`;
          const [byNombre, byDesc] = await Promise.all([
            supabase
              .from("prod_stock_palets")
              .select(selectCols)
              .ilike("material_nombre", pattern)
              .limit(200),
            supabase
              .from("prod_stock_palets")
              .select(selectCols)
              .ilike("descripcion_material", pattern)
              .limit(200),
          ]);
          if (byNombre.error) throw byNombre.error;
          if (byDesc.error) throw byDesc.error;
          const matMap = rowsToMap([
            ...((byNombre.data as Record<string, unknown>[]) ?? []),
            ...((byDesc.data as Record<string, unknown>[]) ?? []),
          ]);
          maps.push(matMap);
        }

        if (maps.length === 0) {
          palets = [];
        } else {
          let intersect = maps[0]!;
          for (let i = 1; i < maps.length; i++) {
            const next = maps[i]!;
            const kept = new Map<string, Record<string, unknown>>();
            for (const [id, row] of intersect) {
              if (next.has(id)) kept.set(id, row);
            }
            intersect = kept;
          }
          byId.clear();
          for (const [id, row] of intersect) byId.set(id, row);
          palets = Array.from(byId.values());
        }

        palets = palets
          .sort((a, b) => {
            const ia = Number((a as { id_stock?: number }).id_stock ?? 0);
            const ib = Number((b as { id_stock?: number }).id_stock ?? 0);
            return ib - ia;
          })
          .slice(0, 200);
      }

      if (palets.length === 0) {
        setCartelas([]);
        return;
      }

      const ids = palets
        .map((p) => String((p as { id?: string }).id ?? ""))
        .filter(Boolean);
      const { data: otsRows } = await supabase
        .from("prod_stock_palet_ots")
        .select("palet_id, ot_numero, cantidad_reservada")
        .in("palet_id", ids);

      const otsByPalet: Record<string, string[]> = {};
      const reservasByPalet: Record<
        string,
        { ot_numero: string; cantidad_reservada: number | null }[]
      > = {};
      for (const row of otsRows ?? []) {
        if (!otsByPalet[row.palet_id]) otsByPalet[row.palet_id] = [];
        otsByPalet[row.palet_id].push(row.ot_numero);
        if (!reservasByPalet[row.palet_id]) reservasByPalet[row.palet_id] = [];
        reservasByPalet[row.palet_id].push({
          ot_numero: row.ot_numero,
          cantidad_reservada: row.cantidad_reservada ?? null,
        });
      }

      const enriched: ProdStockPaletConOts[] = palets.map((raw) => {
        const p = raw as unknown as ProdStockPaletRow;
        const recep = unwrapJoinRow(raw.prod_recepciones_material);
        const compra = recep
          ? unwrapJoinRow(recep.prod_compra_material)
          : null;
        const provRecep = recep ? unwrapJoinRow(recep.prod_proveedores) : null;
        const prov = compra ? unwrapJoinRow(compra.prod_proveedores) : null;
        const proveedorNombre =
          (typeof provRecep?.nombre === "string" ? provRecep.nombre : null) ??
          (typeof prov?.nombre === "string" ? prov.nombre : null);
        return {
          ...p,
          ots: otsByPalet[p.id] ?? [],
          otsReservas: reservasByPalet[p.id] ?? [],
          proveedor_nombre: proveedorNombre,
        };
      });

      setCartelas(enriched);
    } catch (e) {
      toast.error(`Error al cargar cartelas: ${errorMessageFromUnknown(e)}`);
    } finally {
      setLoadingCartelas(false);
    }
  }, [filterIdStock, filterAlbOt, filterMaterial]);

  useEffect(() => {
    loadPendientes();
  }, [loadPendientes]);

  useEffect(() => {
    if (tab === "cartelas") loadCartelas();
  }, [tab, loadCartelas]);

  // Cargar rol del usuario para el botón Liberar (9.8.1)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const uid = typeof authUser?.id === "string" && authUser.id.trim().length > 0
          ? authUser.id.trim()
          : null;
        if (!uid || cancelled) return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (!cancelled) {
          setUserRole(
            prof && typeof (prof as { role?: unknown }).role === "string"
              ? String((prof as { role: string }).role).trim() || null
              : null,
          );
        }
      } catch {
        // non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Filtro búsqueda cartelas creadas ─────────────────────────────────
  const filteredCartelas = useMemo(() => {
    let list = cartelas;
    if (!mostrarPruebas) {
      list = list.filter((c) => !c.es_prueba);
    }
    return list;
  }, [cartelas, mostrarPruebas]);

  const cartelasPruebaOcultas = useMemo(() => {
    if (mostrarPruebas) return 0;
    return cartelas.filter((c) => c.es_prueba).length;
  }, [cartelas, mostrarPruebas]);

  const hasCartelasFilter = Boolean(
    filterIdStock.trim() || filterAlbOt.trim() || filterMaterial.trim(),
  );

  const busquedaCoincidePruebaOculta = useMemo(() => {
    if (mostrarPruebas || !hasCartelasFilter) return false;
    return cartelas.some((c) => c.es_prueba);
  }, [cartelas, mostrarPruebas, hasCartelasFilter]);

  // ── Filtro bandeja pendientes ─────────────────────────────────────────
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const filteredPendientes = useMemo(() => {
    let list = pendientes.filter((g) => g.cartelas_existentes === 0);

    if (ocultarSinAlbaran) {
      list = list.filter(
        (g) =>
          g.albaran_proveedor !== "(sin albarán)" &&
          g.albaran_proveedor !== "-" &&
          g.albaran_proveedor.trim() !== ""
      );
    }

    if (soloUltimos30) {
      list = list.filter(
        (g) => new Date(g.fecha_recepcion) >= thirtyDaysAgo
      );
    }

    if (searchPendientes.trim()) {
      const q = searchPendientes.toLowerCase();
      list = list.filter(
        (g) =>
          g.albaran_proveedor.toLowerCase().includes(q) ||
          (g.proveedor_nombre?.toLowerCase().includes(q) ?? false) ||
          g.recepciones.some(
            (r) =>
              r.ot_numero.toLowerCase().includes(q) ||
              (r.tipo_recepcion === "stock_libre" && q.includes("stock")) ||
              (r.cliente_nombre?.toLowerCase().includes(q) ?? false) ||
              (r.material?.toLowerCase().includes(q) ?? false) ||
              (r.trabajo_titulo?.toLowerCase().includes(q) ?? false)
          )
      );
    }

    return list;
  }, [pendientes, ocultarSinAlbaran, soloUltimos30, searchPendientes, thirtyDaysAgo]);

  const pendientesConCartela = pendientes.filter((g) => g.cartelas_existentes > 0);

  function openWizard(grupo: AlbaranPendienteGroup) {
    setWizardGrupo(grupo);
    setWizardOpen(true);
  }

  function handleStockRecepcionCreated(grupo: AlbaranPendienteGroup) {
    void loadPendientes();
    openWizard(grupo);
  }

  function handleWizardCreated(created: CartelaWizardCreatedInfo[]) {
    loadPendientes();
    if (created.some((c) => c.es_prueba)) {
      setMostrarPruebas(true);
      setTab("cartelas");
      // No auto-rellenar filtros: las 99xxx ya salen arriba (id DESC).
      setFilterIdStock("");
      setFilterAlbOt("");
      setFilterMaterial("");
      const first = created[0];
      if (first) {
        toast.success(
          `Cartela de prueba #${first.id_stock} creada. Activa «Mostrar pruebas» si no la ves.`
        );
      }
    } else if (tab !== "cartelas") {
      setTab("cartelas");
    }
    // Tras limpiar búsqueda / cambiar tab, loadCartelas corre vía useEffect
    void loadCartelas();
  }

  function handleAbrirLiberarDialog(palet: ProdStockPaletConOts, otNumero: string) {
    setLiberarPalet(palet);
    setLiberarOtNumero(otNumero);
    setLiberarDialogOpen(true);
  }

  function handleLiberarDone() {
    setLiberarDialogOpen(false);
    setLiberarPalet(null);
    setLiberarOtNumero("");
    loadCartelas();
  }

  function handleAbrirAsignarDialog(palet: ProdStockPaletConOts) {
    setAsignarPalet(palet);
    setAsignarDialogOpen(true);
  }

  function handleAsignarDone() {
    setAsignarDialogOpen(false);
    setAsignarPalet(null);
    loadCartelas();
  }

  async function handleDeletePrueba(palet: ProdStockPaletConOts) {
    if (!palet.es_prueba) return;
    const ok = window.confirm(
      `¿Borrar cartela de prueba #${palet.id_stock}? Solo válido en sandbox (sin movimientos).`,
    );
    if (!ok) return;
    try {
      const { count, error: movErr } = await supabase
        .from("prod_stock_movimientos")
        .select("id", { count: "exact", head: true })
        .eq("palet_id", palet.id);
      if (movErr) throw movErr;
      if ((count ?? 0) > 0) {
        toast.error("No se puede borrar: ya tiene movimientos de stock.");
        return;
      }
      const { error } = await supabase
        .from("prod_stock_palets")
        .delete()
        .eq("id", palet.id)
        .eq("es_prueba", true);
      if (error) throw error;
      toast.success(`Cartela #${palet.id_stock} borrada`);
      loadCartelas();
      loadPendientes();
    } catch (e) {
      toast.error(
        `Error al borrar: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async function handlePrint(
    palet: ProdStockPaletConOts & { proveedor_nombre?: string | null }
  ) {
    const printWin = openCartelaPrintWindow(`Cartela-${palet.id_stock}`);
    try {
      const otNums = palet.ots;
      const meta =
        otNums.length > 0
          ? await fetchOtMetadataMap(supabase, otNums)
          : {};
      const jobs = [
        {
          palet,
          copies: 1 as const,
          proveedorNombre: palet.proveedor_nombre ?? null,
          otTitulos: otTitulosFromMetadata(otNums, meta),
        },
      ];
      if (printWin) {
        writeCartelasToWindow(printWin, jobs);
      } else if (!printCartelasWindow(jobs)) {
        toast.error(
          "No se pudo abrir la ventana de impresión. Permite ventanas emergentes."
        );
      }
    } catch {
      printWin?.close();
      toast.error("Error al preparar la cartela para imprimir.");
    }
  }

  async function handleWizardPrintReady(
    palets: ProdStockPaletConOts[],
    proveedorNombre?: string | null
  ) {
    const title =
      palets.length === 1
        ? `Cartela-${palets[0]!.id_stock}`
        : "Cartelas-material";
    const printWin = openCartelaPrintWindow(title);
    try {
      const otNums = [...new Set(palets.flatMap((p) => p.ots))];
      const meta =
        otNums.length > 0
          ? await fetchOtMetadataMap(supabase, otNums)
          : {};
      const otTitulos = otTitulosFromMetadata(otNums, meta);
      const jobs = palets.map((palet) => ({
        palet,
        copies: 1 as const,
        proveedorNombre: proveedorNombre ?? null,
        otTitulos,
      }));
      if (printWin) {
        writeCartelasToWindow(printWin, jobs);
      } else if (!printCartelasWindow(jobs)) {
        toast.error(
          "No se pudo abrir la ventana de impresión. Permite ventanas emergentes."
        );
      }
    } catch {
      printWin?.close();
      toast.error("Error al preparar la cartela para imprimir.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147]">
            Cartelas de material
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Almacén · Emma / Ramón
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "pendientes" | "cartelas")}
      >
        <TabsList>
          <TabsTrigger value="pendientes" className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            Pendientes de cartelar
            {filteredPendientes.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5">
                {filteredPendientes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cartelas" className="flex items-center gap-2">
            <Package className="size-4" />
            Cartelas creadas
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Pendientes ─────────────────────────────── */}
        <TabsContent value="pendientes" className="space-y-3 mt-4">
          {/* Barra de filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                placeholder="OT, albarán, proveedor, cliente, material…"
                value={searchPendientes}
                onChange={(e) => setSearchPendientes(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setOcultarSinAlbaran((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2 py-1 border transition-colors whitespace-nowrap ${
                ocultarSinAlbaran
                  ? "bg-[#002147] text-white border-[#002147]"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
              }`}
            >
              {ocultarSinAlbaran ? "✓ " : ""}Ocultar sin albarán
            </button>
            <button
              type="button"
              onClick={() => setSoloUltimos30((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2 py-1 border transition-colors whitespace-nowrap ${
                soloUltimos30
                  ? "bg-[#002147] text-white border-[#002147]"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
              }`}
            >
              {soloUltimos30 ? "✓ " : ""}Solo 30 días
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={loadPendientes}
              disabled={loadingPendientes}
            >
              {loadingPendientes ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => setStockDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Recepción STOCK
            </Button>
          </div>

          <p className="text-xs text-slate-400 flex items-center gap-1">
            <SlidersHorizontal className="size-3" />
            {loadingPendientes
              ? "Cargando…"
              : `${filteredPendientes.length} albarán${filteredPendientes.length !== 1 ? "es" : ""} pendiente${filteredPendientes.length !== 1 ? "s" : ""}`}
          </p>

          {loadingPendientes && (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-slate-400" />
            </div>
          )}

          {!loadingPendientes && filteredPendientes.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-400" />
              <p>
                {searchPendientes || ocultarSinAlbaran || soloUltimos30
                  ? "Sin resultados con los filtros actuales"
                  : "Todo cartelado — no hay recepciones pendientes"}
              </p>
            </div>
          )}

          {/* Albaranes SIN cartela (filtrados) */}
          {filteredPendientes.map((grupo) => (
            <AlbaranCard
              key={grupo.albaran_proveedor}
              grupo={grupo}
              onCartelar={() => openWizard(grupo)}
            />
          ))}

          {/* Albaranes YA cartelados (acordeón colapsado) */}
          {pendientesConCartela.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                {pendientesConCartela.length} albarán
                {pendientesConCartela.length !== 1 ? "es" : ""} ya cartelado
                {pendientesConCartela.length !== 1 ? "s" : ""}
              </summary>
              <div className="space-y-2 mt-2">
                {pendientesConCartela.map((grupo) => (
                  <AlbaranCard
                    key={grupo.albaran_proveedor}
                    grupo={grupo}
                    onCartelar={() => openWizard(grupo)}
                    dimmed
                  />
                ))}
              </div>
            </details>
          )}
        </TabsContent>

        {/* ── Tab: Cartelas creadas ────────────────────────── */}
        <TabsContent value="cartelas" className="space-y-3 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="ID"
              value={filterIdStock}
              onChange={(e) => setFilterIdStock(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadCartelas();
              }}
              className="h-8 w-[5.5rem] text-sm tabular-nums"
              inputMode="numeric"
              title="ID cartela (prefijo, ej. 10673 o 106)"
            />
            <Input
              placeholder="Albarán / OT"
              value={filterAlbOt}
              onChange={(e) => setFilterAlbOt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadCartelas();
              }}
              className="h-8 w-[8.5rem] text-sm"
              title="Albarán o número de OT"
            />
            <Input
              placeholder="Material…"
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadCartelas();
              }}
              className="h-8 min-w-[8rem] flex-1 max-w-[14rem] text-sm"
              title="Nombre o descripción de material"
            />
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <Checkbox
                checked={mostrarPruebas}
                onCheckedChange={(v) => setMostrarPruebas(v === true)}
              />
              Mostrar pruebas
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={loadCartelas}
              disabled={loadingCartelas}
              className="h-8"
            >
              {loadingCartelas ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          </div>

          {hasCartelasFilter && (
            <p className="text-xs text-slate-500">
              Filtros server-side (AND)
              {filterIdStock.trim() ? (
                <>
                  {" "}
                  · ID <strong>«{filterIdStock.trim()}»</strong>
                </>
              ) : null}
              {filterAlbOt.trim() ? (
                <>
                  {" "}
                  · Alb/OT <strong>«{filterAlbOt.trim()}»</strong>
                </>
              ) : null}
              {filterMaterial.trim() ? (
                <>
                  {" "}
                  · Material <strong>«{filterMaterial.trim()}»</strong>
                </>
              ) : null}
              {" "}
              · máx. 200
            </p>
          )}

          {loadingCartelas && (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-slate-400" />
            </div>
          )}

          {!loadingCartelas && filteredCartelas.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Package className="size-8 mx-auto mb-2" />
              <p>
                {hasCartelasFilter
                  ? busquedaCoincidePruebaOculta
                    ? "Hay cartelas de prueba que coinciden — activa «Mostrar pruebas»"
                    : "Sin resultados para esa búsqueda"
                  : cartelasPruebaOcultas > 0
                    ? `${cartelasPruebaOcultas} cartela${cartelasPruebaOcultas !== 1 ? "s" : ""} de prueba oculta${cartelasPruebaOcultas !== 1 ? "s" : ""} — activa «Mostrar pruebas»`
                    : "No hay cartelas todavía (mostrando últimas 200)"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {filteredCartelas.map((palet) => (
              <CartelaListRow
                key={palet.id}
                palet={palet}
                userRole={userRole}
                onPrint={() => handlePrint(palet)}
                onDeletePrueba={
                  palet.es_prueba ? () => handleDeletePrueba(palet) : undefined
                }
                onLiberarOt={(otNumero) => handleAbrirLiberarDialog(palet, otNumero)}
                onAsignarOt={() => handleAbrirAsignarDialog(palet)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Wizard */}
      <CartelaWizardDialog
        open={wizardOpen}
        grupo={wizardGrupo}
        onClose={() => {
          setWizardOpen(false);
          setWizardGrupo(null);
        }}
        onCreated={handleWizardCreated}
        onPrintReady={handleWizardPrintReady}
      />

      <RecepcionStockDialog
        open={stockDialogOpen}
        onClose={() => setStockDialogOpen(false)}
        onCreated={handleStockRecepcionCreated}
      />

      {/* Diálogo liberar reserva 9.8.1 */}
      {liberarPalet && (
        <LiberarReservaDialog
          open={liberarDialogOpen}
          palet={liberarPalet}
          otNumero={liberarOtNumero}
          onClose={() => setLiberarDialogOpen(false)}
          onDone={handleLiberarDone}
        />
      )}

      {/* Diálogo asignar stock libre a OT 9.8.4 */}
      {asignarPalet && (
        <AsignarOtDialog
          open={asignarDialogOpen}
          palet={asignarPalet}
          onClose={() => setAsignarDialogOpen(false)}
          onDone={handleAsignarDone}
        />
      )}
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────

function AlbaranCard({
  grupo,
  onCartelar,
  dimmed = false,
}: {
  grupo: AlbaranPendienteGroup;
  onCartelar: () => void;
  dimmed?: boolean;
}) {
  const hasCartelas = grupo.cartelas_existentes > 0;
  const hasPrueba = grupo.cartelas_prueba_existentes > 0;
  return (
    <Card className={dimmed ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {grupo.proveedor_nombre ?? "Proveedor desconocido"}
              <span className="text-slate-400 font-normal text-sm">
                · Albarán {grupo.albaran_proveedor}
              </span>
            </CardTitle>
            <CardDescription className="mt-0.5">
              {formatFechaEsCorta(grupo.fecha_recepcion)} ·{" "}
              {grupo.palets_recibidos ?? "?"} palet
              {(grupo.palets_recibidos ?? 0) !== 1 ? "s" : ""} ·{" "}
              {grupo.hojas_recibidas_total.toLocaleString("es-ES")} hojas
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasCartelas && (
              <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                <AlertCircle className="size-3" />
                {grupo.cartelas_existentes} cartela
                {grupo.cartelas_existentes !== 1 ? "s" : ""} ya creada
                {grupo.cartelas_existentes !== 1 ? "s" : ""}
              </div>
            )}
            {!hasCartelas && hasPrueba && (
              <div className="flex items-center gap-1 text-xs text-amber-800 bg-amber-50/80 border border-amber-300 rounded px-2 py-0.5">
                <AlertCircle className="size-3" />
                {grupo.cartelas_prueba_existentes} cartela
                {grupo.cartelas_prueba_existentes !== 1 ? "s" : ""} de prueba
              </div>
            )}
            <Button size="sm" onClick={onCartelar} className="text-xs">
              {hasCartelas ? "Añadir cartelas →" : "Generar cartelas →"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {grupo.foto_urls.length > 0 ? (
          <RecepcionFotosPanel
            urls={grupo.foto_urls}
            subtitle={`${grupo.proveedor_nombre ?? "Proveedor"} · ${grupo.albaran_proveedor}`}
            variant="inline"
          />
        ) : null}
        {grupo.recepciones.length > 1 ? (
          <p className="text-xs text-slate-500">
            {grupo.recepciones.length} líneas en este albarán (mismo envío)
          </p>
        ) : null}
        <div className="space-y-1.5">
          {grupo.recepciones.map((line) => (
            <div
              key={`${line.recepcion_id}-${line.ot_numero || "stock"}`}
              className="flex items-start gap-2 text-xs text-slate-600"
            >
              {line.tipo_recepcion === "stock_libre" ? (
                <Badge
                  variant="outline"
                  className="shrink-0 text-[10px] border-emerald-300 text-emerald-800 bg-emerald-50"
                >
                  STOCK
                </Badge>
              ) : (
                <span className="font-mono font-semibold text-slate-800 w-20 shrink-0 pt-0.5">
                  OT {line.ot_numero}
                </span>
              )}
              <div className="flex-1 min-w-0">
                {line.tipo_recepcion !== "stock_libre" ? (
                  <div className="text-slate-500 truncate">
                    {formatClienteTrabajo(line.cliente_nombre, line.trabajo_titulo)}
                  </div>
                ) : null}
                <div className="truncate">
                  {line.material}
                  {line.gramaje ? ` ${line.gramaje}gr` : ""}
                  {line.tamano_hoja ? ` · ${line.tamano_hoja}` : ""}
                </div>
                {line.notas_muelle ? (
                  <p className="text-[10px] text-amber-700 mt-0.5 truncate" title={line.notas_muelle}>
                    Muelle: {line.notas_muelle}
                  </p>
                ) : null}
              </div>
              <div className="text-right shrink-0">
                {line.hojas_recibidas_muelle != null ? (
                  <span className="text-slate-600 block">
                    {line.hojas_recibidas_muelle.toLocaleString("es-ES")} h
                  </span>
                ) : null}
                {line.num_hojas_brutas != null &&
                line.hojas_recibidas_muelle != null &&
                line.num_hojas_brutas !== line.hojas_recibidas_muelle ? (
                  <span className="text-slate-400 text-[10px]">
                    OC {line.num_hojas_brutas.toLocaleString("es-ES")} h
                  </span>
                ) : line.num_hojas_brutas && !line.hojas_recibidas_muelle ? (
                  <span className="text-slate-400">
                    {line.num_hojas_brutas.toLocaleString("es-ES")} h
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CartelaListRow({
  palet,
  userRole,
  onPrint,
  onDeletePrueba,
  onLiberarOt,
  onAsignarOt,
}: {
  palet: ProdStockPaletConOts;
  userRole: string | null;
  onPrint: () => void;
  onDeletePrueba?: () => void;
  onLiberarOt?: (otNumero: string) => void;
  onAsignarOt?: () => void;
}) {
  const otsConReserva = palet.ots;
  const reservadaDura = sumReservaDuraTotal(palet.otsReservas ?? []);
  const estadoDerivado = deriveEstadoDerivado(palet.cantidad_actual, reservadaDura);
  const estadoUi = estadoDerivadoLabelCartelas(estadoDerivado);
  const estadoClass = ESTADO_COLORS[estadoDerivado] ?? ESTADO_COLORS[estadoUi] ?? "";
  const puedeLiberar = userRole != null && ROLES_LIBERAR.has(userRole);
  const esDisponible = estadoDerivado === "disponible" && palet.cantidad_actual > 0;

  return (
    <div className="flex items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50 transition-colors">
      {/* ID Stock */}
      <span className="font-black text-xl text-[#002147] w-20 shrink-0 tabular-nums">
        #{palet.id_stock}
      </span>
      {palet.es_prueba ? (
        <Badge
          variant="outline"
          className="shrink-0 text-[10px] border-amber-300 text-amber-800 bg-amber-50"
        >
          prueba
        </Badge>
      ) : null}

      {/* Material */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {palet.material_nombre ?? palet.descripcion_material ?? "—"}
          {palet.gramaje ? (
            <span className="text-slate-400 font-normal ml-1">
              {palet.gramaje} gr
            </span>
          ) : null}
          {palet.formato ? (
            <span className="text-slate-400 font-normal ml-1">
              · {palet.formato}
            </span>
          ) : null}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
          {palet.nota_entrega && <span>Alb. {palet.nota_entrega}</span>}
          {otsConReserva.length > 0 && (
            <span>OT(s): {otsConReserva.join(", ")}</span>
          )}
          {otsConReserva.length === 0 && (
            <span className="text-emerald-600">stock libre</span>
          )}
        </div>
      </div>

      {/* Cantidad actual */}
      <div className="text-right shrink-0 w-24">
        <div className="font-bold">
          {palet.cantidad_actual.toLocaleString("es-ES")}
        </div>
        <div className="text-xs text-slate-400">
          de {palet.cantidad_inicial.toLocaleString("es-ES")} h
        </div>
      </div>

      {/* Estado */}
      <Badge
        variant="outline"
        className={`shrink-0 text-xs ${estadoClass}`}
      >
        {estadoUi}
      </Badge>

      {/* Liberar OT / Asignar OT / Imprimir / Borrar prueba */}
      <div className="flex shrink-0 items-center gap-0.5">
        {/* Botón Liberar (9.8.1) — visible solo a roles privilegiados y si hay OTs */}
        {puedeLiberar && otsConReserva.length > 0 && onLiberarOt &&
          otsConReserva.map((ot) => (
            <Button
              key={ot}
              size="icon"
              variant="ghost"
              className="size-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => onLiberarOt(ot)}
              title={`Liberar reserva OT ${ot}`}
            >
              <Unlink className="size-3.5" />
            </Button>
          ))
        }
        {/* Botón Asignar a OT (9.8.4) — visible en palets disponibles */}
        {esDisponible && onAsignarOt && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={onAsignarOt}
            title="Asignar a OT (stock libre)"
          >
            <Link2 className="size-3.5" />
          </Button>
        )}
        {onDeletePrueba ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onDeletePrueba}
            title="Borrar cartela de prueba"
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          onClick={onPrint}
          title="Imprimir cartela (1 copia)"
        >
          <Printer className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Diálogo de liberación de reserva (9.8.1) ─────────────────────────────────

function LiberarReservaDialog({
  open,
  palet,
  otNumero,
  onClose,
  onDone,
}: {
  open: boolean;
  palet: ProdStockPaletConOts;
  otNumero: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [nuevoFormato, setNuevoFormato] = useState("");
  const [saving, setSaving] = useState(false);
  const autorizadoRef = useRef<HTMLInputElement>(null);

  // Limpiar al abrir
  useEffect(() => {
    if (open) {
      setAutorizadoPor("");
      setMotivo("");
      setNuevoFormato("");
      setSaving(false);
      setTimeout(() => autorizadoRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleConfirmar() {
    const quien = autorizadoPor.trim();
    if (!quien) {
      toast.error("Indica quién autoriza la liberación (obligatorio para el ledger).");
      autorizadoRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("prod_stock_liberar_reserva", {
        p_palet_id: palet.id,
        p_ot_numero: otNumero,
        p_autorizado_por: quien,
        p_notas: motivo.trim() || null,
        p_nuevo_formato: nuevoFormato.trim() || null,
      });
      if (error) throw error;
      toast.success(
        `Reserva de cartela #${palet.id_stock} liberada de OT ${otNumero}.`,
      );
      onDone();
    } catch (e) {
      toast.error(`Error al liberar: ${errorMessageFromUnknown(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const materialDesc = [
    palet.material_nombre ?? palet.descripcion_material,
    palet.gramaje ? `${palet.gramaje} gr` : null,
    palet.formato,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlink className="size-4 text-amber-600" />
            Liberar reserva de OT
          </DialogTitle>
          <DialogDescription>
            Cartela{" "}
            <span className="font-semibold text-slate-800">
              #{palet.id_stock}
            </span>{" "}
            {materialDesc && (
              <span className="text-slate-600">— {materialDesc}</span>
            )}
            <br />
            Se liberará la reserva para{" "}
            <span className="font-semibold text-slate-800">OT {otNumero}</span>.
            El material quedará libre para reasignar. Queda registrado en el ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lib-autorizado" className="text-sm font-medium">
              Autorizado por <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lib-autorizado"
              ref={autorizadoRef}
              placeholder="Nombre de quien autoriza (Ramón, Juan…)"
              value={autorizadoPor}
              onChange={(e) => setAutorizadoPor(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lib-motivo" className="text-sm font-medium">
              Motivo / nota
            </Label>
            <Textarea
              id="lib-motivo"
              placeholder="Ej: Formato incorrecto — cartela 65×92 no cubre pliego troquel 72×102"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lib-formato" className="text-sm font-medium">
              Nuevo formato del palet{" "}
              <span className="text-slate-400 font-normal text-xs">
                (solo si ya fue cortado; p. ej. 65×46)
              </span>
            </Label>
            <Input
              id="lib-formato"
              placeholder="Dejar vacío si el material está sin cortar"
              value={nuevoFormato}
              onChange={(e) => setNuevoFormato(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="default"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => void handleConfirmar()}
            disabled={saving || !autorizadoPor.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1" />
                Liberando…
              </>
            ) : (
              <>
                <Unlink className="size-4 mr-1" />
                Confirmar liberación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo asignar stock libre a OT (9.8.4) ─────────────────────────────────

function AsignarOtDialog({
  open,
  palet,
  onClose,
  onDone,
}: {
  open: boolean;
  palet: ProdStockPaletConOts;
  onClose: () => void;
  onDone: () => void;
}) {
  const [otNumero, setOtNumero] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const otRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setOtNumero("");
      setNotas("");
      setSaving(false);
      setTimeout(() => otRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleConfirmar() {
    const ot = otNumero.trim();
    if (!ot) {
      toast.error("Indica el número de OT a asignar.");
      otRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("prod_stock_asignar_palet_ot", {
        p_palet_id: palet.id,
        p_ot_numero: ot,
        p_cantidad_reservada: null,
        p_notas: notas.trim() || null,
      });
      if (error) throw error;
      toast.success(`Cartela #${palet.id_stock} asignada a OT ${ot}. Material en stock asignado.`);
      onDone();
    } catch (e) {
      toast.error(`Error al asignar: ${errorMessageFromUnknown(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const materialDesc = [
    palet.material_nombre ?? palet.descripcion_material,
    palet.gramaje ? `${palet.gramaje} gr` : null,
    palet.formato,
    `${palet.cantidad_actual.toLocaleString("es-ES")} h`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-emerald-600" />
            Asignar stock libre a OT
          </DialogTitle>
          <DialogDescription>
            Cartela{" "}
            <span className="font-semibold text-slate-800">
              #{palet.id_stock}
            </span>{" "}
            {materialDesc && (
              <span className="text-slate-600">— {materialDesc}</span>
            )}
            <br />
            Asigna esta cartela a una OT en estado STOP. Juan puede hacer
            esta acción sin rol especial. Queda registrado en el ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="asig-ot" className="text-sm font-medium">
              OT destino <span className="text-red-500">*</span>
            </Label>
            <OtDestinoSearchInput
              id="asig-ot"
              value={otNumero}
              onChange={setOtNumero}
              disabled={saving}
              inputRef={otRef}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asig-notas" className="text-sm font-medium">
              Notas{" "}
              <span className="text-slate-400 font-normal text-xs">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="asig-notas"
              placeholder="Motivo de la asignación, instrucción de oficina…"
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={saving}
            />
          </div>
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            La OT saldrá del estado STOP y el palet quedará reservado para ella.
            Asegúrate de que oficina ya ha decidido usar este stock.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => void handleConfirmar()}
            disabled={saving || !otNumero.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1" />
                Asignando…
              </>
            ) : (
              <>
                <Link2 className="size-4 mr-1" />
                Confirmar asignación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
