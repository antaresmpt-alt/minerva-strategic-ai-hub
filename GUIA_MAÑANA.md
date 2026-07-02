# Guía demo — Bloque 8.1 (OT contenedor 98010)

> **Fecha:** reunión jueves con Albert / Jordi (jun 2026)  
> **Rama desplegada:** `feature/bloque8.1-pool-mesa-ejecucion-fixes`  
> **Briefing completo:** `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §8.1 / §8.1.1  
> **Pendiente CTP despacho:** `docs/despacho-wizard-ctp-pendiente.md` — ✅ **v1 implementado** (30 jun 2026)  
> **Pedidos complejos / demo:** `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` **§3 Caso A.2 — OT 36204**

---

## Mensaje clave (30 segundos)

Minerva modela pedidos complejos como un **barco** (OT padre) con **hijas reales** en BD (`98010-01`, `-02`, `-03`). En listados solo ves el contenedor; al expandir, las hijas. Cada hija planifica y ejecuta su ruta como una OT normal, pero **compra el material una vez** en el padre.

---

## OT de demo: 98010

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
| ¿Wizard crear hijas? | Fase **8.2** pendiente; 98010 se creó con script de prueba. |
| Merma impresión en 01 | Ejecución anterior a fix; nuevas OTs usan `brutas − merma = netas`. |

---

## Checklist antes de la reunión

```powershell
git pull
npx tsc --noEmit
```

- [ ] Login con usuario producción (no CTP-only si quieres ver todas las áreas).
- [ ] Fecha mesa diaria = día con planificación de 98010.
- [ ] Vercel preview en rama `feature/bloque8.1-pool-mesa-ejecucion-fixes` (o merge a main si ya está).

---

## Después de la demo

- [ ] Anotar respuestas §12 con Jordi/Zaida/Abraham.
- [ ] Fase **8.2**: wizard despacho contenedor + creación batch de hijas.
- [ ] Opcional: desbroce + engomado de 98010-01 para cerrar arco completo.

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
3. Imprimir → 2 copias; ID Stock grande; Ref. Lote `OT - TRABAJO`.

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

## Demo pedidos complejos — OT 36204 (jul 2026)

**Fuente de verdad:** `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §3 **Caso A.2**.

| Rol | OT | Para qué en la demo |
|-----|-----|---------------------|
| Barco en ejecución | **98010** | Pool, Pipeline, cartelas, hijas a distinto avance |
| Definición de formas (diseño 8.2) | **36204** | 4 refs, 2 formas, troquel 4 poses, 6.000 estuches |

**Mensaje clave:** Optimus ya parte el pedido en hijas; Minerva necesita el **wizard al despachar** para no usar scripts. Caso 36204 es el ejemplo real del día.

**Al retomar desde casa:** leer §16 «Retomar desde casa» en Bloque 8 → implementar MVP 8.2 o ensayar guion con doc + 98010.

---

## Comandos útiles

```powershell
git status
git log --oneline -5
npx tsc --noEmit
```
