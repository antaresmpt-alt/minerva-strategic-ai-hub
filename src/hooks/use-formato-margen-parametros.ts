"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  MARGENES_IMPR_DEFAULT,
  SYS_PARAM_MARGENES,
  type MargenesImpr,
} from "@/lib/formato-cabe";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const TABLE = "sys_parametros";

function mergeMargenesDesdeFilas(
  rows: Array<{ clave: string; valor_num: string | number | null }>,
): MargenesImpr {
  const out: MargenesImpr = { ...MARGENES_IMPR_DEFAULT };
  for (const row of rows) {
    const v = row.valor_num != null ? Number(row.valor_num) : Number.NaN;
    if (!Number.isFinite(v) || v <= 0) continue;
    if (row.clave === SYS_PARAM_MARGENES.pinza) out.pinza = v;
    if (row.clave === SYS_PARAM_MARGENES.superior) out.superior = v;
    if (row.clave === SYS_PARAM_MARGENES.lateral) out.lateral = v;
  }
  return out;
}

/** Devuelve los márgenes de impresión desde sys_parametros (con fallback a defaults). */
export function useFormatoMargenParametros() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [margenes, setMargenes] = useState<MargenesImpr>(MARGENES_IMPR_DEFAULT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const claves = Object.values(SYS_PARAM_MARGENES);
      const { data } = await supabase
        .from(TABLE)
        .select("clave, valor_num")
        .in("clave", claves);
      setMargenes(mergeMargenesDesdeFilas(data ?? []));
    } catch (e) {
      console.warn("[formato-margen-parametros] Usando defaults.", e);
      setMargenes(MARGENES_IMPR_DEFAULT);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return { margenes, loading, refetch: load };
}
