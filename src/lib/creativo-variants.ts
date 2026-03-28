export type CreativoVariant = "square" | "horizontal" | "vertical";

export const VARIANT_ORDER: CreativoVariant[] = [
  "square",
  "horizontal",
  "vertical",
];

export const VARIANT_META: Record<
  CreativoVariant,
  { w: number; h: number; title: string; short: string }
> = {
  square: {
    w: 1200,
    h: 1200,
    title: "Formato cuadrado (1:1)",
    short: "1200×1200 px",
  },
  horizontal: {
    w: 1200,
    h: 675,
    title: "Formato horizontal (16:9)",
    short: "1200×675 px",
  },
  vertical: {
    w: 960,
    h: 1280,
    title: "Formato vertical (3:4)",
    short: "960×1280 px",
  },
};
