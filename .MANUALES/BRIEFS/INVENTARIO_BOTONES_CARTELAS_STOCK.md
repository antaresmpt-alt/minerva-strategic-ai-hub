# Inventario de botones — Cartelas & Stock (para manual de usuario)

> Fuente: código en `main` a **21 ago 2026** (incluye **9.8.6 MVP**).
> Destinatario: quien escribe el manual (Ramón / Juan / Emma), **sin jerga de código**.
> Casos STOP: **A** = reservado sin consumo · **B** = ya hubo consumo · **C** = stock libre / compra sin OT.

**Roles cortos usados aquí**

| Etiqueta | Quién |
|----------|--------|
| Almacén | Juan, Emma, Ramón (usuario autenticado en almacén) |
| Oficina | `oficina_tecnica`, `admin`, `gerencia` |
| Solo gerencia/admin | `admin`, `gerencia` (reabrir paso) |

---

## 1. Cartelas → Pendientes de cartelar

Pantalla: Producción → Almacén → **Cartelas** → pestaña **Pendientes**.

| Botón / Acción | Dónde aparece (condición) | Rol mínimo | Qué hace en una frase | Estado resultante |
|----------------|---------------------------|------------|------------------------|-------------------|
| Buscar (campo texto) | Siempre en la barra | Almacén | Filtra por OT, albarán, proveedor, cliente, material | Solo filtro visual |
| Ocultar sin albarán | Chip en barra (activo por defecto) | Almacén | Esconde recepciones sin número de albarán | Solo filtro |
| Solo 30 días | Chip en barra | Almacén | Limita a recepciones recientes | Solo filtro |
| Actualizar (icono refresh) | Barra | Almacén | Recarga la bandeja de pendientes | — |
| **Recepción STOCK** | Barra (botón principal) | Almacén | Abre el flujo de entrada de material **sin OT** (compra/cartela stock libre) | Nueva recepción / cartela posible en stock libre (**Caso C**) |
| **Generar cartelas →** | En cada tarjeta de albarán **sin** cartelas reales aún | Almacén | Abre el asistente para crear cartelas de esa recepción | Palets nuevos (normalmente **reservados** a la OT de la compra, o libres si es STOCK) |
| **Añadir cartelas →** | Misma tarjeta si **ya** hay cartelas creadas | Almacén | Abre el asistente para crear **más** cartelas del mismo albarán | Más palets ligados a esa recepción |
| Aviso “N cartelas ya creadas” | Tarjeta con cartelas reales | — | Solo informativo | — |
| Aviso “cartelas de prueba” | Tarjeta solo con cartelas `prueba` | — | Avisa que hay cartelas sandbox | — |
| Fotos de recepción | Si el albarán tiene fotos | Almacén | Ver fotos del muelle | — |

---

## 2. Cartelas → Cartelas creadas

Pestaña **Cartelas** (listado).

### 2.1 Buscadores / filtros

| Botón / Acción | Dónde aparece | Rol mínimo | Qué hace | Estado resultante |
|----------------|---------------|------------|----------|-------------------|
| ID cartela | Input (prefijo numérico, ej. `106` o `10673`) | Almacén | Busca por número de cartela en servidor | Solo filtro |
| Albarán / OT | Input | Almacén | Busca por nota de entrega o número de OT | Solo filtro |
| Material | Input | Almacén | Busca por nombre/descripción de material | Solo filtro |
| Actualizar | Botón refresh | Almacén | Recarga el listado | — |
| Mostrar pruebas | Checkbox (si hay cartelas de prueba) | Almacén | Incluye cartelas marcadas como prueba | Solo filtro |

### 2.2 Acciones por fila (cartela)

| Botón / Acción | Dónde aparece (condición) | Rol mínimo | Qué hace en una frase | Estado resultante del palet / OT | Cuándo usarla (STOP A/B/C) |
|----------------|---------------------------|------------|------------------------|----------------------------------|----------------------------|
| Icono **Liberar** (cadena rota), uno por OT | Hay OT(s) con reserva en esa cartela | **Oficina** | Quita la reserva de esa OT sobre el palet (con aviso “a tu cuenta y riesgo”) | Palet pasa a **disponible / stock libre** (si no quedan otras reservas); OT puede quedar en STOP material | **Caso A** (aún no se consumió). En **B**, primero Revertir consumo (fuera de esta pantalla) |
| Icono **Asignar a OT** (enlace) | Estado **disponible** y cantidad > 0 (stock libre) | **Almacén** (Juan puede) | Reserva esa cartela a la OT indicada → “Material en stock asignado” | Palet **reservado** a esa OT | **Caso C** (y salida de STOP con stock existente tras decisión de oficina) |
| Icono **Imprimir** | Siempre en la fila | Almacén | Reimprime 1 copia de la cartela | Sin cambio de stock | — |
| Icono **Borrar** | Solo cartelas marcadas **prueba**, sin movimientos | Almacén | Borra la cartela de sandbox | Cartela eliminada | Nunca en producción real |
| Badge “prueba” | Cartela de prueba | — | Marca sandbox | — | Trampa: no usar OTs/cartelas de prueba como evidencia de Pool |

**Nota:** En **Cartelas creadas no hay “Partir palet”**. Partir está en **Stock → detalle del palet**.

### 2.3 Modales desde Cartelas

| Modal | Quién lo ve | Qué pide | Resultado |
|-------|-------------|----------|-----------|
| Liberar reserva de OT | Oficina | Confirmar OT + notas opcionales | Reserva liberada; ledger anota el movimiento |
| Asignar stock libre a OT | Almacén | OT destino (+ notas) | Reserva creada; badge OT “Material en stock asignado” |
| **¿Actualizar despacho?** (9.8.6) | Solo **Oficina**, **justo después** de asignar con éxito | “Ahora no” / “Abrir lápiz despacho” | Abre el editor de despacho forzado de esa OT (mismo espíritu que el lápiz en OTs Despachadas) |

---

## 3. Stock de material (listado)

Pantalla: Producción → Almacén → **Stock**.

| Botón / Acción | Dónde aparece | Rol mínimo | Qué hace | Estado resultante |
|----------------|---------------|------------|----------|-------------------|
| Buscar | Barra | Almacén | Filtra filas visibles | Solo filtro |
| Filtros de estado (chips) | Barra (todos / disponible / reservado / parcial / etc.) | Almacén | Filtra por estado del palet | Solo filtro |
| Filtro tipo stock | Selector | Almacén | Filtra por tipo | Solo filtro |
| Mostrar pruebas | Checkbox | Almacén | Incluye palets de prueba | Solo filtro |
| Actualizar | Barra | Almacén | Recarga | — |
| Importar Optimus | Barra | Almacén (según uso planta) | Carga Excel Optimus y muestra diff antes de confirmar | Puede crear/actualizar palets Optimus |
| IA Stock (si visible) | Barra | Según producto | Panel asistente stock | — |
| Clic en fila | Cualquier fila | Almacén | Abre **detalle del palet** | — |
| Reimprimir (icono en fila) | Columna acciones | Almacén | Imprime cartela sin abrir detalle | Sin cambio stock |

---

## 4. Modal detalle de palet (Stock)

Se abre al clicar una fila de Stock.

| Botón / Acción | Dónde aparece (condición) | Rol mínimo | Qué hace en una frase | Estado resultante | Cuándo usarla (STOP A/B/C) |
|----------------|---------------------------|------------|------------------------|-------------------|----------------------------|
| **Ajustar cantidad** | Siempre en bloque “Sobrantes” | Almacén | Corrige hojas físicas del palet (con notas) | `cantidad` actualizada; movimiento de ajuste | Merma / conteo; en STOP B a veces tras revertir |
| **Partir palet** | Habilitado si **no** hay reservas duras y cantidad > 1 | Almacén | Crea **cartela nueva** con parte de las hojas; la original se queda con el resto | Dos palets: origen + **nuevo disponible** | **Caso C** típico: partir stock libre / sobrante y asignar solo la parte nueva |
| **Asignar a OT** | Solo si el palet **no tiene OTs** (stock libre) | **Almacén** | Igual que en Cartelas: reserva a OT STOP / cobertura | Palet reservado; OT “Material en stock asignado” | **Caso C** |
| **Reimprimir cartela** | Pie del modal | Almacén | Imprime la cartela | Sin cambio | — |
| Cerrar | Pie | Almacén | Cierra el detalle | — | — |
| Historial de movimientos | Lista en el modal | Almacén | Solo lectura (consumos, ajustes, etc.) | — | Sirve para ver si ya hubo **consumo** (Caso B) |
| Popup **¿Actualizar despacho?** (9.8.6) | Tras asignar con éxito desde este modal | **Oficina** | Ofrece abrir lápiz de despacho | Despacho editable si aceptan | Tras **C** (o reasignación con material/formato distinto) |

**Bloqueo importante (Partir):** si el palet tiene **reservas duras**, Partir está desactivado. Hay que liberar o ajustar antes.

---

## 5. Acciones STOP que **no** están en Cartelas / Stock

Estas aparecen en la **hoja de ruta / paso finalizado** (acciones admin del paso), no en el listado de cartelas.

| Botón / Acción | Dónde aparece (condición) | Rol mínimo | Qué hace en una frase | Estado resultante | Cuándo usarla (STOP A/B/C) |
|----------------|---------------------------|------------|------------------------|-------------------|----------------------------|
| **Revertir consumo** | Paso **finalizado**, proceso con cartela, y existe un consumo revertible de ese paso | **Oficina** | Devuelve hojas al palet; marca OT en STOP; pide quién autoriza (+ formato/hojas opcionales) | Consumo anulado en ledger; palet recupera cantidad | **Caso B** obligatorio antes de liberar / reasignar si ya se cortó/consumió |
| **Reset planificación STOP** | Paso **finalizado** | **Oficina** | Anula huecos de mesa posteriores y devuelve la OT al Pool (con confirmación) | OT fuera de mesas futuras; vuelve a Pool | Tras decidir STOP: limpiar plan de máquinas posteriores (A o B) |
| Editar paso (admin) | Paso finalizado | Oficina | Corrige datos del proceso sin reabrir | Datos del paso actualizados | Corrección; no es liberar stock |
| Corregir cartela | Paso finalizado + proceso con cartela | Oficina | Registra consumo que faltó al cerrar | Puede descontar stock | Si faltó cartelar al cierre |
| Reabrir paso | Paso finalizado | **Solo admin / gerencia** | Vuelve a dejar el paso ejecutable | Paso ya no “finalizado” | Excepcional; no confundir con Reset STOP |

### Redespacho (lápiz) — relacionado con 9.8.6

| Botón / Acción | Dónde aparece | Rol mínimo | Qué hace | Cuándo (STOP) |
|----------------|---------------|------------|----------|----------------|
| **Editar despacho** (lápiz) en OTs Despachadas | Fila de OT despachada | **Oficina** (modo forzado) | Abre el mismo wizard de despacho para cambiar formato/material/datos de proceso | Tras cambiar cartela (**C** o post-liberar); 9.8.6 solo **ataja** ofreciendo este lápiz al asignar |
| Popup “¿Abrir lápiz despacho?” | Automático tras Asignar (Stock o Cartelas) | **Oficina** (Juan **no** lo ve) | Atajo al lápiz; “Ahora no” = oficina lo hará luego a mano | **Caso C** / reasignación con formato distinto |

---

## 6. Mapa rápido STOP → botones

| Situación en planta | Caso | Orden típico de botones |
|---------------------|------|-------------------------|
| CTP ve mal el formato; aún no se ha cortado/consumido | **A** | Liberar (Cartelas) → compra corrección o stock libre → Asignar → (Oficina) popup/lápiz → Reset planificación si hace falta |
| Ya se consumió en Guillotina (u otro paso con cartela) | **B** | **Revertir consumo** (paso) → luego Liberar / decidir scrap → recompra o Asignar → lápiz → Reset si hace falta |
| Hay palet libre (compra STOCK, sobrante, partido) | **C** | Partir (Stock) si hace falta → **Asignar a OT** → (Oficina) **¿Actualizar despacho?** |

---

## 7. Quién ve qué (resumen para el manual)

| Persona | Puede | No debería / no ve |
|---------|--------|---------------------|
| **Juan** (almacén) | Generar/añadir cartelas, Recepción STOCK, Partir, Ajustar, Asignar a OT, Reimprimir | Liberar, Revertir, Reset STOP, popup 9.8.6, lápiz forzado |
| **Emma / Ramón** | Igual que almacén en pantallas de cartelas/stock; recepción y cartelas del día a día | Acciones Oficina salvo que tengan rol oficina |
| **Zaida / oficina técnica** | Todo lo de almacén **más** Liberar, Revertir, Reset, popup redespacho, lápiz | — |
| **Admin / gerencia** | Todo lo de oficina **más** Reabrir paso | — |

---

## 8. Detalles que el manual debe dejar claros

1. **Asignar ≠ redespachar.** Asignar pone la cartela en la OT. Cambiar el despacho (72×102, etc.) es el **lápiz** (o el popup 9.8.6 que lo abre).
2. **Recibir compra en STOP** no debe hacer creer que el material “ya está OK” en el badge de la OT: en STOP el badge no se pisa con el progreso de la OC (matiz validado 20 ago).
3. **Partir** solo en Stock detalle, y **no** con reservas activas.
4. Cartelas **prueba** / OT con trampa `es_prueba`: no sirven como evidencia de flujo real ni de Pool.
5. En Caso **B**, Liberar sin Revertir deja el ledger incoherente: el manual debe ordenar **Revertir → luego Liberar/Asignar**.

---

*Fin del inventario. Claude puede combinar esto con `MINERVA_MANUAL_RESERVAS_STOCK.md` y los MDs de sesión 18–21 ago.*
