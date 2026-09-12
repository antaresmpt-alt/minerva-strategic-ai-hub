# Sesión 2 sep 2026 — Bloque 9.7 OCR albaranes de entrada ✅

> **Rama:** `main`  
> **Commits:** `0bfef6b` (feat OCR + tabla revisión) · mismo día: campos más anchos en el modal  
> **Quién:** Ramón entra albaranes; Manel implementa. Validación planta: Ramón con PDF escaneado real (varios albaranes).  
> **Relacionado:** `.MANUALES/BLOQUES/MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §11 9.7 · patrón UI = import Optimus de externos.

---

## Resumen

Ramón no da abasto a teclear albaranes de papel. El **9.7** (aparcado en baja prioridad hasta tener cartelas/stock) pasa a **MVP en `main`**:

1. Cartelas → **Pendientes** → **OCR albaranes**.
2. Sube PDF (varias páginas) o fotos.
3. Gemini Vision extrae líneas → **tabla editable**.
4. Ramón corrige / desmarca duplicados / elige compra Minerva.
5. **Confirmar entradas** crea filas en `prod_recepciones_material` (bandeja Pendientes).
6. **No crea cartelas.** Ramón abre *Generar cartelas* como siempre.

**Smoke Manel 2 sep:** el motor capta bastante bien proveedor, albarán, material, formato, kg/hojas y compras candidatas. Pendiente de diseño (no código aún): **una partida de material para 2+ OTs**.

---

## Flujo (no saltarse confirmación humana)

```text
PDF / fotos
  → Gemini 2.5 Flash o Pro (visión; PDF nativo si cabe)
  → JSON líneas
  → cruce catálogo proveedores + compras pendientes + antiduplicado albarán
  → tabla (semaforo verde / ámbar / rojo)
  → OK de Ramón
  → prod_recepciones_material (tipo oc | stock_libre)
  → Pendientes de cartelar
```

- Si hay **compra pendiente** clara (OT + proveedor + material): `tipo_recepcion = oc`, marca la compra **Recibido** (y despacho `estado_material` si no está en STOP).
- Si no hay OT / STOCK: `stock_libre` (igual que Recepción STOCK).
- Si el nº de albarán **ya existe**: línea en rojo, desmarcada por defecto.

---

## Archivos

| Pieza | Ruta |
|-------|------|
| Modal | `src/components/produccion/almacen/cartelas/albaranes-ocr-dialog.tsx` |
| Botón | `cartelas-page.tsx` (Pendientes, junto a Recepción STOCK) |
| Lib (kg→hojas, match, JSON) | `src/lib/albaranes-ocr.ts` + `albaranes-ocr.test.ts` |
| Raster / PDF cliente | `src/lib/albaranes-ocr-files.ts` |
| API | `POST /api/gemini/albaranes-ocr` (permiso módulo **producción**) |
| Prompt | `ALBARANES_OCR_SYSTEM_PROMPT` en `albaranes-ocr.ts` |

PDF pequeño (~&lt; 2,4 MB): se manda entero a Gemini. Más grande: intento de paginar con pdf.js; si falla, pedir fotos o partir el PDF.

---

## Fórmula kilos → hojas (ya documentada en Bloque 9 §3b)

```
hojas = (kilos × 1000) / (gramaje × formato_m²)
```

Ej. OFFSET 70×100 100 g · 35 kg → **500 h**. Si el albarán ya trae hojas, se usan esas; kilos solo rellenan `cantidad_peso`.

---

## Pendiente (explícito 2 sep)

| Ítem | Notas |
|------|--------|
| **1 partida → 2+ OTs** | El albarán trae un total; hay que partir hojas/palets entre OTs **antes** de confirmar. Ramón lo tiene que mirar; no inventar split automático. |
| Fotos 9.10 | Adjuntar el PDF/foto a la recepción al confirmar (hoy no se guarda el original). |
| PDF muy pesado | Fotografiar páginas o dividir. |

---

## Cómo probar

1. Producción → Almacén → **Cartelas** → Pendientes → **OCR albaranes**.
2. Subir PDF escaneado o JPG.
3. **Interpretar** (selector IA del Hub: Flash o Pro).
4. Revisar tabla; marcar **OK** en las líneas buenas.
5. **Confirmar entradas** → aparecen tarjetas en Pendientes → *Generar cartelas*.
