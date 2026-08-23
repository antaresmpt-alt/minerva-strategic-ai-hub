# Sesión 22 ago 2026 noche — Bloque 11 contenedor: smoke OK 🎉

> **Rama:** `feature/bloque11-contenedor-ctp-spike`  
> **Doc diseño + detalle técnico:** `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` (§17–22)  
> **Merge a `main`:** pendiente OK Manel / planta (Ramón lunes)

---

## Celebración (qué avanzamos hoy)

Sustituimos la puerta **Pool/Mesa/Optimus** por **contenedor pull** en ejecución:

1. El itinerario deja el paso en `disponible`.
2. El operario lo ve en «OTs en ejecución» (badge Contenedor …).
3. **Iniciar** (claim si hay varias máquinas) → ejecución ligera (`mesa_trabajo_id = null`).
4. Cerrar → el siguiente paso del itinerario aparece solo.

Probado de punta a punta en planta (lab + OTs reales 35900 / 35904).

---

## Matriz smoke

| Escenario | Resultado |
|-----------|-----------|
| CTP → Troquel (claim) → Desbroce → Engomado (lab) | OK |
| **35900** Guillotina → Digital (claim Xerox) → Troquel → Engomado (sin desbroce) | OK — itinerario 100 % |
| Hojas Digital→Troquel: 1050 al Iniciar (no 1200 despacho) | OK |
| **35904** Offset Contenedor → Troquel | OK |
| Lista SpeedMaster CD 102 llena de Contenedor Impresión | OK |
| Cartela obligatoria al cerrar Offset (1 de 6 palets) | OK smoke; multi mañana |

---

## Fix post-smoke (código)

**Problema:** Troquel/Engomado finalizados mostraban **«0 min»** en la línea gorda; Impresión/Digital solo contaban tiraje, no entrada+impresión.

**Causa:** `buildEjecucionHorasSyncPatch` no rellenaba `horas_reales` (lo que pinta la lista) en T/E; en I/D ponía solo impresión.

**Solución:** `src/lib/planificacion-ejecucion-horas.ts` — total declarado → `horas_reales` + desglose. Tests en `planificacion-ejecucion-horas.test.ts`.

**Nota:** filas ya cerradas con «0 min» no se recalculan solas (lab).

---

## Mañana

1. **Multi-cartela** al cerrar (ej. 300 de #10234 + 1400 de #10235) — hermana de 35904.
2. Re-smoke cierre Troquel/Engomado → línea gorda con prep+tiraje.
3. (Opcional) Manipulados / interiores cuando toque calendario.

**No bloquea contenedor:** ordenar por fecha en ejecución → viene con bandeja/calendario.

---

## Update 23 ago — multi-cartela al cerrar ✅

**Código:** `cartela_consumos[]` en `datos_proceso` + UI «Añadir otro consumo» (`cartela-cierre-block.tsx`).  
Cada línea → RPC `prod_stock_registrar_consumo`. Legacy (`id_stock_cartela` + total hojas) se sincroniza para PDF.  
Aviso si hojas > stock del palet (no bloquea). Sobrante = misma cartela con `cantidad_actual` baja; liberar a libre = 9.8 Juan/oficina.

**Smoke sugerido:** hermana 35904 / Offset con 2+ palets (p.ej. 300+#10234 + resto de otro).

---

## Commits spike (referencia)

Ver log de la rama: contenedor CTP → Troquel claim → G/D/M/E → Impresión/Digital → fix Vercel tsc → **fix horas**.

---

*Manel + Cursor · noche 22 ago 2026*
