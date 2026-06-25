"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Package } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyCartelaToDatos,
  CARTELA_DATOS_KEYS,
  fetchPaletByIdStock,
  formatIdStockDisplay,
  normalizeIdStockInput,
} from "@/lib/cartela-ejecucion";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdStockPaletRow } from "@/types/prod-stock";

type LookupState = "idle" | "loading" | "found" | "not_found" | "error";

type CartelaCierreBlockProps = {
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

export function CartelaCierreBlock({ datosDraft, onDatosChange }: CartelaCierreBlockProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const datosRef = useRef(datosDraft);
  datosRef.current = datosDraft;

  const initialId = readIdStockFromDatos(datosDraft);
  const initialHojas = readHojasFromDatos(datosDraft);

  const [idInput, setIdInput] = useState(
    initialId != null ? formatIdStockDisplay(initialId) : "",
  );
  const [hojasInput, setHojasInput] = useState(
    initialHojas != null ? String(initialHojas) : "",
  );
  const [lookupState, setLookupState] = useState<LookupState>(initialId != null ? "loading" : "idle");
  const [paletPreview, setPaletPreview] = useState<ProdStockPaletRow | null>(null);

  useEffect(() => {
    const trimmed = idInput.trim();
    if (!trimmed) {
      setLookupState("idle");
      setPaletPreview(null);
      const hojas = parseHojasInput(hojasInput);
      onDatosChange(applyCartelaToDatos(datosRef.current, null, null, hojas));
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
          onDatosChange(applyCartelaToDatos(datosRef.current, palet, idStock, hojas));
        } catch {
          if (cancelled) return;
          setPaletPreview(null);
          setLookupState("error");
          onDatosChange(applyCartelaToDatos(datosRef.current, null, idStock, hojas));
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idInput, hojasInput, onDatosChange, supabase]);

  const updateHojas = (raw: string) => {
    setHojasInput(raw);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <Package className="mt-0.5 size-4 shrink-0 text-[#002147]" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-[#002147]">Cartela / material usado</p>
          <p className="text-xs text-slate-500">
            Opcional. Mismo ID Stock que en almacén (como en Optimus RDC).
          </p>
        </div>
      </div>

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

      <Alert className="border-amber-200/90 bg-amber-50/80 py-2">
        <AlertTitle className="text-xs text-amber-900">Piloto — sin descuento automático</AlertTitle>
        <AlertDescription className="text-[11px] text-amber-800">
          Este enlace es documental (hoja de ruta). El consumo real de stock llegará en la fase
          operativa 9.4.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function parseHojasInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
