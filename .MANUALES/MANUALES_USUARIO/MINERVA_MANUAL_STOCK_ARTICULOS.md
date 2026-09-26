# Stock artículos — cómo usarlo

Menú **Stock artículos**. No es **Stock material** (eso es el papel).

Aquí se apunta el producto ya hecho o a medias: cajas, estuches, interiores. Sirve para saber qué hay, de qué artículo y de qué cliente, sin bajar al pasillo.

Gabri lo rellena y lo va bajando. Zaida y Manel lo miran antes de crear una OT en Optimus. El comercial lo consulta. Quien no tenga permiso de escritura ve la lista y no puede cambiar números.

---

## Lo que hay que recordar

- **Un lote es una fila.** Misma referencia puede tener varios lotes (sitio distinto, estado distinto).
- **No se borra.** Anular pone la cantidad a 0. La fila se queda.
- **Ajustar** corrige el recuento. **Consumir** es cuando la mercancía sale.
- El número de OT sigue naciendo en **Optimus**. Minerva no lo crea.

---

## Gabri — el día a día

**Dar de alta.** Botón **Alta lote**. Artículo, cantidad, unidad, bultos si se saben, ubicación. El cliente lo copia del artículo.

**Dejar el número bien.** **Ajustar cantidad.** Se pone la cifra real (también 0). La nota es obligatoria. Ahí mismo se pueden corregir uds/bulto y pico. Si bultos × uds + pico no cuadra con la cantidad, avisa en amarillo y deja guardar.

**Poner a 0.** **Anular (poner a 0).** No borra el lote.

**Sacar mercancía.** En el lote, **Consumir**. Baja el físico. Si no hay reserva, **Sin reserva…** y un motivo. No toca lo que esté reservado a otra OT.

**Cambiar ubicación, notas o embalaje sin tocar la cantidad.** **Editar datos.**

Eso basta para tener el almacén al día. Asignar una OT es opcional.

---

## Zaida y Manel — antes de crear la OT

1. Buscar el artículo en Stock artículos.
2. Si hay bastante: en Optimus, una OT de entrega (el pedido de verdad, no la palabra «fabricación»).
3. Si falta: dos OTs, mismo pedido de cliente. Una por lo que hay. Otra solo por lo que hay que fabricar.
4. En el lote, **OT entrega**, con el número ya importado de Optimus. Reserva esa cantidad (baja el libre, el físico sigue) y marca la OT.
5. Cuando sale de verdad, **Consumir** esa reserva. Al gastarla entera, la OT pasa a histórico. No pide horas de planta. En **Producidas** se ve la fecha, el rol de quien cerró y la etiqueta **Entrega de stock**.

El checkbox **OT de entrega** al editar la OT hace la marca, sin reservar. El botón del lote marca y reserva. Con el botón sobra el checkbox.

Si el cliente del lote y el de la OT no coinciden, el stock **se ofrece igual**, en amarillo. El nombre bueno es el de la OT.

---

## Comercial

Entra en **Stock artículos** y mira. No reserva, no consume y no puede marcar una OT como entrega. Lo que ve es lo que hay apuntado. Si Gabri no lo ha dado de alta, para la pantalla no existe.
