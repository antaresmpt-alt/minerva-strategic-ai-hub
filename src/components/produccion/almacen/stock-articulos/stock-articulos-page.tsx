"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";
import {
  canWriteStockArticulosClient,
  fetchProfileCapacidades,
} from "@/lib/stock-articulos-permissions";

/**
 * Placeholder UI Bloque 15.1 — bandeja completa en siguiente entrega.
 * Comprueba capacidad de escritura (rol writer o stock_articulos_write).
 */
export function StockArticulosPage() {
  const supabase = createClient();
  const [role, setRole] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const r =
        prof && typeof (prof as { role?: unknown }).role === "string"
          ? String((prof as { role: string }).role)
          : null;
      let caps = new Set<string>();
      try {
        caps = await fetchProfileCapacidades(supabase, user.id);
      } catch {
        caps = new Set();
      }
      if (!mounted) return;
      setRole(r);
      setCanWrite(canWriteStockArticulosClient(r, caps));
      setLoading(false);
    })().catch(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-[#002147]">Stock de artículos</h1>
        <p className="text-sm text-slate-600">
          Producto terminado y WIP (Bloque 15) · distinto del stock de material
          (palets / cartelas).
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando permisos…</p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
          <p>
            Rol: <span className="font-medium">{role ?? "—"}</span>
            {" · "}
            Escritura:{" "}
            <span className="font-medium">
              {canWrite ? "sí (alta / reserva / ajuste)" : "solo lectura"}
            </span>
          </p>
          <p className="mt-2 text-slate-500">
            La bandeja, alta manual e import inventario (15.1 / 15.1b) llegan
            tras aplicar la migración 15.0 revisada. Generar OT de entrega no
            crea OT en Minerva: la OT nace en Optimus; aquí se etiqueta y
            reserva.
          </p>
        </div>
      )}
    </div>
  );
}
