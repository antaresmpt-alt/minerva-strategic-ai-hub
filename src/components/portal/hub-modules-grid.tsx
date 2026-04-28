"use client";

import { useCallback, useState } from "react";

import {
  accessDeniedMessage,
  canAccessHubModule,
  type HubModuleId,
} from "@/lib/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModuleCard } from "@/components/portal/module-card";

const MODULE_IMG = {
  sales: {
    src: "/images/module-sales.png",
    alt: "Sales Intelligence — icono del módulo",
  },
  sem: {
    src: "/images/module-sem.png",
    alt: "SEM — icono del módulo",
  },
  seo: {
    src: "/images/module-seo.png",
    alt: "SEO — icono del módulo",
  },
  produccion: {
    src: "/images/module-produccion.png",
    alt: "Producción — icono del módulo",
  },
  produccion_ejecucion: {
    src: "/images/module-produccion.png",
    alt: "OTs en ejecución — icono del módulo",
  },
  chat: {
    src: "/images/module-chatbot.png",
    alt: "Minerva AI Assistant — icono del módulo",
  },
  muelle: {
    src: "/images/module_muelle.png",
    alt: "Muelle — icono del módulo",
  },
} as const;

/**
 * Logos del hub: `<img>` en lugar de `next/image` para que el navegador pida el mismo
 * recurso que `/images/...` (sin `/_next/image`), evitando cachés u optimizaciones que
 * mostraban versiones antiguas mientras la URL directa ya estaba actualizada.
 */
function ModuleMark({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- assets estáticos en `public`; debe coincidir con GET directo
    <img
      src={src}
      alt={alt}
      width={200}
      height={220}
      decoding="async"
      loading="eager"
      className="h-auto max-h-[8.75rem] w-full object-contain object-center"
    />
  );
}

export function HubModulesGrid({
  role,
  moduleAccess,
}: {
  role: string | null;
  /** Desde `role_permissions`; si hay filas, prevalece sobre la matriz por defecto. */
  moduleAccess: Record<string, boolean> | null;
}) {
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  const onDenied = useCallback(() => {
    setAccessNotice(accessDeniedMessage(role));
  }, [role]);

  const allow = useCallback(
    (id: HubModuleId) => {
      if (moduleAccess && Object.keys(moduleAccess).length > 0) {
        return moduleAccess[id] === true;
      }
      return canAccessHubModule(role, id);
    },
    [role, moduleAccess]
  );
  const onlyExecution =
    allow("produccion_ejecucion") &&
    !allow("produccion") &&
    !allow("sales") &&
    !allow("sem") &&
    !allow("seo") &&
    !allow("muelle") &&
    !allow("chat") &&
    !allow("settings");

  return (
    <>
      {accessNotice && (
        <div className="mb-6 w-full max-w-2xl self-center">
          <Alert
            role="alert"
            className="border-slate-300/90 bg-slate-50/95 text-slate-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100"
          >
            <AlertTitle>Acceso no permitido</AlertTitle>
            <AlertDescription>{accessNotice}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 lg:items-stretch">
        {onlyExecution ? (
          <ModuleCard
            title="OTs en ejecución"
            description="Acceso tablet para iniciar, pausar, reanudar, guardar datos y finalizar órdenes liberadas a máquina."
            iconFrame="module"
            icon={
              <ModuleMark
                src={MODULE_IMG.produccion_ejecucion.src}
                alt={MODULE_IMG.produccion_ejecucion.alt}
              />
            }
            actionLabel="Abrir OTs en ejecución"
            href="/produccion/ejecucion"
            accessAllowed
          />
        ) : (
          <>
            <ModuleCard
              title="Minerva Sales & Tech Intelligence"
              description="Dashboard avanzado de ventas, márgenes reales y control operativo de la Oficina Técnica (pharma/cosmética)."
              iconFrame="module"
              icon={
                <ModuleMark
                  src={MODULE_IMG.sales.src}
                  alt={MODULE_IMG.sales.alt}
                />
              }
              actionLabel="Acceder a Ventas"
              href="/analytics/sales"
              accessAllowed={allow("sales")}
              onAccessDenied={onDenied}
            />
            <ModuleCard
              title="SEM (Search Engine Marketing)"
              description="Herramientas de análisis SEM, PMAX, propuestas Meta Ads y generación ejecutiva con IA."
              iconFrame="module"
              icon={
                <ModuleMark src={MODULE_IMG.sem.src} alt={MODULE_IMG.sem.alt} />
              }
              actionLabel="Acceder a SEM"
              href="/sem"
              accessAllowed={allow("sem")}
              onAccessDenied={onDenied}
            />
            <ModuleCard
              title="SEO (Search Engine Optimization)"
              description="Monitor de visibilidad orgánica y optimizador de contenidos on-page para minervaglobal.es."
              iconFrame="module"
              icon={
                <ModuleMark src={MODULE_IMG.seo.src} alt={MODULE_IMG.seo.alt} />
              }
              actionLabel="Acceder a SEO"
              href="/seo"
              accessAllowed={allow("seo")}
              onAccessDenied={onDenied}
            />
            <ModuleCard
              title="Producción"
              description="Órdenes de trabajo, fichas técnicas y almacén. Panel alineado con el hub estratégico."
              iconFrame="module"
              icon={
                <ModuleMark
                  src={MODULE_IMG.produccion.src}
                  alt={MODULE_IMG.produccion.alt}
                />
              }
              actionLabel="Acceder a Producción"
              href="/produccion"
              accessAllowed={allow("produccion")}
              onAccessDenied={onDenied}
            />
            {allow("produccion_ejecucion") && !allow("produccion") ? (
              <ModuleCard
                title="OTs en ejecución"
                description="Acceso tablet para iniciar, pausar, reanudar, guardar datos y finalizar órdenes liberadas a máquina."
                iconFrame="module"
                icon={
                  <ModuleMark
                    src={MODULE_IMG.produccion_ejecucion.src}
                    alt={MODULE_IMG.produccion_ejecucion.alt}
                  />
                }
                actionLabel="Abrir OTs en ejecución"
                href="/produccion/ejecucion"
                accessAllowed
              />
            ) : null}
            <ModuleCard
              title="Minerva AI Assistant"
              description="Tu asistente corporativo inteligente. Consultas generales, redacción y soporte."
              iconFrame="module"
              icon={
                <ModuleMark
                  src={MODULE_IMG.chat.src}
                  alt={MODULE_IMG.chat.alt}
                />
              }
              actionLabel="Abrir Chat"
              href="/chat"
              accessAllowed={allow("chat")}
              onAccessDenied={onDenied}
            />
            <ModuleCard
              title="Muelle"
              description="Muelle: Recepción de Material (Próximamente)"
              iconFrame="module"
              icon={
                <ModuleMark
                  src={MODULE_IMG.muelle.src}
                  alt={MODULE_IMG.muelle.alt}
                />
              }
              actionLabel="Acceder a Muelle"
              href="/produccion/muelle"
              accessAllowed={allow("muelle")}
              onAccessDenied={onDenied}
            />
          </>
        )}
      </div>
    </>
  );
}
