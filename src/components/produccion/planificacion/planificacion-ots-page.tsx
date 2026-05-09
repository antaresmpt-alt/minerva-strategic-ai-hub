"use client";

import { CalendarClock, GitBranch, PlayCircle, Rows3, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PlanificacionMesaDiariaTab } from "@/components/produccion/planificacion/planificacion-mesa-diaria-tab";
import { PlanificacionMesaSecuenciacionTab } from "@/components/produccion/planificacion/planificacion-mesa-secuenciacion-tab";
import { PlanificacionOtsEjecucionTab } from "@/components/produccion/planificacion/planificacion-ots-ejecucion-tab";
import { PlanificacionPipelineTab } from "@/components/produccion/planificacion/planificacion-pipeline-tab";
import { PlanificacionPoolOtsTab } from "@/components/produccion/planificacion/planificacion-pool-ots-tab-v2";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getPlanificacionLastTabStorageKey } from "@/lib/planificacion-mesa-diaria";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const SUBTAB_TRIGGER_CLASS =
  "flex h-full min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-active:bg-[#C69C2B]/20 data-active:font-semibold data-active:text-[#002147] data-active:shadow-sm data-active:ring-2 data-active:ring-[#C69C2B]/45 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm";

const VALID_SUBTABS = ["pool", "diaria", "mesa", "ejecucion", "pipeline"] as const;
type SubtabId = (typeof VALID_SUBTABS)[number];

/**
 * Pestaña inicial: lee la última visitada de `localStorage` (clave global por
 * navegador, no per-user, para evitar setState diferido en `useEffect`).
 * Fallback: **Mesa diaria** (decisión de UX: el responsable de planta arranca
 * en la vista del día).
 */
function readInitialSubtab(): SubtabId {
  if (typeof window === "undefined") return "diaria";
  try {
    const raw = window.localStorage.getItem(getPlanificacionLastTabStorageKey(null));
    if (raw && (VALID_SUBTABS as readonly string[]).includes(raw)) {
      return raw as SubtabId;
    }
  } catch {
    /* ignore */
  }
  return "diaria";
}

export function PlanificacionOtsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [subtab, setSubtab] = useState<SubtabId>(readInitialSubtab);
  const [showEjecucionTab, setShowEjecucionTab] = useState(true);

  // Persistir pestaña actual.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getPlanificacionLastTabStorageKey(null), subtab);
    } catch {
      /* ignore */
    }
  }, [subtab]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uid = typeof user?.id === "string" && user.id.trim() ? user.id.trim() : null;
      let role: string | null = null;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        role =
          prof && typeof (prof as { role?: unknown }).role === "string"
            ? String((prof as { role: string }).role).trim() || null
            : null;
      }
      const { data: rows } = await supabase
        .from("sys_parametros")
        .select("valor_num")
        .eq("clave", "planificacion_ots_ejecucion_enabled")
        .limit(1);
      const enabledValue = Number(rows?.[0]?.valor_num ?? 0);
      const enabledForAll = Number.isFinite(enabledValue) && enabledValue > 0;
      const isAdmin = role === "admin";
      if (!mounted) return;
      setShowEjecucionTab(enabledForAll || isAdmin);
      if (!(enabledForAll || isAdmin) && subtab === "ejecucion") {
        setSubtab("diaria");
      }
    })().catch(() => {
      if (mounted) setShowEjecucionTab(true);
    });
    return () => {
      mounted = false;
    };
  }, [subtab, supabase]);

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[#002147] md:text-xl">
          Planificación OT&apos;s
        </h2>
        <p className="text-xs text-slate-600 sm:text-sm">
          Preparación del pool, secuenciación diaria y soporte IA para decidir
          orden de producción.
        </p>
      </header>

      <Tabs
        value={subtab}
        onValueChange={(v) => setSubtab(v as SubtabId)}
        className="w-full space-y-3"
      >
        <TabsList className="box-border inline-flex h-auto min-h-9 w-fit max-w-full flex-wrap items-stretch gap-0 rounded-lg border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
          <TabsTrigger value="pool" className={SUBTAB_TRIGGER_CLASS}>
            <Table2 className="size-4 shrink-0 opacity-90" aria-hidden />
            Pool de OT&apos;s
          </TabsTrigger>
          <TabsTrigger value="diaria" className={SUBTAB_TRIGGER_CLASS}>
            <CalendarClock className="size-4 shrink-0 opacity-90" aria-hidden />
            Mesa diaria
          </TabsTrigger>
          <TabsTrigger value="mesa" className={SUBTAB_TRIGGER_CLASS}>
            <Rows3 className="size-4 shrink-0 opacity-90" aria-hidden />
            Mesa semanal
          </TabsTrigger>
          <TabsTrigger
            value="ejecucion"
            className={SUBTAB_TRIGGER_CLASS}
            disabled={!showEjecucionTab}
            title={
              showEjecucionTab
                ? "OTs en ejecución"
                : "Pestaña deshabilitada por configuración"
            }
          >
            <PlayCircle className="size-4 shrink-0 opacity-90" aria-hidden />
            OTs en ejecución
          </TabsTrigger>
          <TabsTrigger value="pipeline" className={SUBTAB_TRIGGER_CLASS}>
            <GitBranch className="size-4 shrink-0 opacity-90" aria-hidden />
            Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pool" className="mt-0 space-y-3 outline-none">
          <PlanificacionPoolOtsTab />
        </TabsContent>

        <TabsContent value="diaria" className="mt-0 space-y-3 outline-none">
          <PlanificacionMesaDiariaTab />
        </TabsContent>

        <TabsContent value="mesa" className="mt-0 space-y-3 outline-none">
          <PlanificacionMesaSecuenciacionTab />
        </TabsContent>

        <TabsContent value="ejecucion" className="mt-0 space-y-3 outline-none">
          <PlanificacionOtsEjecucionTab />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-0 space-y-3 outline-none">
          <PlanificacionPipelineTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}
