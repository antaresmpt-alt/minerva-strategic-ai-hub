# Guía demo — Bloque 8 (contenedor + wizard complejos)

> **Fecha:** demo pedidos complejos — **3 jul 2026** (Albert / Jordi / planta)  
> **Rama desplegada:** `wizard-despacho` (merge a `main` pendiente)  
> **Briefing completo:** `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §8.2 / §16  
> **Pendiente CTP despacho:** `docs/despacho-wizard-ctp-pendiente.md` — ✅ **v1 implementado** (30 jun 2026)  
> **Pedidos complejos / demo:** `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` **§3 Caso A.2 — OT 36204**

---

## Mensaje clave (30 segundos)

Minerva modela pedidos complejos como un **barco** (OT padre) con **hijas reales** en BD (`98010-01`, `-02`, `-03`). En listados solo ves el contenedor; al expandir, las hijas. Cada hija planifica y ejecuta su ruta como una OT normal, pero **compra el material una vez** en el padre.

**Novedad 2–3 jul:** el **wizard de despacho** ya crea hijas + componentes + hoja simplificada (portada barco + 1 A5 por forma) **sin script**. Demo en vivo con OT **98011**.

---

## OTs de demo — resumen rápido

| OT | Rol | Estado al abrir demo |
|----|-----|----------------------|
| **98010** | Barco en ejecución (Milical) | Compra hecha; hijas a distinto avance (pool/mesa) |
| **98011** | Wizard **en vivo** (clone 36204) | Solo maestro — **despachar en la demo** |
| **36204** | Caso real Optimus ya despachado | Padre + 36204-01/02; compra pendiente en padre; probar desbroce 36204-01 |

---

## OT de demo: 98010 (ejecución barco)

| OT | Forma | Estado esperado al abrir |
|----|-------|--------------------------|
| **98010** | Padre (barco) | Compra + recepción hechas; no va a mesa |
| **98010-01** | AU260 | CTP + Impresión + Troquel **terminados**; Desbroce disponible |
| **98010-02** | AU235 | CTP **confirmada** en mesa diaria |
| **98010-03** | AU490 | Pendiente en **pool lateral CTP** (aún no arrastrada) |

**No re-ejecutar** `scripts/setup-contenedor-test-98010.mjs` — borraría itinerarios/ejecuciones ya hechas.

---

## Recorrido sugerido (~5 min)

### 1. Pool OTs (vista agrupada)

- Buscar **98010** → contenedor expandible con 3 hijas.
- Badge progreso: **% pasos** (todas las hijas), no solo hijas cerradas.
- Marcar hijas y enviar a mesa: material **vía barco** del padre (semáforo verde heredado).

### 2. Pipeline

- Contenedor **98010** con hijas a distinto avance.
- **01**: pasos avanzados; siguiente paso Desbroce.
- **02 / 03**: aún en fase CTP.

### 3. Mesa diaria — Todas las áreas

- **SpeedMaster:** pool lateral **vacío** (correcto: hijas siguen en CTP, no offset).
- **CTP MNRV:** pool lateral muestra **98010-03** si aún no está en mesa; **02** no sale (ya confirmada en tarde).
- Columna CTP: 01 terminada (mañana), 02 confirmada (tarde).

### 4. Hoja de ruta — 98010-01

- CTP, Impresión, Troquel finalizados con datos reales.
- Encadenado de formatos / hojas visible.

### 5. OTs despachadas / Maestro OTs (agrupado)

- Buscar **98010** → una fila barco; expandir → hijas `-01/-02/-03`.
- Filtro **Vista OT: Agrupado (barco)**.

### 6. Preguntas para planta (§12 Bloque 8)

Tener a mano `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §12:
- ¿Quién define hijas al despachar?
- ¿Compra siempre conjunta en el barco?
- ¿CTP compartido o por hija?

---

## Qué NO enseñar / aclarar si preguntan

| Tema | Respuesta corta |
|------|-----------------|
| ¿Por qué 03 en pool si 02 ya está en CTP? | Cada hija es independiente; no hay cola secuencial entre hijas (futuro opcional). |
| ¿Wizard crear hijas? | ✅ **Fase 8.2 MVP** en `wizard-despacho`. 98010 sigue siendo script; **98011** para wizard en vivo. |
| ¿Compra en hijas? | **No.** Marcar solo el **contenedor** (36204) en OTs Despachadas → Generar compras en lote. |
| Merma impresión en 01 | Ejecución anterior a fix; nuevas OTs usan `brutas − merma = netas`. |
| NETAS/BRUTAS hijas en Despachadas | Pueden mostrar `—` (hijas sin fila despacho propia); la compra usa datos del **padre**. |

---

## Checklist antes de la reunión

```powershell
git pull
npx tsc --noEmit
```

- [ ] Login con usuario producción (no CTP-only si quieres ver todas las áreas).
- [ ] Deploy `wizard-despacho` en Vercel activo (o merge a `main`).
- [ ] Confirmar OT **98011** visible en Maestro OTs (estado: No empezado, no despachada).
- [ ] Confirmar OT **36204** expandible en OTs Despachadas con hijas 36204-01/02.

---

## Recorrido ampliado — wizard complejos (~8 min extra)

### 7. Maestro OTs → despachar **98011** en vivo

- Buscar **98011** → wizard despacho contenedor.
- Pestaña **Formas/Hijas**: 2 formas, 4 refs (605212, 605229, 115735, 202037), troquel 4 poses.
- Validación 6.000 estuches antes de guardar.
- Tras despachar: **Hoja simplificada** → portada barco + 1 A5 por forma.

### 8. OTs Despachadas — **36204** compra material

- Vista **Agrupado (barco)** → expandir **36204**.
- Seleccionar **solo 36204** (padre) — checkboxes de hijas **deshabilitados**.
- **Generar compras en lote (1)** → `OCM-36204`.

### 9. Ejecución — desbroce **36204-01**

- Avanzar hasta paso Desbroce.
- Verificar banner **NO MEZCLAR** (2 refs en forma) + prefill componentes.

---

## Después de la demo

- [ ] Anotar respuestas §12 con Jordi/Zaida/Abraham (CTP compartido, quién define formas).
- [ ] Merge `wizard-despacho` → `main`.
- [ ] Opcional: re-despachar 36204 para refrescar `datos_proceso` por forma en pasos existentes.
- [ ] Fase **8.4**: cierre contenedor + Bloque 6.

---

## Smoke test OT 35990 (23 jun tarde)

OT simple validada de punta a punta. Ver `FASES_HOJA_RUTA_DIGITAL.md` §Bloque 3.9 y `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §8.7.1.

| Paso | Notas |
|------|-------|
| CTP / Guillotina / Impresión / Troquel / Manipulados | **Cerrar proceso** OK (horas reloj + ajuste manual). |
| Impresión | Badge usa hojas de guillotina, no compradas. |
| Troquel → Manipulados | Merma 25 → semáforo amarillo 475/500. |
| Externos | **Pendiente** — formato y hojas recibidas sin ligar bien. |

Filtro Pool "Próximo paso" ahora incluye **Guillotina** y **Desbroce** (Externo pendiente).

---

## Bloque 9 — Cartelas (24 jun)

Ramón respondió el cuestionario (`MINERVA_CUESTIONARIO_CARTELAS_RAMON.md`). Decisiones en `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §3g y §13c.

### Modelo (sin cambios)

- **1 cartela = 1 palet = 1 ID Stock**; varias OTs sin cantidad por OT en la cartela.
- **Juan:** solo muelle. **Emma/Ramón:** cartelas.
- **Piloto:** Optimus en paralelo + **10–20 OTs** en Minerva (consumo maquinista obligatorio en piloto).
- **Barco:** mismo material → 1 cartela multi-hija; material distinto → cartela separada.

### Implementado (24 jun noche) — §15 briefing

| Fase | Estado | Dónde |
|------|--------|-------|
| **9.0** SQL | ✅ | `supabase/migrations/20260624183000_bloque9_stock_palets_cartelas.sql` |
| **9.1** UI cartelas | ✅ | `/produccion/almacen/cartelas` |
| **9.1b** post smoke | ✅ | Filtros, wizard split, OTs+hijas, ref_lote Optimus, print fix |

**Smoke test:** cartelas **#10310** (g3-9999, OT 98010-01), **#10311** y **#10312** (G6-3305, OT 35990).

**Demo rápida:**
1. Producción → **Cartelas** → Pendientes (filtros: ocultar sin albarán, buscar OT).
2. Generar cartelas → wizard (panel izq. líneas, panel der. palet).
3. Imprimir → **1 copia**; ID Stock grande; Ref. Lote `OT - TRABAJO`.

**Pendiente:** 9.2 Stock, 9.4 consumo, recuento §13b, lista OTs piloto con Emma/Ramón.

---

## CTP despacho + Hoja Ruta Simplificada (30 jun) ✅

Documentación completa: `docs/despacho-wizard-ctp-pendiente.md`.

| Pieza | Dónde probar |
|-------|----------------|
| Marcar requisitos CTP al despachar | Wizard → tab **Producción** (incl. **PDF X OK**) |
| Imprimir papel entre departamentos | Tras despachar → **Imprimir hoja simplificada** (A5) |
| Ejecutar CTP | Mesa diaria CTP MNRV u **OTs en ejecución** → área preimpresión |
| UI híbrida | 9 tareas visibles; sombreadas = pedidas en despacho; opcionales para imprevistos (FSC, retoque…) |

**Próximo paso:** sentarse con **Marc y Gemma** con **3 OTs piloto** — recoger si añadirían/quitarían tareas del catálogo.

**OT de referencia probada:** 35989 (PLANTILLAS COIMBRA).

---

## Demo pedidos complejos — OTs 36204 / 98011 (jul 2026)

**Fuente de verdad:** `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §3 **Caso A.2**.

| Rol | OT | Para qué en la demo |
|-----|-----|---------------------|
| Barco en ejecución | **98010** | Pool, Pipeline, cartelas, hijas a distinto avance |
| Wizard en vivo (desde cero) | **98011** | Maestro solo — despachar 2 formas / 4 refs en la reunión |
| Caso real ya despachado | **36204** | Compra padre, hoja simplificada, desbroce 36204-01 |

**Mensaje clave:** Optimus ya parte el pedido en hijas; Minerva **ya lo hace en el wizard** (rama `wizard-despacho`). 98011 demuestra el flujo sin script.

**Datos 98011 / 36204 (Forma 1):** 605212 + 605229 · 1.100 netas · 1.300 brutas · 4.400 uds.  
**Forma 2:** 115735 + 202037 · 600 netas · 800 brutas · 2.400 uds.  
**Total:** 6.000 estuches · compra padre ~1.800 hojas brutas.

---

## Comandos útiles

```powershell
git status
git log --oneline -5
npx tsc --noEmit
```
