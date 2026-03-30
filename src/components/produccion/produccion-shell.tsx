"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileCog, Home, Package } from "lucide-react";

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
    href: "/produccion/ordenes",
    label: "Órdenes",
    icon: ClipboardList,
    match: (p) =>
      p === "/produccion" ||
      p === "/produccion/ordenes" ||
      p.startsWith("/produccion/ordenes/"),
  },
  {
    href: "/produccion/fichas",
    label: "Fichas Técnicas",
    icon: FileCog,
    match: (p) =>
      p === "/produccion/fichas" ||
      p.startsWith("/produccion/fichas/"),
  },
  {
    href: "/produccion/almacen",
    label: "Almacén",
    icon: Package,
    match: (p) =>
      p === "/produccion/almacen" ||
      p.startsWith("/produccion/almacen/"),
  },
];

export function ProduccionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="flex gap-1 overflow-x-auto border-b border-[#002147]/15 bg-[#002147] p-2 md:hidden">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition",
                active
                  ? "bg-[#C69C2B] text-[#002147]"
                  : "text-white/85 hover:bg-white/10"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#002147]/15 bg-[#002147] text-white md:flex">
        <div className="flex items-center gap-3 p-5">
          <div className="relative h-10 w-32 shrink-0 overflow-hidden rounded-md bg-white/10">
            <Image
              src="/images/brand-minerva-wordmark.png"
              alt="Minerva"
              fill
              className="object-contain object-left"
              sizes="128px"
              priority
            />
          </div>
        </div>
        <p className="font-[family-name:var(--font-heading)] px-5 text-xs leading-snug tracking-wide text-[#C69C2B]/95 uppercase">
          Producción
        </p>
        <Separator className="my-4 bg-white/15" />
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Módulo Producción">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
                  active
                    ? "bg-[#C69C2B] text-[#002147]"
                    : "text-white/90 hover:bg-white/10"
                )}
              >
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 p-4">
          <Link
            href="/"
            className="block text-xs font-medium text-[#C69C2B]/95 underline-offset-4 hover:text-white hover:underline"
          >
            ← Volver al portal
          </Link>
          <p className="text-[10px] leading-relaxed text-white/55">
            Órdenes de trabajo, fichas técnicas y almacén. Módulo en expansión.
          </p>
        </div>
      </aside>

      <div className="relative isolate flex min-h-0 min-h-dvh flex-1 flex-col md:min-h-screen">
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          <div className="sem-workspace-marble" />
          <div className="sem-workspace-overlay" />
        </div>
        <main className="relative z-10 flex-1 px-4 py-8 md:px-10 md:py-10">
          {children}
        </main>
        <SemContactFooter />
      </div>
    </div>
  );
}
