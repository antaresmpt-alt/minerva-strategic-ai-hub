import { StockPage } from "@/components/produccion/almacen/stock/stock-page";

export const metadata = {
  title: "Stock de material | Minerva",
  description: "Consulta de stock por palet (ATP) — Almacén Minerva.",
};

export default function ProduccionAlmacenStockPage() {
  return <StockPage />;
}
