import type { Metadata } from "next";

import { SalesIntelligenceDashboard } from "@/components/sales/sales-intelligence-dashboard";

export const metadata: Metadata = {
  title: "Sales Intelligence | Minerva Strategic AI Hub",
  description:
    "Dashboard de ventas, márgenes y alertas de coste para la Oficina Técnica.",
};

export default function SalesIntelligencePage() {
  return <SalesIntelligenceDashboard />;
}
