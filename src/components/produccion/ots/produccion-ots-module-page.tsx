"use client";

import {
  BarChart3,
  LayoutGrid,
  PackageCheck,
  Rows3,
  ShoppingBag,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { TabRouteLoading } from "@/components/ui/tab-route-loading";

const MasterOtsPage = dynamic(
  () =>
    import("@/components/produccion/ots/master-ots-page").then((m) => ({
      default: m.MasterOtsPage,
    })),
  { loading: () => <TabRouteLoading label="Cargando OT maestro…" /> },
);

const OtsDespachadasPage = dynamic(
  () =>
    import("@/components/produccion/ots/ots-despachadas-page").then((m) => ({
      default: m.OtsDespachadasPage,
    })),
  { loading: () => <TabRouteLoading label="Cargando despachadas…" /> },
);

const ComprasMaterialPage = dynamic(
  () =>
    import("@/components/produccion/ots/compras-material-page").then((m) => ({
      default: m.ComprasMaterialPage,
    })),
  { loading: () => <TabRouteLoading label="Cargando compras…" /> },
);

const PlanificacionOtsPage = dynamic(
  () =>
    import("@/components/produccion/planificacion/planificacion-ots-page").then(
      (m) => ({ default: m.PlanificacionOtsPage }),
    ),
  { loading: () => <TabRouteLoading label="Cargando planificación…" /> },
);

const OtsImpresasPage = dynamic(
  () =>
    import("@/components/produccion/planificacion/ots-impresas-page").then(
      (m) => ({ default: m.OtsImpresasPage }),
    ),
  { loading: () => <TabRouteLoading label="Cargando analítica…" /> },
);

const TAB_TRIGGER_CLASS =
  "flex h-full min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-active:bg-[#C69C2B]/20 data-active:font-semibold data-active:text-[#002147] data-active:shadow-sm data-active:ring-2 data-active:ring-[#C69C2B]/45 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm";

export function ProduccionOtsModulePage({
  canAccessPlanificacion,
}: {
  canAccessPlanificacion: boolean;
}) {
  const [tab, setTab] = useState("maestro");
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    const v = (tabParam ?? "").trim().toLowerCase();
    if (!v) return;

    const allowed = new Set([
      "maestro",
      "despachadas",
      "compras",
      "planificacion",
      "impresas",
    ]);
    if (!allowed.has(v)) return;

    if (v === "planificacion" && !canAccessPlanificacion) {
      setTab("maestro");
      return;
    }

    setTab(v);
  }, [tabParam, canAccessPlanificacion]);

  useEffect(() => {
    if (!canAccessPlanificacion && tab === "planificacion") {
      setTab("maestro");
    }
  }, [canAccessPlanificacion, tab]);

  return (
    <div className="w-full min-w-0 max-w-[100vw] space-y-3 overflow-x-hidden">
      <header className="mb-0">
        <h1 className="font-heading text-xl font-bold leading-tight text-[#002147] md:text-2xl">
          OTs
        </h1>
        <p className="mt-0.5 max-w-full truncate text-xs text-slate-600 sm:max-w-3xl">
          Listado maestro, despachos, compras
          {canAccessPlanificacion ? ", planificación" : ""} ·{" "}
          <span className="font-medium text-[#002147]">Producción</span>
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="w-full min-w-0 max-w-full overflow-x-hidden"
      >
        <div className="mb-2 flex w-full justify-start sm:mb-3">
          <TabsList className="box-border inline-flex h-auto min-h-9 w-fit max-w-full flex-wrap items-stretch gap-0 rounded-lg border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
            <TabsTrigger value="maestro" className={TAB_TRIGGER_CLASS}>
              <LayoutGrid className="size-4 shrink-0 opacity-90" aria-hidden />
              OT Maestro
            </TabsTrigger>
            <TabsTrigger value="despachadas" className={TAB_TRIGGER_CLASS}>
              <PackageCheck className="size-4 shrink-0 opacity-90" aria-hidden />
              OTs Despachadas
            </TabsTrigger>
            <TabsTrigger value="compras" className={TAB_TRIGGER_CLASS}>
              <ShoppingBag className="size-4 shrink-0 opacity-90" aria-hidden />
              Compras de Material
            </TabsTrigger>
            {canAccessPlanificacion ? (
              <TabsTrigger value="planificacion" className={TAB_TRIGGER_CLASS}>
                <Rows3 className="size-4 shrink-0 opacity-90" aria-hidden />
                Planificación OT&apos;s
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="impresas" className={TAB_TRIGGER_CLASS}>
              <BarChart3 className="size-4 shrink-0 opacity-90" aria-hidden />
              Analítica de Planta
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="maestro" className="mt-0 space-y-3 outline-none">
          {tab === "maestro" ? <MasterOtsPage /> : null}
        </TabsContent>

        <TabsContent value="despachadas" className="mt-0 space-y-3 outline-none">
          {tab === "despachadas" ? (
            <OtsDespachadasPage
              onCompraMaterialSuccess={() => setTab("compras")}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="compras" className="mt-0 space-y-3 outline-none">
          {tab === "compras" ? <ComprasMaterialPage /> : null}
        </TabsContent>

        {canAccessPlanificacion ? (
          <TabsContent
            value="planificacion"
            className="mt-0 space-y-3 outline-none"
          >
            {tab === "planificacion" ? <PlanificacionOtsPage /> : null}
          </TabsContent>
        ) : null}

        <TabsContent value="impresas" className="mt-0 space-y-3 outline-none">
          {tab === "impresas" ? <OtsImpresasPage /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
