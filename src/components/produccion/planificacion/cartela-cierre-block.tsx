"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Package, Plus, Trash2 } from "lucide-react";

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
  applyCartelaConsumosToDatos,
  buildMaterialRealLabel,
  fetchCartelasForOt,
  fetchPaletByIdStock,
  formatIdStockDisplay,
  normalizeIdStockInput,
  parseCartelaConsumosLineasFromDatos,
  suggestHojasConsumoCartela,
  type CartelaOption,
} from "@/lib/cartela-ejecucion";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdStockPaletRow } from "@/types/prod-stock";

type LookupState = "idle" | "loading" | "found" | "not_found" | "error";

type LineaDraft = {
  key: string;
  idInput: string;
  hojasInput: string;
  modoTextoLibre: boolean;
  lookupState: LookupState;
  paletPreview: ProdStockPaletRow | null;
};

type CartelaCierreBlockProps = {
  otNumero: string;
  procesoId: number | null;
  datosDraft: DatosProcesoGenerico;
  onDatosChange: (datos: DatosProcesoGenerico) => void;
  /** Si true, la cartela es obligatoria (OT con cartelas asignadas al cierre). */
  obligatorio?: boolean;
  /** Notifica cuántas cartelas tiene la OT (para aviso en padre). */
  onCartelasOtCount?: (count: number) => void;
};

function newLineKey(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLinea(modoTextoLibre = false): LineaDraft {
  return {
    key: newLineKey(),
    idInput: "",
    hojasInput: "",
    modoTextoLibre,
    lookupState: "idle",
    paletPreview: null,
  };
}

function parseHojasInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function lineasFromDatos(
  datos: DatosProcesoGenerico,
  defaultModoLibre: boolean,
): LineaDraft[] {
  const parsed = parseCartelaConsumosLineasFromDatos(datos);
  if (parsed.length === 0) return [emptyLinea(defaultModoLibre)];
  return parsed.map((l) => ({
    key: newLineKey(),
    idInput: formatIdStockDisplay(l.id_stock),
    hojasInput: String(l.hojas),
    modoTextoLibre: defaultModoLibre,
    lookupState: "idle" as LookupState,
    paletPreview: null,
  }));
}

export function CartelaCierreBlock({
  otNumero,
  procesoId,
  datosDraft,
  onDatosChange,
  obligatorio = false,
  onCartelasOtCount,
}: CartelaCierreBlockProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const datosRef = useRef(datosDraft);
  datosRef.current = datosDraft;
  const onDatosChangeRef = useRef(onDatosChange);
  onDatosChangeRef.current = onDatosChange;

  const [cartelasOt, setCartelasOt] = useState<CartelaOption[]>([]);
  const [loadingCartelas, setLoadingCartelas] = useState(true);
  const [lineas, setLineas] = useState<LineaDraft[]>(() =>
    lineasFromDatos(datosDraft, false),
  );
  const autoSelectedRef = useRef(false);
  const hojasPrefilledRef = useRef(false);
  const lineasRef = useRef(lineas);
  lineasRef.current = lineas;

  const emitFromLineas = useCallback(
    async (drafts: LineaDraft[]) => {
      const built: Array<{
        id_stock?: number | null;
        hojas?: number | null;
        palet_id?: string | null;
        material_real?: string | null;
      }> = [];
      for (const d of drafts) {
        const idStock = normalizeIdStockInput(d.idInput);
        const hojas = parseHojasInput(d.hojasInput);
        if (idStock == null && hojas == null) continue;
        let paletId = d.paletPreview?.id ?? null;
        let material = d.paletPreview ? buildMaterialRealLabel(d.paletPreview) : null;
        if (idStock != null && !paletId) {
          try {
            const palet = await fetchPaletByIdStock(supabase, idStock);
            if (palet) {
              paletId = palet.id;
              material = buildMaterialRealLabel(palet);
            }
          } catch {
            /* keep without palet */
          }
        }
        built.push({
          id_stock: idStock,
          hojas,
          palet_id: paletId,
          material_real: material,
        });
      }
      onDatosChangeRef.current(applyCartelaConsumosToDatos(datosRef.current, built));
    },
    [supabase],
  );

  const patchLinea = useCallback(
    (key: string, patch: Partial<LineaDraft>) => {
      setLineas((prev) => {
        const next = prev.map((l) => (l.key === key ? { ...l, ...patch } : l));
        void emitFromLineas(next);
        return next;
      });
    },
    [emitFromLineas],
  );

  useEffect(() => {
    onCartelasOtCount?.(cartelasOt.length);
  }, [cartelasOt.length, onCartelasOtCount]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCartelas(true);
    void (async () => {
      try {
        const options = await fetchCartelasForOt(supabase, otNumero);
        if (cancelled) return;
        setCartelasOt(options);
        if (options.length === 0) {
          setLineas((prev) =>
            prev.map((l) => ({ ...l, modoTextoLibre: true })),
          );
        }
      } catch {
        if (cancelled) return;
        setCartelasOt([]);
        setLineas((prev) => prev.map((l) => ({ ...l, modoTextoLibre: true })));
      } finally {
        if (!cancelled) setLoadingCartelas(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, otNumero]);

  // Auto-seleccionar única cartela en la 1ª línea
  useEffect(() => {
    if (autoSelectedRef.current || loadingCartelas || cartelasOt.length !== 1) return;
    const first = lineasRef.current[0];
    if (!first || normalizeIdStockInput(first.idInput) != null) return;

    autoSelectedRef.current = true;
    const option = cartelasOt[0]!;
    const suggested =
      parseHojasInput(first.hojasInput) ??
      suggestHojasConsumoCartela(procesoId, datosRef.current);

    void (async () => {
      let palet: ProdStockPaletRow | null = null;
      let lookupState: LookupState = "not_found";
      try {
        palet = await fetchPaletByIdStock(supabase, option.idStock);
        lookupState = palet ? "found" : "not_found";
      } catch {
        lookupState = "error";
      }
      if (suggested != null) hojasPrefilledRef.current = true;
      setLineas((prev) => {
        const next = prev.map((l, i) =>
          i === 0
            ? {
                ...l,
                idInput: formatIdStockDisplay(option.idStock),
                hojasInput: suggested != null ? String(suggested) : l.hojasInput,
                modoTextoLibre: false,
                paletPreview: palet,
                lookupState,
              }
            : l,
        );
        void emitFromLineas(next);
        return next;
      });
    })();
  }, [cartelasOt, loadingCartelas, procesoId, supabase, emitFromLineas]);

  // Lookup palet por línea cuando cambia ID
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cancelledFlags = lineas.map(() => false);

    lineas.forEach((linea, idx) => {
      const trimmed = linea.idInput.trim();
      if (!trimmed) {
        if (linea.lookupState !== "idle" || linea.paletPreview) {
          patchLinea(linea.key, { lookupState: "idle", paletPreview: null });
        }
        return;
      }
      const idStock = normalizeIdStockInput(linea.idInput);
      if (idStock == null) return;
      if (linea.paletPreview?.id_stock === idStock && linea.lookupState === "found") {
        return;
      }

      const t = setTimeout(() => {
        void (async () => {
          setLineas((prev) =>
            prev.map((l) =>
              l.key === linea.key ? { ...l, lookupState: "loading" } : l,
            ),
          );
          try {
            const palet = await fetchPaletByIdStock(supabase, idStock);
            if (cancelledFlags[idx]) return;
            setLineas((prev) => {
              const next = prev.map((l) =>
                l.key === linea.key
                  ? {
                      ...l,
                      paletPreview: palet,
                      lookupState: (palet ? "found" : "not_found") as LookupState,
                    }
                  : l,
              );
              void emitFromLineas(next);
              return next;
            });
          } catch {
            if (cancelledFlags[idx]) return;
            setLineas((prev) => {
              const next = prev.map((l) =>
                l.key === linea.key
                  ? { ...l, paletPreview: null, lookupState: "error" as LookupState }
                  : l,
              );
              void emitFromLineas(next);
              return next;
            });
          }
        })();
      }, 350);
      timers.push(t);
    });

    return () => {
      cancelledFlags.forEach((_, i) => {
        cancelledFlags[i] = true;
      });
      timers.forEach(clearTimeout);
    };
    // Solo reaccionar a cambios de IDs (no a cada patch de lookup)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas.map((l) => l.idInput).join("|"), supabase]);

  const idsUsados = useMemo(() => {
    const set = new Set<number>();
    for (const l of lineas) {
      const id = normalizeIdStockInput(l.idInput);
      if (id != null) set.add(id);
    }
    return set;
  }, [lineas]);

  const totalHojas = useMemo(() => {
    return lineas.reduce((s, l) => s + (parseHojasInput(l.hojasInput) ?? 0), 0);
  }, [lineas]);

  const addLinea = () => {
    setLineas((prev) => {
      const next = [
        ...prev,
        emptyLinea(cartelasOt.length === 0),
      ];
      void emitFromLineas(next);
      return next;
    });
  };

  const removeLinea = (key: string) => {
    setLineas((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((l) => l.key !== key);
      void emitFromLineas(next);
      return next;
    });
  };

  const handleSelectCartela = (key: string, idStockStr: string | null) => {
    if (!idStockStr) return;
    const option = cartelasOt.find((c) => String(c.idStock) === idStockStr);
    if (!option) return;
    setLineas((prev) => {
      const next = prev.map((l) =>
        l.key === key
          ? {
              ...l,
              idInput: formatIdStockDisplay(option.idStock),
              lookupState: "loading" as LookupState,
            }
          : l,
      );
      return next;
    });
    void (async () => {
      try {
        const palet = await fetchPaletByIdStock(supabase, option.idStock);
        setLineas((prev) => {
          const next = prev.map((l) =>
            l.key === key
              ? {
                  ...l,
                  idInput: formatIdStockDisplay(option.idStock),
                  paletPreview: palet,
                  lookupState: (palet ? "found" : "not_found") as LookupState,
                }
              : l,
          );
          void emitFromLineas(next);
          return next;
        });
      } catch {
        setLineas((prev) => {
          const next = prev.map((l) =>
            l.key === key
              ? {
                  ...l,
                  paletPreview: null,
                  lookupState: "error" as LookupState,
                }
              : l,
          );
          void emitFromLineas(next);
          return next;
        });
      }
    })();
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <Package className="mt-0.5 size-4 shrink-0 text-[#002147]" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#002147]">
            Cartela / material usado
            {obligatorio ? (
              <span className="ml-1 font-normal text-red-700">· obligatorio</span>
            ) : (
              <span className="ml-1 font-normal text-slate-500">· opcional</span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {obligatorio
              ? "Indica una o varias cartelas y hojas (como en Optimus). Se descuenta stock al cerrar."
              : "Puedes añadir varios palets. Si indicas ID Stock, las hojas son obligatorias."}
          </p>
        </div>
      </div>

      {loadingCartelas ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Cargando cartelas asignadas…
        </p>
      ) : null}

      {!loadingCartelas
        ? lineas.map((linea, index) => {
            const idStock = normalizeIdStockInput(linea.idInput);
            const hojas = parseHojasInput(linea.hojasInput);
            const stockActual = linea.paletPreview?.cantidad_actual;
            const superaStock =
              hojas != null &&
              stockActual != null &&
              hojas > stockActual;
            const opcionesSelect = cartelasOt.filter(
              (opt) =>
                opt.idStock === idStock || !idsUsados.has(opt.idStock),
            );

            return (
              <div
                key={linea.key}
                className="space-y-2 rounded-md border border-slate-100 bg-slate-50/60 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Consumo {index + 1}
                    {lineas.length > 1 ? (
                      <span className="ml-1 font-normal text-slate-500">
                        de {lineas.length}
                      </span>
                    ) : null}
                  </p>
                  {lineas.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-700 hover:text-red-800"
                      onClick={() => removeLinea(linea.key)}
                      aria-label={`Quitar consumo ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>

                {cartelasOt.length > 0 && !linea.modoTextoLibre ? (
                  <div className="space-y-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-slate-600">
                          Cartelas asignadas a esta OT
                        </Label>
                        <Select
                          value={idStock != null ? String(idStock) : undefined}
                          onValueChange={(v) => handleSelectCartela(linea.key, v)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecciona una cartela…" />
                          </SelectTrigger>
                          <SelectContent>
                            {opcionesSelect.map((opt) => (
                              <SelectItem key={opt.idStock} value={String(opt.idStock)}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">
                          Hojas consumidas{obligatorio ? "" : " (opcional)"}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="—"
                          className="mt-1"
                          value={linea.hojasInput}
                          onChange={(e) =>
                            patchLinea(linea.key, { hojasInput: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        patchLinea(linea.key, { modoTextoLibre: true })
                      }
                    >
                      o introducir ID Stock manualmente
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-slate-600">ID Stock</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej. 10.313"
                          className="mt-1 font-mono"
                          value={linea.idInput}
                          onChange={(e) =>
                            patchLinea(linea.key, { idInput: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">
                          Hojas consumidas{obligatorio ? "" : " (opcional)"}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="—"
                          className="mt-1"
                          value={linea.hojasInput}
                          onChange={(e) =>
                            patchLinea(linea.key, { hojasInput: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    {cartelasOt.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          patchLinea(linea.key, { modoTextoLibre: false })
                        }
                      >
                        Volver a cartelas asignadas
                      </Button>
                    ) : null}
                  </div>
                )}

                {linea.lookupState === "loading" ? (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Buscando palet…
                  </p>
                ) : null}

                {linea.lookupState === "found" && linea.paletPreview ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
                    <p className="font-semibold">
                      #{formatIdStockDisplay(linea.paletPreview.id_stock)}
                      {linea.paletPreview.codigo_articulo
                        ? ` · ${linea.paletPreview.codigo_articulo}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-emerald-800">
                      {linea.paletPreview.material_nombre ??
                        linea.paletPreview.descripcion_material ??
                        "—"}
                      {linea.paletPreview.gramaje != null
                        ? ` · ${linea.paletPreview.gramaje} gr`
                        : ""}
                      {linea.paletPreview.formato
                        ? ` · ${linea.paletPreview.formato}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-emerald-700">
                      Stock actual:{" "}
                      {linea.paletPreview.cantidad_actual.toLocaleString("es-ES")} h
                    </p>
                  </div>
                ) : null}

                {linea.lookupState === "not_found" ? (
                  <p className="flex items-start gap-1.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    ID Stock no encontrado. Se guardará el número; puedes cerrar igualmente.
                  </p>
                ) : null}

                {linea.lookupState === "error" ? (
                  <p className="flex items-start gap-1.5 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Error al buscar el palet.
                  </p>
                ) : null}

                {superaStock ? (
                  <p className="flex items-start gap-1.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Las hojas ({hojas!.toLocaleString("es-ES")}) superan el stock del palet (
                    {stockActual!.toLocaleString("es-ES")} h). Mejor reparte en otra cartela o
                    corrige la cantidad.
                  </p>
                ) : null}
              </div>
            );
          })
        : null}

      {!loadingCartelas ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={addLinea}
          >
            <Plus className="mr-1 size-3.5" aria-hidden />
            Añadir otro consumo
          </Button>
          {totalHojas > 0 ? (
            <p className="text-xs text-slate-600">
              Total declarado:{" "}
              <span className="font-semibold">{totalHojas.toLocaleString("es-ES")} h</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-[11px] text-slate-500">
        Al confirmar el cierre, cada línea descuenta su palet en Minerva. El sobrante
        queda en la misma cartela (cantidad actual); liberar a stock libre lo hace
        almacén/oficina cuando toque.
      </p>
    </div>
  );
}
