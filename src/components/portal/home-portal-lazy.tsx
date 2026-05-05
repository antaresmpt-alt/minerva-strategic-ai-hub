"use client";

import dynamic from "next/dynamic";

import type { HubPortalProps } from "@/components/portal/hub-portal";

const HubPortal = dynamic(
  () =>
    import("@/components/portal/hub-portal").then((m) => ({
      default: m.HubPortal,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-muted-foreground">
        Cargando portal…
      </div>
    ),
  },
);

export function HomePortalLazy(props: HubPortalProps) {
  return <HubPortal {...props} />;
}
