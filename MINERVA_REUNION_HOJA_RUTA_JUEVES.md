# MINERVA — Reunión hoja de ruta (Albert · Jordi · Manel)

**Fecha prevista:** jueves (confirmada por mail Albert)  
**Objetivo:** validar OT contenedor + hijas y hoja de ruta digital; cerrar dudas antes de wizard 8.2 y paso de unión 8.5.  
**Demo:** OT **98010** (`98010-01` / `-02` / `-03`)  
**Rama:** `feature/bloque8.1-pool-mesa-ejecucion-fixes`  
**Guía rápida:** `GUIA_MAÑANA.md`

---

## Mensaje clave (30 s)

Pedidos complejos = **barco** (padre) + **hijas reales** en BD. Planificación agrupada; cada hija ejecuta su ruta. **Material una vez** en el padre.

**No en demo:** wizard crear hijas (8.2), unión de hijas (8.5), cartelas (9).

---

## Contexto presupuesto vs despacho (decisión interna)

| Hoy | Futuro (Bloque 10) |
|-----|-------------------|
| Hijas al **despachar** / producción trocea | Presupuesto define formas; versión **real** al repetir |
| Pocos presupuestos Optimus con todas las formas | Módulo presupuestos Minerva más ágil |

Ver `MINERVA_BLOQUE10_PRESUPUESTOS.md`.

---

## Recorrido demo (~5–10 min)

1. **Pool OTs** — `98010` expandible, % pasos, material barco  
2. **Pipeline** — hijas a distinto avance  
3. **Mesa diaria** — Speed pool vacío; CTP solo la hija que toque  
4. **Hoja de ruta `98010-01`** — CTP → impresión → troquel  
5. **OTs despachadas / Maestro OTs** — vista agrupada barco (nuevo 8.1.2)

---

## Preguntas para rellenar en reunión

### Despacho y estructura

| # | Pregunta | Respuesta |
|---|----------|-----------|
| A1 | ¿Quién define las hijas al despachar? | |
| A2 | ¿Fecha entrega común con contenedor? | |
| A3 | ¿Compra conjunta en barco? | |
| A4 | ¿Itinerario distinto por hija? | |

### CTP y planificación

| # | Pregunta | Respuesta |
|---|----------|-----------|
| B1 | ¿CTP compartido o por hija? | |
| B2 | ¿Hijas en paralelo o secuencia? | |
| B3 | ¿Maquinista ve pedido completo o solo hija? | |

### Hoja de ruta

| # | Pregunta | Respuesta |
|---|----------|-----------|
| C1 | ¿Merma `brutas − merma = netas` OK? | |
| C2 | ¿Troquel desde salida impresión OK? | |
| C3 | ¿Horas por forma/hija o totales? | |

### Punto de unión (post-demo, diseño 8.5)

| # | Pregunta | Respuesta |
|---|----------|-----------|
| D1 | ¿Dónde convergen hijas en estuches (98010)? | |
| D2 | ¿Engomado conjunto o por referencia? | |
| D3 | ¿Quién registra el paso unión? | |

---

## Notas de la reunión

**Asistentes:**  
**Acuerdos:**  
**Siguiente paso:**
