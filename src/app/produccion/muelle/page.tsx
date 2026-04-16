import type { Metadata } from "next";

import { MuelleRecepcionPage } from "@/components/produccion/muelle/muelle-recepcion-page";

export const metadata: Metadata = {
  title: "Muelle | Minerva Strategic AI Hub",
  description: "Recepción de material en muelle — Minerva Global.",
};

export default function MuellePage() {
  return <MuelleRecepcionPage />;
}
