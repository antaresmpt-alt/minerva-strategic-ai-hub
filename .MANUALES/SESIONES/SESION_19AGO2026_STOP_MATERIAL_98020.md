# Sesión 19 ago 2026 — Lab Bloque 9.8 STOP material · OT 98020 (A+B+C)

> **No es la fuente de verdad del módulo.** Eso sigue siendo `.MANUALES/BLOQUES/MINERVA_BLOQUE9_REASIGNACION_STOP.md`.
> Esta sesión: implementación + validación en planta del lab **98020** (tres casos A/B/C sobre la misma OT).
> **Commits en `main`:** `acca03b` (9.8.2) · `14fc084` (reabrir paso fix) · `c93205e` (9.8.4 stock libre + 9.8.5 mejoras revertir).

---

## 1. Resumen ejecutivo

| Ámbito | Veredicto |
|--------|-----------|
| **Código 9.8.2** (aviso formato CTP/Guillotina/Impresión) | ✅ En `main`; validado Caso A y B |
| **Código 9.8.4** (asignar stock libre → OT) | ✅ RPC + UI Cartelas; validado Caso C |
| **Código 9.8.5** (revertir consumo) | ✅ RPC + UI; validado Caso B |
| **Compra / cartela sin OT** (entrada Caso C) | ✅ `ComprasMaterialManualDialog` + migración `ot_numero` nullable |
| **Lab OT 98020 — Caso A** | ✅ Validado (CTP STOP, liberar, recompra, guillotina) |
| **Lab OT 98020 — Caso B** | ✅ Validado (consumo erróneo, revertir, badge persiste) |
| **Lab OT 98020 — Caso C** | ✅ Validado (stock libre → asignar → guillotina #10985 → impresión 72×51 / 2000 h) |
| **Producto final / polish** | 📋 Backlog mañana (§7) — no bloquea cierre funcional del bloque |

**Conclusión:** el **flujo operativo STOP material** (tres caminos) funciona de punta a punta con workarounds documentados. Falta **UX de cascade planificación** y varias fases 9.8.3/9.8.6 dedicadas.

---

## 2. Commits y archivos tocados (19 ago)

### `acca03b` — feat(9.8.2): aviso formato en ejecución

- `src/lib/formato-cabe.ts`, `src/lib/formato-cabe-ejecucion.ts`
- Banners ámbar en CTP, Guillotina e Impresión cuando formato cartela/plan no cubre `prod_troqueles.formato_papel`
- Etiqueta origen `(GUILLOTINA)` / `(CTP)` en badge
- Pausa CTP con motivo STOP material

### `14fc084` — fix(planificacion): reabrir paso + anular mesa

- `src/lib/prod-paso-admin-client.ts`: `reabrirPasoAdmin` usa tabla real `prod_mesa_planificacion_trabajos` (antes apuntaba a `prod_mesa_trabajo` inexistente → mesa no se reactivaba)
- `derivar-impresion-externa.ts` / mesa: revertir paso al anular hueco sin finalizar ejecución (anti `en_marcha` colgado)

### `c93205e` — feat(9.8): compra stock libre sin OT + mejoras revertir consumo

| Pieza | Ruta / migración |
|-------|------------------|
| Compra manual stock libre | `src/components/produccion/ots/compras-material-manual-dialog.tsx` |
| Revertir consumo UI | `src/components/produccion/planificacion/paso-admin-actions.tsx` |
| Client admin pasos | `src/lib/prod-paso-admin-client.ts` |
| RPC revertir (anti-doble, `p_nueva_cantidad`, `p_paso_id`) | `supabase/migrations/20260819200100_revertir_consumo_mejoras.sql` |
| Compra/cartela `ot_numero` nullable | `supabase/migrations/20260819200000_compra_stock_libre_ot_nullable.sql` |
| Asignar palet OT (9.8.4, commit previo) | `supabase/migrations/20260819130000_bloque9_8_4_asignar_palet_ot.sql` · `cartelas-page.tsx` |

---

## 3. OT laboratorio 98020

| Campo | Valor |
|--------|--------|
| `num_pedido` | **98020** |
| Cliente | COSMECEUTICAL CONCEPT S.L. (SEGLE COSMETICS) |
| Título | EST HAIR REVITALIZANTE TRIPLO… **[lab STOP material · clone 98016 · caso B post-guillotina]** |
| Cantidad | 5000 · 3 poses |
| Troquel | TAM00520 · formato papel **72×102** |
| Despacho inicial (erróneo a propósito) | **65×92** / guillotina plan **65×46** (como 98016) |
| Despacho corregido (Caso C) | **72×102** / guillotina **72×51** (mitad) · 1000 → 2000 h brutas impresión |

**Nota metodológica:** el brief original reservaba 98020 solo para Caso B. En la práctica se encadenaron **A → B → C** sobre la misma OT (98019 ya estaba sucia del 18 ago). Válido para demo; para repetir pruebas limpias conviene clonar **98021**.

---

## 4. Validación por caso (cronología 19 ago noche)

### 4.1 Caso A — STOP en CTP (sin consumo)

1. Despacho 65×92 / corte 65×46 → compra → muelle → cartelar → reservar OT.
2. **CTP:** badge aviso formato ✅ · pausa STOP ✅ · cerrar paso.
3. **Liberar cartela** (rol privilegiado) → palet libre, OC1 intacta, `estado_material` permite recompra.
4. **2.ª compra** 72×102 (workaround: duplicar P1 en Compras; botón lote Despachadas aún no crea P2 — **9.8.3 pendiente**).
5. **Redespacho lápiz** 72×102 → 72×51 (popup 9.8.6 no existe — **pendiente**).
6. **Guillotina** con cartela correcta del camino A.

**Veredicto A:** ✅ VALIDADO.

---

### 4.2 Caso B — STOP post-Guillotina (con consumo)

1. Guillotina ejecutada con plan erróneo **65×46** (a propósito).
2. Badge **`65×46 (GUILLOTINA)`** en guillotina ✅ y persiste en **Impresión** ✅.
3. Consumo cartela **`#99021`** (1000 h) al cerrar guillotina ✅.
4. **Revertir consumo** desde hoja de ruta (admin):
   - Devuelve hojas al palet; formato palet → **65×46**; OT → STOP material.
   - Botón revertir **desaparece** tras revert (anti-doble) ✅.
5. Cartela `#99021` queda **1000 h libres** (sin OT).

**Veredicto B:** ✅ VALIDADO (9.8.5 + 9.8.2).

**No probado en B:** liberar + recompra completa tras revert (se saltó al Caso C con stock libre).

---

### 4.3 Caso C — Stock libre / compra sin OT

| Paso | Detalle | Resultado |
|------|---------|-----------|
| 1 | Entrada compra manual · checkbox **Stock libre (sin OT)** | `OCM-STOCK-20260819-2058` |
| 2 | Material ZENITH 350 gr **72×102** · 1700/1750 h · albarán `G23-PRUEBA STOCK LIBRE` | Muelle OK |
| 3 | Cartelar | **`#99022`** (1750 h, stock libre, es_prueba) |
| 4 | Partir palet 1000 h | `#99022` → **750 h** libre · nueva **`#10985`** → **1000 h** libre |
| 5 | Asignar a OT | Cartelas creadas → 🔗 → OT **98020** · toast «Material en stock asignado» ✅ |
| 6 | Stock | `#10985` → OT 98020 · `#99022` → libre ✅ |
| 7 | Redespacho lápiz | Guillotina 72×102 → **72×51**, 1000 → **2000 h** ✅ |
| 8 | Reabrir guillotina (paso ya finalizado del intento B) | Paso disponible; **impresión seguía en mesa** (ver §5) |
| 9 | Cerrar guillotina | Cartela asignada **`#10985`** preseleccionada · 1000 h consumidas ✅ |
| 10 | Devolver impresión al Pool (manual) → mesa → ejecución | Entrada **72×51 · 2000 h** ✅ · sin badge formato erróneo ✅ |

**Veredicto C:** ✅ VALIDADO para objetivo 9.8 (material libre → asignar → producir con plan corregido).

**No obligatorio para cierre 9.8:** cerrar impresión en mesa (E2E completo hasta troquel).

---

## 5. Estado final de cartelas (lab 98020)

| ID | Material | Formato | Hojas / estado | OT | Notas |
|----|----------|---------|----------------|-----|-------|
| **#99020** | Folding zenith | 650×920 | ~1000 libre | — | Caso A — liberada |
| **#99021** | Folding zenith | **65×46** | 1000 libre | — | Caso B — tras revertir consumo |
| **#99022** | ZENITH | 72×102 | **750 libre** | — | Resto tras split Caso C |
| **#10985** | ZENITH | 72×102 | **0** (consumida) | 98020 | Split de #99022; consumida en guillotina C |

Albarán común Caso C: `G23-PRUEBA STOCK LIBRE` · proveedor CARPAPSA.

---

## 6. Bugs, fricciones y workarounds (constancia exhaustiva)

### 6.1 Planificación — cascade STOP (prioridad alta mañana)

**Síntoma:** Tras **reabrir guillotina**, la OT **no aparece en Pool** pero **sí en Mesa diaria** (impresión `pendiente_inicio`) y en OTs ejecución.

**Causa (diseño actual, no regresión de hoy):**

| Acción | Alcance |
|--------|---------|
| `revertir_consumo` (9.8.5) | Solo stock + `estado_material` STOP |
| `reabrirPasoAdmin` | Paso N → disponible; pasos posteriores «disponible» → pendiente; **mesa N → confirmado** |
| Pool UI | Oculta OT si ya hay hueco en mesa para el mismo `tipo_maquina` (`otBlockedFromPoolByMesa`) |

**Workaround validado:** **Anular hueco mesa → Devolver al Pool** (`devolverHuecoMesaAlPool`) → replanificar → mesa.

**Producto final (acordado):** acción explícita **«STOP material: reset planificación»** con confirmación — **no** cascade silencioso dentro de `revertir_consumo`/`reabrirPasoAdmin`. Ver §7.1 y brief §18.1 / §19.

### 6.2 Asignar stock libre — solo en Cartelas creadas

- Detalle **Stock** (#10985): Ajustar / Partir / Reimprimir — **sin** «Asignar a OT».
- Asignación: **Cartelas → Cartelas creadas** → icono 🔗 verde.
- **Fricción:** lista carga top 200 por `id_stock DESC`; #10985 (id bajo) a veces invisible hasta buscar por id con «Mostrar pruebas».

### 6.3 Partir palet en cartela de prueba

- `prod_stock_split_palet` copia `es_prueba=true` pero usa secuencia production → **#10985** en lugar de 99xxx.
- Filtro UI «Mostrar pruebas» usa **`es_prueba`**, no rango id — confunde en lab pero **no hay riesgo** de colarse en informes reales.
- **Lección positiva (P1 del brief):** cuando el criterio de verdad es un **campo explícito** (`es_prueba`) y no una convención visual (id ≥ 99xxx), el sistema aguanta aunque el número sorprenda. Ejemplo a replicar en otros filtros.

### 6.4 Stock — KPI «Hojas reservadas»

- Asignación 9.8.4 con `cantidad_reservada = null` (**reserva blanda**): chip OT visible, KPI reservadas puede quedar **0** y columna Libre en **1000**. Cosmético.

### 6.5 Pool — semáforo material

- Tras Caso C: badge **«Material parcial»** con texto tipo **2000/1000 h muelle** (mezcla cartelado + objetivo despacho). Revisar criterio cuando hay stock libre + recompra histórica.

### 6.6 Ya documentados (sin fix hoy)

- **9.8.3** compra corrección P2 desde Despachadas (duplicar P1 manual).
- **9.8.6** popup redespacho asistido (lápiz funciona).
- **Observaciones CTP** no persisten sin Guardar explícito (brief §12.1).
- **`estado_material`** a veces sucio tras asignar/consumir.
- Consumo 9.4 no limpia fila bridge residual (`estado` legacy en cartelas).

### 6.7 Fix real de hoy — reabrir paso

Commit `14fc084`: antes `reabrirPasoAdmin` fallaba al actualizar mesa (tabla inexistente). **Ahora** reactiva mesa `confirmado` correctamente. Comportamiento «sigue en mesa, no en pool» es **intencionado** tras el fix, no bug nuevo.

---

## 7. Backlog mañana — producto final (priorizado)

> **Criterio:** lo que Manel validó hoy con workaround manual debería quedar **automático o visible en UI** para planta.

### P0 — Operativa STOP (imprescindible)

| # | Tarea | Descripción |
|---|--------|-------------|
| **7.1** | **Reset planificación STOP (confirmado)** | Botón explícito **«STOP material: reset planificación»** (hoja de ruta / admin): lista huecos mesa a anular (pasos > N), confirmación *«Se van a anular N huecos de mesa planificados. ¿Continuar?»*, luego `devolverHuecoMesaAlPool` + pool `en_transito`. **No** enganchar cascade silencioso a `revertir_consumo` ni `reabrirPasoAdmin` — coherente con P5 «aviso + confirmación antes de acción destructiva». |
| **7.2** | **Asignar OT en detalle Stock** | Mismo `AsignarOtDialog` / RPC `prod_stock_asignar_palet_ot` que Cartelas creadas. |
| **7.3** | **Cartelas creadas — búsqueda server-side** | Buscar por `id_stock`, albarán, OT sin depender del límite 200 filas. |

### P1 — Completar fases 9.8 pendientes

> **Prioridad confirmada (revisión 19 ago noche):** liberar reserva, compra corrección y revertir consumo están gateados a **`admin` / `oficina_tecnica` / `gerencia`**. Ramón/Juan solo ejecutan **9.8.4** (asignar stock libre). El workaround manual P1→P2 lo hace Zaida/Manel con contexto — **P1 correcto**, no bloqueante operativa diaria.

| # | Fase | Tarea |
|---|------|--------|
| **7.4** | **9.8.3** | Compra corrección P2 desde Despachadas (tipo `correccion`, `compra_origen_id`); desbloquear botón lote cuando allowlist STOP. |
| **7.5** | **9.8.6** | Popup redespacho asistido tras liberar/asignar (guillotina + formato compra). |

### P2 — Polish / deuda conocida

| # | Tarea |
|---|--------|
| **7.6** | Toast reabrir: «Paso reabierto. **Sigue en mesa**; usa Anular→Pool si quieres replanificar.» |
| **7.7** | Split palet prueba: id_stock coherente (secuencia prueba) o aviso al operario. |
| **7.8** | Stock KPI: reservas blandas en contador o leyenda «blanda». |
| **7.9** | Pool `materialStatus` con stock libre asignado + histórico compras. |
| **7.10** | Fix observaciones CTP/ejecución (brief §12.1). |
| **7.11** | Sync `estado_material` tras asignar palet y tras consumo (badge Despachadas). |
| **7.12** | Consumo 9.4: limpiar bridge/residual `estado` legacy. |

### P3 — Lab opcional

| # | Tarea |
|---|--------|
| **7.13** | Clonar **98021** para repetir A/B/C sin estado sucio. |
| **7.14** | E2E cerrar impresión 98020 (troquel) — no bloqueante 9.8. |

---

## 8. Mapa fases 9.8 — estado al cierre sesión

| Fase | Código | Validación planta |
|------|--------|-------------------|
| 9.8.1 + 1b | ✅ `main` | 98019-A (18 ago) + 98020-A |
| 9.8.2 | ✅ `main` | 98020-A/B |
| 9.8.3 | 📋 workaround manual | Duplicar P1 |
| 9.8.4 | ✅ `main` | 98020-C (#10985 → 98020) |
| 9.8.5 | ✅ `main` | 98020-B (#99021 revert) |
| 9.8.6 | 📋 lápiz | Redespacho manual OK |
| Compra sin OT | ✅ `main` | OCM-STOCK + #99022 |
| Cascade planificación | 📋 | Workaround anular→Pool; mañana botón confirmado §19 |

---

## 9. Retomar mañana

1. Leer §7 (backlog priorizado) — empezar por **7.1 reset planificación STOP** (botón + confirmación; ver brief §19).
2. Brief bloque: `.MANUALES/BLOQUES/MINERVA_BLOQUE9_REASIGNACION_STOP.md` §18.
3. Si se repite lab: OT **98021** limpia.
4. Migraciones pendientes de aplicar en remoto (si no están): `20260819200000_*`, `20260819200100_*`.

---

## 10. Referencias cruzadas

| Documento | Actualizar |
|-----------|------------|
| `.MANUALES/BLOQUES/MINERVA_BLOQUE9_REASIGNACION_STOP.md` | §12 98020 + §18 backlog |
| `.MANUALES/CONTEXTO/MINERVA_HUB_CONTEXTO_MAESTRO.md` | Estado 9.8 + sesión 19 ago |
| `.MANUALES/CONTEXTO/FASES_HOJA_RUTA_DIGITAL.md` | Tabla fases 9.8 |
| `.MANUALES/SESIONES/SESION_18AGO2026_STOP_MATERIAL.md` | Enlace a 98020 validado |
| `CLAUDE.md` | Puntero sesión activa |
