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

## Fase 2 — Auto-enriquecimiento desde despacho (✅ jul 2026)

Cuando el usuario despacha una OT y rellena datos técnicos, puede guardarlos como predeterminados en el maestro con un click.

**Nota Bloque 8 (17 jun):** el campo `tamano_hoja` en despacho es hoy **formato de compra**, no necesariamente formato de impresión. Futuro: `formato_compra_habitual` y `formato_impresion_habitual` en maestro + encadenado por proceso. Ver `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §6.

**Relación con Bloque 6.x:** esta fase es el **bootstrap manual** (despacho → `*_habitual`). El recálculo de **promedios** desde histórico (`prod_ot_producidas`) es distinto y vive en `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md` §7.1. No se toca el prefill automático del wizard (sigue mandando el último despacho de la referencia); ver §7.1.8.

**UX:**
En el wizard de despacho (pestaña Resumen), si hay Referencia Minerva y datos técnicos:
> 💡 Guardar como predeterminado para M-00001: Zenith 300g · 4 poses · TAG00205 · …
> [Guardar en maestro] — solo vacíos; si hay conflictos, confirma sobrescritura.

**Regla:** solo se actualiza si el campo está vacío en el maestro **o** si el usuario lo acepta explícitamente. Nunca sobrescribe sin confirmar.

**Archivos:**
- `src/lib/articulos-maestro-sugerencias.ts` — `buildSugerenciasFromDespacho` + `upsertSugerenciasTecnicas`
- `src/components/produccion/ots/despacho-wizard-dialog.tsx` — bloque UI en Resumen

### Ampliación Fase 2 — Olas (jul 2026)

> Prefill automático del wizard **no se cambia** en ninguna ola (sigue último despacho).
> Promedios de horas (entrada vs millar) → `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md` §7.1.10; **no** en estas olas.

| Ola | Qué | Estado |
|-----|-----|--------|
| **0** | MVP: 6 campos (`material`, poses, troquel, tintas, acabado, tipo engomado) | ✅ Hecho |
| **1** | Embalaje + `ruta_habitual` + ampliar “Guardar en maestro” | ⏳ Siguiente |
| **2** | Defaults por proceso (CTP / guillotina / …) vía JSONB o columnas | Pendiente |
| **3** | Prefill con botones explícitos (“Usar último trabajo” / “Usar maestro”) + fix picker | Pendiente (acuerdo planta) |

#### Ola 1 — alcance concreto

1. Migración aditiva `prod_referencias`:
   - `caja_embalaje_habitual text null`
   - `unidades_por_embalaje_habitual integer null` (estuches/uds por caja)
   - (opcional si cabe fácil) `gramaje_habitual numeric null`
2. Ampliar `articulos-maestro-sugerencias.ts`: mapear `codigo_caja_embalaje` → caja; `unidades_por_embalaje` → uds; serializar itinerario del wizard → `ruta_habitual` (solo si vacío o con confirmación, misma regla).
3. Formulario Maestro de Artículos: mostrar/editar los campos nuevos.
4. UI Resumen wizard: incluir embalaje (+ ruta) en el resumen del bloque “Guardar en maestro”.
5. **No** tocar `handleReferenciaPicked` / orden de prefill.
6. **No** columnas de horas/millar (§7.1.10).

**Prompt listo para Agent (copiar/pegar):**

```text
Ola 1 ampliación Fase 2 maestro (solo esta ola).

Lee FASES_MAESTRO_ARTICULOS.md § Fase 2 / Ola 1 y MINERVA_BLOQUE6 §7.1.8 + §7.1.10.

Implementa Ola 1:
- Migración: caja_embalaje_habitual, unidades_por_embalaje_habitual (+ gramaje_habitual si trivial).
- Ampliar upsert/sugerencias desde despacho (form.codigo_caja_embalaje, unidades_por_embalaje) y ruta_habitual desde itinerarioSlots.
- UI maestro + bloque Guardar en maestro en Resumen.
- NO cambiar prefill al elegir referencia.
- NO horas/millar ni promedios Bloque 6.
Commit al final con mensaje claro. Prueba mental: M-00003 con MN2L y 450 uds.
```

Tras Ola 1: commit → prueba en wizard → luego pedir **“Ola 2”** (defaults proceso).

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

## Fase 4 — Sugerencias desde histórico (≈ 60 min) → evoluciona a Bloque 6.x

> **Diseño vigente:** el recálculo de promedios **no** se hace al vuelo en despacho.
> Ver `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md` §7.1 (precálculo persistido, botón en Maestro,
> dependencia de `prod_ot_producidas`) y **§7.1.10** (entrada/prep absoluta vs tiraje
> `horas_millar_*` para impresión, troquelado y engomado). Esta fase queda como placeholder hasta Bloque 6.

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
