"use client";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  enrichRecepcionLine,
  fetchOtMetadataMap,
  formatClienteTrabajo,
} from "@/lib/cartelas-ot-metadata";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  AlbaranPendienteGroup,
  AlbaranRecepcionLine,
  ProdStockPaletConOts,
  ProdStockPaletRow,
} from "@/types/prod-stock";
import { CartelaPrint } from "./cartela-print";
import { CartelaWizardDialog } from "./cartela-wizard-dialog";

const supabase = createSupabaseBrowserClient();

const ESTADO_COLORS: Record<string, string> = {
  disponible: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reservado: "bg-blue-100 text-blue-800 border-blue-200",
  parcial: "bg-amber-100 text-amber-800 border-amber-200",
  consumido: "bg-slate-100 text-slate-500 border-slate-200",
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
  const [search, setSearch] = useState("");

  // Filtros bandeja pendientes
  const [searchPendientes, setSearchPendientes] = useState("");
  const [ocultarSinAlbaran, setOcultarSinAlbaran] = useState(true);
  const [soloUltimos30, setSoloUltimos30] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardGrupo, setWizardGrupo] = useState<AlbaranPendienteGroup | null>(null);
  // P0: printPalet ahora puede ser un array (desde wizard) o null
  const [printPalets, setPrintPalets] = useState<ProdStockPaletConOts[]>([]);

  // ── Carga bandeja pendientes ──────────────────────────────────────────
  const loadPendientes = useCallback(async () => {
    setLoadingPendientes(true);
    try {
      // recepciones con su compra y proveedor
      const { data: receps, error } = await supabase
        .from("prod_recepciones_material")
        .select(
          `id, albaran_proveedor, fecha_recepcion, palets_recibidos, hojas_recibidas,
           compra_id,
           prod_compra_material!inner(
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

      // cuántas cartelas tiene cada recepcion (antiduplicado)
      const recepIds = receps.map((r) => r.id);
      const { data: stockCounts } = await supabase
        .from("prod_stock_palets")
        .select("recepcion_id")
        .in("recepcion_id", recepIds);

      const cartelasByRecepcion: Record<string, number> = {};
      for (const sc of stockCounts ?? []) {
        if (sc.recepcion_id) {
          cartelasByRecepcion[sc.recepcion_id] =
            (cartelasByRecepcion[sc.recepcion_id] ?? 0) + 1;
        }
      }

      // agrupar por albaran_proveedor
      const byAlbaran = new Map<string, AlbaranPendienteGroup>();
      for (const raw of receps as Record<string, unknown>[]) {
        const r = raw;
        const compra = unwrapJoinRow(r.prod_compra_material);
        const proveedorRow = compra
          ? unwrapJoinRow(compra.prod_proveedores)
          : null;
        const proveedor =
          typeof proveedorRow?.nombre === "string"
            ? proveedorRow.nombre
            : null;
        const key =
          typeof r.albaran_proveedor === "string" && r.albaran_proveedor.trim()
            ? r.albaran_proveedor
            : "(sin albarán)";

        const recepcionId = String(r.id ?? "");
        const fechaRecepcion = String(r.fecha_recepcion ?? "");
        const paletsRecibidos =
          typeof r.palets_recibidos === "number" ? r.palets_recibidos : null;
        const hojasRecibidas =
          typeof r.hojas_recibidas === "number" ? r.hojas_recibidas : 0;

        if (!byAlbaran.has(key)) {
          byAlbaran.set(key, {
            albaran_proveedor: key,
            proveedor_nombre: proveedor ?? null,
            fecha_recepcion: fechaRecepcion,
            palets_recibidos: paletsRecibidos,
            hojas_recibidas_total: hojasRecibidas,
            recepciones: [],
            cartelas_existentes: cartelasByRecepcion[recepcionId] ?? 0,
          });
        }

        const group = byAlbaran.get(key)!;
        if (
          new Date(fechaRecepcion) > new Date(group.fecha_recepcion)
        ) {
          group.fecha_recepcion = fechaRecepcion;
        }
        group.hojas_recibidas_total += hojasRecibidas;
        group.cartelas_existentes += cartelasByRecepcion[recepcionId] ?? 0;

        const line: AlbaranRecepcionLine = {
          recepcion_id: recepcionId,
          compra_id: String(r.compra_id ?? compra?.id ?? ""),
          ot_numero: String(compra?.ot_numero ?? ""),
          material:
            typeof compra?.material === "string" ? compra.material : null,
          gramaje:
            typeof compra?.gramaje === "number" ? compra.gramaje : null,
          tamano_hoja:
            typeof compra?.tamano_hoja === "string" ? compra.tamano_hoja : null,
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
        };
        group.recepciones.push(line);
      }

      // Fallback cliente/trabajo desde prod_ots_general si compra viene vacía
      const allOtNums = Array.from(byAlbaran.values()).flatMap((g) =>
        g.recepciones.map((r) => r.ot_numero)
      );
      const otMeta = await fetchOtMetadataMap(supabase, allOtNums);
      for (const group of byAlbaran.values()) {
        group.recepciones = group.recepciones.map((line) =>
          enrichRecepcionLine(line, otMeta)
        );
      }

      setPendientes(Array.from(byAlbaran.values()));
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
      const { data: palets, error: paletsErr } = await supabase
        .from("prod_stock_palets")
        .select("*")
        .order("id_stock", { ascending: false })
        .limit(200);

      if (paletsErr) throw paletsErr;

      if (!palets || palets.length === 0) {
        setCartelas([]);
        return;
      }

      const ids = palets.map((p: ProdStockPaletRow) => p.id);
      const { data: otsRows } = await supabase
        .from("prod_stock_palet_ots")
        .select("palet_id, ot_numero")
        .in("palet_id", ids);

      const otsByPalet: Record<string, string[]> = {};
      for (const row of otsRows ?? []) {
        if (!otsByPalet[row.palet_id]) otsByPalet[row.palet_id] = [];
        otsByPalet[row.palet_id].push(row.ot_numero);
      }

      const enriched: ProdStockPaletConOts[] = palets.map(
        (p: ProdStockPaletRow) => ({
          ...p,
          ots: otsByPalet[p.id] ?? (p.ot_destino_numero ? [p.ot_destino_numero] : []),
        })
      );
      setCartelas(enriched);
    } catch (e) {
      toast.error(`Error al cargar cartelas: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingCartelas(false);
    }
  }, []);

  useEffect(() => {
    loadPendientes();
  }, [loadPendientes]);

  useEffect(() => {
    if (tab === "cartelas") loadCartelas();
  }, [tab, loadCartelas]);

  // ── Filtro búsqueda cartelas creadas ─────────────────────────────────
  const filteredCartelas = useMemo(() => {
    if (!search.trim()) return cartelas;
    const q = search.toLowerCase();
    return cartelas.filter(
      (c) =>
        c.id_stock.toString().includes(q) ||
        c.material_nombre?.toLowerCase().includes(q) ||
        c.nota_entrega?.toLowerCase().includes(q) ||
        c.ots.some((o) => o.toLowerCase().includes(q))
    );
  }, [cartelas, search]);

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

  function handleWizardCreated() {
    loadPendientes();
    if (tab === "cartelas") loadCartelas();
  }

  function handlePrint(palet: ProdStockPaletConOts) {
    setPrintPalets([palet]);
    // wait for React render before triggering print
    setTimeout(() => window.print(), 150);
  }

  /** P0 fix: el wizard emite la lista de palets recién creados; imprimimos desde aquí */
  function handleWizardPrintReady(palets: ProdStockPaletConOts[]) {
    setPrintPalets(palets);
    setTimeout(() => window.print(), 100);
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
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por ID Stock, material, albarán, OT…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={loadCartelas}
              disabled={loadingCartelas}
            >
              {loadingCartelas ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          </div>

          {loadingCartelas && (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-slate-400" />
            </div>
          )}

          {!loadingCartelas && filteredCartelas.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Package className="size-8 mx-auto mb-2" />
              <p>
                {search ? "Sin resultados para esa búsqueda" : "No hay cartelas todavía"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {filteredCartelas.map((palet) => (
              <CartelaListRow
                key={palet.id}
                palet={palet}
                onPrint={() => handlePrint(palet)}
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

      {/* Área de impresión — fuera del Dialog, gestiona el print tanto desde Creadas como desde el wizard (P0 fix) */}
      {printPalets.map((p) => (
        <CartelaPrint key={p.id} palet={p} copies={2} />
      ))}
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
            <Button size="sm" onClick={onCartelar} className="text-xs">
              {hasCartelas ? "Añadir cartelas →" : "Generar cartelas →"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1.5">
          {grupo.recepciones.map((line) => (
            <div
              key={`${line.recepcion_id}-${line.ot_numero}`}
              className="flex items-start gap-2 text-xs text-slate-600"
            >
              <span className="font-mono font-semibold text-slate-800 w-20 shrink-0 pt-0.5">
                OT {line.ot_numero}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-slate-500 truncate">
                  {formatClienteTrabajo(line.cliente_nombre, line.trabajo_titulo)}
                </div>
                <div className="truncate">
                  {line.material}
                  {line.gramaje ? ` ${line.gramaje}gr` : ""}
                  {line.tamano_hoja ? ` · ${line.tamano_hoja}` : ""}
                </div>
              </div>
              {line.num_hojas_brutas && (
                <span className="text-slate-400 shrink-0">
                  {line.num_hojas_brutas.toLocaleString("es-ES")} h
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CartelaListRow({
  palet,
  onPrint,
}: {
  palet: ProdStockPaletConOts;
  onPrint: () => void;
}) {
  const estadoClass = ESTADO_COLORS[palet.estado] ?? "";
  return (
    <div className="flex items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50 transition-colors">
      {/* ID Stock */}
      <span className="font-black text-xl text-[#002147] w-20 shrink-0 tabular-nums">
        #{palet.id_stock}
      </span>

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
          {palet.ots.length > 0 && (
            <span>OT(s): {palet.ots.join(", ")}</span>
          )}
          {palet.ots.length === 0 && (
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
        {palet.estado}
      </Badge>

      {/* Imprimir */}
      <Button
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        onClick={onPrint}
        title="Imprimir cartela (×2 copias)"
      >
        <Printer className="size-3.5" />
      </Button>
    </div>
  );
}
