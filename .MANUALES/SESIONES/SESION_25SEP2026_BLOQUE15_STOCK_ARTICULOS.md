# Sesión 25 sep 2026 — Bloque 15 stock artículos (Fase A casi completa)

> **Rama:** `feature/bloque15-stock-articulos` (sin merge a `main` todavía)  
> **Horario aprox.:** 11:00 → 18:30 (~8 h, con diseño B15/B16 por la mañana)  
> **Quién:** Manel (smokes + decisiones) · Cursor (código) · Claude (revisión SQL 15.0)  
> **Brief:** `.MANUALES/BLOQUES/MINERVA_BLOQUE15_STOCK_ARTICULOS.md` · diseño paralelo `.MANUALES/BLOQUES/MINERVA_BLOQUE16_LISTADOS_PERSONALIZADOS.md`

---

## En una frase

De cero a un **almacén de producto terminado / WIP** usable: dar de alta lotes, importarlos desde Excel, reservar/consumir/liberar para una OT, marcar **OT de entrega** y, al despachar, que el asistente avise si hay stock para no fabricar de más.

---

## Qué se hizo (orden del día)

| Hora | Qué | Commit |
|------|-----|--------|
| 11:04 | Etiquetas Hugo: sesiones **«Hoy»** por I/T/N | `feat(etiquetas)` |
| mañana | Briefs **B15** (stock artículos) y **B16** (listados + digest mail 08:00) niquelados | docs |
| 13:04–13:49 | **15.0** migración: lotes + reservas + vista ATP + RPCs + capacidades; 8 correcciones de Claude; smoke con ROLLBACK | 5 commits |
| 14:37–15:17 | **15.1** bandeja + KPIs PT/WIP · Asistente IA (preguntas en lenguaje natural) · alta con OT del maestro y embalaje · **15.1a** editar datos del lote | 6 commits |
| 15:35–16:28 | **15.1b** plantilla Excel + import con semáforo y reintento · **15.1d** export PDF/Excel de la bandeja | 4 commits |
| 16:34–16:57 | **15.3** reservas (reservar/consumir/liberar) · **15.4** OT entrega (tag `[OT_ENTREGA]`) · hardening IA y miles | 3 commits |
| 17:15–17:36 | Writers sin almacén/administración; comercial solo lectura · columna Pedido/OT · acciones por lote (editar/ajustar/anular) · prefill OT entrega | 3 commits |
| 18:09 | **15.2** ATP en despacho (usar stock / mezclar / fabricar) + fixes de smoke | `7757972` |

Total: **22 commits** en el día. Migraciones aplicadas en Supabase remoto (15.0 y writers `20260925170000`).

---

## Decisiones de negocio (no repetir)

1. **Stock producto ≠ stock material.** B15 tiene tablas propias; nada de palets de papel (B9).
2. **Minerva no crea OTs mientras haya Optimus.** Si piden 300 y hay 120: en Optimus se crea **OT entrega 120** (sale de stock) + **OT fabricación 180** (despacho normal). Minerva solo guía y reserva.
3. **OT de entrega** = reserva con tag `[OT_ENTREGA]` en notas. Frágil: un campo `es_ot_entrega` real necesita revisión de Claude antes del SQL.
4. **Nº pedido** de la reserva = `pedido_cliente` de la OT (p. ej. PC-9988), no el código de artículo del título.
5. **No se borran lotes:** anular = poner a 0 (queda trazado en movimientos).
6. **Editar datos no cambia cantidad.** Si bultos × uds/bulto + pico no cuadra con el físico, aviso; la cantidad se cambia con «Ajustar».
7. **Permisos:** escriben admin, gerencia, oficina técnica, logística (o capacidad `stock_articulos_write`). Comercial = consulta para negociar. Almacén (Juan) sigue en B9.

---

## Smokes del día

| Smoke | Resultado |
|-------|-----------|
| Alta X-MART 1000 cajas → queda libre | ✅ |
| OT 98046 (M-01632): reservar 50 → libre 70 → liberar → 120 | ✅ |
| Reservar más que el libre (500) | ✅ bloquea |
| Editar bultos no recalcula cantidad | ✅ por diseño (añadido aviso) |
| «Liberar» casi invisible · modales anidados todo blanco · tag duplicado | ✅ corregidos en `7757972` |
| **15.2** en despacho | ⏳ mañana (guion abajo) |

---

## Guion smoke 15.2 (mañana)

1. OT **98046** con cantidad ≤ 120 → despacho: aviso verde → **Usar stock** → reserva visible en bandeja con PC-9988; «Despachar» queda bloqueado (OT de entrega).
2. Liberar; cantidad 300 → **Mezclar** → texto 120 + 180, copiar; no despacha.
3. **Fabricar completo** → despacha normal.
4. **(Claude)** Repetir paso 1 con OT cuyo **cliente** sea distinto del del lote (o vacío). Hoy el aviso **no sale** (bug diseño §abajo).

---

## Review Claude noche 25 sep (commits `1be214a` → `7757972`)

**OK:** permisos writers · comercial RO · overlay diálogos · lógica 15.2 (dedicado→genérico FIFO, solo PT uds, multi-lote, tests).

### 1. Cliente distinto → aviso desaparece ⚠️ importante · **sin SQL**

`loteClienteCompatible` saca el lote si no encaja (ni approx). `alta_lote` rellena cliente del maestro → casi todos tienen cliente. Si Optimus pone «CHM LABORATORIOS» y maestro «CHMLAB» (o OT sin cliente), todo va a «otro cliente» → `relevante=false` → **ni banner ni modal** → despacho como si no hubiera stock.

**Arreglo propuesto:** dentro de la misma referencia Minerva, **no excluir por cliente**. Ofrecer el lote + aviso amarillo («cliente lote ≠ OT; ¿mismo?»). Filtro duro solo si el lote está marcado a propósito para **otro** cliente (Takeit / dedicado).

### 2. «Usar stock» deja la OT colgada · **SQL → Claude antes**

Decisión React se pierde al cerrar (menor; al reabrir ve la reserva). **Grave:** la OT nunca se despacha → queda en pendientes (Pool / Despachadas / calendario…). Hace falta **`es_ot_entrega` en `prod_ots_general`** (no solo tag en reserva): sacar de listas de despacho y mostrar «entrega de stock». Draft SQL → Claude review → aplicar.

### 3. «Mezclar» no protege stock · **decidir numeración Optimus**

Hoy solo copia texto; las uds siguen libres → otra OT puede pillárselas; la OT de fabricación de 180 vuelve a ofrecer las mismas 120.

- **a)** Reservar ya las N contra la OT actual (nota «pendiente partir Optimus»); al existir OT entrega, pasar reserva (liberar + reservar). Preferida.
- **b)** Solo mensaje «si viene de partir, elige Fabricar» — frágil.

**Confirmar Manel:** al partir en Optimus, ¿la OT original se convierte en entrega, en fabricación, o salen **dos números nuevos**?

### Orden mañana

Decidido el **26 sep** (esta lista queda sustituida): `.MANUALES/SESIONES/SESION_26SEP2026_BLOQUE15_DECISIONES.md`.

Mezclar / reservar al partir **no** entra en la tanda. El nombre bueno del cliente es el de la OT. `es_ot_entrega` se marca en el maestro y al reservar con OT entrega. María José termina con **Consumir**.

---

## Pendiente

Pasado a la sesión del 26 sep. B16 Fase A (validar §9 con Gemma/Carlos) sigue en paralelo, sin código.
