import type { PackagingAnalysis } from "@/lib/sem-creative-lab-types";

/**
 * Prompts para Hugging Face: mockup 3D de caja de cartón fiel al troquel PDF,
 * sin botella ni líquido — estuche rectangular tipo farmacia.
 */
export function buildStudioPrompt(analysis: PackagingAnalysis): string {
  const name = analysis.product_name.trim();
  const exact = analysis.exact_colors.trim();
  const main = analysis.main_colors.join(", ");
  const faces = analysis.die_cut_faces.trim();
  const elements = analysis.key_elements.join(", ");
  const format = analysis.format.trim();

  const brandHint = name.toLowerCase().includes("biform")
    ? "Place the 'Biform' wordmark and grapefruit imagery exactly as positioned on the main panel of the box."
    : `Place branding and product imagery for "${name}" exactly as on the main panel of the die-cut.`;

  return (
    `Generate a 3D rectangular cardboard box mockup using the exact branding, typography, and color palette seen in the uploaded PDF die-cut. ` +
    `${brandHint} ` +
    `Rectangular pharmaceutical folding carton, cardboard folding carton, matte paper texture — not a bottle, no liquid, no glass, no cosmetic jar. ` +
    `Die-cut geometry (panels / fold lines): ${faces}. ` +
    `Strict color fidelity — use only this palette and named tones; do not invent blues, reds or hues outside it: ${exact}. Dominant colors list: ${main}. ` +
    `Where the spec lists Pantone 2415 C (purple), use it as the dominant background on main faces; the product title line «Drenaje Activador Cítrico» must render in white on that purple, matching the PDF COLORES block — do not substitute off-white or gray. ` +
    `If the die-cut implies full-bleed purple panels, do not add plain white card backgrounds behind them. ` +
    `Graphics and structure to preserve: ${elements}. ` +
    `Packaging description: ${format}. ` +
    `Studio product shot, soft even lighting, photorealistic, premium advertising mockup for display ads, sharp focus, no illegible micro-text.`
  );
}

export function buildLifestylePrompt(analysis: PackagingAnalysis): string {
  return (
    `${buildStudioPrompt(analysis)} ` +
    `Lifestyle context: the same folding carton box on a clean pharmacy or retail shelf surface, natural soft daylight, shallow depth of field, editorial quality — still clearly a paperboard box, never a bottle.`
  );
}
