# Sesión 13 ago 2026 — Imprimir fuera, Anular al Pool, ajustar itinerario vivo

> **Fuente de esta jornada.** Commits en `main`: `1addf8d`, `622fc7b`, `325429d` (noche: no wipe + prepend). Deploy: Vercel rama `main`.  
> **Caso de campo:** OT **98015** (impresión externa + recepción + hueco Desbroce).  
> **Brief relacionado:** Bloque 9 §15.6.12 (`MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`).  
> **Día siguiente (14 ago):** Encajar / flags wizard / portada — `SESION_14AGO2026_MANIPULADOS_ENCAJAR.md`.

---

## Mensaje clave

Tres huecos reales de planta, cerrados el mismo día:

1. **Mandar a imprimir fuera** una OT ya despachada para Offset/Digital, sin rehacer el despacho.
2. **Anular un hueco de mesa** sin marcar la OT como Terminada: vuelve al Pool como antes de enviarla a mesa.
3. **Meter o reordenar procesos pendientes** (p. ej. Desbroce olvidado) aunque ya haya compra y pasos hechos; y **corregir cabecera/material** a cuenta y riesgo (oficina técnica / gerencia / admin).

---

## 1. Imprimir fuera (Bloque 9 §15.6.12 — opción A)

### Qué hace

Sustituye el paso **disponible** Offset (1) o Digital (2) por **Impresión EXTERNA (21)**. Libera mesa si el hueco no se ha iniciado, deja la OT en Pool (`en_transito`) y la cola de Externos la recoge porque 21 es `es_externo`.

**No toca** CTP, guillotina ni pasos ya `en_marcha` / `finalizado`.

### Dónde sale

| Sitio | Acción | Cuándo |
|-------|--------|--------|
| **Pool OTs** | Derivar / Imprimir fuera | Próximo paso = 1 o 2, aún abierto |
| **Mesa diaria / secuenciación** | Menú **Acción → Imprimir fuera** | Máquina impresión o digital + mesa `confirmado` o ejecución `pendiente_inicio` |
| **Ejecución (tarjeta)** | Botón **Imprimir fuera** | Offset/Digital + Pendiente inicio |

Oculto si la ejecución ya está `en_curso` o `pausada`.

### Reglas

- Contenedor (barco padre): no se deriva (las hijas sí, como OT normal).
- Si ya hay un 21 abierto en itinerario: no duplica.
- Si hay hueco de mesa iniciado: error explícito — hay que cancelar o terminar esa ejecución antes.
- Al derivar: ejecuciones `pendiente_inicio` → `cancelada`; filas de mesa **borradas** (no `finalizada`); pool → `en_transito` con nota «Derivada a impresión externa».

### Piezas

| Pieza | Ruta |
|-------|------|
| Lógica | `src/lib/derivar-impresion-externa.ts` — `derivarOtAImpresionExterna`, `puedeMostrarImprimirFueraMesa` |
| Tests | `src/lib/derivar-impresion-externa.test.ts` |
| Mesa UI | `turno-column.tsx`, `planificacion-mesa-diaria-tab.tsx`, `planificacion-mesa-secuenciacion-tab.tsx` |
| Ejecución UI | `planificacion-ots-ejecucion-tab.tsx` |
| Pool | `planificacion-pool-ots-tab-v2.tsx` (acción ya prevista; misma función) |

### Prueba planta — OT 98015

**Flujo comprobado:** Imprimir fuera desde Pool → cola Externos → **modal de cantidad al Enviado** (1600 hojas brutas) → recibir 1400 netas → siguiente paso interno.

La captura envío/recepción (`ExternoCantidadDialog` + `fetchExternoEnvioBrief`) **ya estaba** al marcar Enviado/Recibido; no era trabajo de esta sesión. Prefill desde impresión/guillotina/despacho; troquel encadena `hojas_recibidas_muelle`.

**Aceptado de momento:** en muelle / envío salen las **brutas** (lo enviado). Las netas se indican en observaciones / recepción. Futuro: que muelle muestre las netas pedidas, no las brutas.

**Cartela:** 9.4 C sigue igual — consumo al **Enviado** solo si 21 es el primer consumidor (17→1/2→10→21). Si ya se cartó en guillotina, 21 no vuelve a descontar.

---

## 2. Anular hueco de mesa → Pool

### Antes

«Anular ejecución» cancelaba y dejaba `estado_mesa = finalizada` → la OT aparecía **Terminada**. Incorrecto para un hueco que aún no había arrancado.

### Ahora

**Acción → Anular y devolver al Pool…**

1. Cancela la ejecución abierta (`cancelada`) si existe.
2. **Borra** la fila de `prod_mesa_planificacion_trabajos` (no la finaliza).
3. Pool: `estado_pool = en_transito` (como antes de enviarla a mesa).

Función: `devolverHuecoMesaAlPool` en `derivar-impresion-externa.ts`. Misma idea al derivar a externa: mesa se borra, no se cierra.

Visible en mesa diaria, secuenciación y tarjeta de ejecución (Pendiente inicio).

---

## 3. Ajustar itinerario vivo (botón Ruta)

### Problema de campo (98015)

Impresión externa y Troquelado hechos. El siguiente paso salía Engomado, pero **faltaba Desbroce**. El wizard de despacho no dejaba guardar (compra ya generada) y el editor antiguo exigía que **todos** los pasos fueran `pendiente`/`disponible`.

### Qué hace el botón Ruta (OTs Despachadas)

Abre `AjustarItinerarioDialog`:

| Pasos | UI | Editable |
|-------|-----|----------|
| `finalizado` | Verde + candado | No |
| `en_marcha` | Azul + candado | No |
| `pausado` | Ámbar + candado | No |
| `pendiente` / `disponible` | Cola con picker | Sí: reordenar, quitar, añadir del catálogo |

Al guardar llama a `insertarPasosEnColaViva`:

- No borra pasos bloqueados.
- Borra solo los pendientes/disponibles.
- Inserta la nueva cola **después** del último bloqueado (`orden` continuo).
- Primer slot nuevo: `disponible` si no hay ningún `en_marcha`; si hay uno en marcha, el primero nuevo queda `pendiente`.
- Desbroce: asigna máquina `ENG-DESBROZ` igual que el replace completo.

**La compra no bloquea** este diálogo. Aviso en pantalla: *a tu cuenta y riesgo*.

### Qué no hace

No cambia material, formato, tintas ni horas. Eso es el lápiz / wizard.

`replaceProdOtItinerarioSlots` + `itinerarioPasosPermitenReemplazo` siguen existiendo para el replace **total** (solo si ningún paso ha arrancado).

---

## 4. Reeditar despacho (botón Lápiz) — aviso, no muro

### Roles que pueden forzar

`admin` · `oficina_tecnica` · `gerencia`

El rol se lee de `profiles` al abrir OTs Despachadas. El wizard recibe `forceMode` + `userRole`.

### Comportamiento

| Situación | Guardar |
|-----------|---------|
| OT no despachada / despachada sin compra | Igual que siempre |
| Despachada **con compra**, rol no privilegiado | Bloqueado (rojo) — «modifica desde Compras» |
| Despachada **con compra**, rol privilegiado | Aviso ámbar + toast *a tu cuenta y riesgo* — **sí guarda** |

Casos reales que esto cubre: el proveedor manda 72×102 en vez de 70×100; se compró Zenith y en cabecera seguía TP White. La cartela ya tiene el material real; la cabecera y los procesos abiertos deben poder alinearse.

El wizard **no** pinta los pasos hechos en verde (eso es el diálogo Ruta). El lápiz es cabecera / material / horas / datos de proceso.

---

## 5. Mapa de botones en OTs Despachadas

| Icono | Antes | Ahora |
|-------|--------|--------|
| **Ruta** | Abría el wizard | **Ajustar itinerario** (cola pendiente) |
| **Lápiz** | Wizard (bloqueado si hay compra) | Wizard **forzado** si rol privilegiado |
| Mapa | Hoja de ruta (lectura) | Igual |
| Ojo | Compra | Igual |

---

## 6. Decisiones que no hay que reabrir

1. Anular mesa **borra** el hueco; no lo deja `finalizada`.
2. Imprimir fuera **sustituye** 1/2 por 21 (opción A de §15.6.12); no inserta un 21 extra ni marca 1/2 como `saltado`.
3. Itinerario vivo: hechos = candado; pendientes = editables. Compra **no** es el candado.
4. Cabecera/material: privilegio estrecho + aviso, no bloqueo duro.
5. Muelle muestra brutas enviadas (no netas) — consciente; no es bug de esta sesión.

---

## 7. Pendiente / no hecho hoy

- ~~Wizard wipe de pasos hechos al redespachar~~ ✅ **corregido 13 ago noche**: con pasos bloqueados el wizard no hace delete+insert; usa cola viva o deja el itinerario. UI avisa → usar Ruta.
- ~~Insertar solo al final en Ruta~~ ✅ **corregido**: `addPosition=prepend` + flechas ↑↓ en el picker.
- Prefill de horas al añadir proceso desde Ajustar itinerario: el paso entra en cola; horas se completan luego.
- Muelle: mostrar netas pedidas en vez de brutas.
- Plan engomado desde salida troquel (sigue en backlog Bloque 9).
- OCR albarán / sobrantes al cierre.

**14 ago (otra sesión):** Encajar en Manipulados + flags wizard + `/produccion` → OTs. Campo Ruta en OT **36286**. Ver `SESION_14AGO2026_MANIPULADOS_ENCAJAR.md`.

---

## 8. Archivos tocados

| Commit | Qué |
|--------|-----|
| `1addf8d` | Derivar a 21, anular→Pool, acción mesa/ejecución, tests |
| `622fc7b` | `insertarPasosEnColaViva`, `AjustarItinerarioDialog`, wizard `forceMode`, cableado OTs Despachadas |
| `325429d` | Wizard: no wipe de pasos hechos; picker Ruta `prepend` + flechas ↑↓ |

Archivos clave:

- `src/lib/derivar-impresion-externa.ts`
- `src/lib/prod-ot-itinerario-client.ts` (`insertarPasosEnColaViva`)
- `src/components/produccion/ots/ajustar-itinerario-dialog.tsx`
- `src/components/produccion/ots/despacho-wizard-dialog.tsx`
- `src/components/produccion/ots/ots-despachadas-page.tsx`
- `src/components/produccion/ots/ots-despachadas-columns.tsx`
- Mesa / ejecución: `turno-column.tsx`, `planificacion-mesa-diaria-tab.tsx`, `planificacion-mesa-secuenciacion-tab.tsx`, `planificacion-ots-ejecucion-tab.tsx`
