"use client";

import dynamic from "next/dynamic";

const ProduccionOtsModulePage = dynamic(
  () =>
    import("@/components/produccion/ots/produccion-ots-module-page").then(
      (m) => ({ default: m.ProduccionOtsModulePage }),
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-muted-foreground">
        Cargando OTs…
      </div>
    ),
  },
);

export function ProduccionOtsRouteLazy({
  canAccessPlanificacion,
}: {
  canAccessPlanificacion: boolean;
}) {
  return (
    <ProduccionOtsModulePage canAccessPlanificacion={canAccessPlanificacion} />
  );
}
