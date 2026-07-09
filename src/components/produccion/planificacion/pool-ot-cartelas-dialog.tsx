"use client";

import { ExternalLink, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchCartelasForOt,
  formatIdStockDisplay,
  type CartelaOption,
} from "@/lib/cartela-ejecucion";
import { SANDBOX_ID_STOCK_MIN } from "@/lib/prod-stock-sandbox";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PoolOtCartelasDialogProps = {
  otNumero: string;
  cliente?: string;
  /** Hojas carteladas ya calculadas en el pool (informativo). */
  hojasCarteladas?: number;
  className?: string;
};

export function PoolOtCartelasDialog({
  otNumero,
  cliente,
  hojasCarteladas,
  className,
}: PoolOtCartelasDialogProps) {
  const supabase = createSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cartelas, setCartelas] = useState<CartelaOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCartelas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const options = await fetchCartelasForOt(supabase, otNumero);
      setCartelas(
        options.filter((o) => o.idStock < SANDBOX_ID_STOCK_MIN)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar cartelas");
      setCartelas([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, otNumero]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && cartelas === null && !loading) {
      void loadCartelas();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className={
          className ??
          "text-[11px] font-medium text-[#002147] underline-offset-2 hover:underline inline-flex items-center gap-0.5"
        }
        title="Ver ID Stock / cartelas para esta OT"
      >
        <Package className="size-3 shrink-0" aria-hidden />
        Ver cartela{hojasCarteladas != null && hojasCarteladas > 0 ? "(s)" : ""}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#002147]">
              Cartelas · OT {otNumero}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Cartelas de material asignadas a la OT {otNumero}
            </DialogDescription>
            {cliente && cliente !== "—" ? (
              <p className="text-xs text-slate-500 truncate">{cliente}</p>
            ) : null}
          </DialogHeader>

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 className="size-4 animate-spin" />
              Cargando cartelas…
            </p>
          ) : error ? (
            <p className="text-sm text-red-600 py-2">{error}</p>
          ) : cartelas && cartelas.length === 0 ? (
            <p className="text-sm text-slate-600 py-2">
              No hay cartelas asignadas a esta OT en Minerva. Puede que el
              material esté solo recepcionado en muelle o en Optimus sin
              enlace OT.
            </p>
          ) : cartelas ? (
            <ul className="space-y-2 max-h-[min(50vh,320px)] overflow-y-auto">
              {cartelas.map((c) => (
                <li
                  key={c.palet.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div className="font-mono text-lg font-bold text-[#002147]">
                    #{formatIdStockDisplay(c.idStock)}
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5 line-clamp-2">
                    {c.palet.material_nombre ??
                      c.palet.descripcion_material ??
                      "—"}
                    {c.palet.gramaje != null ? ` · ${c.palet.gramaje} gr` : ""}
                    {c.palet.formato ? ` · ${c.palet.formato}` : ""}
                  </p>
                  <p className="text-xs font-medium text-emerald-800 mt-1">
                    {c.palet.cantidad_actual.toLocaleString("es-ES")} h en
                    palet
                  </p>
                  <Link
                    href={`/produccion/almacen/stock`}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#002147] hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Abrir Stock
                    <ExternalLink className="size-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {hojasCarteladas != null && hojasCarteladas > 0 && cartelas && cartelas.length > 0 ? (
            <p className="text-[11px] text-slate-500 border-t pt-2">
              Total referenciado en pool:{" "}
              <strong>{hojasCarteladas.toLocaleString("es-ES")} h</strong>
              {cartelas.length > 1
                ? " (varias cartelas / reservas blandas)"
                : null}
            </p>
          ) : null}

          <div className="flex justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
