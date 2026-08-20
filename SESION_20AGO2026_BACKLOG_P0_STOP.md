# SESION 20 AGO 2026 — Backlog P0 + smoke test lab

**Fecha**: 20 agosto 2026  
**Contexto**: Tras lab 98020 (19 ago), implementación y validación exhaustiva de P0 §7.1–7.3 + fixes P2 §18.9/18.11/18.15.  
**Modelos**: Composer / Claude Sonnet 4.6 medium (fixes P2)  
**Branch**: `main` (último fix relevante: `014e4cd`)

---

## Executive Summary (para smoke / handoff Claude)

| Bloque | Estado | Notas |
|--------|--------|-------|
| **7.3** Búsqueda Cartelas | ✅ VALIDADO | 6 bugs lab → fixes en mismo día; UX final = 3 inputs AND |
| **7.2** Asignar OT desde Stock | ✅ VALIDADO | Mecánica OK; gaps P2 detectados y cerrados (ver abajo) |
| **7.1** Reset planificación STOP | ✅ VALIDADO | OT 98020 Guillotina→Impresión; 2 bugs lab → fixes |
| **§18.11** Sync `estado_material` | ✅ VALIDADO | OT 35643 + `#99019` → «Material en stock asignado» |
| **§18.15** Autocompletar OT | ✅ VALIDADO | Tras fix columnas fantasma (`014e4cd`); teclear `35` → dropdown |
| **§18.9** Pool sin compra + stock | ✅ VALIDADO | OT 35643: Material OK + ámbar + checkbox → Pasar a Mesa |

**Pendiente producto (actualizado noche 20 ago):** ~~P1 9.8.3~~ ✅ validado 98022 · P1 **9.8.6** redespacho · **P2↑ perf Compras** · KPI §18.8 · linter legacy.  
**Handoff noche Claude:** `SESION_20AGO2026_HANDOFF_NOCHE_CLAUDE.md`.

**Trampa de lab a recordar:** cartelas `es_prueba=true` (p.ej. `#10986` en OT 35760) **no cuentan** en semáforo Pool. Validar §18.9 con stock real (`es_prueba=false`), p.ej. `#9718` en 35643.

---

## Commits clave del día (orden aproximado)

| Commit | Qué |
|--------|-----|
| `a553e20` / roles | 7.1 Reset planificación STOP |
| `a019d27` | 7.2 Asignar OT desde Stock |
| `c1cbd01` + iteraciones | 7.3 búsqueda (+ B1–B6) |
| `4076de1` | 7.1 fix: huecos por `ot_paso_id` en **ejecuciones**, no en mesa |
| `9e5f46c` | 7.1 UX: literal `máquina · fecha · turno` |
| `a04fb20` | P2 §18.11 + §18.15 + §18.9 (migración RPC + Pool + OtDestinoSearchInput) |
| `014e4cd` | §18.15 fix: query sin columnas fantasma `cliente`/`titulo` en despachadas |

Migración remota aplicada: `20260820090000_bloque9_8_4_asignar_estado_material_ampliado.sql` (proyecto Supabase `minerva-rag`).

---

## 7.1 — Reset planificación STOP

### Diseño
- Botón rojo «Reset planificación STOP» en paso **finalizado** (admin / oficina_tecnica / gerencia).
- Preview + confirmación → `devolverHuecoMesaAlPool` por cada hueco posterior → pool `en_transito`.
- **No** cascade silencioso (P5).

### Lab (OT 98020)
| Paso | Resultado |
|------|-----------|
| Impresión en mesa 19/08 SpeedMaster, `PENDIENTE INICIO` | Precondición OK |
| Reset desde **Guillotina** (no CTP) | Correcto: busca `orden > actual` |
| 1.ª apertura diálogo: «No hay huecos…» | ❌ Bug detección |
| Tras `4076de1`: lista 1 hueco Impresión | ✅ |
| Literal feo `Mesa ID: e91d8df0…` | ❌ → `9e5f46c` |
| Tras fix: `SpeedMaster CD 102 · 19/08/26 · Mañana` | ✅ |
| Confirmar → toast, mesa vacía, ejecución `cancelada`, OT en Pool | ✅ |

### Bugs 7.1

| # | Bug | Causa | Fix |
|---|-----|-------|-----|
| R1 | Diálogo no encontraba Impresión en mesa | `fetchHuecosMesaPosteriores` filtraba `prod_mesa_planificacion_trabajos.ot_paso_id` — esa columna **no existe** ahí; vive en `prod_mesa_ejecuciones` | Buscar ejecuciones activas por `ot_paso_id` + fallback `ot_numero` (`4076de1`) |
| R2 | Literal UUID ilegible | UI mostraba `mesaId.slice(0,8)` | Enriquecer con máquina/fecha/turno (`9e5f46c`) |

---

## 7.2 — Asignar OT desde Stock

### Lab
| # | Paso | Resultado |
|---|------|-----------|
| 7.2.1 | Botón visible stock libre | ✅ |
| 7.2.2 | Botón oculto si ya tiene OT | ✅ |
| 7.2.3–6 | Split `#99020` → `#10986` 900h + assign 35760; `#99020` 100 libre | ✅ mecánica |

### Gaps P2 detectados en lab → cerrados misma sesión

| Gap | Problema | Fix |
|-----|----------|-----|
| §18.11 | RPC solo actualizaba `estado_material` si venía de STOP | WHERE ampliado (null / Sin orden compra / …) |
| §18.15 | Campo OT sin búsqueda | `OtDestinoSearchInput` |
| §18.9 | Pool muro rojo sin compra aunque hay cartela | Gate + mensaje ámbar si `hojasStockCartelado > 0` |

---

## 7.3 — Búsqueda server-side Cartelas

**Estado:** ✅ VALIDADO (6 bugs iterativos en lab)

| # | Bug | Fix | Commit |
|---|-----|-----|--------|
| B1 | OT numérica no encontraba | Parallel id_stock + ot_numero + nota_entrega | `153ec42` |
| B2 | `id_stock::text ILIKE` rechazado PostgREST | Rangos numéricos | `ec4040a` |
| B3 | Overflow int4 | Cap `PG_INT4_MAX` | `2b13786` |
| B4 | `1067` → cientos de falsos positivos | **3 inputs** ID / Alb-OT / Material (AND) | `54d7c4b` |
| B5 | Wizard auto-colapsaba lista | Quitar auto-fill | `3b973d3` |
| B6 | Build Vercel `setSearch` | Rename | `177b656` |

UX final: `[ ID Stock ] [ Albarán/OT ] [ Material ]` · Enter · sin límite 200 con búsqueda.

---

## Smoke test tarde — P2 §18.9 / 18.11 / 18.15

### §18.11 — VALIDADO
- Asignar `#99019` → OT **35643**
- Toast OK
- Despachadas: **Material en stock asignado** ✅

### §18.15 — VALIDADO (tras 2.º fix)
- 1.ª prueba (`357` en modal): **sin dropdown**
- Causa: select de `cliente`/`titulo` en `produccion_ot_despachadas` (columnas inexistentes; viven en `prod_ots_general`) → error silencioso
- Fix `014e4cd`: despachadas solo `ot_numero`+`estado_material`; enrich maestro
- Revalidación: teclear `35` → dropdown con OTs + cliente ✅

### §18.9 — VALIDADO (con matices lab)
| OT | Qué pasó |
|----|----------|
| **35643** | Material OK · `2050 h en cartela` · ámbar «Sin compra — cubierto por stock cartelado» · checkbox → **Pasar a Mesa** habilitado ✅ |
| **35760** | Parecía «no funciona»: `#10986` es `es_prueba=true` → Pool **ignora** prueba → 0 h cartela / crítico. Además asignación fue **antes** del fix §18.11 (`estado_material` se sincronizó a mano en DB). No es fallo del gate. |

**Nota UX:** botón Pasar a Mesa deshabilitado si `selectedRows.length === 0` (hay que marcar checkbox).

### Cantidades «raras» (no bug P0)
Reserva **blanda**: físicas = libres, reservadas = 0; palet puede aparecer en filtros «libre» con OT referenciada. Ruido amplificado por muchas OTs de lab a medias.

---

## Archivos tocados (día)

**7.1:** `prod-paso-admin-permisos.ts`, `prod-paso-admin-client.ts`, `paso-admin-actions.tsx`  
**7.2:** `stock-page.tsx`  
**7.3:** `cartelas-page.tsx`  
**P2:** `ot-destino-search-input.tsx` (nuevo), `cartelas-page.tsx`, `stock-page.tsx`, `planificacion-contenedor-query.ts`, `planificacion-pool-ots-tab-v2.tsx`, migración SQL §18.11  
**Docs:** este archivo · `MINERVA_BLOQUE9_REASIGNACION_STOP.md` · `MINERVA_HUB_CONTEXTO_MAESTRO.md`

---

## Checklist smoke (copiar a Claude)

```
[ ] 7.3 — 3 filtros Cartelas (ID / Alb-OT / Material) encuentran fuera del top 200
[ ] 7.2 — Stock libre → Asignar a OT (toast + bridge)
[ ] 7.1 — Paso finalizado → Reset STOP lista máquina·fecha·turno → anula → Pool
[ ] 18.11 — Asignar stock a OT «Sin orden compra» → estado_material = Material en stock asignado
[ ] 18.15 — Modal Asignar: ≥2 chars → dropdown OT + cliente
[ ] 18.9 — OT con cartela real (no prueba) sin compra → ámbar + seleccionable + Pasar a Mesa
[ ] Trampa: es_prueba no cuenta en Pool
```

---

## Siguiente sesión

1. **P1** 9.8.3 Compra corrección (`correccion`, allowlist batch)
2. **P1** 9.8.6 Popup redespacho asistido
3. Opcional: §18.8 KPI reservas blandas · split prueba → aviso id coherente · linter `set-state-in-effect`

---

## Prerreq antes de 9.8.3 — Tipos Supabase `Database`

> **20 ago 2026** — Activación tipos generados Supabase (`Database`) + triage errores TS.

**Qué se hizo:**
- Generado `src/types/database.ts` (3771 líneas) vía MCP `generate_typescript_types` (proyecto `jrwwuqplilbydxptsbqz`).
- Añadidos helpers estándar `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`, `Enums<>`.
- Cableado `SupabaseClient<Database>` en `src/utils/supabase/client.ts`, `src/utils/supabase/server.ts`, `src/lib/supabase/admin.ts`.
- Script `"db:types"` en `package.json` para regenerar.

**Por qué antes de 9.8.3:**
- **R1** (bug §7.1): columna `ot_paso_id` en tabla equivocada — sin tipos, TypeScript no avisa.
- **§18.15 (silencioso)**: select `cliente`/`titulo` en `produccion_ot_despachadas` compilaba sin error aunque las columnas viven en `prod_ots_general`.
- Familia idéntica: "columna en tabla equivocada". Con `Database` genérico el editor avisa en tiempo real. 9.8.3 toca stock/compras/despachadas — mejor llegar con tipos activos.

**⚠️ Aviso:** Activar tipos puede sacar discrepancias silenciosas. Correr `npx tsc --noEmit` y triagear antes de implementar 9.8.3. Ver informe triage en `SESION_20AGO2026_SUPABASE_TYPES_TRIAGE.md`.
