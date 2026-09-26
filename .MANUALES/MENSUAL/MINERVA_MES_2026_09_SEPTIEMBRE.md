# Minerva Hub — Trabajo septiembre 2026 (~37,5 h a 26 sep · mes abierto)

**Manel · desarrollo en solitario (Cursor + IA) en paralelo con Optimus**  
**Objetivo del mes:** pasar de «funciona en agosto» a **uso real con OTs de verdad** (4–5 OTs E2E, reunión Gemma 6 sep), y abrir los módulos que pide la oficina: **fichas comercial**, **compras/facturas** y **stock de producto terminado**.

> Horas = **estimación** a partir de commits y sesiones (no hay fichaje). Manel las ajusta antes de pasarlas a Gemma. Se cierra el mes con los días que falten (26–30 sep).

---

## En una frase

Septiembre puso **Compras y almacén de papel en uso diario** (OCR de albaranes, factura por albarán, residuos), dio a **comerciales su ficha técnica** en el maestro con PDF para cliente, y construyó en un día el **stock de producto terminado** con reserva para OTs y aviso al despachar.

---

## Entregables principales

| Área | Qué quedó hecho | Validación |
|------|-----------------|------------|
| **9.7 OCR albaranes** | PDF/fotos → IA → tabla revisable → recepciones en Pendientes (Ramón confirma; no crea cartela solo) | Ramón, PDF real · 2 sep |
| **Despacho** | Buscar OT anterior por nº / cliente / artículo · «Usar maestro» sobrescribe técnicos | 4 sep |
| **Reunión Gemma** | App enseñada de arriba a abajo (Albert, Jordi, Gemma) · plan 4–5 OTs reales · Bloque 13 comerciales/TV en diseño | 6 sep (~3 h) |
| **Ejecución planta** | Iniciar contenedor abre el parte al instante (antes 5–10 s) | OT 98005 · 6 sep |
| **B14 Fichas comercial** | Ficha en maestro · PDF Minerva + PDF cliente · adjuntos foto/troquel · tintas ecológicas · RGS · bultos/palet · copiar ficha · permisos comercial | Jordi 9 sep · merge `main` |
| **Compras / almacén** | Kg en cartelas · solo hojas brutas · **conciliar factura por albarán** (prorrateo €) · **análisis residuos v1** (Excel/PDF) · tabla Compras con columnas fijas y scroll arriba | OT 36254 · 12 sep |
| **Demo STOP** | Guion peor caso OT **98045** para Gemma | 12 sep |
| **Etiquetas Hugo** | Sesiones «Hoy» por I/T/N | 25 sep |
| **B15 Stock artículos** | Lotes PT/WIP · import Excel · export · reservas · aviso al despachar · `es_ot_entrega` · Consumir archiva · manual de uso | En `main` 26 sep · carga real de Gabri pendiente |
| **B16 Listados + mail 08:00** | Diseño cerrado (sin código) | 25 sep |

---

## Línea temporal

| Día | Foco |
|-----|------|
| **2 sep** | 9.7 OCR albaranes |
| **4 sep** | Despacho: OT anterior + Usar maestro |
| **6 sep** | Reunión Gemma (~3 h) + perf Iniciar contenedor |
| **7–9 sep** | Bloque 14 fichas comercial (PDF dual, adjuntos, permisos, borrado maestro) |
| **12 sep** | Compras: kg, factura por albarán, residuos, UX tabla · guion 98045 |
| **15 sep** | Maestro artículos: crear → editar con foto |
| **25 sep** | Etiquetas «Hoy» · **Bloque 15 Fase A** (22 commits) · diseño B16 |
| **26 sep** | B15 cerrado: no esconder stock, clientes, Ajustar, OT entrega, Consumir archiva. Manual. Merge `main` |

---

## Horas (~37,5 h) — reparto orientativo

| Día | h | Contenido |
|-----|---|-----------|
| 2 sep | ~4 | OCR albaranes + smoke |
| 4 sep | ~2 | Despacho OT anterior / maestro |
| 6 sep | ~5 | Reunión Gemma ~3 h + perf contenedor ~2 h |
| 7 sep | ~4 | B14 fichas: modelo, PDF, permisos, adjuntos |
| 8 sep | ~1,5 | B14: tintas eco, logo, RGS |
| 9 sep | ~4 | B14: bultos/palet, copiar ficha, borrado maestro (2 PR) |
| 12 sep | ~4 | Compras / residuos / factura + docs 98045 |
| 15 sep | ~1 | Maestro artículos |
| 25 sep | ~8 | Etiquetas + B15 completo + B16 diseño |
| 26 sep | ~3,5 | B15: decisiones, código de cierre, manual, merge `main` |
| **Total** | **~37,5** | |

Por bloque: **B14 fichas ~9,5 h** · **Compras/almacén (9.7 + 12 sep) ~8 h** · **B15 stock artículos ~10,5 h** (7 h el 25 + 3,5 h el 26) · **Reunión + perf planta ~5 h** · **Despacho/maestro/etiquetas ~3,5 h** · **B16 diseño ~0,5 h**.

---

## Qué NO es (expectativas)

- **Stock artículos (B15)** no crea OTs: el reparto entrega + fabricación se hace en Optimus mientras convivan.
- Stock de producto aún con **datos de prueba**; falta la carga real de Gabri.
- **B16 digests** y **B13 comerciales/TV** están solo en diseño.
- Albarán / cierre por María José sigue fuera (Bloque 7, pendiente Odoo).

---

## Octubre (siguiente)

- Carga real de Gabri en Stock artículos (el lunes, minidemo). Lotes de prueba a 0 después. Excel Blanxart para Zaida. **15.5** después. Detalle: `.MANUALES/SESIONES/SESION_26SEP2026_BLOQUE15_DECISIONES.md`.
- **B16 Fase A:** digest mail 08:00 (material que llega hoy para Gemma, plan impresión, atrasadas).
- Seguir con 4–5 OTs reales E2E por semana; Bloque 12 (landing por perfil) cuando entren más usuarios.

*Repo: minerva-strategic-ai-hub · Deploy: Vercel · Detalle diario: `.MANUALES/SESIONES/SESION_*SEP2026*.md` · Mes anterior: `MINERVA_MES_2026_08_AGOSTO.md`*
