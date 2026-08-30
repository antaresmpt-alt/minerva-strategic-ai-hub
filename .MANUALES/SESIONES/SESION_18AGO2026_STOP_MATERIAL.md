# Sesión 18 ago 2026 — Spec STOP material / reasignación cartelas · OT 98019

> **No es la fuente de verdad del módulo.** Eso es `.MANUALES/BLOQUES/MINERVA_BLOQUE9_REASIGNACION_STOP.md`.
> Esta sesión: acuerdo de spec + OT laboratorio en maestro. **Sin código de producto.**

---

## Qué pasó

1. Cierre de diseño (Cursor + Claude + Manel): tres capas compra/reserva/consumo; no anular OC; ledger manda; usuarios no marcan.
2. Creada OT **98019** en `prod_ots_general` (clone 98016, no despachada). 98017/98018 ya existían.
3. Brief de bloque escrito. Siguiente: fase **9.8.1 + 9.8.1b** (mismo PR, 1b bloqueante).

---

## OT 98019

| Campo | Valor |
|--------|--------|
| `num_pedido` | **98019** |
| Cliente | COSMECEUTICAL CONCEPT S.L. (SEGLE COSMETICS) |
| Título | EST HAIR REVITALIZANTE TRIPLO… **[lab STOP material · clone 98016]** |
| Cantidad | 5000 |
| Despachada | **No** |
| Pedido cliente | `LAB-STOP-98019` |
| Entrega | 2026-09-11 |

Despacho de prueba (cuando toque 98019-A): **65×92** / corte **65×46**, troquel como 98016 (pliego necesario **72×102**).

---

## Acuerdos que no hay que reabrir

- Allowlist en `estadoMaterialPermiteNuevaCompra` (no `includes("sin")` maquillado).
- 9.8.1b **en el mismo PR** que liberar reserva.
- `ot_origen_numero` en `prod_stock_movimientos`; notas en palet.
- Oficina decide camino; Juan asigna stock libre.
- Sonnet = ledger/SQL (1, 3, 5); Composer = UI (2, 4, 6).
- Numeración: **9.8 = este módulo**; fotos/adjuntos (roadmap viejo 9.8) → **9.10**.

Detalle y plan de prueba: el brief de bloque §8 y §12.

---

## Retomar

- [x] 98019-A validada 18 ago noche (ver brief §12).
- [x] **9.8.1 + 9.8.1b + 9.8.1c** en `main`.
- [x] **9.8.2** aviso formato — `acca03b`.
- [x] **98020** casos A+B+C validados 19 ago — ver **`.MANUALES/SESIONES/SESION_19AGO2026_STOP_MATERIAL_98020.md`**.

---

## OT 98020 (lab A+B+C — 19 ago) ✅

Ver sesión completa: **`.MANUALES/SESIONES/SESION_19AGO2026_STOP_MATERIAL_98020.md`**.

Resumen: misma OT encadenó Caso A (CTP/liberar), B (revertir consumo `#99021`), C (stock libre `#10985` → guillotina → impresión 72×51 / 2000 h). Backlog mañana: brief §18.
