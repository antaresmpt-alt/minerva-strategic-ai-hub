# Minerva Hub — Trabajo agosto 2026 (~61 h)

**Manel · desarrollo en solitario (vacaciones · Cursor + IA)**  
**Objetivo del mes:** dejar operativos **material/stock con STOP**, **calendario de planta** y **ejecución por contenedor**, validados en planta.

---

## En una frase

Agosto cerró el **«qué hacemos cuando el material está mal»** (Bloque 9.8) y puso el **calendario de Carlos/Jordi en producción real** (Bloque 11), con smoke en planta y mejoras de rendimiento.

---

## Entregables principales

| Área | Qué quedó hecho | Validación |
|------|-----------------|------------|
| **9.8 STOP material** | Liberar · revertir consumo · recompra · stock libre · aviso formato · reset planificación · sync albarán | OTs **98019, 98020, 98022, 36112** |
| **Compras / almacén** | Perf usable (~1–2 s) · compra stock libre · asignar desde Stock · búsqueda cartelas server-side | Ramón / oficina 20–21 ago |
| **Calendario (B11)** | Bandeja I/D/T/E · contenedor CTP/Troquel/secciones · detalle del día · PDF rico · orden «Hoy planificado» | Smoke **35900/35904** · Carlos en uso |
| **Ejecución planta** | Lista gorda OTs en ejecución · contenedor planificado + sin plan · fix horas al cerrar paso | 14 + 22–30 ago |
| **Bloque 12 (prep.)** | Vista **mesa** detalle del día (DnD, claim) | 29 ago |
| **Rendimiento** | 3 PRs calendario (bandeja, guardar detalle-día, inputs) + filtros ejecución | 30 ago |

---

## Línea temporal

| Semana | Foco |
|--------|------|
| **13–14 ago** | Externos «imprimir fuera» · Manipulados Encajar · **OTs en ejecución** (lista gorda) |
| **17 ago** | E2E OT **98016** · prefill horas Ruta · muelle brutas/netas |
| **18–21 ago** | **Bloque 9.8 completo** — labs STOP + smoke **36112** |
| **22–23 ago** | **Contenedor + bandeja** calendario — smoke Digital/Offset |
| **26–27 ago** | Detalle del día · PDF cartelas+material · reserva dura · modal Atrasadas |
| **29–30 ago** | Vista mesa detalle-día · **perf calendario** (3 PRs) |

---

## Horas (~61 h) — reparto orientativo

| Bloque | h | Contenido |
|--------|---|-----------|
| 9.8 STOP + Compras + cartelas | ~28 | RPCs, UI, migraciones, 4 OTs lab, manual usuario |
| 11 Calendario + contenedor | ~22 | Bandeja, detalle-día, PDF, smoke, fixes |
| Ejecución + HR + pulidos | ~7 | Lista gorda, perf, print Electron |
| Docs / handoffs / planta | ~4 | Sesiones, briefs, validación Carlos/Ramón |

---

## Qué NO es (expectativas)

- No es Bloque 13 (comerciales / TV planta) — solo diseño.
- No sustituye Optimus al 100% — **paralelo** con 4–5 OTs reales E2E.
- Calendario **ordena**; no «lanza» — ejecución = **contenedor** + itinerario.

---

## Septiembre (siguiente)

- Demo STOP peor caso con Gemma (OT lab **98045** — ver `.MANUALES/SESIONES/SESION_12SEP2026_SMOKE_GEMMA_98045.md`).
- Uso real **Compras** (calendario fecha prevista) + fichas comercial (Bloque 14).

*Repo: minerva-strategic-ai-hub · Deploy: Vercel · Detalle: `.MANUALES/SESIONES/SESION_*AGO2026*.md`*
