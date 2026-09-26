# Sesión 26 sep 2026 — Bloque 15: decisiones y cierre

> **Rama:** `feature/bloque15-stock-articulos` → merge a `main` el mismo día.  
> **Horario aprox.:** 17:00 → 20:45 (~4 h)  
> **Quién:** Manel (decisiones y smoke) · Cursor (código y manual)  
> **Brief:** `.MANUALES/BLOQUES/MINERVA_BLOQUE15_STOCK_ARTICULOS.md`  
> **Manual:** `.MANUALES/MANUALES_USUARIO/MINERVA_MANUAL_STOCK_ARTICULOS.md`

---

## En una frase

Se cerró cómo se usa el stock con Optimus todavía mandando: el nombre bueno del cliente es el de la OT, la OT de entrega se marca en el maestro y al reservar, y María José la termina con **Consumir**.

---

## Confirmado (etiquetas, de ayer)

Sesiones **Hoy** I/T/N: al día siguiente la casilla amanece sin marcar; el calendario conserva el día anterior y añade el nuevo (naranja = en curso). Prueba **FICT-98001**: borrarla de la hoja de ruta quita `I-98.001` / `T-98.001`. El apunte **PUENTE** del **24 sep** se queda (festivo, no se trabajó).

---

## Decisiones de negocio

1. **Flujo real.** Zaida y Manel miran el stock antes de crear nada. En Optimus: una OT de entrega si hay bastante; dos (mismo nº de pedido de cliente, OT distinta) si hay que fabricar el resto. Minerva no crea números. El reparto de clientes (Manel: Sergi, Jordi Puigcerver, Francesc; Zaida: Albert, Jordi Gaia, Jordi Rubens) hace muy raro pisarse el stock. **Mezclar / reservar al partir queda fuera de esta tanda.** Cuando Minerva cree las OTs desde el presupuesto, el stock se mira en ese momento: si solo cubre una parte, nacen dos OTs (entrega por lo que hay + fabricación por el resto, no por el total).
2. **Reservar ≠ consumir.** Reservar (u OT entrega) baja el libre y deja el físico. **Consumir** es la salida. Lo hace María José en **Almacén → Stock artículos → el lote → Consumir**. No en el pipeline ni en «Cerrar y enviar a histórico» (eso pide horas y pasos de planta).
3. **OT entrega ≠ Reservar.** Mismo efecto de stock. OT entrega escribe la marca de entrega (no se fabrica). Reservar aparta sin esa marca.
4. **Nombre de cliente.** El bueno es el de la OT (texto Optimus). El del maestro de artículos lo escribieron a mano y es el que hay que igualar. El Excel de Gabri no graba el cliente del lote: lo copia del artículo. No hay tabla de clientes ni se espera a Odoo: el desplegable sale de los nombres distintos del maestro de OTs, con texto libre si el cliente aún no está en ninguna OT.
5. **Ajustar ≠ Editar.** Ajustar es el recuento (cambia el físico, nota obligatoria). Editar no toca la cantidad. No se funden. No se obliga a que bultos × uds/bulto + pico = físico (aviso amarillo y se guarda). En Ajustar faltan uds/bulto y pico en el mismo diálogo.
6. **`es_ot_entrega`.** Campo en la OT, no solo el tag en notas de la reserva. Checkbox en el maestro de OTs, y el botón **OT entrega** lo pone al reservar. Sale de pendientes de despachar. Sigue visible: un solo paso **Entrega** en el pipeline. **Consumir** cierra ese paso y manda la OT al histórico.

---

## Prompt — siguiente tanda de código

Orden. SQL nueva (puntos 2 y 4) → borrador, revisión Claude, luego aplicar. No aplicar en la misma pasada que la UI.

1. **No esconder el stock.** Misma referencia Minerva: si el cliente del lote y el de la OT no coinciden, el aviso sale igual, en amarillo. Desde el aviso, copiar el nombre de la OT al artículo y al lote. Filtro duro solo si el lote está marcado a propósito para otro cliente (Takeit).
2. **Limpieza de nombres.** Hecha el 26 sep (datos, sin migración). Enlace OT↔artículo = la ref. cliente al inicio del título. Una sola grafía y el artículo es el mismo nombre más corto o con otra puntuación → se copió la grafía de la OT (19 artículos: Anur `S.L.` → `S.L`, Glower Lab → Glower Lab SAU). Lotes de prueba no cambiaron (su cliente ya era el de la OT). No se tocó: 6 conflictos (hoteles SB, dos grafías), 6 razones distintas (Diafarm/Manent, Faes/Solchem, Lobinsa y Remeifle/Kroxas, Teikit Sevilla, Delaviuda/Sampaka), 13 artículos más específicos que la OT (locales Teik It), 7 Blanxart porque ya existe otra ficha con la misma ref. y `BLANXART, S.L.U.` (índice único).
3. **Alta de artículo.** Cliente = lista distinta del maestro de OTs + texto libre para uno que aún no esté en ninguna OT.
4. **`es_ot_entrega`** en `prod_ots_general` (sí/no). Checkbox en maestro de OTs. El botón **OT entrega** lo marca al reservar. Con la marca, fuera de «no despachadas».
5. **Paso único Entrega** al marcarla (no es proceso de planta). Pipeline: pendiente de salir. **Consumir** baja el físico, termina el paso y envía la OT al histórico.
6. **Ajustar cantidad:** en el mismo diálogo, nueva cantidad + bultos + uds/bulto + pico. Sin fusión con Editar. Sin bloqueo si el embalaje no cuadra.
7. **Smoke** OT 98046 cuando el punto 1 esté hecho.

**No en esta tanda:** reservar al pulsar Mezclar. Lotes `TEST_PILOTO` a 0 (botón Anular, lo hace Manel) · merge `main` · carga Gabri · **15.5**, después del smoke.

---

## Pasada 1 (26 sep, tarde) — hecha, sin SQL

1. **No esconder stock.** Misma referencia: cliente distinto entra en el aviso y se puede reservar. Aviso ámbar. Botón «Poner el cliente de la OT» actualiza `prod_referencias`. El lote solo cambia si la tabla deja el update; si no, el toast lo dice y la limpieza de lotes sigue en la pasada 2.
3. **Alta / edición de artículo.** Campo cliente con lista de `prod_ots_general` y texto libre.
6. **Ajustar.** Cantidad y bultos por `prod_stock_articulos_ajustar`. Uds/bulto y pico por `prod_stock_articulos_editar_datos`. Si el embalaje no cuadra, aviso y se guarda.

Pendiente de esta tanda: punto 7 (smoke formal). Puntos 4 y 5 hechos el 26 sep noche (abajo).

---

## Pasada Consumir (26 sep, noche)

4. **`es_ot_entrega`** en `prod_ots_general`. Checkbox en el maestro. El botón **OT entrega** lo marca al reservar y crea un solo paso **Entrega** (proceso de catálogo, no de planta). El filtro «No» de despachadas no las enseña. El asistente de despacho no las manda a planta.
5. **Consumir** al agotar la última reserva viva de esa OT: cierra el paso y la archiva en histórico, excluida de promedios (sin horas). Un consumo parcial no cierra. Consumir sin reserva no cierra.

Excel de las 15 parejas Blanxart para Zaida: `.MANUALES/DUDAS/BLANXART_PAREJAS_ZAIDA_2026-09-26.xlsx` (el `.xlsx` no entra en git). No se ha borrado ninguna ficha.

Manual de uso: `.MANUALES/MANUALES_USUARIO/MINERVA_MANUAL_STOCK_ARTICULOS.md`. Lunes: minidemo a Gabri y Zaida. Los lotes `TEST_PILOTO` se anulan hoy o el lunes, después de enseñarlos. Smoke 98046 hecho: reserva 130, Consumir entero, lote en Agotado, ya no sale en el pipeline.

---

## Pendiente operativo (no es código)

- Lunes: borrar **FICT-98001** de la hoja de ruta de etiquetas. No tocar el apunte PUENTE del 24.
- Anular lotes `TEST_PILOTO` (poner a 0) cuando se cierre la prueba de stock.

---

## Review de Claude (26 sep, noche) — aplicada y en `main` (`c398f19`)

La migración `20260926193000` dejó `prod_ot_entrega_marcar` solo mirando la sesión. Visto bueno de Claude y aplicada: `supabase/migrations/20260926210000_bloque15_ot_entrega_permiso.sql`. Exige `minerva_can_write_stock_articulos()` (admin, gerencia, oficina técnica, logística, o la capacidad de Gabri). Comprobado: la función sale una sola vez; un comercial recibe «Sin permiso» y no llega a la OT; un admin pasa el permiso.

En código, en `main`:

- Reservar primero y marcar después. Si la reserva falla, no se quita una marca que ya estaba.
- «Usar stock» del despacho marca la OT cuando la reserva sale bien (también si ya estaba cubierta). Si un lote falla a medias, no desmarca.
- El checkbox del maestro solo llama a marcar si la casilla ha cambiado.
- «Poner el cliente de la OT» solo si se puede escribir stock.
- Histórico: fecha, rol de quien cerró (si el perfil se puede leer) y la nota «Entrega de stock».

Reimportar Optimus no toca OTs que ya existen: solo inserta las nuevas. El upsert de la hija no manda `es_ot_entrega`.
