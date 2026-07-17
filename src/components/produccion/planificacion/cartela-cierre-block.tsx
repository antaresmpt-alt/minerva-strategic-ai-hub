"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyCartelaToDatos,
  CARTELA_DATOS_KEYS,
  fetchCartelasForOt,
  fetchPaletByIdStock,
  formatIdStockDisplay,
  normalizeIdStockInput,
  suggestHojasConsumoCartela,
  type CartelaOption,
} from "@/lib/cartela-ejecucion";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdStockPaletRow } from "@/types/prod-stock";

type LookupState = "idle" | "loading" | "found" | "not_found" | "error";

type CartelaCierreBlockProps = {
  otNumero: string;
  procesoId: number | null;
  datosDraft: DatosProcesoGenerico;
  onDatosChange: (datos: DatosProcesoGenerico) => void;
};

function readIdStockFromDatos(datos: DatosProcesoGenerico): number | null {
  const raw = datos[CARTELA_DATOS_KEYS.idStock];
  if (typeof raw === "number" && raw > 0) return raw;
  if (typeof raw === "string") return normalizeIdStockInput(raw);
  return null;
}

function readHojasFromDatos(datos: DatosProcesoGenerico): number | null {
  const raw = datos[CARTELA_DATOS_KEYS.hojasConsumidas];
  if (typeof raw === "number" && raw > 0) return raw;
  return null;
}

export function CartelaCierreBlock({
  otNumero,
  procesoId,
  datosDraft,
  onDatosChange,
}: CartelaCierreBlockProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const datosRef = useRef(datosDraft);
  datosRef.current = datosDraft;

  const initialId = readIdStockFromDatos(datosDraft);
  const initialHojas = readHojasFromDatos(datosDraft);

  const [cartelasOt, setCartelasOt] = useState<CartelaOption[]>([]);
  const [loadingCartelas, setLoadingCartelas] = useState(true);
  const [modoTextoLibre, setModoTextoLibre] = useState(false);
  const [idInput, setIdInput] = useState(
    initialId != null ? formatIdStockDisplay(initialId) : "",
  );
  const [hojasInput, setHojasInput] = useState(
    initialHojas != null ? String(initialHojas) : "",
  );
  const [lookupState, setLookupState] = useState<LookupState>(initialId != null ? "loading" : "idle");
  const [paletPreview, setPaletPreview] = useState<ProdStockPaletRow | null>(null);
  const hojasPrefilledRef = useRef(false);
  const onDatosChangeRef = useRef(onDatosChange);
  onDatosChangeRef.current = onDatosChange;

  const emitDatos = useCallback((datos: DatosProcesoGenerico) => {
    onDatosChangeRef.current(datos);
  }, []);

  useEffect(() => {
    if (hojasPrefilledRef.current || initialHojas != null) return;
    const suggested = suggestHojasConsumoCartela(procesoId, datosDraft);
    if (suggested == null) return;
    hojasPrefilledRef.current = true;
    setHojasInput(String(suggested));
    const idFromDraft = readIdStockFromDatos(datosRef.current);
    const idFromInput = normalizeIdStockInput(idInput);
    const idStock = idFromDraft ?? idFromInput;
    if (idStock != null) {
      emitDatos(
        applyCartelaToDatos(datosRef.current, paletPreview, idStock, suggested),
      );
    }
  }, [procesoId, datosDraft, initialHojas, idInput, paletPreview, emitDatos]);

  // Cargar cartelas asignadas a esta OT
  useEffect(() => {
    let cancelled = false;
    setLoadingCartelas(true);
    void (async () => {
      try {
        const options = await fetchCartelasForOt(supabase, otNumero);
        if (cancelled) return;
        setCartelasOt(options);
        // Si no hay cartelas asignadas, habilitar texto libre por defecto
        if (options.length === 0) {
          setModoTextoLibre(true);
        }
      } catch (err) {
        if (cancelled) return;
        setCartelasOt([]);
        setModoTextoLibre(true);
      } finally {
        if (!cancelled) setLoadingCartelas(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, otNumero]);

  useEffect(() => {
    const trimmed = idInput.trim();
    if (!trimmed) {
      setLookupState("idle");
      setPaletPreview(null);
      const hojas = parseHojasInput(hojasInput);
      emitDatos(applyCartelaToDatos(datosRef.current, null, null, hojas));
      return;
    }

    const idStock = normalizeIdStockInput(idInput);
    if (idStock == null) {
      setLookupState("idle");
      setPaletPreview(null);
      return;
    }

    const hojas = parseHojasInput(hojasInput);
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLookupState("loading");
        try {
          const palet = await fetchPaletByIdStock(supabase, idStock);
          if (cancelled) return;
          setPaletPreview(palet);
          setLookupState(palet ? "found" : "not_found");
          emitDatos(applyCartelaToDatos(datosRef.current, palet, idStock, hojas));
        } catch {
          if (cancelled) return;
          setPaletPreview(null);
          setLookupState("error");
          emitDatos(applyCartelaToDatos(datosRef.current, null, idStock, hojas));
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idInput, hojasInput, emitDatos, supabase]);

  const updateHojas = (raw: string) => {
    setHojasInput(raw);
  };

  const handleSelectCartela = (idStockStr: string | null) => {
    if (!idStockStr) return;
    const option = cartelasOt.find((c) => String(c.idStock) === idStockStr);
    if (option) {
      setIdInput(formatIdStockDisplay(option.idStock));
      // Trigger lookup inmediato
      const hojas = parseHojasInput(hojasInput);
      setLookupState("loading");
      void (async () => {
        try {
          const palet = await fetchPaletByIdStock(supabase, option.idStock);
          setPaletPreview(palet);
          setLookupState(palet ? "found" : "not_found");
          emitDatos(applyCartelaToDatos(datosRef.current, palet, option.idStock, hojas));
        } catch {
          setPaletPreview(null);
          setLookupState("error");
          emitDatos(applyCartelaToDatos(datosRef.current, null, option.idStock, hojas));
        }
      })();
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <Package className="mt-0.5 size-4 shrink-0 text-[#002147]" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#002147]">Cartela / material usado</p>
          <p className="text-xs text-slate-500">
            Opcional. Si indicas ID Stock, las hojas son obligatorias para descontar stock.
          </p>
        </div>
      </div>

      {loadingCartelas ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Cargando cartelas asignadas…
        </p>
      ) : cartelasOt.length > 0 && !modoTextoLibre ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cerrar-cartela-select" className="text-xs text-slate-600">
                Cartelas asignadas a esta OT
              </Label>
              <Select onValueChange={handleSelectCartela}>
                <SelectTrigger id="cerrar-cartela-select" className="mt-1">
                  <SelectValue placeholder="Selecciona una cartela…" />
                </SelectTrigger>
                <SelectContent>
                  {cartelasOt.map((opt) => (
                    <SelectItem key={opt.idStock} value={String(opt.idStock)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cerrar-hojas-cartela-select" className="text-xs text-slate-600">
                Hojas consumidas (opcional)
              </Label>
              <Input
                id="cerrar-hojas-cartela-select"
                type="number"
                min={0}
                step={1}
                placeholder="—"
                className="mt-1"
                value={hojasInput}
                onChange={(e) => updateHojas(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setModoTextoLibre(true)}
          >
            o introducir ID Stock manualmente
          </Button>
        </div>
      ) : null}

      {(modoTextoLibre || cartelasOt.length === 0) && !loadingCartelas ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cerrar-id-stock" className="text-xs text-slate-600">
              ID Stock
            </Label>
            <Input
              id="cerrar-id-stock"
              type="text"
              inputMode="numeric"
              placeholder="Ej. 10.313"
              className="mt-1 font-mono"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cerrar-hojas-cartela" className="text-xs text-slate-600">
              Hojas consumidas (opcional)
            </Label>
            <Input
              id="cerrar-hojas-cartela"
              type="number"
              min={0}
              step={1}
              placeholder="—"
              className="mt-1"
              value={hojasInput}
              onChange={(e) => updateHojas(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {cartelasOt.length > 0 && modoTextoLibre && !loadingCartelas ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setModoTextoLibre(false)}
        >
          Volver a cartelas asignadas
        </Button>
      ) : null}

      {lookupState === "loading" ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Buscando palet…
        </p>
      ) : null}

      {lookupState === "found" && paletPreview ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
          <p className="font-semibold">
            #{formatIdStockDisplay(paletPreview.id_stock)}
            {paletPreview.codigo_articulo ? ` · ${paletPreview.codigo_articulo}` : ""}
          </p>
          <p className="mt-0.5 text-emerald-800">
            {paletPreview.material_nombre ?? paletPreview.descripcion_material ?? "—"}
            {paletPreview.gramaje != null ? ` · ${paletPreview.gramaje} gr` : ""}
            {paletPreview.formato ? ` · ${paletPreview.formato}` : ""}
          </p>
          <p className="mt-0.5 text-emerald-700">
            Stock actual: {paletPreview.cantidad_actual.toLocaleString("es-ES")} h
          </p>
        </div>
      ) : null}

      {lookupState === "not_found" ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          ID Stock no encontrado en Minerva. Se guardará el número; puedes cerrar igualmente.
        </p>
      ) : null}

      {lookupState === "error" ? (
        <p className="flex items-start gap-1.5 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Error al buscar el palet. Se guardará el ID si lo confirmas.
        </p>
      ) : null}

      <p className="text-[11px] text-slate-500">
        Al confirmar el cierre con hojas consumidas, el stock del palet se descuenta
        automáticamente en Minerva.
      </p>
    </div>
  );
}

function parseHojasInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
