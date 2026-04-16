"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_OTS_COMPRAS_UMBRALES,
  mergeOtsComprasUmbralesDesdeFilas,
  type OtsComprasUmbralesParametros,
  SYS_PARAM_OTS_COMPRAS_CLAVES,
} from "@/lib/sys-parametros-ots-compras";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const TABLE = "sys_parametros";

export function useSysParametrosOtsCompras() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [umbrales, setUmbrales] = useState<OtsComprasUmbralesParametros>(
    DEFAULT_OTS_COMPRAS_UMBRALES
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from(TABLE)
        .select("clave, valor_num")
        .in("clave", [...SYS_PARAM_OTS_COMPRAS_CLAVES]);
      if (qErr) throw qErr;
      setUmbrales(mergeOtsComprasUmbralesDesdeFilas(data ?? []));
    } catch (e) {
      console.warn("[sys_parametros ots compras]", e);
      setError(
        e instanceof Error ? e.message : "No se pudieron leer sys_parametros."
      );
      setUmbrales(DEFAULT_OTS_COMPRAS_UMBRALES);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return { umbrales, loading, error, refetch: load };
}
