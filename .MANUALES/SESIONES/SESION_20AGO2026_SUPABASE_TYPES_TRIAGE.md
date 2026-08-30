# Triage Tipos Supabase — 20 ago 2026

**Contexto:** Primera activación de `Database` genérico en los tres clientes Supabase.  
**Fecha:** 20 agosto 2026  
**Proyecto Supabase:** `jrwwuqplilbydxptsbqz` (minerva-rag)  
**Archivos generados/modificados:**
- `src/types/database.ts` (3774 líneas) — generado vía MCP `generate_typescript_types`
- `src/utils/supabase/client.ts` — `createBrowserClient<Database>` / `SupabaseClient<Database>`
- `src/utils/supabase/server.ts` — `createServerClient<Database>`
- `src/lib/supabase/admin.ts` — `createClient<Database>`
- `package.json` — script `"db:types": "supabase gen types typescript --project-id jrwwuqplilbydxptsbqz -o src/types/database.ts"`

---

## Resultado `npx tsc --noEmit`

| Métrica | Valor |
|---------|-------|
| **Total errores TS** | **44** |
| P0 (bug silencioso real — columna/tabla incorrecta) | **0** |
| P1 (hot path stock/mesa/cartelas) | **~12** |
| P2 (ruido — casts, Json genérico, enum strict) | **~32** |

> **Conclusión:** Los bugs R1 + §18.15 (familia "columna en tabla equivocada") **ya estaban arreglados** y no aparecen como errores TS. El generador confirma que las queries actuales sobre `prod_mesa_planificacion_trabajos` y `produccion_ot_despachadas` son correctas post-fix. Ningún P0 nuevo encontrado. Los 44 errores son discrepancias de tipado entre tipos locales `src/types/` (definidos a mano, más estrictos o más flojos) y el esquema real de BD.

---

## Tabla triage

### P0 — Bug silencioso real (columna/tabla incorrecta) — **NINGUNO**

| # | Archivo | Patrón | Veredicto |
|---|---------|--------|-----------|
| — | — | No se encontraron queries `.from(tabla_equivocada).select(col_inexistente)` | ✅ R1 + §18.15 ya corregidos |

---

### P1 — Hot path stock / mesa / cartelas (~12 errores)

| # | Archivo:línea | Error | Patrón | Descripción |
|---|--------------|-------|--------|-------------|
| 1 | `stock-page.tsx:203` | TS2345 | ATP view shape | `StockPaletAtpRow.id: string` pero vista BD devuelve `id: string \| null`. El tipo local en `prod-stock.ts` es más estricto que la vista real. |
| 2 | `stock-page.tsx:234` | TS2345 | ATP view shape | Mismo: `StockPaletAtpRow` incompatible con la vista `prod_stock_palets_atp_view` real. |
| 3 | `stock-page.tsx:253` | TS2345 | ATP view shape | `.map(v: StockPaletAtpRow => ...)` — mismo tipo local más estricto que BD. |
| 4 | `stock-page.tsx:998` | TS2322 | null vs undefined | Campo `string \| null` asignado a prop `string \| undefined`. Supabase devuelve null, tipo local espera undefined. |
| 5 | `stock-page.tsx:1041` | TS2322 | null vs undefined | Mismo patrón. |
| 6 | `stock-page.tsx:1078` | TS2322 | null vs undefined | `null` no asignable a `number \| undefined`. |
| 7 | `stock-page.tsx:1079` | TS2322 | null vs undefined | `string \| null` no asignable a `string \| undefined`. |
| 8 | `cartelas-page.tsx:1425` | TS2322 | null vs undefined | Mismo patrón en módulo cartelas. |
| 9 | `cartelas-page.tsx:1426` | TS2322 | null vs undefined | Mismo. |
| 10 | `cartelas-page.tsx:1584` | TS2322 | null vs undefined | `null` no asignable a `number \| undefined`. |
| 11 | `cartelas-page.tsx:1585` | TS2322 | null vs undefined | `string \| null` no asignable a `string \| undefined`. |
| 12 | `cartela-wizard-dialog.tsx:487` | TS2345 | `tipo_stock` string vs `StockTipo` | La forma construida en wizard tiene `tipo_stock: string` (de la BD), pero `ProdStockPaletConOts` espera `StockTipo` (enum local). |

**Subpatrón más frecuente en P1:**
- **ATP view shape** (stock-page 203/234/253): `StockPaletAtpRow` definido localmente en `src/types/prod-stock.ts` tiene `id: string` pero la vista Supabase devuelve `id: string | null`. El tipo local debe actualizar o usar `Tables<'prod_stock_palets_atp_view'>` directamente.
- **null vs undefined** (stock + cartelas): tipos locales definen campos opcionales como `field?: string` pero Supabase devuelve `string | null`. Fix genérico: `?? undefined` en el punto de asignación, o actualizar los tipos locales a `field?: string | null`.

---

### P2 — Ruido / deuda técnica (~32 errores)

| # | Archivo(s) | Patrón | Count | Descripción |
|---|------------|--------|-------|-------------|
| A | `api/admin/role-permissions/route.ts:73`, `api/admin/users/route.ts:145,187`, `api/admin/users/[id]/profile/route.ts:43`, `lib/role-permissions-fetch.ts:22,28` | `user_role` enum strict | 6 | Supabase infiere `role` como `"admin" \| "comercial" \| ...` (enum literal union). Código admin pasa `string` sin aserción. **Runtime OK** — el string siempre es un rol válido, pero TS no puede probarlo sin cast. Fix: `as Database['public']['Enums']['user_role']` o validar con zod. |
| B | `planificacion-ots-ejecucion-tab.tsx:1964,2008,2112,2170`, `despacho-wizard-dialog.tsx:1884,1923,1955` | `DatosProcesoGenerico` / `Record<string,unknown>` no asignable a `Json` | 8 | El tipo `Json` generado es `string \| number \| boolean \| null \| Json[] \| {[key:string]:Json}`. `Record<string,unknown>` y `DatosProcesoGenerico` no son subtipos verificables. Fix: cast `as unknown as Json` o tipar DatosProcesoGenerico compatible. |
| C | `despacho-wizard-dialog.tsx:1797` | TS2769 overload | 1 | Insert con objeto parcial no cuadra con ningún overload tras tipado. Relacionado con patrón B. |
| D | `troqueles-page.tsx:400,654,673` | string ↔ number | 3 | Conversiones explícitas `as string` sobre número o viceversa — IDs numéricos vs string. Fix trivial: usar String(n) / parseInt(s). |
| E | `troqueles-page.tsx:617,939` | TS2769 overload | 2 | Insert troquel: campo con tipo string donde BD espera number (o viceversa). Mismo patrón D. |
| F | `etiquetas-digital/etiquetas-entrada-express-dialog.tsx:364` | TS2769 overload | 1 | Overload de insert etiquetas. |
| G | `etiquetas-digital/etiquetas-troqueles-tab.tsx:125` | SetStateAction mismatch | 1 | `setState(data)` donde data viene del generado y el State fue definido con tipo local. |
| H | `externos/gestion-externos-page.tsx:2266`, `hoja-ruta/hoja-ruta-ot-dialog.tsx:619`, `muelle/muelle-recepcion-page.tsx:873` | TS2769 overload | 3 | Inserts/updates en módulos no-hot con overload mismatch. |
| I | `fichas-tecnicas/fichas-tecnicas-page.tsx:485,578` | TS2769 overload | 2 | Fichas técnicas — no es hot path para 9.8.3. |
| J | `master-ots-page.tsx:385`, `ots-despachadas-page.tsx:286` | `(string\|number)[]` → `readonly string[]` | 2 | Array de IDs mixto pasado donde se espera `readonly string[]`. Fix: `.map(String)` o tipar el array. |
| K | `planificacion-mesa-secuenciacion-tab.tsx:2449,2470` | TS2769 overload | 2 | Insert/update mesa: overload mismatch — mesa es hot path pero error de overload no indica columna incorrecta. |
| L | `utils/supabase/server.ts:100` | `boolean \| null` → `boolean` | 1 | `role_permissions.is_enabled` es `boolean \| null` en BD; `Record<string, boolean>` espera `boolean`. Fix trivial: `r.is_enabled ?? false`. |
| M | `api/etiquetas-digital/troquel-archivo/route.ts:216` | string → number | 1 | Argumento string donde BD espera number. |

---

## Top ~20 errores por archivo (agrupados)

```
src/components/produccion/almacen/stock/stock-page.tsx         7 errores  (P1)
src/components/produccion/almacen/cartelas/cartelas-page.tsx   4 errores  (P1)
src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx  4 errores  (P2-B)
src/components/produccion/ots/despacho-wizard-dialog.tsx       4 errores  (P2-B/C)
src/components/produccion/troqueles/troqueles-page.tsx         5 errores  (P2-D/E)
src/app/api/admin/users/route.ts                               2 errores  (P2-A)
src/lib/role-permissions-fetch.ts                              2 errores  (P2-A)
src/components/produccion/planificacion/planificacion-mesa-secuenciacion-tab.tsx  2 errores  (P2-K)
src/components/produccion/ots/master-ots-page.tsx              1 error    (P2-J)
src/components/produccion/ots/ots-despachadas-page.tsx         1 error    (P2-J)
src/app/api/admin/role-permissions/route.ts                    1 error    (P2-A)
src/app/api/admin/users/[id]/profile/route.ts                  1 error    (P2-A)
src/components/produccion/almacen/cartelas/cartela-wizard-dialog.tsx  1 error   (P1)
src/components/produccion/etiquetas-digital/etiquetas-troqueles-tab.tsx  1 error (P2-G)
src/components/produccion/etiquetas-digital/etiquetas-entrada-express-dialog.tsx  1 error (P2-F)
src/components/produccion/externos/gestion-externos-page.tsx   1 error    (P2-H)
src/components/produccion/fichas-tecnicas/fichas-tecnicas-page.tsx  2 errores  (P2-I)
src/components/produccion/hoja-ruta/hoja-ruta-ot-dialog.tsx    1 error    (P2-H)
src/components/produccion/muelle/muelle-recepcion-page.tsx     1 error    (P2-H)
src/app/api/etiquetas-digital/troquel-archivo/route.ts         1 error    (P2-M)
src/utils/supabase/server.ts                                   1 error    (P2-L)
```

---

## Recomendación

### Arreglar YA (próxima sesión, antes de 9.8.3)

No hay P0 claros. El triage confirma que los bugs R1/§18.15 estaban ya arreglados.

**Recomendado arreglar antes de 9.8.3** (porque tocaremos stock/cartelas/compras):

| # | Fix | Esfuerzo | Por qué |
|---|-----|----------|---------|
| Fix-1 | `src/utils/supabase/server.ts:100` — `r.is_enabled ?? false` | 1 min | Trivial; en archivo ya tocado |
| Fix-2 | `src/types/prod-stock.ts` — actualizar `StockPaletAtpRow.id` a `string \| null` (o usar `Tables<'prod_stock_palets_atp_view'>`) | 15 min | stock-page.tsx 3 errores en ATP view shape; afecta 9.8.4 |
| Fix-3 | Patrón null/undefined en stock-page + cartelas-page (8 errores) | 20 min | Añadir `?? undefined` en las 8 asignaciones; ningún cambio de lógica |

**Total ~36 min** para eliminar ~12 errores P1. Resto (P2, 32 errores) → dejar para sesión dedicada de tipado post-9.8.

### NO tocar en esta sesión
- `DatosProcesoGenerico` → `Json` casts (P2-B): requiere refactor de tipo compartido
- `user_role` enum en admin routes (P2-A): requiere validación/cast sistemático
- Troqueles number/string (P2-D/E): módulo separado, no bloquea 9.8.3
- Planificacion overloads (P2-K): investigar si overload error o campo equivocado

---

## Investigación P2-J y P2-K (20 ago — antes de 9.8.3)

### P2-J — `ots-despachadas-page.tsx:286` + `master-ots-page.tsx:385`

**Veredicto: ruido de tipos, no bug de dato.**

Ambos archivos construyen arrays `(string|number)[]` para matching en `.in()`:
- `ots-despachadas-page.tsx`: `inVals` contiene tanto el string `c` como su forma numérica `Number(c)` para buscar `num_troquel` (que puede ser integer en BD). La columna es correcta.
- `master-ots-page.tsx`: `inValues` hace lo mismo con `ot_numero`. Columna correcta.

El error TS es solo de tipos: el `.in()` generado espera `readonly string[]` pero los arrays son `(string|number)[]`. **Fijado** con `.map(String)` en los dos `.in()` calls (20 ago). No hay bug de datos.

`ots-despachadas-page.tsx` está en el radio de 9.8.3 (botón Compra corrección). El error estaba en una función `fetchTroquelInfo` completamente separada. **El botón de compra corrección no se ve afectado.**

### P2-K — `planificacion-mesa-secuenciacion-tab.tsx:2449,2470`

**Veredicto: ruido de tipos, no bug de dato.**

Ambas líneas son `.insert(inserts)` y `.insert(legacyInserts)` en el patrón "try new schema / fallback legacy" protegido por `isMissingColumnError`. El overload TS2769 es porque el objeto insert tiene campos con `null` donde el tipo generado puede esperar `never` o tipo incompatible en algún overload. No hay columna incorrecta ni tabla equivocada — la tabla (`prod_mesa_planificacion_trabajos`) y todas las columnas son correctas. El fallback `isMissingColumnError` maneja gracefully cualquier discrepancia de esquema. **No se toca en esta sesión.**

---

## Estado post-sesión (actualizado 20 ago)

- [x] `database.ts` generado y comprometido
- [x] Clientes cableados (`browser` / `server` / `admin`)
- [x] Script `db:types` en `package.json`
- [x] Fix-1: `server.ts:100` `r.is_enabled ?? false` — ya aplicado en sesión anterior
- [x] Fix-2: `stock-page.tsx` cast `viewRaw as StockPaletAtpRow[]` — elimina 3 errores ATP shape
- [x] Fix-3: `null` → `undefined` en 8 params RPC de `stock-page.tsx` y `cartelas-page.tsx`
- [x] Fix #12: `tipo_stock as StockTipo` en `cartela-wizard-dialog.tsx:487`
- [x] P2-J fijado: `.map(String)` en `ots-despachadas-page.tsx:286` y `master-ots-page.tsx:385`
- [x] P2-J investigado y confirmado ruido
- [x] P2-K investigado y confirmado ruido (no tocar)
- [ ] Fix P2 resto (32 errores) — siguiente sesión dedicada tipado post-9.8
