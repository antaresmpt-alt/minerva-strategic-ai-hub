# MINERVA — Cuestionario cartelas (para Ramón)

**Para:** Ramón (planta / logística)  
**De:** Manel  
**Fecha:** junio 2026  
**Tiempo estimado:** 30–45 min (respuestas cortas valen; ejemplos reales ayudan mucho)

---

## Contexto (1 minuto de lectura)

Estamos diseñando en Minerva el **Bloque 9: cartelas de material** (sustituir Optimus + papel en almacén).  
Ya tenemos documentado el flujo de hoy y tus respuestas del 22-jun. **Este cuestionario profundiza** en matices que pueden cambiar cómo lo programamos.

No hace falta un speech largo: responde punto por punto. Si algo varía según el caso, dilo (“normalmente X, pero si es CARPAPSA Y”).

**Propuesta de diseño que queremos validar contigo:**

- Juan recepciona en **Muelle** (ya existe) → luego **cartela** en paso separado (no automático al recepcionar).
- Una **cartela** = una cantidad de material asignada a una OT (o a STOCK libre). Un palet físico puede tener **varias cartelas**.
- El sobrante **no crea cartela nueva**: se actualiza la misma (como hoy tacháis el papel, pero en sistema).
- ID Stock Minerva arrancaría en **10.310** (continuando Optimus).

**Documentación técnica:** `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`

---

## Cómo responder

- Respuesta corta + ejemplo real si puedes (proveedor, OT, cantidades).
- Si no lo sabes con certeza: “no sé” / “depende” también sirve.
- Marca **frecuencia** cuando aplique: diario / varias veces por semana / raro / nunca.

---

## BLOQUE A — Roles y quién hace qué (6 preguntas)

**A1.** Hoy, paso a paso: desde que Jordi manda el email de pedido hasta que existe la OC en Optimus, **¿quién hace qué**? (Jordi / Gemma / tú / Emma / otro)

**A2.** En la práctica, **¿quién crea las cartelas hoy** la mayoría de las veces: Emma, Juan, o los dos por igual?

**A3.** Objetivo en Minerva: Juan cartela solo en casos “normales”. **¿Qué casos seguirían siendo de Emma sí o sí?** (ej: albarán con 5 OTs, STOCK, FSC dudoso, material a corte raro…)

**A4.** Cuando Juan necesita material para una OT urgente, **¿te llama siempre antes de coger un palet reservado a otra OT**, o a veces actúa y luego te cuenta?

**A5.** **¿Emma y Juan pueden cartelar el mismo albarán a la vez** sin coordinarse, o siempre hay una persona “dueña” del albarán ese día?

**A6.** Además de Juan y Emma, **¿hay alguien más** que deba poder crear cartelas o mover stock? (Miguel, maquinistas, Patricia…)

---

## BLOQUE B — Muelle vs cartelado (timing) (5 preguntas)

**B1.** Cuando llega un camión: **¿cuánto tiempo pasa** entre “Juan recepciona en muelle” y “se pegan las cartelas en los palets”? (mismo día / día siguiente / varios días)

**B2.** Si un albarán trae material para **3 OTs** pero solo han llegado las OCs de 2: **¿carteláis lo que hay** o esperáis a tener las 3 OCs registradas?

**B3.** **¿Puede pasar** que el proveedor entregue **en dos camiones** el mismo pedido (mismo nº albarán o albaranes distintos)? ¿Cómo lo tratáis?

**B4.** Material marcado **STOCK** (sin OT): **¿quién decide** que va a stock y no a una OT concreta? ¿Hace falta autorización tuya o Emma decide?

**B5.** Si Juan recepciona en muelle pero **aún no hay cartelas**, el material **¿dónde se queda físicamente**? (zona muelle / pasillo / ubicación en almacén / mezclado con palets ya cartelados)

---

## BLOQUE C — Palets físicos vs cartelas (5 preguntas)

**C1.** En un palet físico con material para **dos OTs** (ej. 1.500h + 500h): **¿pegáis una cartela o dos** en el mismo palet hoy?

**C2.** **¿Cómo identificáis el palet físico** además del ID Stock? (letra PA/PB, posición en almacén, solo la cartela, rotulador en el film…)

**C3.** Cuando un palet **no se vacía del todo** y vuelve al almacén: **¿va siempre al mismo sitio** o “donde quepa”? ¿Importa saber la ubicación en Minerva?

**C4.** **¿Cuántos palets** suele traer un albarán “normal” y cuál es el **máximo** que recordáis en un solo envío?

**C5.** **¿Hay palets “rotos” o media hoja** que guardáis como stock útil, o eso casi no pasa con folding/offset estándar?

---

## BLOQUE D — Reparto entre OTs y urgencias (4 preguntas)

**D1.** Cuando Jordi pide **varias OTs en una comanda** (ej. 35834-35851-35856) y llega **un solo albarán sin desglose**: **¿cómo repartís** en la práctica? (a partes iguales / por hojas de cada OC / intuición / lo que pide el maquinista)

**D2.** **¿Con qué frecuencia** una OT “roba” material reservado a otra OT? (nunca / 1-2 veces al mes / casi cada semana)

**D3.** Ese “robo” o traspaso: **¿quién lo autoriza** hoy? (solo tú / Emma también / Juan con tu OK verbal)

**D4.** Cuando una OT se queda **corta de material** (merma, error de pedido…): **¿qué hacéis primero** — stock libre, robar otra OT, pedir compra urgente, o mezcla?

---

## BLOQUE E — Consumo en máquina (4 preguntas)

**E1.** Hoy en impresión: **¿el maquinista anota el nº de cartela** en algún sitio (hoja de ruta, parte, Optimus)?

**E2.** El descuento de hojas en Optimus: **¿lo hace el maquinista, Juan, Emma o nadie** hasta que sobra material visible?

**E3.** Si sobran hojas en el palet tras imprimir: **¿quién corrige la cantidad** en Optimus/cartela — maquinista, Juan, o lo veis días después?

**E4.** Para el **MVP de Minerva**: ¿preferís que al principio **no descontemos automáticamente** en máquina (solo cartelas + stock bien identificado) y el ajuste sea manual/periódico, o **es imprescindible** descontar al cerrar cada tirada desde el día 1?

---

## BLOQUE F — Cantidades, kilos y formatos (3 preguntas)

**F1.** Cuando el albarán viene en **kilos o toneladas**: **¿quién calcula las hojas** hoy y con qué fórmula/herramienta? (calculadora, Excel, confianza en el proveedor…)

**F2.** Si el proveedor **ya pone las hojas en el albarán** (ej. PROEMBASA): **¿las revisáis** o las aceptáis tal cual?

**F3.** Material **a corte** (formato distinto al del maestro): **¿con qué frecuencia** el formato de la cartela no coincide con el del artículo en catálogo? (siempre / a menudo / raro)

---

## BLOQUE G — FSC, lotes y calidad (2 preguntas)

**G1.** **¿Alguna vez** habéis tenido problema de auditoría FSC/PEFC por cartela mal marcada o lote no registrado? ¿Qué campo os habría salvado?

**G2.** El **lote del proveedor** (cuando viene): **¿lo usáis operativamente** o solo “por si acaso” en una auditoría?

---

## BLOQUE H — Arranque Minerva y día 0 (3 preguntas)

**H1.** Para arrancar Minerva con stock real: **¿sería viable un recuento físico un sábado** (palets en almacén → Excel)? ¿Quién lo haría?

**H2.** Hoy en almacén, **¿cuántos palets aproximados** hay sin identificar claro (sin cartela legible, OT dudosa, “material viejo”)?

**H3.** Al pasar a Minerva: **¿seguiríais entrando cartelas en Optimus en paralelo** un tiempo, o corte limpio el día del recuento?

---

## BLOQUE I — Pedidos especiales y futuro (3 preguntas)

**I1.** Pedidos **barco / varias formas (OT contenedor + hijas)**: el material se compra **una vez en el padre**. **¿Cómo carteláis hoy** — una cartela para el barco, una por hija, o aún no pasa en Optimus?

**I2.** **¿Qué es lo que más os frustra** del sistema de cartelas/stock actual (Optimus + papel)?

**I3.** Si Minerva solo pudiera hacer **3 cosas bien el primer día**, **¿cuáles elegirías**? (ej: imprimir cartela, saber qué hay libre, repartir albarán multi-OT, traspasos, enlace con muelle…)

---

## BLOQUE J — Validación del modelo propuesto (3 preguntas)

**J1.** Cartela con **“OT prevista”** (no exclusiva) + historial de **qué OT consumió qué** en movimientos: **¿os encaja** con cómo trabajáis, o preferís que una cartela sea “solo de una OT” hasta que pase a stock libre?

**J2.** Sobrante: **¿preferís** que Minerva al cerrar la OT **sugiera** “pasar X hojas a stock libre”, o que **siempre** quede automático sin preguntar?

**J3.** **¿Algo importante** que no hayamos preguntado y que un programador sin experiencia en almacén **no sabría**?

---

## Resumen para Manel (rellenar tras las respuestas)

| Tema | Decisión / matiz clave |
|------|------------------------|
| Rol Juan vs Emma | |
| Timing muelle → cartela | |
| Modelo cartela / palet | |
| Traspasos y urgencias | |
| Consumo en máquina (MVP) | |
| Arranque día 0 | |
| Prioridad MVP (top 3) | |

---

*Generado desde `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` — Bloque 9 Minerva Hub.*
