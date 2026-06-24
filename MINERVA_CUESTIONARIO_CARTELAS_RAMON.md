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

**Propuesta de diseño validada con Ramón (24 jun 2026):**

- Juan recepciona en **Muelle** (ya existe) → **Emma o Ramón** cartelan en paso separado (Juan **no** cartela).
- Una **cartela** = **1 palet físico** = **1 ID Stock**. Ese palet puede referenciar **varias OTs**, sin desglose de cantidad por OT en la cartela.
- En físico se pegan **2 copias iguales** de la misma cartela (por si se pierde una), no dos cartelas distintas.
- El sobrante **no crea cartela nueva**: se actualiza la misma (`cantidad_actual` + movimiento).
- ID Stock Minerva arrancaría en **10.310** (continuando Optimus).
- **Arranque:** piloto en paralelo con Optimus (10–20 OTs en Minerva); ver §13c en `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`.

**Documentación técnica:** `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`

---

## Respuestas de Ramón (23–24 jun 2026)

> Fuente: cuestionario escrito (23 jun) + WhatsApp I1 (24 jun) + matiz H3 acordado con Manel (24 jun).

### BLOQUE A — Roles

| ID | Respuesta |
|----|-----------|
| **A1** | Nadie hace nada hasta que llega el material con albarán. Algunos proveedores envían confirmación a Jordi/Gemma/Emma, pero no se actúa hasta recepción física. |
| **A2** | **Emma o Ramón**, según carga. Tema a comentar con jefes. **Juan nunca** cartela. |
| **A3** | No hace falta diferenciar casos Juan/Emma para cartelar: **cualquiera (Emma/Ramón) puede hacer la cartela**. Ejemplo: 1 palet zenith 1.800 h → 300 OT0001 + 600 OT0002 + 500 OT0003 + 400 stock sobrante en el **mismo palet/cartela**. |
| **A4** | Urgencia: primero stock sobrante. Si basta (ej. 400 h del palet), maquinista descuenta ese ID Stock aunque estuviera asignado a otra OT ya impresa. Si hace falta más, descuenta de **varios ID Stock**. **MUY IMPORTANTE: cada palet = un ID Stock.** |
| **A5** | Solo Ramón y Emma cartelan. **Riesgo real:** doble entrada del mismo albarán (Emma por mail + Ramón al llegar físico) → stock duplicado en Optimus (pasó una vez). Minerva debe **antiduplicar por albarán**. |
| **A6** | **No** conviene más gente. Más manos, más líos. |

### BLOQUE B — Muelle vs cartelado

| ID | Respuesta |
|----|-----------|
| **B1** | Debería ser **inmediato**. Con Juan recepcionando y subiendo el albarán enseguida va más rápido. Si no sube Juan, depende de que Ramón/Emma bajen y de su carga de trabajo. |
| **B2** | No entendió “OC” (Orden de Compra Optimus). Aclaración: las cartelas identifican **palet + nº albarán + OT(s)**. Se hacen para lo que llega al almacén. |
| **B3** | Puede pasar mismo pedido en 2 camiones, pero no pasa. Se cartela según **albarán** (si dice 10 palets, eso; si vienen 5+5, da igual — manda el albarán). |
| **B4** | STOCK: Ramón le dice a Jordi *“X material es para stock”* antes del pedido. |
| **B5** | Sin cartela aún: material en **muelle o almacén**, según espacio. |

### BLOQUE C — Palets vs cartelas

| ID | Respuesta |
|----|-----------|
| **C1** | **2 cartelas iguales** pegadas en el mismo palet (duplicado por si se pierde una). La cartela lista las OTs del palet; no son dos cartelas con reparto distinto. |
| **C2** | Identificación: **solo la cartela** (ID Stock). A veces Juan rotula con rotulador, pero la cartela es la referencia. |
| **C3** | Ubicación por **filas de familia**: ALLYKING, ZENITH, COMCOTE/TPWHITE, GRISES, GRISES PAPRINSA, KRAFTLINER, ESTUCADOS, PAPELES ESPECIALES Y OFFSET. Sobrante vuelve a su fila. **Sí importa** conocer ubicación en Minerva (campo o catálogo de filas). |
| **C4** | Sin media fija: desde 1 palet (Duchange) hasta ~60 (Sashito). |
| **C5** | Sí hay palets sobrantes de **corte en guillotina** no impreso: deben **identificarse, entrar en stock y cartelarse**. |

### BLOQUE D — Reparto y urgencias

| ID | Respuesta |
|----|-----------|
| **D1** | **No** se especifica en cartela la cantidad por OT. El maquinista sabe las hojas brutas de la OT. |
| **D2** | Robo de material reservado: **raro** (alguna vez, no cada semana). Ideal: que no pase. |
| **D3** | Autoriza el traspaso/robo: **Ramón**. |
| **D4** | OT corta de material: (1) stock sobrante, (2) robar de otro palet reservado y reponer, (3) pedir al proveedor. |

### BLOQUE E — Consumo en máquina

| ID | Respuesta |
|----|-----------|
| **E1** | Sí: en Optimus **“Captura de datos en planta”** — OT + cantidad consumida por **ID Stock**. |
| **E2** | Descuento: **maquinista**. |
| **E3** | Sobrante tras imprimir: corrigen **maquinistas**. |
| **E4** | MVP: **imprescindible descontar tras cada trabajo** (no posponer a fase 2). |

### BLOQUE F — Cantidades y formatos

| ID | Respuesta |
|----|-----------|
| **F1** | Kilos/toneladas: calculan **Emma o Ramón**. |
| **F2** | Si el proveedor pone hojas (PROEMBASA): **no las revisan** hoy; **deberían** revisarlas. |
| **F3** | Formato cartela vs catálogo: **nunca** difiere en la práctica — cartela con datos del **albarán**. |

### BLOQUE G — FSC y lotes

| ID | Respuesta |
|----|-----------|
| **G1** | No sabe si hubo problema de auditoría FSC/PEFC. |
| **G2** | Lote proveedor: **no lo usa operativamente**. |

### BLOQUE H — Arranque Minerva

| ID | Respuesta |
|----|-----------|
| **H1** | *(Sin respuesta escrita)* — ver recuento §13b Bloque 9. |
| **H2** | *(Sin respuesta escrita)* |
| **H3** | **Paralelo durante un tiempo** (acordado Manel + Ramón, 24 jun): Optimus sigue siendo fuente de verdad del stock general; Minerva en **piloto con 10–20 OTs/trabajos** elegidos (ciclo completo: cartela + consumo). Resto del almacén en Optimus. Ver §13c. |

### BLOQUE I — Futuro

| ID | Respuesta |
|----|-----------|
| **I1** | **24 jun WhatsApp:** Si **material distinto** → **cartela distinta** (1 cartela por material diferente). Si hijas 1–3 **mismo material** → **1 cartela por palet** indicando que es para Hija 1, 2 y 3. Ej. cara/dorso distinto gramaje = 2 hijas = 2 materiales = 2 cartelas. Compra puede ser en el padre (barco); cartelado sigue regla palet/material. |
| **I2** | Ahora mismo **nada** les frustra; con Juan recepcionando es más inmediato. |
| **I3** | Prioridad #1: **saber material disponible y no reservado para ninguna OT**. |

### BLOQUE J — Validación modelo

| ID | Respuesta |
|----|-----------|
| **J1** | **CARTELA = IDENTIFICADOR DE PALET INDIVIDUAL** (1 ID Stock = 1 palet). Varias OTs en la misma cartela; trazabilidad de consumo en movimientos. |
| **J2** | **No** sugerir automáticamente “pasar a stock libre” al cerrar OT: las hojas que quedan pueden ser para **otra OT ya indicada** en el mismo palet (ej. OT0002). |
| **J3** | *(Sin respuesta adicional)* |

---

## Resumen para Manel (rellenado 24 jun 2026)

| Tema | Decisión / matiz clave |
|------|------------------------|
| **Rol Juan vs Emma** | Juan: **solo muelle** (recepción + subir albarán rápido). Cartelas: **Emma o Ramón** (Juan nunca). No ampliar a más usuarios. |
| **Timing muelle → cartela** | Ideal **inmediato**; cuello de botella si Ramón/Emma no bajan o están cargados. |
| **Modelo cartela / palet** | **1 cartela = 1 palet = 1 ID Stock.** Varias OTs en la misma cartela **sin cantidad por OT**. 2 etiquetas físicas iguales por palet. Barco: mismo material → 1 cartela/palet multi-hija; material distinto → cartela separada. |
| **Traspasos y urgencias** | Robo raro; autoriza Ramón. Orden: sobrante → robar reserva → pedir. Consumo puede usar varios ID Stock. **Antiduplicado albarán.** |
| **Consumo en máquina (MVP)** | **Obligatorio** desde día 1 del piloto: maquinista descuenta por ID Stock + OT tras cada trabajo (como Optimus hoy). |
| **Arranque día 0** | **Piloto paralelo** (H3): Optimus todo lo demás; Minerva 10–20 OTs. Mini-recuento solo palets del piloto o entradas nuevas desde fecha piloto. Recuento global → fase de corte. |
| **Prioridad MVP (top 3)** | 1) Stock **libre / no reservado** visible. 2) Cartela + ID Stock claro. 3) Descuento en máquina tras cada trabajo. |

---

## Preguntas originales (referencia)

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

> **Ver tabla rellenada arriba** (sección «Resumen para Manel (rellenado 24 jun 2026)»).

---

*Generado desde `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` — Bloque 9 Minerva Hub. Respuestas incorporadas 24 jun 2026.*
