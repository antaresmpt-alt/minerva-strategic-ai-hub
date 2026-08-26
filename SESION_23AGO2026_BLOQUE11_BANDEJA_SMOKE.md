# Sesión 23 ago 2026 — Bloque 11 fase 1b: bandeja + calendario smoke OK 🎉

> **Rama:** `feature/bloque11-contenedor-ctp-spike`  
> **Diseño:** `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` §5 · §23  
> **Código:** `calendario-bandeja.ts` · `calendario-bandeja-panel.tsx` · wiring en `calendario-produccion-page.tsx`  
> **Merge a `main`:** pendiente OK Manel / planta

---

## Celebración

Sustituimos las **hojas HR de Optimus** (mesa Carlos) por **bandeja computada** en el Calendario Producción:

1. Panel izquierdo: OTs **despachadas sin pastilla** del ámbito activo (I/D/T/E).
2. «Colocar en calendario…» → pastilla; desaparece de bandeja.
3. Quitar pastilla del día → vuelve a bandeja (tras recargar).
4. Semáforo en bandeja y pastillas = estado HR del ámbito (verde listo / amarillo esperando / navy Hecho HR).
5. Cerrar proceso en contenedor (p.ej. Engomado 99910) → pastilla pasa a **Hecha** sin marcar checkbox a mano.

Smoke planta Manel **23 ago mediodía** — I/D/T/E + loop ejecución↔calendario **OK**.

---

## Matriz smoke (23 ago)

| Escenario | Resultado |
|-----------|-----------|
| Toggle bandeja ocultar/mostrar | OK |
| Bandeja I / D / T / E cambian OTs | OK |
| Filtro texto + OTs prueba | OK |
| «Ver todas» I/D = mismo set; T/E cambia conteo (cadena) | OK |
| Colocar → sale de bandeja · borrar día → vuelve (recargar) | OK |
| Resumen rápido + HR desde bandeja | OK |
| Semáforo: 35187 T verde; 35380 T amarillo (externo upstream) | OK |
| Engomado E: manipulados cuentan como ámbito E (diseño) | OK — no bug |
| 99910 Engomado cerrar → pastilla **Hecha** (gris HR) + fuera bandeja | OK (26 ago: gris = HR o ✓) |
| PDF grid / PDF listado | OK — ver matices abajo |
| Solo pendientes | OK 26 ago — oculta HR hecho **y** ✓ Carlos |

---

## Responsables / ámbitos (recordatorio)

| Ámbito calendario | Quién |
|-------------------|-------|
| **I** Impresión | Carlos (+ Jordi) |
| **D** Digital | Rita |
| **T** Troquelado | Antonio |
| **E** Engomado (+ manipulados) | Gabri |

**Sin calendario propio (contenedor):** CTP (Gemma se guía con **PDF/listado I de Carlos**), Guillotina (Miguel), Desbroce.

---

## Pulidos post-smoke (mismo día)

- Altura bandeja acotada al viewport + **scroll interno** (no desborda el calendario).
- Icono bandeja HR: **mapa** (`Map`), coherente con hoja de ruta.
- Toggle no desmonta el panel → **no recarga** al reabrir.
- Subtítulo E: «Engomado + manipulados (ámbito E)».

## Pulidos 26 ago (noche)

- **Hecho visual:** pastilla gris «Hecha» si `marcado_hecho` **o** semáforo ámbito = hecho (HR). «Solo pendientes» filtra ambos. Checkbox Carlos = transición.
- **Altura bandeja:** = altura del grid (sin tope viewport); crece/encoge a la par del calendario.
- PDF (grid/listado/día): respetan `hechoVisual`.

---

## Matices producto (no bloquean 1b)

1. **PDF grid/listado** usan checks **Ver I/D/T/E** (overlay). Título lleva ámbito activo; contenido = lo visible. Gemma = poner **Solo I** + PDF listado/semana.
2. **PDF día** ya existe dentro del modal «OTs y notas del día» (no en toolbar principal).
3. Externos: no auto-gris de pastillas internas; siguen en módulo Externos.

---

## Siguiente (Track B)

1. **Fase 3** detalle del día Carlos — aplicar migración + UI (spike §6.5 B cerrado).  
2. Brief Jordi/Carlos · valla LEGACY por rol.  
3. (Bloque 12) menú Planificador / roles.  
4. Backlog: estado Guillotina visible en I/D (Rita/Ramón).

---

*Manel + Cursor · 23 ago 2026 mediodía*
