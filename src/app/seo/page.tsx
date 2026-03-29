import type { Metadata } from "next";

import { SeoIntelligencePage } from "@/components/seo/seo-intelligence-page";

export const metadata: Metadata = {
  title: "SEO Intelligence | Minerva Strategic AI Hub",
  description:
    "Monitor de rankings y optimizador on-page para la visibilidad orgánica de Minerva Global.",
};

export default function SeoHubPage() {
  return <SeoIntelligencePage />;
}
