/**
 * html2canvas 1.x no soporta colores modernos (oklab / oklch / lab / lch / color-mix).
 *
 * El problema real: html2canvas usa literalmente `window.getComputedStyle(element)`
 * (el `window` global de su propia closure), no el del iframe clonado.
 * El navegador moderno (Chrome 112+) puede devolver `lab()` / `oklab()` para
 * colores definidos con oklch() (Tailwind v4 / shadcn).
 *
 * Solución: parchear temporalmente `window.getComputedStyle` en el window PRINCIPAL
 * antes de llamar a html2canvas y restaurarlo después.
 */

/** Funciones de color que html2canvas no puede parsear. */
export const UNSUPPORTED_COLOR_RE =
  /oklab\s*\(|oklch\s*\(|lab\s*\(|lch\s*\(|color-mix\s*\(/i;

/* ─── color normalisation via 2-D canvas ─── */

let _ctx: CanvasRenderingContext2D | null = null;
function getCtx(): CanvasRenderingContext2D | null {
  if (!_ctx) _ctx = document.createElement("canvas").getContext("2d");
  return _ctx;
}

function normalizeColor(raw: string): string {
  const s = raw.trim();
  if (!s || s === "none") return s;
  if (s === "transparent") return "rgba(0, 0, 0, 0)";
  if (/gradient|url\s*\(/i.test(s)) return s;
  const c = getCtx();
  if (!c) return "#64748b";
  try {
    c.fillStyle = "#000000";
    c.fillStyle = s;
    const out = String(c.fillStyle);
    return UNSUPPORTED_COLOR_RE.test(out) ? "#64748b" : out;
  } catch {
    return "#64748b";
  }
}

function sanitizeValue(val: string): string {
  if (!UNSUPPORTED_COLOR_RE.test(val)) return val;
  const n = normalizeColor(val);
  return UNSUPPORTED_COLOR_RE.test(n) ? "none" : n;
}

/* ─── Proxy around CSSStyleDeclaration ─── */

function proxyDeclaration(real: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(real, {
    get(target, prop) {
      if (typeof prop === "symbol") return Reflect.get(target, prop);
      const val = Reflect.get(target, prop);

      if (typeof val === "function") {
        return function (...args: unknown[]) {
          const result = (val as (...a: unknown[]) => unknown).apply(target, args);
          if (typeof result === "string" && UNSUPPORTED_COLOR_RE.test(result)) {
            return sanitizeValue(result);
          }
          return result;
        };
      }

      if (typeof val === "string" && UNSUPPORTED_COLOR_RE.test(val)) {
        return sanitizeValue(val);
      }
      return val;
    },
  }) as CSSStyleDeclaration;
}

/* ─── Main: patch window.getComputedStyle for the duration of html2canvas ─── */

type GCSFn = typeof window.getComputedStyle;

let _patched = false;
let _origGCS: GCSFn | null = null;

export function patchWindowGCSForHtml2Canvas(): () => void {
  if (_patched) return () => { /* already active */ };

  _origGCS = window.getComputedStyle.bind(window);
  const orig = _origGCS;

  const patched = function (elt: Element, pseudo?: string | null) {
    return proxyDeclaration(orig(elt, pseudo ?? undefined));
  } as GCSFn;

  try {
    (window as Window & { getComputedStyle: GCSFn }).getComputedStyle = patched;
    _patched = true;
  } catch (e) {
    console.warn("html2canvas-pdf-fix: could not patch window.getComputedStyle", e);
    return () => { /* noop */ };
  }

  return function restore() {
    if (!_patched || !_origGCS) return;
    try {
      (window as Window & { getComputedStyle: GCSFn }).getComputedStyle = _origGCS;
    } catch { /* ignore */ }
    _patched = false;
    _origGCS = null;
  };
}

/* ─── CSS-variable overrides injected in the clone ─── */

const SAFE_VARS = `
:root,.dark{
  --background:#fff!important;--foreground:#1e293b!important;
  --card:#fff!important;--card-foreground:#1e293b!important;
  --popover:#fff!important;--popover-foreground:#1e293b!important;
  --primary:#002147!important;--primary-foreground:#fafafa!important;
  --secondary:#f1f5f9!important;--secondary-foreground:#002147!important;
  --muted:#f8fafc!important;--muted-foreground:#64748b!important;
  --accent:#f5f0e6!important;--accent-foreground:#002147!important;
  --destructive:#dc2626!important;
  --border:#e2e8f0!important;--input:#e8e8ea!important;--ring:#c69c2b!important;
  --chart-1:#ddd!important;--chart-2:#8e8e8e!important;
  --chart-3:#707070!important;--chart-4:#5e5e5e!important;--chart-5:#454545!important;
  --sidebar:#002147!important;--sidebar-foreground:#fafafa!important;
  --sidebar-primary:#c69c2b!important;--sidebar-primary-foreground:#002147!important;
  --sidebar-accent:#1e4976!important;--sidebar-accent-foreground:#fafafa!important;
  --sidebar-border:#334155!important;--sidebar-ring:#c69c2b!important;
}`;

const SAFE_ID = "minerva-pdf-safe";

export function prepareClonedDocumentForPdfCapture(doc: Document): void {
  // Inject safe CSS variables
  const s = doc.createElement("style");
  s.id = SAFE_ID;
  s.textContent = SAFE_VARS;
  doc.head.appendChild(s);

  // Remove external stylesheets and other <style> blocks
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
  doc.querySelectorAll("style").forEach((el) => {
    if (el.id !== SAFE_ID) el.remove();
  });
}
