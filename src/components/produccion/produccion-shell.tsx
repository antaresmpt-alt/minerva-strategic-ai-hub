"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileCog,
  Home,
  LayoutList,
  Package,
  Stamp,
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
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Inicio",
    icon: Home,
    match: (p) => p === "/",
  },
  {
    href: "/produccion/ots",
    label: "OTs (maestro)",
    icon: LayoutList,
    match: (p) =>
      p === "/produccion" ||
      p === "/produccion/ots" ||
      p.startsWith("/produccion/ots/"),
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
      p === "/produccion/troqueles" ||
      p.startsWith("/produccion/troqueles/"),
  },
  {
    href: "/produccion/almacen",
    label: "Almacén MRP",
    icon: Package,
    match: (p) =>
      p === "/produccion/almacen" || p.startsWith("/produccion/almacen/"),
  },
  {
    href: "/produccion/externos",
    label: "Gestión de Externos",
    icon: Truck,
    match: (p) =>
      p === "/produccion/externos" ||
      p.startsWith("/produccion/externos/"),
  },
];

export function ProduccionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navLinks = NAV.filter((item) => item.href !== "/");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="externos-plan-print-hide sticky top-0 z-40 max-w-[100vw] overflow-x-hidden border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-6">
          <Link
            href="/"
            className="text-sm font-semibold text-[#002147] transition hover:text-[#002147]/80"
          >
            Portal
          </Link>
          <Separator
            orientation="vertical"
            className="hidden h-6 sm:block"
          />
          <nav
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
            aria-label="Módulo Producción"
          >
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm",
                    active
                      ? "bg-[#C69C2B]/25 font-semibold text-[#002147] shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-[#002147]"
                  )}
                >
                  <Icon
                    className="size-4 shrink-0 opacity-90"
                    aria-hidden
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
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
