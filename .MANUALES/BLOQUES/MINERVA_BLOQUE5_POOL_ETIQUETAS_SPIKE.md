# Bloque 5 — Pool entrada etiquetas (spike diseño · 29 ago 2026)

> **Estado:** implementado v3 (29 ago 2026 noche) · migración `prod_etiquetas_pool_plan`  
> **Objetivo lunes:** Rita bandeja + cola + PDF; Hugo express desde cola + hoja de ruta igual.

---

## Flujo acordado

```
Bandeja izquierda (candidatas)     Cola central (Rita ordena)        En curso (derecha)
─────────────────────────────     ───────────────────────────     ─────────────────────
OTs etiqueta en maestro      →    Pool OTs a realizar          →    Activas en HR
(filtro fecha + Optimus)          (orden manual Rita)               (semáforo I/T/N)
                                  PDF cola para planta
```

- **Hugo no cambia** el resto del circuito (hoja de ruta, calendario mensual, muelle…).
- **Entrada manual** sigue válida si el pool está vacío.

---

## Filtro bandeja izquierda (v3)

| Incluir | Excluir |
|---------|---------|
| OT etiqueta en maestro (`tipo_pedido` / `familia` / título ETIQUETA, o pasos 18/19/20) | Ya en `prod_etiquetas_hoja_ruta` (activa o finalizada) |
| Estado Optimus activo: *En producción*, *No empezado*, *Actualmente activo* | *Terminado*, *Suspendido*, *Cancelado* (+ cerrada/producida/anulada) |
| `fecha_entrega` **o** `fecha_apertura` ≥ **2026-01-01** (corte pre-Minerva; Rita puede afinar a abril más adelante) | Ya en cola (`prod_etiquetas_pool_plan`) |
| Despachada o no — badge visual | — |

**Orden bandeja:** apertura más reciente primero (como entradas nuevas en maestro), desempate por número OT descendente.

**Sin filtro despacho obligatorio:** Rita ve OTs aunque no estén despachadas.

---

## Tres columnas UI (v2–v3)

| Col | Rol | Acciones |
|-----|-----|----------|
| 1 · Entrada | Candidatas filtradas | Buscar, **Añadir** a cola, clic OT → detalle maestro |
| 2 · Cola | Orden del día Rita | Subir/bajar, quitar, **Iniciar** → entrada express, **PDF** cola |
| 3 · En curso | HR `finalizado = false` | Semáforo I/T/N (verde = paso marcado en HR), clic OT → detalle, icono **devolver a cola** |

### Semáforo I/T/N

- Itinerario desde `prod_ot_pasos` (18 Konica, 19 Troq, 20 Num).
- Sin itinerario en maestro → asume **I·T·N** (etiqueta digital estándar).
- **Hecho** = booleanos `konica` / `troqueladora` / `numeradora` en HR.

### Devolver a cola

- Icono ↺ bajo el semáforo (columna En curso).
- Confirmación destructiva: **borra fila HR** y reinserta OT en `prod_etiquetas_pool_plan`.
- Alternativa manual Hugo: editar HR y desmarcar pasos (no implementado en pool).

### Detalle OT (clic número)

- Modal solo lectura: cliente, trabajo, cantidad, entrega, apertura, estado, tipo, familia, vendedor, itinerario, despacho.

### PDF cola

- Botón en cabecera cola → lista ordenada (#, OT, cliente, trabajo, cant., entrega, I/T/N, despacho).

---

## Iniciar desde cola

1. Rita selecciona OT en cola → **Iniciar OT seleccionada**.
2. Abre **entrada express** con OT pre-rellenada; Kon/Troq/Num **sin marcar**.
3. Al guardar: INSERT HR + quita OT de cola. **No** cambia a pestaña Hoja de ruta.

Duplicados: `findHojaRutaPorOtNumero` / diálogo existente.

---

## No hacer (aún)

- Calendario producción letra K / segundo calendario Rita.
- OTs ejecución contenedor con redirect a Hugo.
- Tres columnas Konica / Troquel / Numeradora en pool (itinerario basta).

---

## Referencias código

| Pieza | Archivo |
|-------|---------|
| Lógica pool | `src/lib/etiquetas-pool-entrada.ts` |
| PDF cola | `src/lib/etiquetas-pool-export.ts` |
| UI tab | `src/components/produccion/etiquetas-digital/etiquetas-pool-entrada-tab.tsx` |
| Detalle OT | `src/components/produccion/etiquetas-digital/etiquetas-pool-ot-detail-dialog.tsx` |
| Express prefill | `etiquetas-entrada-express-dialog.tsx` (`prefillOtNumero`) |
| Migración | `supabase/migrations/20260829183000_prod_etiquetas_pool_plan.sql` |

- Bloque 5 diseño: `.MANUALES/CONTEXTO/FASES_HOJA_RUTA_DIGITAL.md` § Bloque 5
- Patrón bandeja: `calendario-bandeja.ts`

---

## Commits

| SHA | Notas |
|-----|-------|
| `8c91ee0` | v1 pool bandeja + cola |
| `95ff40b` | v2 express, 3 columnas, maestro sin despacho |
| `f2b124a` | v3 filtro fecha/Optimus, semáforo, detalle OT, PDF, devolver |
| v3.1 | orden bandeja por apertura reciente + icono devolver bajo semáforo |
