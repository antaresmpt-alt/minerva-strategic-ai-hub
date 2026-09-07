# MINERVA BLOQUE 14 — Fichas técnicas comercial / cliente

> Estado: **en rama** `feature/bloque14-fichas-comercial` (7 sep 2026).  
> Objetivo: que comerciales den de alta / completen fichas en el **maestro** (no Forms), impriman PDF cliente, y Zaida/Manel no saturen con Excel/Access.

---

## 1. Problema

Normativa ES/EU → ficha técnica de **todos** los artículos. Manel/Zaida no dan abasto. Comerciales conocen cliente, medidas, material, tintas… y pueden rellenar en Hub.

## 2. Modelo de datos

| Origen | Campos |
|--------|--------|
| Comercial (artículo) | Cliente, ref. cliente (opc.), descripción, tipo, medidas, material, gramaje, tintas, acabados, uds/caja, tipo fondo… |
| Una vez por cliente | RGS, temperatura → tabla `prod_cliente_ficha` |
| OT / planta | Troquel fino, ref. embalaje, peso unitario tras 1ª producción |
| Fotos | Mismos formatos en foto y troquel: PDF, JPG, PNG, BMP, WEBP, GIF… · bucket `referencias-adjuntos` |

- Código siempre **M-xxxxx** Minerva.
- Migración: `supabase/migrations/20260907180000_bloque14_fichas_comercial.sql` (aplicada en proyecto Supabase).

## 3. PDF dual

- **Minerva**: ficha interna (habituales + promedios) para planta/OT.
- **Cliente**: estilo Access/Blanxart; hereda RGS/temp del cliente; embebe JPG/PNG o nota si PDF.
- Lote: botón «PDF cliente lote» (selección o filtrados).

Lib: `src/lib/articulos-maestro-ficha-pdf.ts`.  
Adjuntos: `src/lib/prod-referencia-adjuntos.ts` + panel en form (edición; sin preview en modal — Abrir). Bucket Storage `referencias-adjuntos` (PDF/JPG/PNG/BMP…, 15 MB).  
En PDF Minerva/Cliente se embebe preview (imagen o 1ª página del PDF adjunto, JPEG reducido).

## 4. Permisos comercial

- Rol `comercial` → módulo `produccion` **ON** en `role_permissions`.
- Rutas app: solo `/produccion/articulos` + `/produccion/pipeline` (+ redirect hub).
- Nav shell: Pipeline + Artículos.
- RLS: maestro `insert/update` OK, **sin delete**; pipeline/OTs/ejecución/pool **solo SELECT**.
- Siguen: chat, sales, SEM, SEO.

## 5. Usuarios previstos

Crear (Settings / admin) con rol comercial, p.ej.:

- `jordi.puigcerver@…`
- `sergi@…`
- `francesc@…`
- (+ Albert/Jordi si actúan como comercial)

## 6. Fuera de alcance (ahora)

- Certificados conformidad proveedor (Gemma).
- Auto-peso desde producción.
- Merge a `main` hasta OK Manel/demo.

## 7. Smoke sugerido

1. Login admin → Artículos → crear/editar con tipo fondo + engomado + RGS → PDF Minerva y PDF Cliente (engomado y troqueles duales).
2. Editar artículo → **Troquel habitual** con buscador (mismo picker que despacho) → subir adjuntos (PDF/JPG/PNG/BMP… en ambos slots) → PDF Minerva/Cliente.
3. Checkbox «Guardar y crear otro»: mantiene cliente/RGS, limpia artículo, siguiente M-xxxxx.
4. Descargar plantilla Excel actualizada → rellenar → Importar (incluye engomado, tipo_fondo, RGS/temp).
5. Filtrar por cliente → PDF cliente lote.
6. Login comercial → solo Pipeline + Artículos; upload adjuntos OK; sin borrar artículos.
7. `npx vitest run src/lib/bloque14-fichas-comercial.test.ts`

## 8. Relación con Bloque 13

Bloque 13 = visibilidad planta / pipeline RO para “¿dónde está mi OT?”.  
Bloque 14 = **entrada de datos** ficha en maestro. Complementarios.
