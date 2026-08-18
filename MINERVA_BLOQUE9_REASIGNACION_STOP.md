# MINERVA — Bloque 9.8: Reasignación de cartelas / STOP material

> **Fuente de verdad de este módulo.** No es un parche de sesión: es maquinaria permanente de inventario.
> Complementa `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` (ATP, cartelas, consumo). Si hay contradicción sobre *liberar / recomprar / aviso formato*, **manda este documento**.
>
> **Estado:** 📋 **Spec cerrada 18 ago 2026.** Código: no empezado.
> **OT laboratorio:** **98019** (clone 98016, maestro, *no despachada*).
> **Sesión de acuerdo:** `SESION_18AGO2026_STOP_MATERIAL.md`.
>
> **Numeración:** el roadmap B9 tenía «9.8 fotos/adjuntos» *sin empezar* (baja). **9.8 queda para este módulo** (prioridad planta). Fotos/adjuntos pasa a **9.10**. **9.9** (IA Stock) no se toca.

---

## 0. Cómo usar este brief

1. Leer §1–§3 antes de picar: el problema no es solo 98019.
2. Implementar **una fase, un PR**, prueba en **98019**, luego la siguiente (§8).
3. **9.8.1b es bloqueante del mismo PR que 9.8.1** — no opcional, no “después”.
4. Nombres de tablas = los del repo (§5). No inventar `produccion_ot_compras`.
5. Al cerrar una fase: marcar ✅ aquí + maestro + este archivo §8.

**Modelos (acuerdo 18 ago):** RPC/ledger → **Sonnet**. UI/lectura → **Composer**. Detalle en §8.

---

## 1. El problema de fondo (más importante que 98019)

En planta hay **follón crónico** con el material:

- Optimus enseña líneas de stock / reserva que **Ramón sabe que no existen** en el pasillo.
- Los usuarios **a menudo no marcan** (consumo, ubicación, “ya no es de esta OT”). No es siempre culpa del sistema; el sistema **no puede fiarse** de que alguien recuerde picar.
- Cuando el formato está mal (caso real **98016**: compra 65×92, troquel pide pliego 72×102) no hay flujo para: soltar el palet, volver a comprar, y dejar rastro.

**98019 es la excusa para construir la maquinaria.** El éxito del bloque no es “hacer el STOP una vez”: es que **Ramón pueda confiar en lo que ve en pantalla** sin ir al pasillo a comprobar cada palet.

Es el mismo principio que ya aplica Bloque 9 a `cantidad_libre` (*el estado nunca miente*, calculado ATP): ahora se extiende a **corrección de errores** (liberar, recomprar, revertir).

---

## 2. Principios (no negociables)

| # | Principio | Consecuencia |
|---|-----------|--------------|
| P1 | **El ledger manda, no Optimus** | Verdad = `prod_stock_palets.cantidad_actual` − SUM reservas duras. Una OC o una línea Optimus **no** implica palet en almacén. |
| P2 | **No fiarse de que el usuario marque** | Liberar / consumir / revertir **siempre** deja fila en `prod_stock_movimientos`, aunque olviden la nota humana. Cierre Guillotina ya bloquea sin cartela (17 ago): mismo espíritu. |
| P3 | **Tres capas distintas** | Compra ≠ reserva ≠ consumo. Anular una **no** anula las otras solas. |
| P4 | **No borrar el error** | Igual que Bloque 6 (`reabierta_desde_id`): la OC vieja y el palet equivocado **siguen visibles**. Se marca y se sigue. |
| P5 | **Aviso, no muro** | CTP/Guillotina alertan formato incompatible; oficina decide. Mismo patrón que wizard `forceMode` (13 ago) y Ajustar itinerario. |
| P6 | **Formato real en el palet** | El campo `prod_stock_palets.formato` es el disgregador (65×92 virgen vs 65×46 cortado). **No** hay cajón aparte “stock cortado por error”. |
| P7 | **Oficina decide el camino; Juan ejecuta lo barato** | Liberar + recomprar = coste real → roles privilegiados. Asignar palet **ya libre** a una OT = operativa Juan (§7.6 B9), **después** de que oficina elija “stock” vs “compra nueva”. |

---

## 3. Tres capas (código real)

| Capa | Dónde | Qué significa | Hoy al “quitar” |
|------|--------|---------------|-----------------|
| **Compra** | `prod_compra_material` + `produccion_ot_despachadas.estado_material` | Pedido a proveedor | **No** se libera al quitar reserva. Botón “Generar compra” bloqueado si `estado_material` no contiene `"sin"` (`estadoMaterialPermiteNuevaCompra`). |
| **Reserva** | `prod_stock_palet_ots.cantidad_reservada` | Palet **pillado** para una OT (ATP) | **No hay UI.** Unlink + movimiento = 9.8.1. |
| **Consumo** | RPC `prod_stock_registrar_consumo` → `prod_stock_movimientos` tipo `consumo` + baja `cantidad_actual` | Material **transformado / descontado** | Sin RPC inversa. 9.8.5. |

Pregunta operativa (binaria, no tres estados inventados):

> ¿Hay fila de **consumo** en el ledger para ese palet + OT (+ paso)?
>
> - **No** → Caso A: liberar reserva es barato.
> - **Sí** → Caso B: revertir consumo (y decidir merma/scrap) **antes** de tratar el palet como libre.

`cantidad_libre` **no se escribe**. Es `cantidad_actual − SUM(cantidad_reservada)` vía vista `stock_palets_atp`.

---

## 4. Casos de planta (los tres sobre 98019)

| Caso | Cuándo se detecta | Estado del material | Dificultad | Fase que lo cubre |
|------|-------------------|---------------------|------------|-------------------|
| **A — STOP en CTP** | Antes de consumir | Comprado, recibido, cartelado, **reservado**, sin consumo | Fácil | 9.8.1 + 9.8.2 + 9.8.3 |
| **B — STOP post-Guillotina** | Ya cortó y registró consumo; aún no imprimió | Reserva + **consumo RPC** + posible scrap físico | Media | + **9.8.5** |
| **C — Stock libre / compra sin OT** | Hay palet genérico (p. ej. 75×105) o sobrante usable | Palet `disponible` / sin reserva dura | Media | **9.8.4** + redespacho 9.8.6 |

**Camino A vs C en Etapa 3 (decisión, no clic):** oficina/gerencia elige *recomprar* o *tirar de stock existente*. Juan **no** elige el camino; ejecuta la asignación si el camino es stock.

Etiqueta “Camino C” de drafts anteriores (revertir sin haber consumido) **queda anulada**: si no hay consumo, es Caso A.

---

## 5. Tablas y campos reales (anti-inventario de nombres)

| Concepto | Nombre real | Notas |
|----------|-------------|-------|
| Maestro OT | `prod_ots_general.num_pedido` | No existe `.numero`. |
| Despacho | `produccion_ot_despachadas` | Formato compra = **`tamano_hoja`**. No hay `formato_compra` ni columna `corte`. |
| Cortes Guillotina | `prod_ot_pasos.datos_proceso` | `tamano_inicial` / `tamano_final`. |
| Tamaño troquel (estuche mm) | `datos_proceso.tamano_corte` | **No** es el pliego. No usar para el aviso 65×92 vs 72×102. |
| Formato papel del troquel | `prod_troqueles.formato_papel` | Comparar cartela / plan de corte **con esto**. |
| Compras | **`prod_compra_material`** | Estados: `Pendiente`, `Generada`, `Confirmado`, `Recibido Parcial`, `Recibido`, `Cancelado`. |
| Texto OT (Emma) | `produccion_ot_despachadas.estado_material` | Se sincroniza desde compra vía `estadoMaterialDesdeEstadoCompra`. |
| Palet / cartela | `prod_stock_palets` | `formato`, `notas`, `cantidad_actual`. |
| Reserva | `prod_stock_palet_ots` | `(palet_id, ot_numero)` + `cantidad_reservada`. |
| Ledger | `prod_stock_movimientos` | Tipos `consumo` / `ajuste` / `sobrante` / `traspaso`. Ya tiene **`ot_origen_numero`**, `ot_destino_numero`, `autorizado_por`, `notas`. |
| Consumo | RPC `prod_stock_registrar_consumo` | Migración `20260705150000_bloque9_4_stock_consumo_rpc.sql`. |

### Qué **no** se añade

- **No** `origen_ot_numero` ni `nota_procedencia` en `prod_stock_palet_ots` (extender, no duplicar).
- Trazabilidad estructurada = movimiento `traspaso`/`ajuste` con `ot_origen_numero`.
- Contexto humano = `prod_stock_palets.notas` (Ramón/Juan lo leen en Stock / cartela).
- Informe trimestral “material perdido por error de medida” = `SELECT` al ledger, no parsear notas.

---

## 6. Flujo operativo (etapas)

### Etapa 1 — Aviso preventivo (CTP y Guillotina)

Comparación **correcta**:

```
formato_cartela_reservada     → prod_stock_palets.formato
formato_papel_necesario       → prod_troqueles.formato_papel (troquel de la OT)
tamano_final_planificado      → Guillotina datos_proceso / despacho (ej. 65×46)
```

- **CTP (antes de cortar):** cartela reservada vs `formato_papel` del troquel.
- **Guillotina:** mismo aviso + `tamano_final` planificado vs `formato_papel`.

Si el pliego posible (cartela o corte planificado) **no cubre** el formato papel del troquel → banner ámbar/rojo:

> Formato cartela insuficiente. Material 65×92 (corte plan 65×46); el troquel pide pliego 72×102. Consulta oficina técnica.

- **No bloquea** (P5).
- Enlaces: Ver cartela / Ver troquel / Liberar y reasignar (si rol privilegiado).
- Fase: **9.8.2** (puede ir en paralelo de 9.8.1 *después* de que 9.8.1 esté en `main`, o solapado si no comparte schema conflictivo).

### Etapa 2 — Liberar reserva (Caso A; sin consumo)

- Rol: `admin` / `oficina_tecnica` / `gerencia` (= `ROLES_FORZADO` del wizard 13 ago).
- Confirmación: «¿Liberar material 65×92 (palet #XXXXX) de OT 98019?»
- Efecto:
  1. Borrar o poner a 0 la fila `prod_stock_palet_ots` de esa OT.
  2. `INSERT prod_stock_movimientos` tipo `traspaso` (o `ajuste` si se prefiere un solo palet sin OT destino): `ot_origen_numero = 98019`, `autorizado_por` obligatorio, `notas` con motivo.
  3. Append a `prod_stock_palets.notas`: procedencia humana.
  4. Si el palet **ya está cortado** (Caso B tras revertir): actualizar `formato` a la realidad (65×46). Si sigue virgen: no tocar formato.
- ATP: al desaparecer la reserva dura, `cantidad_libre` sube solo.
- **No** cambia `prod_compra_material` (P3, P4).
- **Sí** actualiza `estado_material` de la OT a un texto de la **allowlist 9.8.1b** (si no, el botón de compra sigue gris).

### Etapa 3 — Elegir camino (oficina) y ejecutar

| Camino | Quién decide | Quién ejecuta | Qué |
|--------|----------------|---------------|-----|
| **Stock existente** | Oficina / gerencia | **Juan** asigna palet libre | 9.8.4 → Etapa 5 |
| **Compra corrección** | Oficina / gerencia | Oficina genera 2.ª OC | 9.8.3 → muelle → cartelar → asignar → Etapa 5 |

Compra adicional (**Opción B**):

- Nueva fila `prod_compra_material` (tipo `correccion` o equivalente + `compra_origen_id` + motivo).
- **No** anular ni borrar la OC 1.
- UI Compras: ambas visibles (histórico ya tiene toggle Recibidos).
- `estado_material` de la OT debe reflejar la **compra activa de cobertura**, no la OC histórica Recibida. Si se sincroniza desde la fila vieja, Emma verá “Material recibido” y pensará que está OK.

### Etapa 4 — Recibir y cartelar el nuevo material

Flujo actual Juan/Emma/Ramón. Sin inventar muelle nuevo. Cartela nueva; reserva a 98019.

### Etapa 5 — Redespacho asistido

Al asignar cartela nueva (o al confirmar corrección): popup

> Se ha asignado material 72×102. ¿Actualizar despacho de OT 98019?

- Sí → `tamano_hoja` 65×92 → 72×102; merge `datos_proceso` en pasos **pendientes** (Guillotina inicial/final, etc.). Mismo espíritu que redespacho 17 ago.
- No → oficina lo hará a mano con el lápiz.
- Cortes / refilado especial (Miguel: “mitad y refilar a 51×72”) = **siempre texto humano**, no ciego.

Fase: **9.8.6**. MVP aceptable: “¿Abrir lápiz despacho?” si el merge automático no llega en el primer PR.

### Etapa 6 — Guillotina con instrucción nueva

Plan 72×102 → corte 72×51 (ejemplo). Cartelar consumo sobre el palet correcto.

---

## 7. Permisos

| Acción | Roles | Notas |
|--------|-------|--------|
| Liberar reserva | `admin`, `oficina_tecnica`, `gerencia` | Aviso “a tu cuenta y riesgo” (patrón `forceMode`) |
| Generar compra de corrección | Idem | Dinero real |
| Elegir camino stock vs recompra | Idem | Decisión de coste/margen |
| Revertir consumo (9.8.5) | Idem (o solo admin/gerencia si se endurece) | Toca ledger |
| Redespacho asistido / lápiz forzado | Idem | Ya existe `ROLES_FORZADO` |
| Asignar palet **libre** → OT | Juan / almacén (permisos actuales cartelas) | Solo **después** de la decisión de oficina |
| Recepción + cartelar | Juan / Emma / Ramón | Sin cambio |
| Cerrar Guillotina / ver aviso | Operario sección | Aviso visible; no requiere gerencia |

Código ancla: `ROLES_FORZADO` en `despacho-wizard-dialog.tsx`; `puedeEditarPasoAdmin` en `prod-paso-admin-permisos.ts` (oficina incluida).

---

## 8. Fases de implementación (una fase, un PR)

Disciplina: **probar en 98019 antes de abrir la siguiente.**

| Fase | Qué | Modelo | PR / riesgo |
|------|-----|--------|-------------|
| **9.8.1 + 9.8.1b** | Liberar reserva + movimiento ledger + notas palet + **arreglar gate de compra** | **Sonnet** (ledger) + Composer para el allowlist UI | **Mismo PR. 1b es bloqueante.** |
| **9.8.2** | Aviso CTP + Guillotina (`formato_papel` vs cartela / corte) | **Composer** | Lectura; no corrompe stock |
| **9.8.3** | Compra corrección: 2.ª fila, tipo, histórico, sync `estado_material` | **Sonnet** | Estados compras + despachadas |
| **9.8.4** | Asignar stock libre → OT (Juan); buscar por material/gramaje/`formato` | **Composer** | |
| **9.8.5** | RPC `prod_stock_revertir_consumo` simétrica | **Sonnet** | Inventario real |
| **9.8.6** | Popup redespacho asistido tras reasignar | **Composer** | |

### 9.8.1b — trampa `includes("sin")` (bloqueante)

Hoy:

```ts
// ots-despachadas-page.tsx
function estadoMaterialPermiteNuevaCompra(estado) {
  if (!n) return true;
  return n.includes("sin");
}
```

Cualquier texto de STOP del estilo *«Material liberado — pendiente reasignar»* **no contiene “sin”** → el botón **sigue gris**. Se perdería la prueba 98019 pensando que 9.8.1 está roto.

**Decisión (18 ago): allowlist explícita, no substring.** No maquillar etiquetas para colar un “sin”.

Allowlist inicial (normalizada):

- vacío
- contiene el legado `"sin orden"` / `"sin orden compra"` (compat)
- `"compra cancelada"`
- **nuevos STOP**, constantes en código (un solo sitio, p. ej. `compras-material-estados.ts`):
  - `Sin material asignado (liberado)`
  - `Pendiente compra de corrección`

`bucketEstadoMaterial` / ojo de columna (`ots-despachadas-columns.tsx`) debe conocer esos textos (si no, badge “otro”).

**9.8.3** añadirá además botón privilegiado **«Generar compra de corrección»** que no dependa del lote “solo si sin pedido”. Hasta que exista, 9.8.1b tiene que dejar el lote usable tras liberar.

Regla de sync: al actualizar una OC **histórica** Recibida, **no** pise `estado_material` de la OT si hay liberación / corrección pendiente. Fuente = compra **activa de cobertura** o constante STOP.

---

## 9. Cambios de esquema (mínimos)

### 9.8.1 (probable)

- Ninguna columna nueva en `prod_stock_palet_ots`.
- RPC o función `prod_stock_liberar_reserva(p_palet_id, p_ot_numero, p_autorizado_por, p_notas)` atómica: unlink + movimiento + append notas. Preferible RPC (como consumo) para no dejar reserva sin ledger.

### 9.8.3 (probable)

- `prod_compra_material.tipo` (`normal` \| `correccion`) o equivalente.
- `compra_origen_id` UUID nullable → la OC 1.
- `motivo` / notas de corrección.

### 9.8.5

- `prod_stock_revertir_consumo(...)` espejo de `prod_stock_registrar_consumo`:
  - movimiento en ledger (tipo `ajuste` con cantidad positiva **o** convención documentada; lo importante es **una fila más**, no un update mudo de `cantidad_actual`);
  - sube `cantidad_actual`;
  - reponer `cantidad_reservada` solo si la OT **sigue** queriendo ese palet (en STOP típico: **no** reponer reserva; el siguiente paso es liberar).
  - Documentar en el comment SQL el orden: revertir consumo → (opcional merma) → liberar reserva.

No fusionar 9.8.5 en el PR de 9.8.1.

---

## 10. Semáforos y lo que Emma / Ramón ven

**Pool `materialStatus` (hoy):** verde = cartelado ≥ objetivo; amarillo = algo cartelado o solo muelle; rojo = nada. **No mira compras.** Tras liberar, la OT debe pasar a amarillo/rojo (deja de contar hojas carteladas). Eso es correcto.

**OTs Despachadas `estado_material`:** debe decir la verdad de cobertura (P1). Tras STOP: no dejar “Material recibido” de la OC 1.

**Stock ATP:** palet liberado aparece en libre con su `formato` real. Ramón filtra “Folding 300 g 65×46” y si cuadra, oficina autoriza y Juan asigna.

---

## 11. Compra sin OT (stock estratégico)

Ya existe cartelar `tipo_recepcion = stock_libre` / checkbox `stock_libre`. Caso C de 98019: palet 75×105 (o el formato que toque) **sin OT**, luego asignar.

No es un tercer módulo: es 9.8.4 sobre palets que nunca tuvieron reserva, más redespacho (instrucciones Miguel).

---

## 12. Plan de prueba — OT 98019

**Maestro (18 ago):** `num_pedido = 98019`, cliente COSMECEUTICAL CONCEPT (SEGLE), clone 98016, título con `[lab STOP material · clone 98016]`, cantidad 5000, **no despachada**, pedido cliente `LAB-STOP-98019`.  
**No usar 98017/98018** (ya existían: Radical Crackers / Anur).

### 98019-A (CTP, sin consumo) — prueba reina de 9.8.1–3 + 6

1. Despachar 65×92 / corte Guillotina 65×46 (a propósito, como 98016).
2. Generar compra → muelle → cartelar → reservar OT.
3. CTP: debe salir aviso 9.8.2 (cuando exista); si aún no, STOP manual.
4. Liberar cartela (rol privilegiado). Comprobar:
   - palet sin reserva OT; `cantidad_libre` = físico;
   - movimiento con `ot_origen_numero = 98019`;
   - notas palet legibles;
   - **OC 1 sigue en Compras** (no borrada);
   - `estado_material` permite **nueva** compra (9.8.1b).
5. Camino B: 2.ª compra 72×102 → recibir → cartelar → asignar.
6. Popup redespacho (9.8.6) o lápiz: 72×102 / 72×51.
7. Guillotina ve instrucción nueva.
8. **Histórico:** OC1 65×92 visible; OC2 72×102 activa; cartela 1 libre con procedencia; cartela 2 reservada a 98019.

### 98019-B (post-Guillotina) — tras 9.8.5

Consumo registrado → revertir RPC → formato palet 65×46 + nota → liberar → recompra o stock.

### 98019-C (stock libre)

Cartelar palet libre (p. ej. 75×105) → oficina elige stock → Juan asigna → lápiz con refilado Miguel.

Si 98019 ya está “sucia” de A, clonar **98020** para B/C. No mezclar estados en la misma OT si confunde la prueba.

---

## 13. Qué no haremos

- Anular/borrar la OC errónea para “poder volver a comprar”.
- Cajón de stock “cortado por error” distinto del ATP normal.
- Columna nueva de origen en el bridge `prod_stock_palet_ots`.
- Comparar aviso CTP contra `tamano_corte` (mm de estuche).
- Dejar 9.8.1b para “el PR siguiente”.
- Un mega-PR con revertir consumo + aviso + compra + popup.
- Confiar en que Guillotina “ya lo marcará” sin ledger (P2).

---

## 14. Decisiones 18 ago 2026

| Decisión | Origen |
|----------|--------|
| Ledger manda; no fiarse del marcado de usuario | Planta (Manel) + cierre Cursor/Claude |
| Brief de **bloque** (consultable en un año: “¿por qué no borramos la OC?”) | Claude + método repo |
| A vs B anclado a existencia de consumo RPC | Cursor (código) |
| Compra adicional, no anular (P4 / Bloque 6) | Cursor + Claude |
| `ot_origen_numero` en **movimientos**, notas en **palet** | Claude (retiro de columna nueva) + Cursor |
| Formato real = disgregador; nota de procedencia humana | Manel (retiro “cajón aparte”) |
| Permisos: oficina libera/recompra; Juan asigna libre | Cursor; Claude: oficina elige el **camino** |
| Allowlist `estadoMaterialPermiteNuevaCompra`, no substring | Claude (trampa `includes("sin")`) |
| 9.8.1b **mismo PR** que 9.8.1, bloqueante | Claude, luz verde Manel |
| Aviso CTP **y** Guillotina | Cursor + Claude |
| Fases 9.8.1–6, un PR, prueba 98019 | Los tres |
| Sonnet en ledger/SQL; Composer en UI | Cursor + Claude |
| OT laboratorio **98019** (98017/18 ocupadas) | Cursor al crear maestro |

---

## 15. Código de referencia (no tocar hasta la fase)

| Pieza | Ruta |
|-------|------|
| Gate compra lote | `src/components/produccion/ots/ots-despachadas-page.tsx` → `estadoMaterialPermiteNuevaCompra` |
| Sync estado OT ← compra | `src/lib/compras-material-estados.ts` |
| Badge estados | `src/components/produccion/ots/ots-despachadas-columns.tsx` → `bucketEstadoMaterial` |
| Consumo RPC | `supabase/migrations/20260705150000_bloque9_4_stock_consumo_rpc.sql` · `src/lib/cartela-stock-consumo.ts` |
| ATP / formato | `src/lib/stock-atp-query.ts` · vista `stock_palets_atp` |
| Wizard cartela / stock libre | `src/components/produccion/almacen/cartelas/cartela-wizard-dialog.tsx` |
| Encadenado formato | `src/lib/hoja-ruta-formato-encadenado.ts` |
| Troquel `formato_papel` | `src/lib/troqueles-query.ts` / `prod_troqueles` |
| Roles lápiz forzado | `despacho-wizard-dialog.tsx` `ROLES_FORZADO` |
| Reasignación diseñada (sin UI) | `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §7.6 |

---

## 16. Preguntas abiertas (no bloquean 9.8.1)

1. ¿Tipo movimiento al liberar: `traspaso` (sin `ot_destino`) o `ajuste`? Preferencia: **`traspaso`** con origen y destino null + `autorizado_por` (ya obligatorio en traspaso). Si el CHECK SQL exige destino, usar `ajuste` y documentar en la migración.
2. ¿Merma física Caso B (hojas ya cortadas inservibles) = movimiento `ajuste` negativo aparte del revertir? Sí, cuando 9.8.5: no fingir que el pliego virgen “volvió”.
3. ¿Endurecer revertir consumo a solo `admin`/`gerencia`? Decidir en 9.8.5; oficina técnica puede bastar como en lápiz.

Nada de esto retrasa el PR **9.8.1 + 9.8.1b**.

---

## 17. Retomar (siguiente chat)

1. Despachar **98019** en UI (Manel) con 65×92 / 65×46 cuando se vaya a probar A.
2. Código: **9.8.1 + 9.8.1b** con **Sonnet** (Agent). No mezclar 9.8.2 en el mismo PR salvo que sea trivial de lectura y no retrase el ledger.
3. Marcar esta fase ✅ aquí y en el maestro al merge.
