# Plan de fases · Maestro de Artículos

> Estado actual: **v0.1 entregada** (2026-06-02)
> Lo que tienes: ruta `/produccion/articulos`, tabla, filtros, modal crear/editar, import Excel con diff preview, export, plantilla descargable, sidebar agrupado por bloques.

---

## ✅ Fase 0 — Base (completada)

- [x] Migración SQL: ampliar `prod_referencias` con campos técnicos (tipo, dimensiones, material, troquel, poses, tintas, acabado, ruta, notas, activo, trazabilidad).
- [x] Índice único compuesto `(cliente, referencia_cliente)` cuando ambos tienen valor → evita duplicados accidentales.
- [x] Tipos TypeScript actualizados (`ProdReferenciaRow`, `ArticuloExcelRow`).
- [x] Librería `src/lib/articulos-maestro-import.ts`: parse Excel, diff, apply, export, plantilla.
- [x] Página `ArticulosMaestroPage` con tabla + filtros + modales crear/editar.
- [x] Import Excel con vista previa (nuevos / modificados / sin cambios).
- [x] Export Excel del catálogo actual (filtrado).
- [x] Plantilla Excel descargable con 3 filas de ejemplo.
- [x] Sidebar reagrupado en bloques: **Operativa · Flujos · Maestros**.

---

## ✅ Fase 1 — Badges de completitud avanzados (completada 2026-06-03)

Indicadores visuales para detectar fichas incompletas y priorizar el relleno.

**Niveles de completitud:**

| Nivel | Condición | Badge |
|-------|-----------|-------|
| `solo_codigo` | Sin `referencia_cliente` ni `descripcion` | ⚫ Solo código |
| `sin_tecnica` | Tiene `referencia_cliente` o `descripcion`, sin técnica | 🔴 Sin técnica |
| `parcial` | Tiene identidad + algún campo técnico (material/troquel/tintas/poses) | 🟡 Parcial |
| `completa` | Identidad + material + troquel + tintas + ruta | ✅ Completa |

**Implementado:**
- [x] Función `completitudNivel()` con 4 niveles + componente `CompletitudBadge`.
- [x] Filtro nuevo por completitud (incl. opción "Sin técnica o menos").
- [x] Contador desglosado en cabecera: `X completas · Y parciales · Z sin técnica · W solo código`.

**Archivos tocados:**
- `src/components/produccion/articulos/articulos-maestro-page.tsx`

---

## Fase 2 — Auto-enriquecimiento desde despacho (≈ 45 min)

Cuando el usuario despacha una OT y rellena datos técnicos, puede guardarlos como predeterminados en el maestro con un click.

**Nota Bloque 8 (16 jun):** el campo `tamano_hoja` en despacho es hoy **formato de compra**, no necesariamente formato de impresión. Futuro: `formato_compra_habitual` y `formato_impresion_habitual` en maestro + encadenado por proceso. Ver `MINERVA_BLOQUE8_FORMAS_Y_FORMATOS.md` §2.

**UX propuesta:**
En el modal de despacho, después de seleccionar la Referencia Minerva, aparece un pequeño bloque colapsable:
> 💡 "Guardar como predeterminado para M-00001: Zenith 300g · 4 poses · TAG00205 · 4+1 · Barniz brillo"
> [Guardar en maestro] [Descartar]

**Regla:** solo se actualiza si el campo está vacío en el maestro **o** si el usuario lo acepta explícitamente. Nunca sobrescribe sin confirmar.

**Archivos a tocar:**
- `src/components/produccion/ots/master-ots-page.tsx` (añadir botón/bloque en sección de despacho)
- `src/components/produccion/ots/ots-despachadas-page.tsx` (igual para edición)
- `src/lib/articulos-maestro-import.ts` (añadir función `upsertSugerenciasTecnicas`)

---

## Fase 3 — Trazabilidad automática (≈ 30 min)

Cuando el sistema cierra una OT (el itinerario completa todos los pasos), actualizar automáticamente en `prod_referencias`:
- `ultima_ot_numero` → número de esa OT
- `ultima_ot_fecha` → fecha de cierre
- `total_repeticiones` → incremento +1

**Opciones de implementación:**
- A) Supabase Function / Trigger en `prod_ot_pasos` cuando todos los pasos del itinerario quedan en `completado`.
- B) Desde el frontend al cerrar el último paso (más sencillo de implementar ahora).

**Archivos a tocar:**
- `supabase/migrations/XXXXXXX_trigger_trazabilidad_referencias.sql` (opción A)
- O el componente que gestiona el cierre de pasos (opción B).

---

## Fase 4 — Sugerencias desde histórico (≈ 60 min)

Para fichas con datos técnicos vacíos, calcular los valores más frecuentes mirando las últimas N OTs reales asociadas a esa referencia.

**UX propuesta:**
En el modal de edición del maestro, botón "Calcular sugeridos desde histórico" →
muestra un panel con los valores más frecuentes de las últimas 5-10 OTs cerradas:
> Material más frecuente: Zenith 300g (7/10 veces)
> Troquel más frecuente: TAG00205 (10/10)
> Poses más frecuente: 4 (8/10)
> [Aplicar todos] [Aplicar seleccionados]

**Query base:**
```sql
select
  material, count(*) as n
from produccion_ot_despachadas
where referencia_id = $1 and material is not null
group by material
order by n desc
limit 5;
```

**Archivos a tocar:**
- `src/components/produccion/articulos/articulos-maestro-page.tsx`
- Posible nuevo componente `articulos-historial-sugeridos.tsx`

---

## Fase 5 — Anti-duplicados avanzados (≈ 30 min)

Ampliar el picker `ReferenciaMinervaPicker` para:
- Si tecleas un `referencia_cliente` que ya existe en otra referencia del mismo cliente, mostrar aviso:
  > ⚠️ "Ya existe `M-00001` para `EU858` · LABORATORIOS ANUR ¿usar esa?"
- Si creas sin código, sugerir automáticamente el siguiente `M-NNNNN` libre (ya lo hace en la pestaña maestro, pendiente de llevarlo al picker inline).

**Archivos a tocar:**
- `src/components/produccion/ots/referencia-minerva-picker.tsx`

---

## Fase 6 — Integración con itinerario habitual (≈ 45 min)

Si la referencia tiene `ruta_habitual` informada, al seleccionarla en el despacho ofrecer:
> 🗺️ "Esta referencia tiene ruta habitual: `impresion → troquelado → engomado`"
> [Aplicar ruta]

Esto ya casi existe (el clonado de itinerario desde OT anterior), pero habría que añadir el camino alternativo: clonar desde `ruta_habitual` del maestro cuando no hay OT anterior con itinerario.

**Archivos a tocar:**
- `src/components/produccion/ots/master-ots-page.tsx`
- `src/lib/prod-ot-itinerario-client.ts`

---

## Fase 7 — Exportar/Importar masivo desde Optimus (≈ 60 min)

Herramienta de migración única: dado un Excel exportado directamente de Optimus (formato crudo, sin limpiar), limpiar, deduplicar y poblar el maestro de artículos.

Pendiente de diseño hasta tener el formato exacto del export de Optimus.

---

## Recordatorio de convenciones del proyecto

- Todos los códigos: `M-NNNNN` (5 dígitos, padding de ceros).
- Cabeceras Excel: siempre en clave técnica (igual que la columna BD), no en español natural.
- Celdas vacías en Excel importado: **no borran datos existentes** en BD.
- Campos nuevos en `prod_referencias`: siempre nullable → cambio aditivo, no rompe nada.
- RLS: la tabla tiene política `authenticated` → cualquier usuario logueado puede leer y escribir.
