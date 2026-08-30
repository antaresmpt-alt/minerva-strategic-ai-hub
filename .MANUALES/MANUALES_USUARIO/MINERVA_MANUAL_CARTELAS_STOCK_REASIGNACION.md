# Minerva Hub — Manual: Cartelas, Stock y corrección de material

> **Versión 1.0 — 21 ago 2026.**
> Basado en el bloque 9.8 validado en planta con OTs 98019, 98020, 98022.
> **Pendiente de añadir:** capturas de pantalla de cada pantalla y botón.
> Fuente técnica: `.MANUALES/BLOQUES/MINERVA_BLOQUE9_REASIGNACION_STOP.md`.

---

## 1. Para qué sirve este manual

Este manual cubre tres cosas relacionadas:

1. **Cartelas** — cómo crear, buscar y gestionar las cartelas de cada palet físico.
2. **Stock** — cómo ver lo que hay en almacén y qué podemos usar.
3. **Corrección de material** — qué hacer cuando nos hemos equivocado de papel (formato, gramaje, etc.) y hay que corregirlo sin liar el sistema.

El objetivo de todo esto es uno solo:

> **Que cuando alguien pregunte "¿qué material tenemos de verdad?", la pantalla diga la verdad** — sin tener que ir al pasillo a comprobarlo.

---

## 2. Ideas clave antes de empezar

**La pantalla manda, no lo que "se supone" que hay.**
Si algo no está marcado en el sistema, para Minerva no existe aunque esté físicamente en el pasillo. Por eso es importante marcar las cosas cuando pasan.

**Nunca se borra un error, se corrige y se sigue.**
Si compramos algo mal, esa compra no desaparece — queda visible junto a la nueva. Si alguien pregunta por qué compramos dos veces, la respuesta está en pantalla.

**El sistema avisa, no bloquea.**
Cuando detecta que algo no cuadra (papel demasiado pequeño para el troquel), avisa con un mensaje en naranja. No impide seguir — la decisión final la toma siempre una persona.

**Una cartela = un palet físico.**
Cada palet del almacén tiene su cartela. La trazabilidad de qué OT usa qué material vive en el sistema, no en la memoria de nadie.

---

## 3. Quién hace qué

| Persona | Puede hacer |
|---------|-------------|
| **Juan** (almacén) | Crear cartelas, recepcionar material, asignar un palet libre a una OT, partir palets, reimprimir cartelas |
| **Emma / Ramón** | Lo mismo que Juan en las pantallas de almacén |
| **Zaida / Oficina técnica** | Todo lo anterior **más**: liberar reservas, revertir consumos, generar compras de corrección, resetear planificación, abrir el lápiz de despacho forzado |
| **Admin / Gerencia** | Todo lo anterior **más**: reabrir pasos ya finalizados (acción excepcional) |

---

## 4. Las pantallas de Cartelas

### 4.1 Pendientes de cartelar

**Dónde:** Producción → Almacén → Cartelas → pestaña **Pendientes**

Esta pantalla muestra los albaranes recibidos que aún no tienen cartelas creadas (o que tienen cartelas incompletas). Es la bandeja de entrada del almacén.

**Qué se ve:** cada tarjeta es un albarán de proveedor, con su OT asociada, el material, y cuántas hojas llegaron.

**Qué se puede hacer:**

- **Buscar** por OT, albarán, proveedor, cliente o material.
- **Ocultar sin albarán** (activo por defecto): esconde recepciones que llegaron sin número de albarán. Si buscas algo que no aparece, prueba a desactivar este filtro.
- **Solo 30 días**: limita la vista a recepciones recientes.
- **Recepción STOCK** (botón principal de la barra): para entrar material que no es para ninguna OT concreta — stock libre para usar cuando haga falta. Ver §7.3 (Caso C).
- **Generar cartelas →**: aparece en cada tarjeta sin cartelas reales. Abre el asistente para crear las cartelas de ese albarán.
- **Añadir cartelas →**: si la tarjeta ya tiene cartelas creadas, este botón permite añadir más del mismo albarán.

> ⚠️ **Importante con el albarán:** si al recibir el material no se pone el número de albarán, el sistema pedirá confirmación. Un palet sin albarán se agrupa como "pendiente sin número" y puede ser difícil de encontrar luego. Poner siempre el número real.

---

### 4.2 Cartelas creadas

**Dónde:** Producción → Almacén → Cartelas → pestaña **Cartelas creadas**

Aquí están todas las cartelas del sistema — cada fila es un palet físico con su estado actual.

**Buscadores (los tres trabajan juntos — AND):**

| Campo | Para qué |
|-------|----------|
| ID cartela | Si sabes el número de cartela (ej. `10984`) |
| Albarán / OT | Para buscar por número de albarán o número de OT |
| Material | Para buscar por nombre del material |

Pulsa **Enter** para buscar. Sin búsqueda, se muestran las 200 más recientes; con búsqueda, sin límite.

**Qué significa el estado de cada cartela:**

| Estado | Qué significa |
|--------|---------------|
| **Reservado** | El palet está asignado a una OT (alguien va a usarlo) |
| **Disponible** | El palet está libre — nadie lo tiene reservado |
| **Agotado** | El material ya se consumió en producción (0 hojas) |
| **Parcial** | Parte está reservada, parte libre |

**Acciones por fila:**

| Icono | Nombre | Quién | Qué hace | Cuándo usarlo |
|-------|--------|-------|----------|----------------|
| 🔗 roto (naranja) | **Liberar reserva** | Oficina | Quita la reserva de esa OT sobre el palet. El palet pasa a disponible. | Cuando hay un error de material y hay que desasignarlo de la OT (Caso A) |
| 🔗 verde | **Asignar a OT** | Juan / Almacén | Reserva ese palet libre a la OT que se indique | Cuando hay stock libre y queremos asignarlo a una OT concreta (Caso C) |
| 🖨️ | **Reimprimir cartela** | Todos | Imprime 1 copia de la cartela para pegar en el palet | Tras liberar un palet, para actualizar la etiqueta física |
| 🗑️ rojo | **Borrar** | Almacén | Solo en cartelas de prueba sin movimientos | Nunca en producción real |

> ⚠️ **No hay "Partir palet" en Cartelas creadas.** Para partir un palet hay que ir a **Stock → clicar la fila → Partir palet**. Ver §5.

**Modal que aparece al liberar:**
- Pide confirmar la OT y opcionalmente una nota del motivo.
- Queda registrado quién autorizó y cuándo.

**Modal que aparece al asignar:**
- Pide la OT destino (con buscador por número, cliente o referencia).
- Tras confirmar, si eres de Oficina técnica, aparece el popup de redespacho (ver §6).

---

## 5. La pantalla de Stock

**Dónde:** Producción → Almacén → Stock

Esta pantalla muestra todos los palets del almacén con sus cantidades reales.

**Los contadores de arriba:**

| Contador | Qué significa |
|----------|---------------|
| Palets | Total de palets en el sistema |
| Hojas libres | Hojas que no están reservadas para ninguna OT — disponibles |
| Hojas reservadas | Hojas comprometidas con alguna OT |
| Valoración remanente | Valor económico del stock |

**Filtros:**

- **Todos / Sin OT / Solo libre / Solo reservado / Parcial**: filtra por estado.
- **Mostrar pruebas**: incluye palets de laboratorio (los de los tests). No actives esto en el día a día.

**Clicar una fila** abre el detalle del palet.

### 5.1 Detalle del palet (modal)

Muestra toda la información de ese palet: material, formato, hojas físicas, reservadas, libres, historial de movimientos.

**Acciones disponibles:**

| Botón | Quién | Qué hace | Cuándo |
|-------|-------|----------|--------|
| **Asignar a OT** | Juan / Almacén | Igual que en Cartelas — reserva ese palet a la OT indicada. Solo aparece si el palet está libre (sin OTs). | Caso C: stock libre para una OT que necesita material |
| **Ajustar cantidad** | Almacén | Corrige las hojas físicas del palet (con nota de motivo). | Merma, conteo incorrecto, o tras revertir un consumo |
| **Partir palet** | Almacén | Crea una cartela nueva con parte de las hojas; la original se queda con el resto. | Para usar solo una parte de un palet en una OT y dejar el resto libre |
| **Reimprimir cartela** | Todos | Imprime la cartela de ese palet | — |

> ⚠️ **Partir palet está bloqueado si hay reservas activas.** Si el palet está reservado a alguna OT, no se puede partir. Hay que liberar primero.

**El historial de movimientos** (parte baja del modal) muestra consumos, ajustes, liberaciones. Si ves un movimiento de tipo "ajuste" con referencia a una OT, es señal de que ese palet estuvo asignado a esa OT en algún momento.

---

## 6. El popup de redespacho (9.8.6)

Después de **asignar** un palet a una OT (desde Stock o desde Cartelas), si eres de Oficina técnica o superior, aparece automáticamente un popup:

> **«¿Actualizar despacho de OT XXXXX?»**
> - **Abrir lápiz despacho**: abre el editor de despacho forzado de esa OT para cambiar el formato de material, cortes, etc.
> - **Ahora no**: cierra el popup. Podrás hacer el cambio luego desde OTs Despachadas con el lápiz.

**Juan no ve este popup** — para él, asignar termina con el toast de confirmación y ya está.

**Cuándo hay que usar el lápiz:** siempre que el material nuevo tenga un formato distinto al que estaba en el despacho original. Por ejemplo, si antes el despacho decía "65×92, cortar a 65×46" y ahora el material es 72×102, Miguel necesita saber que ahora es "72×102, cortar a 72×51".

---

## 7. Corrección de errores de material (STOP)

Esta es la parte nueva del sistema. Cubre qué hacer cuando nos damos cuenta de que el material no es el correcto.

### 7.1 El aviso automático (banner naranja)

Cuando el sistema detecta que el material de una OT no tiene el tamaño suficiente para el troquel (considerando los márgenes de pinzas y laterales), aparece un **banner naranja** en las pantallas de CTP, Guillotina e Impresión:

> ⚠️ «Formato posiblemente insuficiente (estimado). Troquel TAM00xxx: necesita pliego mínimo estimado de XXX × YYY mm. Material actual: ZZZ × WWW mm. Verificar orientación real en planta.»

Este aviso **no bloquea** — la máquina puede seguir. Pero hay que avisar a Oficina técnica para que decida qué hacer.

---

### 7.2 Caso A — Nos damos cuenta antes de cortar

El material está reservado para la OT pero todavía no se ha cortado ni consumido.

**Quién actúa:** Oficina técnica (Zaida o similar).

**Pasos:**

1. En **Cartelas creadas**, buscar la cartela de esa OT.
2. Pulsar el icono de **Liberar reserva** (cadena rota, naranja).
3. Confirmar la OT y añadir una nota de motivo (ej. "formato incorrecto, necesitamos 72×102").
4. El palet queda libre en stock. La compra original **no se borra** — sigue visible en Compras.
5. **Reimprimir la cartela** y pegarla encima de la antigua en el palet físico — ahora indica que está libre.
6. Oficina decide: ¿recompramos el formato correcto, o usamos algo que ya hay en stock?
   - **Si recompramos:** ir a Compras de Material → fila de esa OT → botón naranja **«Compra de corrección»**. Se crea una segunda línea de compra (P2) con el formato correcto. La primera (P1, la incorrecta) queda visible como histórico.
   - **Si usamos stock existente:** ir a Stock o Cartelas, buscar un palet del formato correcto que esté libre, y **Asignar a OT**.
7. Tras asignar, aparece el popup de redespacho (§6) — actualizar el despacho con el formato correcto.
8. Si la OT tenía pasos de producción planificados en mesa (CTP, Impresión, etc.), usar el botón **«Reset planificación STOP»** desde el paso de Guillotina u el anterior al problema, para liberar esos huecos y replanificar desde cero.

> ⚠️ **El badge de la OT en OTs Despachadas:** mientras la OT esté en STOP, verás "Sin material asignado (liberado)" o "Pendiente compra de corrección". Esto es **correcto** — no lo interpretes como un error. Desaparecerá automáticamente cuando se asigne la cartela nueva o cuando el material se consuma en producción.

> ⚠️ **El badge NO cambia al marcar la compra como Recibido.** Que el proveedor haya traído el material y lo marquemos como recibido en Compras no hace que la OT salga del STOP. La OT solo sale del STOP cuando Juan asigna físicamente la cartela nueva, o cuando se consume en máquina.

---

### 7.3 Caso C — Usamos stock libre que ya tenemos

Tenemos un palet libre (comprado como "stock para lo que sea", o sobrante de otra OT) que nos vale para la OT que tiene el problema.

**Quién decide:** Oficina técnica (decide que tiramos de stock en vez de recomprar).
**Quién ejecuta:** Juan.

**Pasos:**

1. Oficina dice a Juan: "usa el palet X (stock libre) para la OT YYYYY".
2. Juan va a **Stock** o **Cartelas creadas**, busca ese palet (debe estar en estado "Disponible").
3. Si hace falta solo una parte, Juan usa **Partir palet** para separar las hojas necesarias.
4. **Asignar a OT** — indica la OT destino.
5. Si es Oficina, aparece el popup de redespacho — actualizar el formato y los cortes.

---

### 7.4 Caso B — Ya se cortó antes de darnos cuenta

El material ya pasó por Guillotina y se registró el consumo. Es el caso más delicado.

**Quién actúa:** Oficina técnica (o Gerencia/Admin en casos excepcionales).

**Pasos — el orden importa:**

1. En la **Hoja de ruta** de la OT (o en el paso de Guillotina en OTs en Ejecución), aparece el botón **«Revertir consumo»** (solo visible para Oficina).
2. Pulsar **Revertir consumo** — pide confirmación, quién autoriza, y opcionalmente el nuevo formato del palet (ahora es el formato cortado, ej. 65×46, no el original 65×92).
3. El sistema devuelve las hojas al palet con su formato real (ya cortado), anota el movimiento en el historial, y marca la OT en STOP material.
4. A partir de aquí, seguir como el **Caso A**: liberar si hace falta, recomprar o buscar stock, asignar, redespachar.
5. Usar **Reset planificación STOP** si hay pasos planificados en mesa que hay que limpiar.

> ⚠️ **Nunca liberar sin revertir primero en el Caso B.** Si el consumo ya está registrado y liberamos la reserva sin revertir el consumo, el ledger queda incoherente. El orden correcto es siempre: **Revertir consumo → luego Liberar / Asignar**.

---

### 7.5 Resumen rápido por caso

| Situación | Caso | Primeros pasos |
|-----------|------|----------------|
| CTP ve el aviso — aún no se cortó nada | **A** | Liberar (Cartelas) → recomprar o usar stock → Asignar → lápiz → Reset planificación si hace falta |
| Guillotina ya cortó y se consumió | **B** | **Revertir consumo** (paso) → Liberar → recomprar o stock → Asignar → lápiz → Reset |
| Hay un palet libre que nos vale | **C** | Partir si hace falta → **Asignar a OT** → lápiz despacho |

---

## 8. El botón Reset planificación STOP

**Dónde:** en la hoja de ruta, al abrir un paso ya finalizado (CTP, Guillotina, etc.), aparece para Oficina.

**Para qué sirve:** cuando detectamos el problema en un paso intermedio (ej. Guillotina), los pasos siguientes (Impresión, Troquelado, etc.) pueden estar ya planificados en la mesa de producción. Este botón los saca de la mesa y devuelve la OT al Pool para replanificar desde cero.

**Cómo funciona:**
1. Pulsar **Reset planificación STOP** en el paso donde se detectó el problema.
2. Aparece una lista con los huecos de mesa que se van a anular (máquina · fecha · turno).
3. Confirmar → los huecos se liberan y la OT vuelve al Pool.

Este botón **no toca el stock ni las cartelas** — solo limpia la planificación de máquinas.

---

## 9. Acciones disponibles por pantalla (resumen)

### En Cartelas creadas
- 🔗 **Liberar reserva** (Oficina) — desasigna un palet de una OT
- 🔗 **Asignar a OT** (Juan) — asigna un palet libre a una OT
- 🖨️ **Reimprimir** — imprime la cartela

### En Stock (detalle del palet)
- **Asignar a OT** (Juan) — igual que en Cartelas, solo si está libre
- **Partir palet** (Juan) — divide el palet en dos
- **Ajustar cantidad** (Juan) — corrige hojas físicas
- **Reimprimir cartela**

### En la Hoja de ruta / paso finalizado
- **Revertir consumo** (Oficina) — deshace el consumo de un paso con cartela
- **Reset planificación STOP** (Oficina) — limpia huecos de mesa posteriores
- **Reabrir paso** (solo Admin/Gerencia) — vuelve a dejar ejecutable un paso cerrado

### Automático tras asignar
- Popup **¿Actualizar despacho?** (solo Oficina) — atajo al lápiz de despacho

---

## 10. Cinco cosas que el sistema no hace solas y que hay que recordar

1. **Asignar ≠ redespachar.** Asignar pone el palet en la OT. Cambiar el formato y los cortes del despacho (lo que verá Miguel en Guillotina) es el lápiz — o el popup que aparece tras asignar.

2. **El badge de OTs Despachadas no cambia al marcar Recibido en Compras.** Si la OT está en STOP, debe quedarse en STOP hasta que se asigne o consuma el material correcto. Ver el badge cambiar a "Material recibido" antes de eso sería un error del sistema — no debería pasar, pero si lo ves, avisar a Oficina técnica.

3. **Partir palet solo si no hay reservas activas.** Si el palet está reservado a alguna OT, primero hay que liberarlo.

4. **En el Caso B, el orden importa: Revertir consumo primero, luego todo lo demás.**

5. **Las cartelas de prueba** (las que tienen el aviso naranja "prueba" en la lista) no cuentan en los semáforos del Pool. No las uses como evidencia de que el flujo funciona — usa OTs reales.

---

## 11. Pendiente de añadir (próxima versión)

- [ ] Capturas de pantalla de cada pantalla y botón
- [ ] Ejemplo paso a paso con OT real de producción
- [ ] Preguntas frecuentes recogidas tras el primer uso en planta con Ramón y Juan

---

*Manual elaborado por Manel Puigcerver · Minerva Packaging & Print, S.A. · agosto 2026*
*Basado en el bloque 9.8 del sistema Minerva Hub, validado en planta con OTs 98019, 98020 y 98022.*
