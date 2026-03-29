"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { ContentOptimizer } from "@/components/seo/content-optimizer";
import { KeywordOpportunityFinder } from "@/components/seo/keyword-opportunity-finder";

const RankingMonitor = dynamic(
  () =>
    import("@/components/seo/ranking-monitor").then((m) => ({
      default: m.RankingMonitor,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="py-12 text-center text-sm text-slate-500">
        Cargando monitor de rankings…
      </p>
    ),
  }
);

export function SeoIntelligencePage() {
  return (
    <div className="relative isolate min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div className="sem-workspace-marble" />
        <div className="sem-workspace-overlay" />
      </div>

      <div className="relative z-10">
        <header className="border-b border-slate-200/60 bg-white/75 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <h1 className="font-heading text-xl font-bold tracking-tight text-[#002147] sm:text-2xl">
                Minerva SEO Intelligence
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                Visibilidad orgánica y optimización on-page ·{" "}
                <span className="font-medium text-[#002147]">
                  www.minervaglobal.es
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Portal
              </Link>
              <Link
                href="/sem"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" })
                )}
              >
                SEM
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Tabs defaultValue="rankings" className="w-full">
            <TabsList className="mb-8 grid h-auto w-full max-w-4xl grid-cols-1 gap-1 p-1 sm:grid-cols-3 sm:gap-0">
              <TabsTrigger
                value="rankings"
                className="px-2 text-xs sm:text-sm"
              >
                Monitor de Rankings
              </TabsTrigger>
              <TabsTrigger
                value="optimizer"
                className="px-2 text-xs sm:text-sm"
              >
                Optimizador On-Page
              </TabsTrigger>
              <TabsTrigger
                value="keywords"
                className="px-2 text-xs sm:text-sm"
                title="Buscador de Oportunidades (Keywords)"
              >
                <span className="hidden sm:inline">
                  Buscador de Oportunidades (Keywords)
                </span>
                <span className="sm:hidden">Oportunidades SEO</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="rankings" className="mt-0 outline-none">
              <RankingMonitor />
            </TabsContent>
            <TabsContent value="optimizer" className="mt-0 outline-none">
              <ContentOptimizer />
            </TabsContent>
            <TabsContent value="keywords" className="mt-0 outline-none">
              <KeywordOpportunityFinder />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
