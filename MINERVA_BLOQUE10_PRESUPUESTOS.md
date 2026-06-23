# MINERVA — Bloque 10: Presupuestos (diseño / roadmap)

> **Estado:** diseño — **no implementado**. Último bloque grande de producción antes de ventas/comercial.
> Complementa `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` (contenedor + hijas) y sustituye gradualmente el flujo presupuesto de Optimus.
> **Última actualización:** 23 jun 2026

---

## 1. Por qué existe este bloque

Optimus genera OTs desde presupuesto con todos los pasos, pero:

- No ayuda bien a definir **formas** y estructura de hijas de forma sencilla.
- En planta, **Carlos (producción) a menudo trocea o recombinar** formas respecto al presupuesto inicial.
- Al repetir un pedido similar, se **copia el presupuesto teórico** otra vez → pérdida de tiempo (no se reutiliza cómo se hizo realmente).

Minerva necesita un módulo presupuestos que:

1. Permita a **oficina técnica / presupuestos** definir formas y estructura de forma más ágil que Optimus.
2. Genere o alimente el **maestro OT** con contenedor + hijas cuando corresponda.
3. Guarde una **versión real** vinculada a lo ejecutado en planta para que la **siguiente copia** traiga hijas y troceo como fueron, no como se estimó la primera vez.

---

## 2. Realidad actual vs futuro

| Hoy (jun 2026) | Futuro (Bloque 10) |
|----------------|-------------------|
| Entrada Optimus → maestro OT (casi todo `simple`) | Presupuesto Minerva → maestro con estructura |
| Hijas se crean al **despachar** (wizard 8.2, puente) o manual/script | Hijas definidas en presupuesto **o** ajustadas al despachar |
| Carlos trocea en producción; no queda en presupuesto | **Versión real** actualiza plantilla para copias |
| Optimus: clonar presupuesto → aceptar → nueva hoja de ruta | Minerva: clonar **estructura validada** + presupuesto |

**Puente hasta Bloque 10:** Fase **8.2** — wizard de hijas **al despachar** el contenedor (refleja cómo trabajáis hoy).

---

## 3. Flujo Optimus de referencia (lo que se quiere mejorar)

```text
Presupuesto (estructura + materiales + pasos)
        ↓ aceptar
OT en maestro — vista única con todo (materiales, paso actual, etc.)
        ↓
Producción

Repetición: buscar OT anterior → presupuesto que la generó → clonar presupuesto → aceptar → nueva OT
```

Incluso OT “sencilla” sin presupuesto nuevo: se localiza el presupuesto histórico, se clona y se acepta.

**Gap:** la estructura ejecutada (troceo real, hijas finales) no vuelve al presupuesto de forma sistemática.

---

## 4. Concepto clave: versión real

| Capa | Contenido |
|------|-----------|
| **Presupuesto comercial** | Estimación de venta: formas aproximadas, tiradas, materiales, márgenes |
| **Estructura ejecutada** | Cómo quedó tras producción: hijas reales (`98010-01…`), hojas, poses, punto de troceo |
| **Plantilla para copiar** | Al duplicar pedido similar: salen hijas y formas **como la última vez que funcionó** |

Fuentes para la versión real:

- Bloque **8** (OT contenedor + hijas en BD)
- Bloque **6** (histórico / snapshot al cerrar OT)
- Despacho y wizard **8.2** (primera vez que se trocea)

---

## 5. Relación con Bloque 8 (hijas)

| Fase | Dónde se definen las hijas |
|------|---------------------------|
| **Ahora → 8.2** | Despacho (wizard) — Carlos puede variar combinación |
| **Bloque 10** | Presupuesto (estructura previa) + opción de ajuste en despacho |
| **Post-ejecución** | Versión real → próxima copia de presupuesto |

**Punto de unión** de hijas (desbroce, contracolado, etc.): ver Bloque 8 §5 y fase **8.5** — se valida con planta (reunión Albert/Jordi); no es parte del Bloque 10 inicial.

---

## 6. Alcance previsto (borrador)

### MVP Bloque 10 (por definir en detalle)

- [ ] Modelo `presupuesto` + líneas / formas / componentes
- [ ] UI sencilla para N formas (límite práctico ~8, como Optimus)
- [ ] Generación de OT contenedor + hijas en maestro al aceptar presupuesto
- [ ] Clonado de presupuesto con **estructura heredada**
- [ ] Enlace presupuesto ↔ OT ejecutada(s)

### Fase 10.1 — versión real

- [ ] Al cerrar OT (Bloque 6): snapshot de estructura ejecutada
- [ ] Actualizar plantilla del presupuesto vinculado (“versión real”)
- [ ] Copiar presupuesto → pre-rellenar hijas como en última ejecución exitosa

### Fuera de alcance inicial

- Integración contable / márgenes avanzados (posible solape con Odoo)
- Sustituir 100 % Optimus presupuesto el día 1 (coexistencia)

---

## 7. Orden en el roadmap global

| Orden | Bloque | Nota |
|-------|--------|------|
| … | 6 Histórico | Base para versión real |
| … | 7 Expedición / Odoo | |
| En curso | 8 Contenedor + hijas | 8.2 despacho; 8.5 unión |
| En curso | 9 Cartelas / stock | |
| **Siguiente grande** | **10 Presupuestos** | |
| Después | 11+ Ventas / comercial / CRM | |

---

## 8. Decisiones registradas (23 jun 2026)

1. **Hoy las hijas se parten en despacho** (pocos presupuestos traen todas las formas exactas; Carlos ajusta combinación).
2. **Objetivo:** presupuestos (oficina técnica) definan formas de forma sencilla; Optimus no es el modelo a copiar en UX.
3. **Versión real** es requisito de negocio para no repetir trabajo en pedidos recurrentes.
4. **8.2 al despachar** es el puente correcto hasta que exista Bloque 10.
5. Bloque 10 va **después** de cartelas (9) y cierre/histórico (6); **antes** de ventas/comercial.

---

## 9. Preguntas abiertas (para cuando se abra el bloque)

1. ¿Presupuesto y OT 1:1 o 1 presupuesto → N OTs (repeticiones)?
2. ¿Quién puede aceptar presupuesto → maestro (solo oficina técnica)?
3. ¿Versión real automática al cerrar OT o revisión manual?
4. ¿Coexistencia con import Optimus durante transición?
