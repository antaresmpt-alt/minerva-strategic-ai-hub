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

## Validación pendiente

- **7.1**: Lab con OT que tenga pasos posteriores en mesa tras revertir consumo
- **7.2**: Lab asignar stock libre desde Stock → detalle
- **7.3**: Lab buscar cartelas por ID/albarán/OT, verificar que carga > 200

---

## Deuda técnica / mejoras opcionales

- **7.1**: Añadir preview de pasos a anular (nombre completo, OT, mesa fecha/hora)
- **7.3**: Indexar `nota_entrega` si búsqueda es lenta (depende de volumen)
- **7.3**: Añadir búsqueda por material_nombre (actual: solo id/albarán/OT)

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

## Notas para siguiente sesión

- Validar las 3 tareas en lab (recomendado: usar OT nueva para 7.1, probar con 98020 para 7.2/7.3)
- Si lab OK, continuar con **P1**:
  - 9.8.3 Compra corrección P2 (type `correccion`, allowlist batch)
  - 9.8.6 Popup redespacho asistido
