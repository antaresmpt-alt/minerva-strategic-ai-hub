# CTP en wizard de despacho y ejecución

> **Fecha nota inicial:** 24 jun 2026  
> **Última actualización:** 30 jun 2026  
> **Usuarios CTP:** Gemma y Marc (`ctp@minervaglobal.es`, `ctp2@minervaglobal.es`, rol `ctp`).  
> **Estado:** ✅ **Implementado v1** — pendiente feedback piloto con Marc/Gemma (3 OTs piloto).

---

## Resumen ejecutivo

| Fase | Qué hace | Estado |
|------|----------|--------|
| **Despacho** (wizard → Producción → CTP) | Marca checkboxes de lo **requerido** para esta OT (`requiere_*` en `datos_proceso`) | ✅ |
| **Ejecución CTP** (mesa / OTs en ejecución) | Muestra **todas** las tareas; las pedidas en despacho van **sombreadas**; el operario marca **hecho** (`pdf_x_ok`, `gestion_fsc`, etc.) | ✅ híbrido 30 jun |
| **Cierre CTP** | Aviso toast si faltan tareas **pedidas en despacho** sin confirmar (no bloquea) | ✅ |
| **Hoja de Ruta Simplificada** | PDF A5 al despachar: cabecera + itinerario + checkbox y línea de firma por proceso | ✅ |

---

## Modelo de dos fases

| Fase | Quién | Qué |
|------|-------|-----|
| **Despacho** | Oficina (wizard tab Producción → CTP) | Marca checkboxes de lo **requerido** para esta OT. Puede dejar en blanco lo que aún no se sabe. |
| **Ejecución CTP** | Gemma / Marc (mesa / cola CTP) | Ven lo requerido destacado, ejecutan, marcan **hecho**. Pueden marcar también tareas **no pedidas** si surgen (FSC, retoque, etc.). |

### Reglas de negocio

- En **despacho**: las opciones son **requeridas si se marcan**, pero **no es obligatorio marcar todas** al despachar.
- En **ejecución**: UI **híbrida** (30 jun): las 9 tareas visibles siempre; las pedidas en despacho con recuadro ámbar/verde; el resto en gris («Opcional» / «Hecho adicional»).
- Al **cerrar CTP**: solo se avisa por tareas con `requiere_*` sin `hecho` correspondiente.

Analogía: despacho = «pedido de trabajo»; ejecución = «albarán de hecho».

---

## Catálogo de tareas CTP (9 + 3 solo ejecución)

Definidas en `src/lib/ctp-despacho.ts` y `CTP_PREIMPRESION_CAMPOS` (`hoja-ruta-campos-config.ts`, proceso id **16**):

| Campo ejecución | Campo despacho (`requiere_*`) | Etiqueta |
|-----------------|-------------------------------|----------|
| `prueba_digital` | `requiere_prueba_digital` | Prueba digital |
| `prueba_gmg` | `requiere_prueba_gmg` | Prueba GMG |
| `pdf_x_ok` | `requiere_pdf_x_ok` | **PDF X OK** |
| `maqueta` | `requiere_maqueta` | Maqueta |
| `gestion_troquel` | `requiere_gestion_troquel` | Gestión troquel |
| `preparacion_montaje` | `requiere_preparacion_montaje` | Preparación montaje |
| `retoque_diseno` | `requiere_retoque_diseno` | Retoque diseño |
| `gestion_relieves_stamping` | `requiere_gestion_relieves_stamping` | Relieves / stamping |
| `gestion_fsc` | `requiere_gestion_fsc` | Gestión FSC |
| `planchas_hechas` | — | Solo ejecución |
| `num_planchas` | — | Solo ejecución |
| `horas_proceso` | — | Solo ejecución |

---

## UX implementada

### Wizard — tab Producción, bloque CTP

- Grid de 9 checkboxes («Instrucciones CTP para esta OT»).
- Semilla `requiere_*` en `prod_ot_pasos.datos_proceso` vía `buildCtpRequisitosSeedFromWizard()`.
- Tab Resumen: línea CTP con tareas marcadas.
- Re-despacho mismo itinerario: **merge** de seeds sin borrar datos de ejecución (`mergeDatosProcesoSeed`).

### Wizard — tras despachar

- Pantalla de éxito con **Imprimir hoja simplificada** / **Descargar PDF**.
- PDF: **Hoja de Ruta Simplificada**, DIN A5 vertical (`hoja-ruta-simplificada-{OT}.pdf`).

### Editar despacho (wizard, no modal legacy)

- OT Maestro, OTs Despachadas (icono verde + lápiz), Pool planificación → `DespachoWizardDialog`.

### Ejecución CTP — `ctp-ejecucion-requisitos-block.tsx`

- Bloque «Tareas CTP» encima de maquinista/incidencias.
- Estilos: pedido pendiente (ámbar), pedido hecho (verde), opcional (gris), adicional hecho (blanco).
- Campos duplicados excluidos del acordeón «Datos del proceso» (`excludeFieldIds`).
- Chips compactos en vistas reducidas: requeridos + cualquier tarea marcada hecha.

### Validación al cerrar

- `ctpRequisitosPendientes()` → toast warning (soft).
- Planchas / horas reales siguen en «Datos del proceso».

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/lib/ctp-despacho.ts` | Definiciones, seeds, merge, helpers estado |
| `src/lib/despacho-wizard-shared.ts` | `DespachoWizardCtpDatos`, `buildDatosProcesoSeed` |
| `src/components/produccion/ots/despacho-wizard-dialog.tsx` | UI despacho + post-despacho print |
| `src/components/produccion/planificacion/ctp-ejecucion-requisitos-block.tsx` | UI ejecución híbrida |
| `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx` | Integración bloque CTP + cierre |
| `src/lib/hoja-ruta/hoja-ruta-cartelita-pdf.ts` | Hoja de Ruta Simplificada A5 |

---

## Commits de referencia (rama `feature/bloque8.1-pool-mesa-ejecucion-fixes`)

| Commit | Contenido |
|--------|-----------|
| `0a3021d` | CTP checkboxes en wizard (inicio) |
| `074575b` | PDF X OK + wizard en OTs Despachadas / Pool |
| `7f292cc` | CTP resumen + Hoja de Ruta Simplificada |
| `2fb50ad` | CTP ejecución híbrida + A5 + textos |

---

## Prueba manual (validada 30 jun — OT 35989)

1. Despachar OT con CTP → marcar PDF X OK, gestión troquel, preparación montaje, prueba digital, etc.
2. Imprimir **Hoja de Ruta Simplificada** → A5, itinerario con líneas de firma.
3. Mesa CTP / OTs en ejecución → ver 9 tareas; pedidas sombreadas.
4. Marcar hechas + tarea adicional (ej. retoque diseño) → guardar.
5. Cerrar proceso → aviso solo si falta alguna **pedida en despacho**; planchas/horas en datos del proceso.

---

## Pendiente / siguiente iteración

- [ ] **Feedback Marc/Gemma** con 3 OTs piloto (añadir/quitar tareas del catálogo).
- [ ] Chips CTP en columna pool mesa diaria (opcional).
- [ ] Mostrar requisitos CTP en PDF hoja de ruta completa (no solo simplificada).
- [ ] Reimprimir hoja simplificada desde `HojaRutaOtDialog` (botón dedicado).
- [ ] Endurecer validación al cerrar (bloquear vs aviso) según acuerdo planta.

---

## Fuera de alcance

- Sustituir Optimus como fuente de verdad de diseño.
- Obligar a marcar todo en despacho antes de guardar.
- CTP compartido entre hijas de contenedor (cada hija independiente hoy).

---

## Relacionado

- `GUIA_MAÑANA.md` — demo OT 98010, piloto CTP  
- `FASES_HOJA_RUTA_DIGITAL.md` — Bloque 4 (PDF) + sesión 30 jun  
- `src/lib/hoja-ruta-campos-config.ts` — `CTP_PREIMPRESION_CAMPOS`, `PROCESO_CTP_ID = 16`
