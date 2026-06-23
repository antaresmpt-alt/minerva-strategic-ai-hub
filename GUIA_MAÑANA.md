# Guía demo — Bloque 8.1 (OT contenedor 98010)

> **Fecha:** reunión jueves con Albert / Jordi (jun 2026)  
> **Rama desplegada:** `feature/bloque8.1-pool-mesa-ejecucion-fixes`  
> **Briefing completo:** `MINERVA_BLOQUE8_FORMAS_Y_COMPONENTES.md` §8.1 / §8.1.1

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

## Comandos útiles

```powershell
git status
git log --oneline -5
npx tsc --noEmit
```
