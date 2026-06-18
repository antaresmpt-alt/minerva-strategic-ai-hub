# MINERVA — Briefing Bloque 7: Odoo / Expedicion / Albaranes

> Documento autocontenido para brainstorming y toma de decisiones.
> Tema: definir el papel de Minerva frente a Odoo en expedicion, albaranes y cierre logistico.
> Complementa a `MINERVA_BRIEFING.md`, `MINERVA_CONTEXTO_TECNICO.md`,
> `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md` y `FASES_HOJA_RUTA_DIGITAL.md`.
>
> Fecha: 13 de junio de 2026.

---

## 1. Idea central

El Bloque 7 no deberia empezar por programar albaranes.

Debe empezar por decidir una cuestion estrategica:

> Que sistema es la fuente de verdad de la expedicion y del documento legal: Minerva u Odoo?

Esta decision cambia todo:

- numeracion de albaranes.
- responsabilidad legal/fiscal.
- quien descuenta stock.
- donde se registran entregas parciales.
- que sistema consulta administracion.
- que ocurre si hay diferencias entre lo producido y lo enviado.

Por ahora, la recomendacion prudente es:

> Minerva debe preparar la expedicion desde OTs producidas y, al menos al principio, Odoo deberia seguir emitiendo el albaran legal.

Pero esta decision debe validarse con la empresa, contabilidad/administracion y el flujo real de Odoo.

---

## 2. Relacion con el Bloque 6

El Bloque 7 depende del Bloque 6.

No se deberia generar/preparar un albaran desde una OT en curso. Lo correcto es:

```text
Hoja de Ruta ejecutada
  -> pendiente_revision
  -> cerrar y enviar a historico
  -> OT producida
  -> preparar expedicion / albaran
```

Motivo:

- El albaran pertenece a logistica/facturacion.
- La Hoja de Ruta pertenece a produccion.
- Una OT puede estar producida pero no enviada.
- Una OT puede enviarse parcialmente.
- El albaran no debe ser el disparador del cierre productivo.

---

## 3. Problema de negocio

Minerva necesita responder:

1. Que se ha producido?
2. Que queda pendiente de enviar?
3. Que se ha enviado?
4. En cuantos bultos/palets?
5. Con que transportista?
6. A que direccion?
7. Con que albaran?
8. Ese albaran lo emite Minerva o Odoo?

Ademas, en el futuro la expedicion se relacionara con:

- cartelas de recepcion de material.
- FSC.
- proveedor y numero de albaran del material usado.
- trazabilidad de que material entro y que material salio en una OT concreta.
- recalculo de presupuesto/costes.

---

## 4. Escenarios posibles de integracion con Odoo

### Opcion A — Odoo emite albaranes, Minerva solo prepara

Minerva:

- muestra OTs producidas pendientes de expedicion.
- agrupa por cliente/direccion/fecha si aplica.
- calcula bultos/palets desde la Hoja de Ruta.
- permite preparar una propuesta de expedicion.
- exporta datos a Odoo o genera una vista para copiarlos.
- guarda el numero de albaran devuelto por Odoo.

Odoo:

- mantiene numeracion legal.
- emite albaran.
- gestiona facturacion/contabilidad.

Ventajas:

- Menor riesgo legal/fiscal.
- Menor complejidad.
- Odoo sigue siendo fuente de verdad administrativa.
- Mejor para fase inicial.

Inconvenientes:

- Puede haber doble trabajo si no hay integracion automatica.
- Minerva no controla todo el ciclo.
- Necesita reconciliacion: propuesta Minerva vs albaran Odoo.

### Opcion B — Minerva emite albaran legal

Minerva:

- genera numero de albaran.
- emite PDF oficial.
- gestiona entregas parciales.
- posiblemente sincroniza con Odoo despues.

Ventajas:

- Experiencia mas integrada.
- Control total desde produccion/logistica.

Inconvenientes:

- Alto riesgo legal/administrativo.
- Numeracion correlativa y series.
- Gestion de rectificaciones/anulaciones.
- Necesita integracion fuerte con facturacion/ERP.
- No recomendable como primer paso salvo decision clara de empresa.

### Opcion C — Modelo intermedio: Minerva genera \"pre-albaran\"

Minerva:

- genera un documento interno: **pre-albaran / propuesta de expedicion**.
- tiene numeracion interna no fiscal.
- Odoo emite el albaran final.
- Minerva guarda el enlace/numero final de Odoo.

Ventajas:

- Muy practico para planta.
- Permite imprimir algo para muelle/transporte.
- Evita asumir la responsabilidad legal de albaran oficial.

Inconvenientes:

- Hay que nombrarlo bien para no confundirlo con documento fiscal.
- Requiere disciplina: el documento oficial sigue siendo Odoo.

Recomendacion inicial: **Opcion C**, evolucionando a A con integracion API si Odoo lo permite.

---

## 5. Modelo funcional recomendado para MVP

### Modulo: Expedicion

Ubicacion posible:

- Dentro de `Produccion -> Muelle`.
- O como pestaña `Produccion -> Producidas` con boton \"Preparar expedicion\".

Recomendacion:

- **Producidas** = historico/productivo.
- **Muelle/Expedicion** = operacion logistica.

Flujo:

```text
OT producida
  -> aparece en Pendiente de expedicion
  -> usuario prepara envio
  -> genera pre-albaran / propuesta
  -> se emite albaran real en Odoo
  -> usuario registra numero Odoo o se sincroniza via API
  -> expedicion queda cerrada
```

---

## 6. Datos logisticos que faltan en la Hoja de Ruta

La Hoja de Ruta captura produccion. Para expedicion faltan datos especificos:

| Dato | Comentario |
|---|---|
| Direccion de envio | Puede venir de cliente/Odoo, pero debe confirmarse. |
| Contacto / horario | Habitual en expedicion real. |
| Transportista | Propio, agencia, cliente recoge, etc. |
| Servicio | Normal, urgente, grupaje, paleteria. |
| Fecha salida | Fecha real de expedicion. |
| Fecha prevista entrega | Si aplica. |
| Cantidad enviada | Puede ser parcial. |
| Cantidad pendiente | Producida - enviada. |
| Bultos enviados | Puede diferir de los bultos producidos. |
| Palets enviados | Puede diferir si hay reagrupacion. |
| Peso | Si se necesita. |
| Observaciones transporte | Instrucciones. |
| Numero albaran Odoo | Si Odoo emite el documento oficial. |
| Estado Odoo | Pendiente / emitido / error / sincronizado. |

---

## 7. Entregas parciales

Debe contemplarse desde el diseño.

Una OT puede producir 20.000 unidades y enviar:

- 10.000 hoy.
- 5.000 la semana que viene.
- 5.000 queda en stock o pendiente.

Por tanto:

```text
1 OT producida -> N expediciones / N albaranes
```

Campos necesarios:

- `cantidad_producida`.
- `cantidad_enviada_acumulada`.
- `cantidad_pendiente_envio`.
- `cantidad_envio` por expedicion.

Reglas:

- No permitir enviar mas que lo producido, salvo override autorizado.
- Permitir registrar expediciones parciales.
- Marcar OT como `expedida_total` solo cuando enviada acumulada >= producida.

---

## 8. Posible modelo de datos

### Tabla `prod_expediciones`

Representa una expedicion/pre-albaran.

Campos sugeridos:

| Campo | Comentario |
|---|---|
| `id` | PK. |
| `codigo_expedicion` | Numero interno Minerva, no fiscal. |
| `cliente` | Snapshot. |
| `direccion_envio` | Snapshot. |
| `transportista` | Texto/catalogo. |
| `fecha_salida_prevista` | Plan. |
| `fecha_salida_real` | Real. |
| `estado` | `borrador`, `preparada`, `enviada`, `sincronizada_odoo`, `cancelada`. |
| `odoo_albaran_id` | Si existe. |
| `odoo_albaran_numero` | Numero oficial devuelto por Odoo. |
| `observaciones` | Texto. |
| `created_by` | Auditoria. |
| `created_at` | Auditoria. |
| `updated_at` | Auditoria. |

### Tabla `prod_expedicion_lineas`

Lineas de una expedicion.

| Campo | Comentario |
|---|---|
| `id` | PK. |
| `expedicion_id` | FK. |
| `ot_producida_id` | FK a `prod_ot_producidas`. |
| `ot_numero` | Snapshot. |
| `referencia_id` | FK si existe. |
| `referencia_cliente` | Snapshot. |
| `descripcion` | Trabajo/articulo. |
| `cantidad_producida` | Snapshot. |
| `cantidad_envio` | Cantidad enviada en esta expedicion. |
| `bultos` | Bultos enviados. |
| `palets` | Palets enviados. |
| `observaciones` | Texto. |

### Alternativa simple MVP

Si se quiere empezar sin crear dos tablas:

- añadir campos logisticos basicos en `prod_ot_producidas`.
- pero no es recomendable si se quieren parciales.

Recomendacion: usar `prod_expediciones` + `prod_expedicion_lineas` desde el principio.

---

## 9. Integracion con Odoo: niveles

### Nivel 0 — Manual asistido

Minerva genera pre-albaran y el usuario crea el albaran en Odoo manualmente.

Luego registra en Minerva:

- numero de albaran Odoo.
- fecha.
- observaciones.

Bueno para empezar si no se conoce aun la API.

### Nivel 1 — Export / Copy-paste

Minerva genera:

- Excel/CSV.
- JSON.
- PDF interno.

El usuario usa esos datos para cargar Odoo.

### Nivel 2 — API unidireccional Minerva -> Odoo

Minerva crea borrador de albaran en Odoo.

Odoo devuelve:

- id.
- numero.
- estado.

### Nivel 3 — Sincronizacion bidireccional

Minerva y Odoo sincronizan estados.

Mas potente, pero mas compleja:

- errores de sync.
- conflictos.
- permisos.
- webhooks.

Recomendacion: empezar por Nivel 0/1, diseñando el modelo para llegar a Nivel 2.

---

## 10. Relacion con FSC y trazabilidad de material

El usuario ya ha planteado:

- `fsc` y `fsc_fecha_validacion` en Maestro de Articulos.
- cartelas de recepcion de material en palets (diseño: `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`).
- ligar material usado con proveedor y numero de albaran de entrada.
- futuro boton \"Recalcular presupuesto\" en Hoja de Ruta/PDF.

Implicacion para Bloque 7:

- La expedicion deberia poder mostrar si la OT/articulo es FSC.
- A futuro, podria enlazar:
  - lote/material recibido.
  - proveedor.
  - albaran de compra.
  - material consumido.
  - material enviado.

Pero no conviene meter todo eso en el MVP de albaranes.

Recomendacion:

1. Primero cerrar bien `prod_ot_producidas`.
2. Luego preparar expedicion parcial.
3. Despues enlazar trazabilidad de material/FSC.

---

## 11. UX propuesta

### Pantalla \"Pendiente de expedicion\"

Lista de OTs producidas no expedidas totalmente.

Columnas:

- OT.
- Cliente.
- Trabajo.
- Referencia cliente.
- Cantidad producida.
- Cantidad enviada.
- Pendiente.
- Bultos.
- Palets.
- FSC.
- Fecha cierre produccion.

Acciones:

- Preparar envio.
- Agrupar con otras OTs del mismo cliente.
- Ver Hoja de Ruta historica.

### Modal \"Preparar expedicion\"

Campos:

- Cliente.
- Direccion envio.
- Transportista.
- Fecha salida.
- Lineas de OTs.
- Cantidad a enviar por linea.
- Bultos/palets.
- Observaciones.

Botones:

- Guardar borrador.
- Marcar preparada.
- Exportar / generar pre-albaran.
- Registrar albaran Odoo.

### Estado visual

Estados posibles:

- `pendiente_expedicion`.
- `borrador_expedicion`.
- `preparada`.
- `enviada`.
- `sincronizada_odoo`.
- `expedida_total`.
- `cancelada`.

---

## 12. Riesgos

### Riesgo 1: duplicar la verdad legal

Si Minerva y Odoo emiten albaranes, puede haber divergencia.

Mitigacion:

- Minerva genera pre-albaran interno.
- Odoo emite oficial.
- guardar numero oficial de Odoo en Minerva.

### Riesgo 2: no contemplar parciales

Si el modelo asume 1 OT = 1 albaran, habra problemas.

Mitigacion:

- `prod_expediciones` + `prod_expedicion_lineas`.

### Riesgo 3: mezclar cierre productivo y cierre logistico

Una OT producida no siempre esta enviada.

Mitigacion:

- estados separados:
  - produccion: `pendiente_revision`, `producida`.
  - logistica: `pendiente_expedicion`, `enviada`, `expedida_total`.

### Riesgo 4: integracion Odoo demasiado pronto

Si no se conoce bien la API/proceso real, se puede invertir mucho tiempo mal.

Mitigacion:

- empezar manual/asistido.
- dejar campos preparados para futura API.

---

## 13. Preguntas para decidir antes de programar

1. Odoo emite hoy los albaranes? Con que numeracion/serie?
2. Quien crea albaranes en la empresa hoy?
3. Hay entregas parciales habituales?
4. Se agrupan varias OTs en un mismo albaran?
5. Se parte una OT en varios albaranes?
6. La direccion de envio siempre es la del cliente o puede variar por pedido?
7. Se necesita peso?
8. Se necesita transportista/agencia?
9. Hay picking real en almacen/muelle o solo expedicion desde produccion?
10. Odoo tiene API disponible y credenciales?
11. Que modulo exacto de Odoo se usa: ventas, inventario, albaranes, stock pickings?
12. Minerva debe descontar stock o solo informar?
13. Que documento se entrega al transportista: albaran Odoo, packing list, hoja interna?

---

## 14. Recomendacion de roadmap

### Fase 7.0 — Discovery Odoo

- Reunir flujo real.
- Ver pantallas actuales de Odoo.
- Identificar si hay API/credenciales.
- Decidir fuente de verdad.

### Fase 7.1 — Pendientes de expedicion

- Desde `prod_ot_producidas`, listar OTs producidas no enviadas.
- Estado logistico separado.

### Fase 7.2 — Pre-albaran interno

- Crear `prod_expediciones` + `prod_expedicion_lineas`.
- Permitir parciales.
- Generar PDF/Excel interno.

### Fase 7.3 — Registro de albaran Odoo

- Campo para numero/id Odoo.
- Estado `sincronizada_odoo` manual.

### Fase 7.4 — Integracion API

- Crear borrador en Odoo desde Minerva.
- Guardar respuesta.
- Manejar errores de sync.

### Fase 7.5 — Trazabilidad avanzada

- FSC.
- material consumido.
- cartelas recepcion.
- proveedor y albaran de entrada.

---

## 15. Prompt sugerido para Claude

```text
Te paso el briefing especifico del Bloque 7 de Minerva.
Minerva es una plataforma de gestion de produccion para una imprenta/packaging que debe sustituir a Optimus.

Estamos diseñando la parte de Expedicion / Albaranes / Odoo.
Todavia no sabemos exactamente que integraremos con Odoo ni que licencia/API tendremos.

Objetivos:
- Decidir el papel correcto de Minerva frente a Odoo.
- Evitar duplicar la verdad legal de albaranes.
- Contemplar entregas parciales desde el principio.
- Diseñar un MVP pragmatico que luego pueda integrarse por API.

Devuelveme:
1. Riesgos principales.
2. 2-3 modelos posibles con trade-offs.
3. Recomendacion de MVP.
4. Modelo de datos minimo.
5. Preguntas que debo hacer a administracion/produccion antes de construir.
6. Roadmap por fases.

--- BRIEFING ---
<pegar MINERVA_BLOQUE7_ODOO_ALBARANES.md>
```

