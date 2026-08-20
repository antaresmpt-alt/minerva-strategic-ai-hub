# Bloque 9.8.3 — Compra de corrección: validación hook salida STOP

**Fecha:** 20 ago 2026  
**Estado:** ✅ Implementado (pendiente prueba en planta)

---

## Eventos de salida de STOP (coherencia 9.8.1 / 9.8.3 / 9.8.4)

### Resumen

El ciclo STOP material tiene **dos** eventos que disparan la salida automática de `estado_material` STOP:

1. **Asignación de cartela libre a OT** (9.8.4)
2. **Consumo de material en producción** (9.8.3)

Ambos eventos actualizan `produccion_ot_despachadas.estado_material` a `'Material en stock asignado'` cuando la OT estaba bloqueada en:

- `'Sin material asignado (liberado)'` (post 9.8.1)
- `'Pendiente compra de corrección'` (post 9.8.3)

---

## Detalle de hooks

### 1. Hook asignación (9.8.4)

**Función:** `prod_stock_asignar_palet_ot`  
**Cuándo:** Juan (o sistema) asigna una cartela libre a una OT mediante:
  - UI Stock → botón "Asignar a OT" (7.2)
  - UI Cartelas → botón "Asignar" (9.8.4)

**Camino cubierto:** Stock libre → asignación explícita → consumo posterior (estado ya limpio al consumir).

**Código:**

```sql
-- Líneas 88-106 en 20260820090000_bloque9_8_4_asignar_estado_material_ampliado.sql
update public.produccion_ot_despachadas
set estado_material = 'Material en stock asignado'
where ot_numero = v_ot_clean
  and (
    estado_material is null
    or btrim(estado_material) = ''
    or btrim(estado_material) in (
      'Sin material asignado (liberado)',
      'Pendiente compra de corrección',
      'Sin orden compra',
      'Sin orden de compra',
      '"Sin orden compra"',
      'Pendiente de pedir',
      'Compra cancelada'
    )
  );
```

### 2. Hook consumo (9.8.3)

**Función:** `prod_stock_registrar_consumo`  
**Cuándo:** Operario cierra un paso de producción (CTP, Guillotina, Impresión, etc.) que consume material de una cartela.

**Camino cubierto:** Compra corrección → muelle → cartela con reserva directa (sin asignación explícita) → consumo limpia STOP.

**Código:**

```sql
-- Líneas 119-127 en 20260820173100_bloque9_8_3_consumo_salida_stop.sql
if v_ot_clean is not null then
  update public.produccion_ot_despachadas
  set estado_material = 'Material en stock asignado'
  where ot_numero = v_ot_clean
    and btrim(estado_material) in (
      'Sin material asignado (liberado)',
      'Pendiente compra de corrección'
    );
end if;
```

**Nota:** Hook consumo solo limpia estados STOP explícitos, preservando otros estados válidos (e.g., `'Material recibido'`). Hook asignación es más amplio (cubre también `null`, `''`, `'Sin orden compra'`, etc.).

---

## Coherencia con decisión §14

Ambos hooks:

- ✅ **Limpian STOP automáticamente** (no requieren intervención manual).
- ✅ **Usan el mismo estado destino:** `'Material en stock asignado'`.
- ✅ **Son simétricos:** aplican al mismo conjunto de estados STOP (`liberado`, `corrección`).
- ✅ **No inventan convención nueva:** reutilizan el estado ya definido en 9.8.4.

**Evento disparador confirmado:**

| Evento | Función | Momento | Quién |
|--------|---------|---------|-------|
| **Asignación** | `prod_stock_asignar_palet_ot` | Juan asigna cartela libre a OT | Juan (almacén) |
| **Consumo** | `prod_stock_registrar_consumo` | Operario cierra paso con consumo material | Operario (CTP, Guillotina, etc.) |

**Salida coherente con 9.8.1/9.8.4:** ✅ Confirmado.

---

## Hueco #5 resuelto

El brief (líneas 340-343, §12.1) documentó:

> `estado_material` de 98019 sigue `'Sin material asignado (liberado)'` **después** de asignar `#10984` y consumirla. Badge STOP queda sucio.

Este hueco queda cerrado con la implementación 9.8.3:

- **Al asignar** `#10984` → `estado_material` limpiado por `prod_stock_asignar_palet_ot`.
- **Al consumir** en Guillotina → `estado_material` limpiado por `prod_stock_registrar_consumo` (si aún estaba en STOP).

**Estado:** Hueco #5 cerrado. Pendiente validación en planta (98020 o nueva OT lab).

---

## Siguiente paso

**Validación:** Los dos hooks cubren **caminos distintos**, no redundantes. Validar ambos:

### Camino A: Asignación explícita (hook 9.8.4)

1. Liberar cartela (9.8.1) → `estado_material = 'Sin material asignado (liberado)'`.
2. Crear compra de corrección (9.8.3) → `estado_material = 'Pendiente compra de corrección'`.
3. Recibir + cartelar + **asignar con botón "Asignar a OT"** (9.8.4) → `estado_material = 'Material en stock asignado'` ✅ (hook asignación).
4. Consumir en Guillotina → verificar que badge **no vuelve a STOP** (estado ya limpio, hook consumo no se dispara).

### Camino B: Reserva directa desde muelle (hook 9.8.3 consumo)

1. Liberar cartela (9.8.1) → `estado_material = 'Sin material asignado (liberado)'`.
2. Crear compra de corrección (9.8.3) → `estado_material = 'Pendiente compra de corrección'`.
3. Recibir + **cartelar con reserva directa a OT** (flujo muelle normal, sin pasar por botón "Asignar") → `estado_material` sigue `'Pendiente compra de corrección'`.
4. Consumir en Guillotina (9.4 + 9.8.3 hook consumo) → `estado_material = 'Material en stock asignado'` ✅ (hook consumo se dispara aquí).

**Crítico:** El camino A ejercita el hook de asignación; el camino B ejercita el hook de consumo. **Ambos son necesarios** para validar completamente el hueco #5.

**Usuario:** Confirmar en Despachadas que el badge refleja correctamente el estado tras cada paso en **ambos** caminos.
