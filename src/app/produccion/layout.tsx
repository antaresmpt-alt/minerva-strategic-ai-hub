import type { Metadata } from "next";

import { ProduccionShell } from "@/components/produccion/produccion-shell";

export const metadata: Metadata = {
  title: "Producción | Minerva Strategic AI Hub",
  description:
    "Órdenes de trabajo, fichas técnicas y almacén — Minerva Global.",
};

export default function ProduccionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProduccionShell>{children}</ProduccionShell>;
}
