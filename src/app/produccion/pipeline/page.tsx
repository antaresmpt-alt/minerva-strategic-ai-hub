import { PlanificacionPipelineTab } from "@/components/produccion/planificacion/planificacion-pipeline-tab";

export default function ProduccionPipelinePage() {
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-[#002147] md:text-xl">
          Pipeline de Producción
        </h1>
        <p className="text-xs text-slate-600 sm:text-sm">
          Seguimiento transversal de OTs con itinerario por pasos y foco en incidencias.
        </p>
      </header>
      <PlanificacionPipelineTab />
    </section>
  );
}

