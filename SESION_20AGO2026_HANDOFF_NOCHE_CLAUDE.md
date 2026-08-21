# SESIÓN 20 AGO 2026 — HANDOFF NOCHE PARA CLAUDE

> **Documento de paso de testigo.** Leer esto primero en un chat nuevo.
> Fecha cierre lab: **20 ago 2026 ~21:15** (Europe/Madrid).
> Branch: **`main`** · Repo: `antaresmpt-alt/minerva-strategic-ai-hub`
> Supabase project: **`jrwwuqplilbydxptsbqz`** (minerva-rag)
> Deploy: Vercel sobre `main`

---

## 0. TL;DR (30 segundos)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Qué se cerró hoy? | P0 7.1–7.3 + P2 §18.9/11/15 + **9.8.3** + harden UI |
| ¿Verificado en planta? | **Sí.** Camino asignación (mañana) + Camino B consumo limpio (noche, OT **98022**) |
| ¿Qué NO hay que repetir? | Otro lab «Camino A» de asignación — **ya validado hace horas** (§18.11 / 7.2) |
| ¿Qué queda de 9.8? | **Cerrado en planta 21 ago** (9.8.6 smoke OT **36112**). Merge auto = opcional |
| ¿Qué molesta ahora? | Histórico/Despachadas polish; merge auto 9.8.6 solo si se pide |
| Fuente detallada mañana | `SESION_20AGO2026_BACKLOG_P0_STOP.md` |
| Fuente detallada 9.8.3 | `SESION_20AGO2026_BLOQUE9_8_3_VALIDACION_HOOK.md` |
| Brief módulo | `MINERVA_BLOQUE9_REASIGNACION_STOP.md` |
| Maestro global | `MINERVA_HUB_CONTEXTO_MAESTRO.md` |

**Veredicto de Manel (noche):** del plan del día, lo gordo está hecho y verificado. No asustar con «falta Camino A otra vez».

---

## 1. Cómo leer el día (mañana → noche)

```
MAÑANA                          TARDE                         NOCHE
─────────────────────────────   ───────────────────────────   ────────────────────────────
P0 7.1 Reset planificación      §18.0 tipos Database          9.8.3 schema remoto (MCP)
P0 7.2 Asignar OT Stock         triage tsc 44 errores         UI corrección + harden STOP
P0 7.3 Búsqueda Cartelas        9.8.3 implementación          Lab 98021 (parcial / sucio)
P2 §18.11 / 18.15 / 18.9        commits migr+UI               Lab 98022 Camino B LIMPIO ✅
```

No mezclar: **Camino A** en docs de 9.8.3 = «salida STOP por **asignar** cartela».  
Eso ya se validó en la mañana como **7.2 + §18.11**. La noche cerró el hueco que faltaba: **salida STOP por consumo** sin que Confirmado/Recibido pise el badge.

---

## 2. Estado de fases Bloque 9.8

| Fase | Qué es | Estado 20 ago noche |
|------|--------|---------------------|
| **9.8.1 + 1b** | Liberar reserva + allowlist compra | ✅ (98019, 98020) |
| **9.8.1c** | Auditoría legacy `estado` palet | ✅ |
| **9.8.2** | Aviso formato CTP/Guillotina/Impresión | ✅ (98020) |
| **9.8.3** | Compra corrección tipada + hooks salida STOP | ✅ **código + lab 98022 Camino B** |
| **9.8.4** | Asignar stock libre → OT (Juan) | ✅ (7.2, §18.11, 98020-C) |
| **9.8.5** | Revertir consumo | ✅ (98020-B) |
| **9.8.6** | Popup redespacho asistido | ❌ **PENDIENTE** (hoy se usa lápiz) |
| Compra/cartela sin OT | Stock libre genérico | ✅ |

Fotos/adjuntos = **9.10** (no tocar). OCR = **9.7** (baja).

---

## 3. P0 mañana — smoke validado

Detalle exhaustivo: `SESION_20AGO2026_BACKLOG_P0_STOP.md`.

| # | Ítem | Resultado | OT / evidencia |
|---|------|----------|----------------|
| **7.1** | Reset planificación STOP | ✅ | 98020 Guillotina→Impresión; fixes R1 (`ot_paso_id` en ejecuciones) + R2 (literal máquina·fecha·turno) |
| **7.2** | Asignar OT desde Stock | ✅ | Mecánica + bridge; gaps P2 cerrados mismo día |
| **7.3** | Búsqueda Cartelas server-side | ✅ | 6 bugs lab → UX final 3 inputs AND |
| **§18.11** | Sync `estado_material` al asignar | ✅ | 35643 + `#99019` → `Material en stock asignado` |
| **§18.15** | Autocompletar OT al asignar | ✅ | Fix columnas fantasma `cliente`/`titulo` en despachadas (`014e4cd`) |
| **§18.9** | Pool sin compra + stock cartelado | ✅ | 35643 ámbar + Pasar a Mesa; **trampa:** `es_prueba=true` no cuenta en Pool |

---

## 4. 9.8.3 — qué se implementó

### 4.1 Schema (remoto aplicado vía MCP)

Migraciones en repo (+ aplicadas en Supabase):

- `supabase/migrations/20260820173000_bloque9_8_3_compra_correccion_schema.sql`
  - enum / columna `tipo` (`normal` | `correccion`)
  - `compra_origen_id`, `motivo` en `prod_compra_material`
- `supabase/migrations/20260820173100_bloque9_8_3_consumo_salida_stop.sql`
  - `prod_stock_registrar_consumo` limpia STOP → `Material en stock asigado` si badge era liberado / pendiente corrección
- Relacionado noche: prorrateo split coste (`20260820180000_bloque9_3_split_prorrateo_coste.sql` + repair #10987/#10988)

**Bug de lab temprano:** guardar corrección fallaba porque columnas no estaban en remoto. Se aplicó migración MCP; no repetir.

### 4.2 UI

- Diálogo **Compra de corrección** (naranja) desde fila de compra cuando OT en STOP liberado / flujo corrección
- Escribe `tipo=correccion`, origen, motivo
- Marca OT: `estado_material = Pendiente compra de corrección`
- Constantes STOP: `src/lib/compras-material-estados.ts`
  - `STOP_MATERIAL_LIBERADO` = `Sin material asignado (liberado)`
  - `STOP_PENDIENTE_CORRECCION` = `Pendiente compra de corrección`
  - `esEstadoMaterialStop` / `esEstadoMaterialStopBloqueado`

### 4.3 Dos hooks de salida STOP (NO son redundantes)

| Camino | Evento | Función | Cuándo limpia badge |
|--------|--------|---------|---------------------|
| **A — Asignación** | Botón «Asignar a OT» (Stock/Cartelas) | `prod_stock_asignar_palet_ot` | Al asignar (WHERE amplio §18.11) |
| **B — Consumo** | Cierre paso con consumo (Guillotina…) | `prod_stock_registrar_consumo` | Solo si aún está en liberado / pendiente corrección |

Ambos dejan: `estado_material = 'Material en stock asignado'`.

### 4.4 Harden UI (crítico — commit `8173506`)

**Bug:** al pasar compra a Confirmado / Recibido, `onEstadoChange` en Compras sincronizaba `estado_material` de la OT a `Compra confirmada` / `Material recibido` **aunque la OT estuviera en STOP**. Eso invalidaba el test del hook de consumo.

**Fix:** `esEstadoMaterialStopBloqueado` = **cualquier** STOP. Mientras liberado o pendiente corrección, **no** propagar progreso de OC al badge OT. Salida solo por asignar o consumir.

Archivos:

- `src/lib/compras-material-estados.ts`
- `src/components/produccion/ots/compras-material-page.tsx` (`onEstadoChange` + sync «Orden compra generada»)

**Comportamiento correcto observado por Manel:**  
Despachadas sigue «Pendiente compra de corrección» aunque la línea OC ya esté Recibida. Eso **no es bug**.

**Nota operativa Muelle:** para que la línea salga en Muelle hay que ponerla en Generada/Confirmado (estado de la **compra**, no del badge OT).

---

## 5. Labs de la noche

### 5.1 OT 98021 — útil pero STOP no limpio

- Split stock #10987 / #10988, asignación, liberar, corrección ALLYKING, cartela #99026, consumo Guillotina
- Aviso margen 9.8.2 OK
- **Problema:** antes del harden, Confirmado pisó badge → `Compra confirmada` antes del consumo → hook consumo no se pudo validar limpio
- No usar 98021 como evidencia Camino B

### 5.2 OT 98022 — Camino B VALIDADO ✅

Seed BD (lab):

| Campo | Valor |
|-------|--------|
| OT | `98022` — LABORATORIOS ANUR · EU514 (lab 9.8.3) |
| Despacho | ALLYKING 300 g · 75×105 · 300 h · TAM00537 |
| Compra P1 | `OCM-98022` ALLYKING · Recibido · `tipo=normal` |
| Cartela inicial | `#99027` (prueba) · liberada en el test |
| Corrección P2 | FOLDING ZENITH 295 g · CAROBSA · `tipo=correccion` · Recibido |
| Cartela corrección | `#99028` · 300 h · reservada a 98022 en muelle |
| Consumo | Guillotina 300 h → `#99028` `consumido` / 0 h |

Checklist ejecutado por Manel:

1. Liberar → badge liberado  
2. Compra corrección → pendiente corrección  
3. Confirmar/Recibir → **badge sigue pendiente corrección** (harden ✅)  
4. Muelle → cartela #99028 con reserva directa a 98022 (sin botón Asignar)  
5. CTP + Guillotina → consumo  
6. BD: `estado_material = Material en stock asignado` ✅  

**Pool «Material parcial»** en 98022: esperable (corrección FOLDING vs despacho ALLYKING). No invalida el test STOP.

### 5.3 Camino A — NO re-labear

Validado en mañana:

- Asignar stock libre → OT sin STOP previo (§18.11, 35643)
- 9.8.4 en general (98020-C, 7.2)

Si alguien pide «validar Camino A otra vez» en contexto 9.8.3: **rechazar** salvo regresión nueva. El checklist teórico en `SESION_20AGO2026_BLOQUE9_8_3_VALIDACION_HOOK.md` §«Camino A» es histórico de diseño; el smoke real ya está en el backlog P0.

---

## 6. Commits clave (orden reciente → antiguo)

| Commit | Qué |
|--------|-----|
| `8173506` | Harden: no pisar STOP al Confirmar/Recibir |
| `2b48d73` | Schema remoto + prorrateo split + OT search/autofill + toast/modal |
| `7bda4ba` | Docs caminos asignación vs consumo |
| `36fbb10` | UI + docs 9.8.3 |
| `932a445` | Schema + hook consumo + UI base 9.8.3 |
| `6d8ea39` / `8eb5558` / `b5e7915` | Tipos Database + triage tsc |
| `6d1f1d9` | Docs smoke P0+P2 |
| `014e4cd` | §18.15 sin columnas fantasma |
| `a04fb20` | §18.11 WHERE estado_material ampliado |
| `9e5f46c` / `4076de1` | Fixes 7.1 Reset STOP |
| `c1cbd01` + B1–B6 | 7.3 búsqueda Cartelas |
| `a019d27` | 7.2 Asignar OT Stock |
| `a553e20` | 7.1 Reset planificación |

---

## 7. Archivos tocados (noche 9.8.3 / harden) — mapa rápido

| Área | Archivos |
|------|----------|
| Constantes STOP | `src/lib/compras-material-estados.ts` |
| Compras UI | `src/components/produccion/ots/compras-material-page.tsx` |
| Diálogo corrección | `src/components/produccion/ots/compras-material-manual-dialog.tsx` |
| SQL | `supabase/migrations/20260820173000_*.sql`, `20260820173100_*.sql`, split prorrateo |
| Buscador OT | `OtDestinoSearchInput` (mejoras título/cliente/ref) |
| Docs | este archivo · `SESION_20AGO2026_BLOQUE9_8_3_VALIDACION_HOOK.md` · `MINERVA_BLOQUE9_REASIGNACION_STOP.md` · maestro |

---

## 8. Pendiente — priorizado para siguiente sesión

### P1 producto (bloque 9.8)

1. **9.8.6** — Popup redespacho asistido tras liberar/asignar (hoy: lápiz manual). Brief § en `MINERVA_BLOQUE9_REASIGNACION_STOP.md`.

### P2 ↑ planta (molestia real Manel 20 ago noche)

2. **Rendimiento Compras de material**
   - Sintoma: al tocar **fechas** o **cambiar estado**, la UI se tira **segundos** y a veces se bloquea; Manel lo nota **peor** últimamente.
   - Pantalla: `/produccion/ots` → Compras de Material (matriz ~400+ filas).
   - Hipótesis a investigar (no implementado aún): re-fetch masivo tras cada patch, re-render tabla completa, falta debounce, queries N+1, sync despachadas por fila, etc.
   - **No es bloqueante** de STOP; sí de usabilidad diaria.

### P2 / polish (backlog §18, no urgente)

| # | Ítem | Notas |
|---|------|-------|
| 18.8 | KPI reservas blandas | Ruido lab con muchas OTs a medias |
| — | Observaciones CTP STOP no siempre persisten | Bug UI antiguo 98019 |
| — | Linter `set-state-in-effect` | Legacy |
| — | Tipos tsc remanentes | ~12 P1 null/ATP + ruido P2 (ver triage) — build Vercel ya limpio en commits tipos |
| 18.6 | Toast reabrir: OT sigue en mesa | No vuelve sola al Pool |
| 18.7 | Split palet prueba → aviso id | |
| — | Merma física post-Guillotina | Solo si planta lo pide |
| — | Lote «Generar compras» Despachadas no crea P2 | Mitigado por UI «Compra de corrección» |

### No abrir ahora

- Bloque 7 Odoo, Bloque 10 presupuestos, 9.7 OCR, 9.9 IA Stock, 9.10 fotos
- Bloque 12 roles (sept, usuarios masivos)
- Re-lab Camino A STOP «por completar checklist»

---

## 9. Trampas de lab (no olvidar)

1. Cartelas **`es_prueba=true`** (id ≥ 99000) **no cuentan** en semáforo Pool (§18.9). Validar Pool con stock real.
2. Reserva **blanda**: físicas = libres, reservadas = 0; puede parecer «libre» con OT referenciada.
3. Badge STOP **debe** quedarse tras Recibir corrección — no «arreglarlo» propagando Compra confirmada.
4. Para Muelle: estado de la **línea compra** Generada/Confirmado; independiente del badge OT.
5. No confiar en Optimus para stock físico; manda ledger Minerva (`prod_stock_palets` + bridge `prod_stock_palet_ots` + movimientos).

---

## 10. Roles (recordatorio)

| Acción | Quién |
|--------|-------|
| Liberar / revertir / compra corrección / Reset planificación STOP | `admin` \| `oficina_tecnica` \| `gerencia` |
| Asignar stock libre a OT (9.8.4) | Juan / almacén (`authenticated` en RPC; UI Stock/Cartelas) |
| Consumo en cierre paso | Operario (CTP, Guillotina, etc.) |

---

## 11. OTs laboratorio — inventario

| OT | Para qué | Estado cierre 20 ago |
|----|----------|----------------------|
| **98019** | Lab A inicial 9.8.1 | Histórico validado 18 ago |
| **98020** | Lab A+B+C + Reset STOP | ✅ 19–20 ago |
| **98021** | Lab corrección / split | Útil; STOP Camino B **no limpio** (pre-harden) |
| **98022** | Camino B 9.8.3 limpio | ✅ badge limpio post-consumo |
| **36112** | Smoke 9.8.6 + prorrateo split | ✅ 21 ago (#10989) |
| **35760** | Trampa `es_prueba` | No usar como evidencia Pool |

---

## 12. Prompt sugerido para chat Claude nuevo

```
Lee en este orden:
1) SESION_20AGO2026_HANDOFF_NOCHE_CLAUDE.md  (este handoff)
2) MINERVA_HUB_CONTEXTO_MAESTRO.md (estado global)
3) MINERVA_BLOQUE9_REASIGNACION_STOP.md (brief 9.8)
Si tocas 9.8.3: SESION_20AGO2026_BLOQUE9_8_3_VALIDACION_HOOK.md
Si tocas smoke P0 mañana: SESION_20AGO2026_BACKLOG_P0_STOP.md

Contexto: 9.8.3 VALIDADO (98022 Camino B). No re-labear Camino A.
Siguiente: smoke 9.8.6 MVP (popup lápiz tras asignar) o polish Histórico.
Perf Compras cerrado usable 21 ago. Supabase ref: jrwwuqplilbydxptsbqz. Branch main.
```

---

## 13. Addendum 21 ago (Cursor / Composer)

| Ítem | Estado |
|------|--------|
| Perf Compras (`20a06a5` + fix `217e500`) | ✅ Usable ~1–2 s; modal editar fluido |
| **9.8.6 MVP** | ✅ Popup «¿Abrir lápiz despacho?» tras asignar en **Stock** y **Cartelas** (roles oficina). Merge auto = fase 2 |
| Smoke planta 9.8.6 | ✅ **21 ago** OT **36112** · cartela **#10989** (split #99029 2000→1350+650, prorrateo OK) · popup → lápiz · campos a mano → guardar · hoja ruta OK |
| Sync albarán | ✅ `ab9bb4f` — compra lápiz → recepción; placeholders KEEP IN SYNC |
| Inventario botones | `INVENTARIO_BOTONES_CARTELAS_STOCK.md` (para manual Claude) |
---

## 13. Checklist «día cerrado» (para Manel)

- [x] P0 7.1 / 7.2 / 7.3 smoke
- [x] P2 §18.9 / 18.11 / 18.15 smoke
- [x] Tipos Database cableados + triage
- [x] 9.8.3 schema remoto + UI
- [x] Harden STOP (no pisar badge)
- [x] Camino B consumo limpio (98022)
- [x] Camino A asignación (mañana — no repetir)
- [x] 9.8.6
- [ ] Perf Compras (fechas/estado)
- [x] Docs maestro/brief alineados con «9.8.3 validado» + handoff Claude

---

*Fin handoff 20 ago noche. Autor sesión: Manel + Cursor (Composer). Destinatario: Claude (siguiente chat).*
