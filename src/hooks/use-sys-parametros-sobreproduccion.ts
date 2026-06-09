"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_SOBREPRODUCCION_MARGENES,
  mergeSobreproduccionMargenesDesdeFilas,
  type SobreproduccionMargenesParametros,
  SYS_PARAM_SOBREPROD_CLAVES,
} from "@/lib/sys-parametros-sobreproduccion";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const TABLE = "sys_parametros";

export function useSysParametrosSobreproduccion() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [margenes, setMargenes] =
    useState<SobreproduccionMargenesParametros>(
      DEFAULT_SOBREPRODUCCION_MARGENES,
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
        .in("clave", [...SYS_PARAM_SOBREPROD_CLAVES]);
      if (qErr) throw qErr;
      setMargenes(mergeSobreproduccionMargenesDesdeFilas(data ?? []));
    } catch (e) {
      console.warn("[sys_parametros sobreproduccion]", e);
      setError(
        e instanceof Error ? e.message : "No se pudieron leer sys_parametros.",
      );
      setMargenes(DEFAULT_SOBREPRODUCCION_MARGENES);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return { margenes, loading, error, refetch: load };
}
