# Bloque 11 — §9: Calendario, contenedor y lanzamiento (decisión de diseño)

> **Fecha:** 21 ago 2026 (rev. noche · **PR1 implementado en código**) · **Estado:** modelo híbrido = **propuesta** (pendiente Jordi/Carlos) · **PR1 en app** · Modelo B / CTP momento 0 documentados sin picar
> **Origen:** petición Albert/Jordi tras uso real del calendario (jul–ago 2026) + sesión de diseño Manel + Claude + Cursor
> **Complementa:** `MINERVA_BLOQUE11_CALENDARIO_MAESTRO_LANZAMIENTO.md` (§0–§8, brainstorming 11 ago)
> **Pendiente de validar con planta:** Jordi (lunes) · Carlos (31 ago) · **smoke PR1**
> **Fuera de PR1 (siguiente hilo):** CTP «momento 0» (Paula ve CTP `disponible` sin Mesa) — este puente no lo resuelve.

---

## 1. El nudo conceptual (y su desatado)

La duda que bloqueaba el diseño, en palabras de Manel:

> *"el calendario puede decir misa pero si una OT no tiene papel o está en CTP, por mucho que me digas que se troquela hoy, no se troquela hoy ni de broma"*

No hay contradicción. Son **tres capas distintas** que hoy están mezcladas mentalmente:

| Capa | Qué responde | Dónde vive hoy | Quién la mueve |
|------|--------------|----------------|----------------|
| **Calendario** | ¿Cuándo QUIERO que se haga? ¿En qué orden? | `prod_calendario_produccion_ot` | Carlos, Antonio, Gabri, Rita |
| **Itinerario** | ¿Qué se PUEDE hacer ahora? | `prod_ot_pasos.estado = 'disponible'` | El sistema (secuencia de pasos) |
| **Ejecución** | ¿Quién lo hace y en qué máquina? | `prod_mesa_ejecuciones` | Operario / responsable |

**Regla que desata el nudo:**

> **El calendario ORDENA. El itinerario AUTORIZA.**

El contenedor (OTs en ejecución) muestra **lo que se puede hacer** (itinerario), **ordenado por lo que se quiere** (fecha de calendario). Sin conflicto: responden preguntas diferentes.

Es el mismo principio de *"el estado nunca miente"* del Bloque 9, aplicado a planificación: el itinerario es **estado**; el calendario es **plan**. El plan puede estar equivocado; el estado no.

---

## 2. Lo que realmente pidieron Albert y Jordi

**No pidieron un rediseño.** Pidieron **no tener que ir a otra pantalla después de planificar**.

Hoy el circuito es: colocar pastilla en calendario → ir al Pool → pasar a mesa → colocar día/máquina/orden → confirmar plan → lanzar.

Lo que sobra en el camino feliz es el **paso por el Pool**: si el calendario ya dice "esta OT va el día 20, ámbito Impresión", esa decisión ya está tomada. Eso se resuelve con un botón, no tirando Pool y Mesa.

La visión del "contenedor plano" (§5 de este documento) es una idea **propia de Manel**, surgida al pensar el problema — es interesante y puede ser el futuro, pero es otra conversación y no es lo que se pidió.

---

## 3. Bloqueo técnico que condiciona todo

**`prod_mesa_ejecuciones` exige máquina, mesa y slot.** `launchExecution` falla literalmente con *"La OT no tiene máquina asignada"*.

Es decir: **la lista del operario existe hoy PORQUE alguien pasó por la mesa.**

Consecuencia directa: "lanzar a saco a un contenedor" no es un botón — es cambiar de dónde se alimenta esa lista (de pasos disponibles, no de mesa). Es **motor, no UI**.

Corolario no obvio: **el slot de mesa está resolviendo hoy, sin que nadie lo diseñara así, el problema de concurrencia** que Manel identificó (*"si uno selecciona una, el otro no podría tocarla"*). Si se quita la mesa, hay que construir un mecanismo de *claim* explícito.

---

## 4. §4.1 PROPUESTA — Modelo híbrido: mesa opcional por área

> **No está “decidido”.** Es la propuesta de diseño a validar con Jordi (lunes) y Carlos (31 ago). Hasta entonces: no picar Modelo B; el PR1 vale con o sin híbrido.

**No es "contenedor SÍ" o "mesa SÍ". Es mesa donde aporta, contenedor donde estorba.**

El criterio no es el número de máquinas, es **si el orden importa**:

| Área | Máquinas | ¿Importa el orden del día? | Modelo propuesto |
|------|----------|---------------------------|------------------|
| **Impresión Offset** | 1 | **Sí** — secuencia y horas de turno mandan | **Mesa** |
| **Impresión Digital** | 2 | Según Rita | Mesa (si Rita la quiere) |
| **Troquelado** | 4 | No — cualquiera coge | Contenedor |
| **Engomado** | 3 | No — cualquiera coge | Contenedor |
| **CTP** | — | No | Contenedor |
| **Guillotina** | 1 | Poco | Contenedor |
| **Desbroce / Manipulados** | 1 | No | Contenedor |

**Lógica:** con **una sola máquina**, el orden del día es la decisión importante → la mesa (drag & drop, cálculo de horas por turno) es exactamente donde está el valor. Con **varias máquinas**, cualquiera puede coger el siguiente trabajo → la mesa solo añade fricción.

**Consecuencia:** el trabajo hecho en Pool/Mesa **no se tira**. Se reutiliza donde aporta y se deja de imponer donde estorba.

---

## 5. Los dos modelos, con su precio

### Modelo A — Mesa opcional (PR1, barato)

El calendario deja la OT en la cola lateral de mesa (`estado_pool = 'enviada_mesa'`, exactamente lo que hace hoy `pasarAMesa`). El responsable sigue usando la mesa para colocar día/máquina/orden.

- ✅ Elimina el paso por el Pool en el camino feliz
- ✅ Cero migraciones; reutiliza el gate de material **a nivel OT** que existe hoy (ver §6.6)
- ✅ No rompe el modelo mental de Carlos/Antonio/Gabri/Rita
- ✅ `pasarAMesa` extraída a `src/lib/planificacion-pasar-a-mesa.ts`

### Modelo B — Contenedor real (post-TEST, motor)

El operario ve sus pasos disponibles ordenados por fecha de calendario; al iniciar se registra usuario + máquina.

Necesita:
1. Alimentar la lista desde **pasos disponibles**, no desde mesa
2. Elegir máquina **al iniciar**, no al planificar
3. Mecanismo de **claim/reserva** (que hoy resuelve el slot de mesa implícitamente)

- ✅ Un solo sitio mental para planta
- ✅ Coherente con cómo trabajan hoy en Optimus (cogen de una lista, sin orden estricto)
- ⚠️ Se pierde cálculo de horas por turno y drag & drop de secuencia (crítico en offset)
- ⚠️ Toca el motor que planta usa a diario, a semanas del TEST
- ⚠️ Riesgo primo hermano del Bloque 12

---

## 5bis. Ciclo de autoridad (quién manda en cada fase)

Calendario y Mesa son sistemas **paralelos** hoy (cero JOIN, cero FK). No hay que decidir “quién manda siempre”: hay que decir **quién manda en cada fase**. El PR1 **lee** ese ciclo; no escribe sincronización.

| Fase | Qué ha pasado | Quién manda | Qué muestra la pastilla |
|------|---------------|-------------|-------------------------|
| **Planificada** | Pastilla en calendario; aún no enviada | **Calendario** (intención) | Fecha del calendario |
| **En cola** | Botón → `estado_pool = 'enviada_mesa'` | **Calendario** sigue (aún **no hay** `fecha_planificada` en Mesa) | Fecha intención + badge «En cola» |
| **Colocada en Mesa** | Responsable arrastra día/máquina/turno | **Mesa** (fecha operativa) | Fecha calendario + espejo «Mesa: DD/MM» si difiere |
| **En curso / hecha** | Paso iniciado o finalizado | **Itinerario** (estado) | Semáforo + label de paso |

**Implicación clave (spike 21 ago):** al pulsar el botón que reutiliza `pasarAMesa` **no se escribe ninguna fecha** en Mesa — solo el estado de pool. La segunda fecha nace **después**, al colocar.

**Opción elegida para PR1:** espejo de lectura, sin sync de escritura.

---

## 5ter. CTP — fuera de PR1 (siguiente hilo)

Hoy en Optimus: en el **momento 0** de generar/despachar la OT, CTP ya puede abrirla. Eso **no** lo arregla el puente calendario→cola Mesa (incluso puede empeorar el modelo mental si se confunde con “Paula ya puede”).

| | Impresión / Offset | CTP |
|---|---|---|
| ¿Sirve PR1? | Sí | **No** es la solución |
| ¿Cuándo trabajar? | Cuando se planifica / envía | **Momento 0** de la OT |
| Siguiente paso | Smoke PR1 | **CTP momento 0** (lista por paso `disponible` sin Mesa) |

Acuerdo Manel 21 ago: **primero smoke PR1; CTP después**.

---

## 6. Decisiones (cerradas vs pendientes)

| # | Decisión | Estado | Motivo |
|---|----------|--------|--------|
| 6.1 | **Colocar en calendario ≠ enviar a cola** | Cerrada | Gate explícito; no equiparar. |
| 6.2 | **Mantener ámbitos I/T/D/E** | Cerrada | + label paso en pastilla. |
| 6.3 | **MVP sin slot** | Cerrada | Cola sin máquina/día/turno. |
| 6.4 | **Mesa opcional por área** | **Propuesta** (§4) | Validar Jordi/Carlos. |
| 6.5 | **Movimiento de pastillas** | Cerrada en principio | Lab si Mesa/en curso. |
| 6.6 | **Gate de material por proceso** | **Pendiente — no existe** | PR1 = gate OT. |
| 6.7 | **Nombre del botón** | Cerrada | «Enviar a cola de Mesa». |
| 6.8 | **Espejo de lectura Mesa** | Cerrada (PR1) | Solo lectura. |
| 6.9 | **CTP momento 0** | **Fuera de PR1** | Hilo aparte post-smoke. |

### 6.6 Gate de material — corrección explícita

**Falso (versión anterior):** *«la regla ya existe, solo hay que aplicarla por proceso»*.

**Hecho:** `isPoolRowSelectableForMesa` solo mira OT: no contenedor; `hasCompraGenerada || hojasStockCartelado > 0`. No sabe si es CTP o guillotina.

**PR1:** gate OT. **Post-PR1:** gate por proceso.

---

## 7. PR1 — Implementado (8 puntos)

Código (21 ago noche):

| Pieza | Dónde |
|-------|--------|
| Lib enviar cola | `src/lib/planificacion-pasar-a-mesa.ts` |
| Espejo lectura | `src/lib/calendario-mesa-espejo.ts` (+ test) |
| UI pastilla / día / detalle | `calendario-produccion-page.tsx` |
| Pool reutiliza lib | `planificacion-pool-ots-tab-v2.tsx` |

### 7.1 Etiqueta de paso disponible — ✅
### 7.2 Botón «Enviar a cola de Mesa» — ✅ (agnóstico de ámbito; lab §7.2)
### 7.3 Espejo solo lectura — ✅ (Planificada / En cola / Mesa / En curso / Hecha)
### 7.4 Emparejamiento ámbito ↔ `tipo_maquina` — ✅
### 7.5 Sin sync escritura / sin migraciones — ✅
### 7.6 Fechas difieren → ambas + badge `≠` — ✅
### 7.7 Gate por proceso = fuera — ✅ documentado
### 7.8 Híbrido = propuesta — ✅

**No incluido:** contenedor real, máquina al iniciar, claim, sync fechas, gate por proceso, **CTP momento 0**.

---

## 8. Por qué NO tocar el Modelo B antes del TEST

1. Modelo mental Pool → Mesa ya asentado.
2. Planta entera entra en semanas: mal momento para reescribir motor.
3. El TEST dará el dato de si hace falta contenedor en N máquinas.

---

## 9. Retomar

- [ ] **Smoke PR1:** label · enviar cola · badge En cola/Mesa · aviso fechas
- [ ] Lab §7.2: envío agnóstico con paso del ámbito aún no disponible
- [ ] Validar §4 con **Jordi** (lunes) / **Carlos** (31 ago)
- [x] PR1 código (lib + calendario + espejo)
- [ ] **CTP momento 0** (post-smoke PR1)
- [ ] Gate material por proceso
- [ ] Post-TEST: Modelo B en áreas N máquinas
- [ ] Encaje Bloque 12

---

## 10. Referencias de código

| Acción | Función / dato | Archivo | ¿PR1? |
|--------|----------------|---------|-------|
| Enviar a cola | `pasarOtsAColaMesa` | `planificacion-pasar-a-mesa.ts` | ✅ |
| Gate material OT | `isPoolRowSelectableForMesa` / `fetchPasarAMesaGateByOt` | contenedor-query + pasar-a-mesa | ✅ reutilizado |
| Espejo Mesa | `fetchCalendarioEspejoByOtNumeros`, `derivePastillaEspejo` | `calendario-mesa-espejo.ts` | ✅ |
| UI | — | `calendario-produccion-page.tsx` | ✅ |
| Lanzar con máquina | `launchExecution` | mesa-diaria | No |
| Iniciar tableta | `beginExecution` | ots-ejecucion | No |

---

## 11. Resumen ejecutivo

1. Pidieron un botón, no un rediseño.
2. Botón = **«Enviar a cola de Mesa»** (`enviada_mesa`).
3. Espejo de lectura sin sync.
4. Gate por proceso **aún no existe**.
5. Híbrido = propuesta.
6. **CTP momento 0 = después** del smoke PR1.
7. Modelo B = post-TEST.

---

*Documento consolidado Manel + Claude + Cursor, 21 ago 2026 · PR1 en código + CTP fuera de alcance.*
