# Sesión 27 ago 2026 — Bloque 11 día completo (cartelas · PDF · pulido UX)

> **Rama:** `feature/bloque11-contenedor-ctp-spike`  
> **Decisión:** `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` §26–27  
> **Merge `main`:** **domingo noche** (demo lunes con mejoras agosto) — **no merge hoy**

---

## Commits del día (orden cronológico)

| Commit | Resumen |
|--------|---------|
| `58ba4ed` | Cartelas: repartir hojas del albarán entre palets al cartelar |
| `d92cf41` | Cartelas: 1 OT → reserva **dura** por defecto (hojas del palet) |
| `5675415` | Fix orden «Hoy planificado»: mañana antes que tarde (`rankPlanHoyByOt`) |
| `ace0409` | PDF detalle cartelas + material · Guillotina chip ejecución · `collectEntradasAtrasadas` · print Electron 5 módulos |
| `7dc75cb` | Modal Atrasadas · Guillotina solo tooltip en pastillas · valla LEGACY mesa |

---

## 1. Cartelas (mañana · Bloque 9 tangente)

### Reparto hojas albarán (`58ba4ed`)

Al cartelar varios palets de un mismo albarán, las hojas brutas del albarán se **reparten** entre palets (no duplicar el total en cada uno).

### Reserva dura por defecto (`d92cf41`)

Con **una sola OT** en el wizard de cartela, el palet queda **reservado duro** por defecto (hojas del palet), no «disponible» blando. Evita que otro OT consuma material mientras Carlos planifica.

**Smoke:** primer palet «reservado», resto «disponible» hasta asignar.

---

## 2. Orden ejecución «Hoy planificado» (`5675415`)

### Problema

`slot_orden` reinicia por turno → en contenedor I/D la **tarde** con `#1` salía **antes** que mañana `#2`.

### Solución

`rankPlanHoyByOt()` en `calendario-detalle-dia.ts`:

- Turno mañana = bloque 0, tarde = bloque 1.
- Dentro del turno, orden por `slot_orden`.
- Test: `calendario-detalle-dia.test.ts`.

**UI:** badges `#1` `#2` `#3` en grupo «Hoy · planificado» respetan mañana → tarde.

---

## 3. PDF detalle del día — cartelas + material (`ace0409`)

### Contexto

El PDF rico del 26 ago (cliente, tintas, papel, hojas, horas) faltaba **cartelas** y estado material ATP — Carlos necesita ver palet, formato, gramaje y cobertura al imprimir el plan.

### Implementación (`calendario-detalle-dia-print.ts`)

`fetchDetalleDiaPrintMetaByOts`:

- `prod_stock_palet_ots` + palet (id, material, formato, gramaje, hojas).
- `fetchCalendarioMaterialByOtNumeros` — pills material (gris/rojo/ámbar/verde).
- Líneas cartela en card: `#id · material · formato · gramaje · N hj` + badge **prueba** si OT ≥ 98.000.
- Pie card: «Despacho X hj · cartelado Y hj».

**Validación Manel:** `Plan-impresion-2026-08-27.pdf` — mejor que listado genérico.

### Print Electron — resto de módulos (`ace0409`)

Migrado `useReactToPrint` → `printElementInNewWindow` en:

- Externos
- Fichas técnicas (2)
- Tablón semanal
- Ventas

Ya OK desde 26 ago: detalle-día + mesa diaria LEGACY (§25).

---

## 4. Atrasadas (`ace0409` + `7dc75cb`)

### Lógica (`calendario-produccion.ts`)

`collectEntradasAtrasadas(byDay, hoyYmd)`:

- `fechaYmd < hoy` (ISO).
- No `hechoVisual` ni `marcadoHecho`.
- **No auto-mueven** — Carlos debe mover pastilla o marcar hecha.
- Orden: fecha → ámbito → OT.

Test: `calendario-produccion-atrasadas.test.ts`.

### UI evolución

| Fase | UI |
|------|-----|
| `ace0409` | Cajón amarillo expandible bajo filtros (comía altura del grid) |
| `7dc75cb` | Botón **«Atrasadas (N)»** en barra filtros (solo si N > 0) → **modal central** |

Modal: OT · letra ámbito · trabajo · fecha legible; clic OT → cierra modal y abre detalle HR.

**Smoke Manel:** 5 atrasadas visibles (36340, 36341, 36019×2, 36020); al mover 36019 al 28, debería bajar el contador.

---

## 5. Guillotina — Rita / Ramón / Miguel (`ace0409` + `7dc75cb`)

### Lib (`calendario-produccion-progreso.ts`)

- `guillotinaStatusFromPasos(pasos)` → `hecha` | `listo` | `pendiente` | `sin_paso`
- `labelGuillotinaStatus` → chip corto `G: hecha` / `G: cortar` / `G: espera`
- `guillotinaTooltipLine` → texto largo para tooltip pastilla

### Superficies

| Superficie | UI |
|------------|-----|
| **OTs ejecución** contenedor I/D | Chip visible en fila gorda (`planificacion-ots-ejecucion-tab.tsx`) |
| **Pastillas calendario** I/D | **Sin chip** (se comía el texto). Estado en **tooltip** del contenedor |

### Regla negocio (smoke 98024)

OT con paso Guillotina en itinerario **no aparece en Impresión** hasta cerrar G. Tras cerrar G → Impresión OK. Tras cerrar Impresión → pastilla I **gris + Hecha**; Troquelado T **semáforo verde** → planificable en calendario T (mismo OT, otro paso HR).

---

## 6. Valla LEGACY (`7dc75cb`)

### Diseño (§10 decisión)

Mesa diaria + Mesa semanal = **solo admin y gerencia** durante transición. Pool + OTs ejecución = camino feliz.

### Código

- `src/lib/planificacion-legacy-access.ts` — `canAccessPlanificacionLegacyMesa(role)` vía `hasFullAccess` (`admin`, `gerencia`).
- `planificacion-ots-page.tsx`:
  - Tabs Mesa diaria / Mesa semanal condicionadas + badge **LEGACY**.
  - Default subtab sin permiso: **Pool** (no `diaria`).
  - Redirige si localStorage tenía `diaria`/`mesa` sin rol.
  - Flag `planificacion_ots_ejecucion_enabled` + admin para tab ejecución (sin cambio).

**Smoke admin:** screenshot con LEGACY visible en Planificación OTs.

---

## 7. Smoke planta Manel (tarde / noche)

### OTs laboratorio ≥ 98.000

| OT | Flujo probado |
|----|----------------|
| 98023 | CTP → itinerario → Impresión SpeedMaster |
| 98024 | Guillotina gate → Impresión → cerrar I → gris; T verde en calendario |
| 98025 | Mismo circuito offset |

Filtros ejecución: **SpeedMaster** + «Mostrar OTs prueba».

### Calendario

- **Hoy planificado** en OTs ejecución usa fecha **hoy del sistema**, no el día abierto en calendario.
- Cartela prueba → pip material amarillo (no cuenta ATP planta).
- Movió **36019** Impresión al **28** y **98024** Troquelado al **28** para probar sábado/domingo «Hoy planificado».

### Conceptos aclarados

- OTs ejecución ≠ espejo literal Mañana/Tarde del detalle; orden por `rankPlanHoyByOt`.
- CTP no ordena por detalle del día.
- Misma OT en I gris + T activa = **correcto** (pasos distintos HR).

---

## 8. Pendiente (post 27 ago)

| Ítem | Notas |
|------|-------|
| Brief Jordi/Carlos | Checklist §14 |
| Merge `main` | **Domingo noche** |
| Bloque 12 | Menú feliz / roles UI |
| Drag&drop slots detalle-día | Diferido |
| Semáforos M/T vivos en PDF | Backlog |
| Filtro N días atrasadas | Opcional |

---

## 9. No commitear

- `.MANUALES/MINERVA_MANUAL_CARTELAS_*`
- `.MANUALES/MINERVA_MANUAL_RESERVAS_*`
- `DISQUISICIONES VARIAS MANEL/`

---

*Manel + Cursor · 27 ago 2026 — sesión completa Bloque 11*
