# Sesión 26 ago 2026 — Spike §6.5 persistencia detalle del día ✅

> **Rama:** `feature/bloque11-contenedor-ctp-spike`  
> **Brief:** `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` §6.5  
> **Migración (fase 3, no aplicada aún):** `supabase/migrations/20260826200000_prod_calendario_detalle_dia.sql`

---

## Decisión

**Opción B — tabla ligera `prod_calendario_detalle_dia`.**  
No reutilizar `prod_mesa_planificacion_trabajos`.

---

## Due diligence: ¿coexistencia en la misma tabla?

Si detalle-día escribiera en `prod_mesa_planificacion_trabajos` junto a Pool/LEGACY:

| Hallazgo | Efecto |
|----------|--------|
| `ux_mesa_ot_activa` (OT + máquina, estados activos) | **Choque** misma OT Pool + detalle |
| `mesa_trabajo_id` + trigger finaliza → `estado_mesa` | Semántica de ejecución de mesa |
| Contenedor ya usa `mesa_trabajo_id = null` | Camino feliz ≠ mesa |
| `calendario-mesa-espejo.ts` | Mentiría «en mesa» con filas de planning |
| `origen_pool_id`, ciclo `estado_mesa` | Pensado para Pool/`launchExecution` |
| LEGACY por rol | Misma tabla = aislamiento frágil |

→ **A descartada.** B zanjada.

*(Fix horas «Cerrar proceso» 23 ago: solo `prod_mesa_ejecuciones` / `datos_proceso` — no tocó la tabla de mesa. Spike limpio.)*

---

## Modelo

```
calendario (pastilla día) ──CASCADE──► detalle_dia (máquina/turno/slot/horas)
                                              │
                                              ▼ lectura orden
                                    contenedor ejecución
                                    (Hoy planificado ∩ disponible
                                     + cola por fecha entrega)
```

- **Itinerario autoriza; detalle solo prioriza.**
- Huérfanas: CASCADE al quitar pastilla; no auto-borrar planes del día no cumplidos (Carlos debe ver la rotura).

---

## Diseño cerrado junto al spike

1. **Ejecución:** 2 grupos visuales (Hoy / Disponibles).  
2. **Material en calendario:** icono no bloqueante; color = Pool `materialStatus` + gris N/A; compra en tooltip. Verde = cartelado ≥ objetivo.  
3. **Nav:** no bautizar «Planificador» ahora (Bloque 12). Sí: entrada detalle desde calendario; valla LEGACY por rol cuando toque (§10).  
4. **Backlog:** exponer «Guillotina cortado / pendiente» en contenedor I/D (dolor Rita/Ramón) — no bloquea fase 3.

---

## Siguiente (fase 3)

1. ~~Aplicar migración~~ ✅  
2. ~~UI detalle del día~~ ✅ v2 draft + mañana/tarde + Guardar + PDF + sync orden calendario  
3. ~~Pegar OT → final secuencia destino~~ ✅  
4. Contenedor: orden «Hoy» por `slot_orden` ✅ (I/D/E; grupos visuales pendientes)  
5. Pendiente: drag&drop · cajón atrasadas · badge visual «Hoy» en lista ejecución  

---

*Manel + Cursor · 26 ago noche spike + fase 3 v1/v2 UX*
