# MINERVA — Briefing Bloque 8: Formatos de hoja + Formas de impresión (OT madre / hijas)

> Documento autocontenido para diseño funcional y arquitectura.
> Tema: cómo modelar formatos que cambian por proceso y pedidos con varias referencias/formas de impresión.
> Complementa a `FASES_HOJA_RUTA_DIGITAL.md`, `FASES_MAESTRO_ARTICULOS.md` y `MINERVA_HUB_CONTEXTO_MAESTRO.md`.
>
> Fecha: 16 de junio de 2026 (sesión de brainstorming, sin implementación).

---

## 1. Contexto: por qué salió este tema

El modelo actual de Minerva asume **1 OT = 1 referencia = 1 formato = 1 poses** en despacho (`produccion_ot_despachadas`).

En planta real ocurren dos cosas que ese modelo no expresa bien:

1. **El formato no es único**: el material se compra a un tamaño (ej. 72×102), se corta en guillotina (ej. 51×72), se imprime, se troquela y a veces se envía a externo con otro formato de referencia.
2. **Un pedido puede llevar varias referencias en una o más formas de impresión**: mismo troquel, combinación de modelos en la misma hoja, prep+tiraje por forma, y a veces rutas distintas (forro con stamping, dorso sin stamping).

En Optimus esto se resuelve con **árbol y sub-árbol**: un pedido genera sub-unidades (ej. `35.698.100` … `35.698.103`, o `356901` … `356908` cuando son 4 formas × 2 caras). Cada sub-unidad tiene **PRE + TIR** propios.

En Minerva no queremos **inundar listados** con cientos de OTs sueltas. La decisión de diseño acordada es la metáfora del **barco**:

- **1 OT madre (contenedor)** visible en pipeline, despacho y listados.
- **N hijas (formas)** dentro del barco, ejecutables con detalle propio, **sin multiplicar OTs en pantalla**.

---

## 2. Problema A — Formato de hoja (cadena, no atributo único)

### Situación actual

- `tamano_hoja` en despacho se usa de facto como **formato de compra** (lo que compra Jordi).
- No es necesariamente el formato de **impresión**, ni de **troquelado**, ni el que interesa en **externo**.

### Flujo real típico

```text
Compra 72×102
  → Guillotina corta a 51×72
  → Impresión en 51×72
  → Troquelado (tamaño de corte propio)
  → Externo (formato de envío/recepción si aplica)
```

### Lo que ya tenemos (aprovechable)

En `hoja-ruta-campos-config.ts` y `datos_proceso` ya existen campos por proceso:

| Proceso | Campo formato |
|---------|----------------|
| Guillotina | `tamano_inicial` → `tamano_final` |
| Impresión | `formato_hojas_impresion` |
| Troquelado | `tamano_corte` |

Falta **encadenar** formato igual que encadenamos hojas (salida anterior → entrada del siguiente paso).

### Propuesta (Fase 8.1 — implementación acotada)

1. **Semántica en despacho**: `tamano_hoja` = **formato de compra** (etiquetar explícitamente en UI).
2. **Encadenado de formato**: `tamano_final` (Guillotina) prefill → `formato_hojas_impresion` (Impresión) → `tamano_corte` (Troquelado).
3. **Maestro** (futuro): separar `formato_compra_habitual` y `formato_impresion_habitual` en `prod_referencias` (hoy solo hay dimensiones de producto terminado).

**Dependencias:** ninguna del tema formas. **Prioridad:** primera implementación del Bloque 8.

**Coste estimado:** medio-bajo (ampliar helper de `salidaAnterior` para canal texto/dimensiones además de números).

---

## 3. Problema B — Pedidos multi-referencia y formas de impresión

### Ejemplo real (50.000 estuches, 4 modelos, troquel 4 poses)

| Modelo | Cantidad |
|--------|----------|
| Mod 1 | 10.000 |
| Mod 2 | 10.000 |
| Mod 3 | 20.000 |
| Mod 4 | 10.000 |

**Forma A** — 10.000 hojas, poses: mod1×1 + mod2×1 + mod3×2 (4 poses) → 10k + 10k + 20k estuches.

**Forma B** — 2.500 hojas, poses: mod4×4 → 10k estuches.

Aguas arriba (CTP, impresión, troquelado, desbroce) se trabaja **por forma**.
Aguas abajo (engomado, embalaje, stock, albarán) se trabaja **por referencia** — el operario engoma unidad a unidad; le importa qué referencia es cada cosa.

**Punto de corte acordado:** la separación por referencia/modelo ocurre **tras Desbroce**.

---

## 4. Qué NO basta: JSON informativo de formas

Se valoró guardar en `datos_proceso` de Impresión algo como:

```json
{
  "num_formas": 2,
  "formas": [
    { "forma": 1, "hojas": 10000, "refs": "mod1×1, mod2×1, mod3×2", "poses": 4 },
    { "forma": 2, "hojas": 2500, "refs": "mod4×4", "poses": 4 }
  ]
}
```

**Sirve** si las formas son solo nota para CTP/maquinista y las horas son **siempre totales**.

**No sirve** si el operario (Abraham) a veces apunta **horas por forma** (prep + tiraje separados), como en Optimus.

Visita a planta (16 jun): a veces dan horas totales; otras veces detalle fino por forma. **Conclusión:** hace falta un modelo que permita captura **por forma**, no solo JSON descriptivo.

---

## 5. Arquitectura elegida (dirección, pendiente de diseño detallado)

### Metáfora del barco

```text
OT 35698 (madre / contenedor / barco)     ← 1 fila en pipeline y despacho
├── Forma F1 (hija)                       ← tabla interna, no OT suelta en listado
├── Forma F2
├── Forma F3
└── Forma F4
```

- Las hijas **comparten** cliente, pedido, troquel habitual, material común (salvo excepciones).
- Cada hija tiene: refs/componentes, poses, hojas previstas, **prep + tiraje** propios.
- El maquinista puede hacer "ahora F2, luego F3" o todas seguidas.
- Cuando **todas las hijas** han completado **su** ruta → la madre pasa a cierre / `pendiente_revision`.

### Optimus como referencia

- Pedido `35.981` → sub-unidades `3.598.100` … `3.598.103` con tipos PRE, HOJA EXT, HOJA INT, PKG.
- En otro caso: 4 formas × 2 caras = 8 unidades (`356901` … `356908`).
- Siempre **PRE + TIR** por unidad de ejecución.

Minerva debe lograr lo mismo **sin** mostrar 1000 OTs en el pool principal.

### UI propuesta (concepto)

| Vista | Qué muestra |
|-------|-------------|
| Pipeline / pool / despacho | Solo OT madre `35698` |
| Detalle OT / ejecución | Pestaña o panel **Formas** con F1…Fn |
| Mesa de ejecución | Operario trabaja la **forma activa**; tarjeta con pasos de esa hija |
| Engomado | Por **referencia/componente** (tras desbroce) |

---

## 6. Itinerario por forma (caso raro pero real)

Casi siempre todas las formas comparten ruta. **Excepción:** una forma va a un externo y otra no.

Ejemplo:

```text
F1 Forro  → CTP → Impresión → Troquel → Stamping (externo) → Desbroce → …
F2 Dorso  → CTP → Impresión → Troquel → Desbroce → …
```

### Regla de diseño

> **Itinerario por forma**, con **plantilla común** en la madre y **override excepcional** por hija.

| Situación | Acción |
|-----------|--------|
| Todas las formas misma ruta | Plantilla en madre → clon a todas las hijas al despachar |
| Una forma distinta | Editar solo el itinerario de esa hija |
| Cierre del barco | Madre cerrada cuando cada hija termina **su** lista de pasos |

**No recomendado:** un solo itinerario en la madre con pasos "solo para F1" mezclados en la misma tarjeta.

---

## 7. Opciones descartadas o diferidas

| Opción | Veredicto |
|--------|-----------|
| A) Solo JSON de formas en `datos_proceso` | Insuficiente para horas por forma |
| B) N OTs sueltas en listado (`356901`, `356902`…) | Correcto funcionalmente pero **rechazado en UX** (océano de OTs) |
| C) Forma = OT técnica oculta del listado | Variante de B; posible si el listado filtra por madre |
| **D) OT madre + tabla `prod_ot_formas` + itinerario por hija** | **Dirección elegida** |

La arquitectura actual (pool, mesa, `datos_proceso`, hoja de ruta) **no se tira**; se **extiende** con un nivel intermedio.

---

## 8. Modelo de datos (borrador, no implementado)

Tablas candidatas (nombres provisionales):

### `prod_ot_formas` (hijas)

| Campo | Uso |
|-------|-----|
| `id` | PK |
| `ot_numero` / `ot_id` | FK a OT madre |
| `numero_forma` | 1, 2, 3… o código F1, F2 |
| `descripcion` | ej. "Cara 1", "Forro", "Dorso" |
| `hojas_previstas` | |
| `poses_totales` | suma poses de la forma |
| `estado` | pendiente / en_marcha / finalizado |
| `notas` | |

### `prod_ot_forma_componentes` (refs dentro de una forma)

| Campo | Uso |
|-------|-----|
| `forma_id` | FK |
| `referencia_id` | FK `prod_referencias` |
| `poses` | poses de ese modelo en la forma |
| `cantidad_objetivo` | estuches objetivo de ese componente |

### Itinerario y ejecución

- Opción preferida: `prod_ot_pasos.forma_id` nullable (NULL = paso de madre legacy; NOT NULL = paso de esa forma).
- `prod_mesa_ejecuciones` enlazada al paso de la forma correspondiente.
- `datos_proceso` sigue en el paso; prep/tir por forma viven en los pasos de impresión de cada hija.

**Pendiente decidir:** ¿material y compras son del barco entero o por forma?

---

## 9. Captura en planta — prep + tiraje

Optimus siempre separa **PRE** (preparación) y **TIR** (tiraje).

En Minerva ya existe en Impresión: `horas_entrada` (prep) y `horas_tiraje`, previsto/real.

Con formas:

| `num_formas` | UI |
|--------------|-----|
| 1 | Un bloque prep/tir (como ahora) |
| >1 | Total del paso **+** sección colapsable "Detalle por forma" (prep/tir por F1, F2…) — **opcional** si el operario solo da total |

No obligar siempre al detalle; pero el **modelo** debe tener sitio para cuando Abraham viene "superdetallado".

---

## 10. Roadmap propuesto (fases)

### Fase 8.1 — Formato de hoja (primera sesión de código)

- Encadenado compra → guillotina → impresión → troquelado.
- Etiquetas UI en despacho.
- Sin tocar formas ni multi-referencia.

### Fase 8.2 — Diseño cerrado + preguntas a planta

- Validar con Abraham / Carlos / Jordi (ver §11).
- Cerrar esquema de tablas y UX del panel Formas.
- Documento de migración y impacto en mesa/pipeline.

### Fase 8.3 — MVP formas (solo despacho + informativo)

- Definir formas y componentes al despachar.
- Mostrar en hoja de ruta y CTP/impresión (hojas por forma).
- Sin horas por forma aún.

### Fase 8.4 — Ejecución por forma

- Mesa y tarjeta de ejecución filtradas por forma activa.
- Prep/tir por forma (opcional).
- Itinerario clonado por hija; override manual.

### Fase 8.5 — Engomado por componente

- Tras desbroce: cantidades y captura por referencia.
- Semáforo/proyección por componente (hoy asume poses uniformes).

---

## 11. Preguntas abiertas (responder antes de implementar formas)

1. ¿Quién crea las sub-unidades en Optimus: el sistema al despachar o Jordi a mano?
2. ¿El maquinista ve el pedido completo o solo "la forma de ahora"?
3. ¿Material es uno para todo el barco o puede variar por forma?
4. ¿Las 8 "formas" de Optimus son siempre **cara = forma** u otra lógica?
5. Cuando Abraham detalla: ¿prep y tir **por forma** o solo tiraje por forma?
6. ¿Externo y troquelado siguen el mismo split que impresión?
7. ¿El cierre del barco es automático al terminar todas las hijas o siempre revisión humana (alineado con Bloque 6)?
8. Cuando forro va a stamping y dorso no: ¿en Optimus son sub-OTs distintas o ramas del mismo árbol?

---

## 12. Relación con otros bloques

| Bloque | Relación |
|--------|----------|
| **Maestro artículos** (Fase 2) | Auto-enriquecimiento al despachar; independiente de formas. Formato compra/impresión en maestro pendiente. |
| **Bloque 6** (histórico) | Snapshot del barco completo + columnas planas; posible detalle por forma dentro del JSON. |
| **Bloque 7** (albarán) | Expedición probablemente por referencia/componente, no por forma. |
| **Cartelas / stock** | Tema futuro; no diseñado aún. |

---

## 13. Sesión 16 jun 2026 — Resumen de decisiones

- Merge `feature/fase0.6-hoja-ruta-virtual` → `main` completado (conflicto doc resuelto).
- **No implementar formas hoy** — requiere sesión de diseño y respuestas de planta.
- **Sí priorizar formato de hoja** como primer paso de código del Bloque 8.
- Arquitectura objetivo: **OT madre + N hijas en tabla**, no OTs sueltas en listado.
- Punto de corte: **tras Desbroce** → trabajo por referencia.
- Itinerario **por forma** con plantilla común y override excepcional (forro/dorso).
- JSON solo informativo **descartado** como solución única (insuficiente para horas por forma).

### Próxima sesión recomendada

1. Implementar **Fase 8.1** (encadenado de formato).
2. O, si antes hay reunión con planta: rellenar §11 y cerrar modelo de tablas.

---

## 14. Prompt sugerido para brainstorming

```text
Te paso el briefing del Bloque 8 de Minerva (formatos + formas de impresión).
Minerva sustituye a Optimus en una imprenta/packaging.

Quiero validar el modelo OT madre + hijas (barco) sin inundar listados.
Prioridad inmediata: encadenado de formato de hoja.

Devuélveme:
1. Riesgos del modelo madre/hijas.
2. Esquema SQL mínimo viable para Fase 8.3.
3. Impacto en planificacion-mesa y ExecutionCard.
4. Orden de implementación recomendado.

--- BRIEFING ---
<pegar MINERVA_BLOQUE8_FORMAS_Y_FORMATOS.md>
```
