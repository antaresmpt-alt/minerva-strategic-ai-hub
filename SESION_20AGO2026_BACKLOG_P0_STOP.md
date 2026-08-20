# SESION 20 AGO 2026 — Implementación backlog P0 (7.1, 7.2, 7.3)

**Fecha**: 20 agosto 2026  
**Contexto**: Tras validación exhaustiva de 98020 (19 ago), se implementan 3 tareas P0 del backlog §7.  
**Modelo**: Claude Sonnet 4.5  
**Branch**: `main`

---

## Executive Summary

Implementadas 3 tareas prioritarias del backlog post-validación 98020:

1. **7.1 Reset planificación STOP**: Botón admin para anular huecos mesa posteriores tras revertir consumo, con confirmación.
2. **7.2 Asignar OT desde Stock**: Botón "Asignar a OT" en detalle de Stock (sin necesidad de ir a Cartelas).
3. **7.3 Búsqueda server-side Cartelas**: Input busca id_stock/albarán/OT sin límite de 200 filas.

**Estado**: Las 3 tareas están en `main` y listas para validación en lab.

---

## 7.1 — Reset planificación STOP (`a553e20`)

### Objetivo

Crear acción explícita para anular planificación posterior tras STOP material, en lugar de cascade silencioso.

### Diseño (coherente con §19 del brief)

- **Botón**: "Reset planificación STOP" (rojo, icono Ban) en paso-admin-actions
- **Permisos**: admin / oficina_tecnica / gerencia (mismos que liberar/revertir; **no** el set más estrecho de reabrir paso)
- **Flujo**:
  1. Identifica pasos con orden > actual que tengan huecos en mesa activos
  2. Muestra diálogo con lista de N huecos (proceso nombre, mesa ID)
  3. Confirmación: "Se van a anular N hueco(s). ¿Continuar?"
  4. Ejecuta `devolverHuecoMesaAlPool` para cada uno
  5. OT devuelta al pool (`en_transito`)

### Implementación

**Archivos modificados**:
- `src/lib/prod-paso-admin-permisos.ts`: Nueva función `puedeResetPlanificacionStop`
- `src/lib/prod-paso-admin-client.ts`: Nueva función `fetchHuecosMesaPosteriores` que busca pasos posteriores con mesa activa
- `src/components/produccion/planificacion/paso-admin-actions.tsx`: Botón + diálogo con confirmación

**Lógica**:
```typescript
// Busca pasos con orden > actual
const pasos = await fetchPasosItinerarioAdmin(supabase, otId);
const huecos = await fetchHuecosMesaPosteriores(supabase, otId, pasoOrden);

// Por cada hueco: devolverHuecoMesaAlPool
for (const hueco of huecos) {
  await devolverHuecoMesaAlPool(supabase, {
    otNumero,
    mesaTrabajoId: hueco.mesaId,
    ejecucionId: hueco.ejecucionId,
  });
}
```

**UI**:
- Badge rojo con icono Ban
- Diálogo carga huecos al abrir
- Lista scrolleable de huecos (nombre proceso, mesa ID)
- Botón rojo "Anular huecos y devolver al Pool" (disabled si 0 huecos)

### Principios respetados

✅ **P5** (aviso + confirmación antes de destructiva)  
✅ **Explícito > implícito**: no cascade silencioso  
✅ **No muro, aviso**: usuario decide cuándo limpiar mesa  

---

## 7.2 — Asignar OT desde Stock (`a019d27`)

### Objetivo

Facilitar asignación de stock libre a OT sin necesidad de ir a Cartelas → Cartelas creadas → buscar ID.

### Implementación

**Archivo modificado**:
- `src/components/produccion/almacen/stock/stock-page.tsx`

**Cambios**:
1. **Botón en `DetalleDialog`** (sección Sobrantes):
   - Verde con icono Link2
   - Visible solo cuando `esStockLibre = row.ots.length === 0`
   - Al lado de "Ajustar cantidad" y "Partir palet"

2. **Diálogo de asignación**:
   - Input OT número (required)
   - Textarea notas (opcional)
   - Llama `prod_stock_asignar_palet_ot` (RPC ya existente)
   - Toast éxito: "Cartela #ID asignada a OT XXX. Material en stock asignado."

**UX mejorada**:
- Antes: Stock → ver ID → Cartelas → buscar ID (con límite 200) → asignar
- Ahora: Stock → detalle → Asignar a OT (directo)

---

## 7.3 — Búsqueda server-side Cartelas (`c1cbd01`)

### Objetivo

Permitir buscar cartelas sin estar limitado a las 200 filas más recientes.

### Implementación

**Archivo modificado**:
- `src/components/produccion/almacen/cartelas/cartelas-page.tsx`

**Cambios**:

1. **Lógica server-side** (`loadCartelas`):
   - Si `searchCartelas` vacío: `.limit(200)` como antes
   - Si hay búsqueda:
     - Parsea como `id_stock` numérico → `.eq("id_stock", num)`
     - Si no es número → `.ilike("nota_entrega", "%term%")` (albarán)
     - Luego filtra por OT en join `prod_stock_palet_ots`
   - **Sin límite** cuando se busca

2. **UI**:
   - Input con icono Search
   - Placeholder: "ID Stock, albarán o OT (Enter busca)"
   - `onKeyDown Enter` dispara `loadCartelas()`
   - Mensaje debajo: "Búsqueda server-side activa: «term» · Sin límite de 200 filas."

3. **Filtro client-side eliminado**:
   - Variable `search` eliminada
   - `filteredCartelas` ahora solo filtra por `mostrarPruebas`
   - Toda búsqueda de texto es server-side

### Casos de uso

- `10985` → busca `id_stock = 10985`
- `ALB-2024-123` → busca `nota_entrega ILIKE '%ALB-2024-123%'`
- `98020` → busca `ot_numero` en join (si no match en id_stock)

---

## Validación 7.3 (Cartelas — búsqueda server-side)

**Estado final**: ✅ VALIDADO (con 4 fixes iterativos durante el lab)

### Pasos y resultados

| # | Paso | Resultado |
|---|------|-----------|
| 7.3.1 | Buscar cartela de prueba por `id_stock` (e.g. `10985`) | ✅ Aparece sola |
| 7.3.2 | Verificar búsqueda levanta > 200 filas (sin límite) | ✅ |
| 7.3.3 | Buscar por albarán parcial | ✅ |
| 7.3.4 | Buscar `98020` (OT número numérico) | ❌ → Fixed |
| 7.3.5 | Crear cartela de prueba con wizard → no auto-colapsa lista | ✅ (tras fix) |
| 7.3.6 | Filtro ID Stock independiente no da resultados cruzados falsos | ✅ |

### Bugs encontrados y fixes aplicados

| # | Bug | Fix | Commit |
|---|-----|-----|--------|
| B1 | `id_stock` numérico solo hacía exact match → búsqueda OT `98020` no salía | Combinar búsqueda: `id_stock` (prefijo/rango) + `ot_numero` (ilike) + `nota_entrega` (ilike) en `Promise.all` | `153ec42` |
| B2 | `id_stock::text ILIKE` rechazado por PostgREST (columna integer) | `idStockPrefixOrFilter`: genera rangos numéricos (`gte`/`lt`) para simular búsqueda parcial de entero | `ec4040a` |
| B3 | Overflow `int4` en rangos para prefijos largos (e.g. `1067`) → error `22003` | Añadir cap `PG_INT4_MAX` en `idStockPrefixOrFilter` | `2b13786` |
| B4 | Input único → `1067` devolvía cientos de filas (match en `nota_entrega` como `410679668`) | Separar en **3 inputs independientes**: ID Stock / Albarán-OT / Material (AND logic server-side) | `54d7c4b` |
| B5 | Tras crear cartela con wizard, `handleWizardCreated` seguía rellenando filtro → lista se colapsaba | Eliminar auto-fill; wizard solo limpia filtros | `3b973d3` |
| B6 | Build Vercel: `setSearch` llamado pero estado renombrado a `searchCartelas` | Renombrar correctamente | `177b656` |

### UX final (3 inputs)

```
[ ID Stock: _____ ]  [ Albarán / OT: _____ ]  [ Material: _____ ]
```
- AND logic: solo muestra cartelas que matcheen todos los filtros activos
- Cada input dispara búsqueda server-side al presionar Enter
- Sin límite de 200 cuando hay búsqueda activa

---

## Validación 7.2 (Asignar OT desde Stock)

**Estado final**: ✅ MECANISMO VALIDADO — 2 gaps P2 detectados

### Pasos y resultados

| # | Paso | Resultado |
|---|------|-----------|
| 7.2.1 | Botón "Asignar a OT" visible en stock libre (`#99022`) | ✅ |
| 7.2.2 | Botón oculto en palet con OT ya asignada (`#99023`) | ✅ |
| 7.2.3 | Split `#99020` 1000h → 900h + 100h → nueva cartela `#10986` | ✅ Toast OK |
| 7.2.4 | Abrir `#10986`, clicar "Asignar a OT", teclear `35760`, confirmar | ✅ Toast: "Cartela #10986 asignada a OT 35760. Material en stock asignado." |
| 7.2.5 | `#10986` en lista Stock muestra OT `35760` | ✅ |
| 7.2.6 | `#99020` queda con 100h libres | ✅ |

### Gaps detectados (backlog)

| # | Gap | Prioridad | Ref backlog |
|---|-----|-----------|-------------|
| G1 | `estado_material` en OT 35760 sigue "Sin orden de compra" tras asignar. El RPC 9.8.4 solo actualiza si OT venía de STOP (`liberado`/`Pendiente corrección`) — si la OT nunca pasó por STOP, el `WHERE` no hace match. Ampliar WHERE del RPC. | P2 | §18.11 |
| G2 | Pool semáforo sigue en rojo ("Sin compra generada - no se puede enviar a mesa") aunque hay cartela asignada | P2 | §18.9 |
| G3 | Campo OT destino sin inteligencia (campo libre, sin autocompletar ni validar existencia) | P2 | §18.15 |

---

## Validación 7.1 (Reset planificación STOP)

**Estado final**: 🔲 PENDIENTE — Lab 20/08

### Escenario rápido propuesto: OT 98020 simulada

**Objetivo**: Tener una OT con ≥1 paso finalizado y ≥1 paso siguiente en mesa activo, para validar que el botón "Reset planificación STOP" identifica y anula correctamente los huecos.

**Pasos del lab**:

1. Ir a OT 98020 (o clonar configuración) → Hoja de Ruta
2. Verificar qué pasos tiene en mesa actualmente (Impresión u otro)
3. Si no hay pasos en mesa: planificar Impresión Offset en mesa (sin ejecutar)
4. Ir a un paso anterior (e.g., Guillotina / CTP) → botón admin → "Reset planificación STOP"
5. Verificar que el diálogo lista el hueco de Impresión
6. Confirmar → verificar:
   - Hueco desaparece de mesa (Mesa diaria)
   - OT vuelve al Pool (`en_transito`)
   - Toast confirmación

**OTs candidatas conocidas**:
- `98020`: Lab principal, conocida, múltiples pasos. Verificar si tiene huecos activos en mesa.
- Nueva OT clon de 98016 ó 98020 si la anterior está "sucia".

---

## Deuda técnica / mejoras opcionales

- **7.1**: Añadir preview mejorado (nombre completo paso, mesa, fecha/hora planificada)
- **7.3**: Indexar `nota_entrega` si búsqueda lenta con volumen alto
- **7.3**: Búsqueda por `material_nombre` ya disponible en tercer input (material)

---

## Decisiones de diseño

### Por qué NO cascade silencioso (7.1)

- **Reversibilidad**: Anular mesa es destructivo; usuario debe confirmarlo
- **Transparencia**: Lista explícita de lo que se va a anular
- **Control**: Usuario puede querer resetear solo parte de la planificación
- **Auditabilidad**: Acción explícita queda más clara en logs

### Por qué búsqueda server-side (7.3)

- **Escalabilidad**: El límite 200 se volvió bloqueante en lab (98020 split generó ID 10985, fuera de top 200)
- **Performance**: Buscar en DB es más rápido que cargar 200+ filas y filtrar client-side
- **UX**: Mensaje claro "server-side activo" evita confusión sobre qué se está buscando

---

## Notas siguiente sesión

- Validar **7.1** con escenario de mesa arriba
- Si lab OK → continuar con **P1**:
  - 9.8.3 Compra corrección (type `correccion`, allowlist batch)
  - 9.8.6 Popup redespacho asistido
- Luego **P2** prioritarios: §18.11 (estado_material OT no-STOP) + §18.9 (semáforo Pool stock)
