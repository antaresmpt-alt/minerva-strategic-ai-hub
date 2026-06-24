"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Anchor,
  Boxes,
  FileCog,
  GitBranch,
  Home,
  LayoutList,
  MessageCircle,
  Package,
  Stamp,
  Tag,
  Tags,
  Truck,
} from "lucide-react";

import { SemContactFooter } from "@/components/layout/sem-contact-footer";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
  /** Lucide Tag/Anchor leen más gruesos a 16px; alinear con el resto del menú. */
  compactNavIcon?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operativa",
    items: [
      {
        href: "/produccion/ejecucion",
        label: "OTs en ejecución",
        icon: LayoutList,
        match: (p) =>
          p === "/produccion/ejecucion" || p.startsWith("/produccion/ejecucion/"),
      },
      {
        href: "/produccion/pipeline",
        label: "Pipeline",
        icon: GitBranch,
        match: (p) =>
          p === "/produccion/pipeline" || p.startsWith("/produccion/pipeline/"),
      },
      {
        href: "/produccion/ots",
        label: "OTs",
        icon: LayoutList,
        match: (p) =>
          p === "/produccion" ||
          p === "/produccion/ots" ||
          p.startsWith("/produccion/ots/"),
      },
      {
        href: "/produccion/muelle",
        label: "Muelle",
        icon: Anchor,
        compactNavIcon: true,
        match: (p) =>
          p === "/produccion/muelle" || p.startsWith("/produccion/muelle/"),
      },
      {
        href: "/produccion/almacen/cartelas",
        label: "Cartelas",
        icon: Tags,
        compactNavIcon: true,
        match: (p) =>
          p === "/produccion/almacen/cartelas" ||
          p.startsWith("/produccion/almacen/cartelas/"),
      },
    ],
  },
  {
    label: "Flujos",
    items: [
      {
        href: "/produccion/externos",
        label: "Externos",
        icon: Truck,
        match: (p) =>
          p === "/produccion/externos" || p.startsWith("/produccion/externos/"),
      },
      {
        href: "/produccion/etiquetas-digital",
        label: "Etiquetas digital",
        icon: Tag,
        compactNavIcon: true,
        match: (p) =>
          p === "/produccion/etiquetas-digital" ||
          p.startsWith("/produccion/etiquetas-digital/"),
      },
    ],
  },
  {
    label: "Maestros",
    items: [
      {
        href: "/produccion/articulos",
        label: "Artículos",
        icon: Boxes,
        match: (p) =>
          p === "/produccion/articulos" || p.startsWith("/produccion/articulos/"),
      },
      {
        href: "/produccion/fichas-tecnicas",
        label: "Fichas Técnicas",
        icon: FileCog,
        match: (p) =>
          p === "/produccion/fichas-tecnicas" ||
          p.startsWith("/produccion/fichas-tecnicas/") ||
          p === "/produccion/fichas" ||
          p.startsWith("/produccion/fichas/"),
      },
      {
        href: "/produccion/troqueles",
        label: "Troqueles",
        icon: Stamp,
        match: (p) =>
          p === "/produccion/troqueles" || p.startsWith("/produccion/troqueles/"),
      },
      {
        href: "/produccion/almacen",
        label: "Almacén MRP",
        icon: Package,
        match: (p) =>
          p === "/produccion/almacen" || p.startsWith("/produccion/almacen/"),
      },
    ],
  },
];

/** Lista plana de todos los items (para filtros por href). */
const NAV_FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function ProduccionShell({
  children,
  hasProduccionModule = true,
  hasProduccionEjecucionModule = false,
  hasEtiquetasDigitalModule = false,
}: {
  children: React.ReactNode;
  /** Si es false (p. ej. rol Almacén), en rutas de Muelle solo se muestra navegación mínima. */
  hasProduccionModule?: boolean;
  /** Acceso tablet limitado a OTs en ejecución. */
  hasProduccionEjecucionModule?: boolean;
  /** Acceso al departamento de etiquetas digital sin el resto de Producción. */
  hasEtiquetasDigitalModule?: boolean;
}) {
  const pathname = usePathname();
  const underMuelle = pathname.startsWith("/produccion/muelle");
  const underEtiquetasDigital = pathname.startsWith("/produccion/etiquetas-digital");
  const onlyExecution = hasProduccionEjecucionModule && !hasProduccionModule;
  const showFullProduccionNav =
    !onlyExecution &&
    (!underMuelle || hasProduccionModule) &&
    (!underEtiquetasDigital || hasProduccionModule);

  /** Items visibles en modo completo (excluye OTs en ejecución que va en su propio bloque) */
  const visibleGroups: NavGroup[] = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.href !== "/produccion/ejecucion"),
  })).filter((g) => g.items.length > 0);

  const onlyEjecucionItem = NAV_FLAT.find((i) => i.href === "/produccion/ejecucion")!;

  const muelleMinimal =
    !showFullProduccionNav && !onlyExecution && underMuelle && !hasProduccionModule;
  const etiquetasMinimal =
    !showFullProduccionNav &&
    !onlyExecution &&
    underEtiquetasDigital &&
    !hasProduccionModule &&
    hasEtiquetasDigitalModule;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="externos-plan-print-hide sticky top-0 z-40 max-w-[100vw] overflow-x-hidden border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 md:px-6">
          <Link
            href="/"
            className="text-sm font-semibold text-[#002147] transition hover:text-[#002147]/80"
          >
            Portal
          </Link>
          <Separator orientation="vertical" className="hidden h-6 sm:block" />

          <nav
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
            aria-label="Módulo Producción"
          >
            {/* Minimal modes */}
            {muelleMinimal && (
              <>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-[#002147] sm:px-3 sm:text-sm"
                >
                  <MessageCircle className="size-4 shrink-0 opacity-90" aria-hidden />
                  <span className="whitespace-nowrap">Chat</span>
                </Link>
                <span
                  className="inline-flex items-center gap-2 rounded-lg bg-[#C69C2B]/25 px-2.5 py-2 text-xs font-semibold text-[#002147] shadow-sm sm:px-3 sm:text-sm"
                  aria-current="page"
                >
                  <Anchor className="size-3.5 shrink-0 opacity-90" strokeWidth={1.5} aria-hidden />
                  Muelle
                </span>
              </>
            )}
            {etiquetasMinimal && (
              <>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-[#002147] sm:px-3 sm:text-sm"
                >
                  <MessageCircle className="size-4 shrink-0 opacity-90" aria-hidden />
                  <span className="whitespace-nowrap">Chat</span>
                </Link>
                <span
                  className="inline-flex items-center gap-2 rounded-lg bg-[#C69C2B]/25 px-2.5 py-2 text-xs font-semibold text-[#002147] shadow-sm sm:px-3 sm:text-sm"
                  aria-current="page"
                >
                  <Tag className="size-3.5 shrink-0 opacity-90" strokeWidth={1.5} aria-hidden />
                  Etiquetas digital
                </span>
              </>
            )}

            {/* Solo ejecución (tablet) */}
            {onlyExecution && (
              <NavLink item={onlyEjecucionItem} pathname={pathname} />
            )}

            {/* Navegación completa con grupos */}
            {showFullProduccionNav &&
              visibleGroups.map((group, gi) => (
                <span key={group.label} className="contents">
                  {/* Separador + etiqueta de grupo */}
                  {gi > 0 && (
                    <Separator orientation="vertical" className="mx-1 h-5 opacity-40" />
                  )}
                  <span className="hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:inline">
                    {group.label}
                  </span>
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </span>
              ))}
          </nav>
        </div>
      </header>

      <div className="relative isolate flex min-h-0 min-h-dvh flex-1 flex-col md:min-h-screen">
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          <div className="sem-workspace-marble" />
          <div className="sem-workspace-overlay" />
        </div>
        <main className="relative z-10 w-full min-w-0 max-w-[100vw] flex-1 overflow-x-hidden px-4 py-6">
          {children}
        </main>
        <SemContactFooter />
      </div>
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = item.match(pathname);
  return (
    <Link
      href={item.href}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm",
        active
          ? "bg-[#C69C2B]/25 font-semibold text-[#002147] shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-[#002147]"
      )}
    >
      <Icon
        className={cn("shrink-0 opacity-90", item.compactNavIcon ? "size-3.5" : "size-4")}
        strokeWidth={item.compactNavIcon ? 1.5 : 2}
        aria-hidden
      />
      <span className="whitespace-nowrap">{item.label}</span>
    </Link>
  );
}
