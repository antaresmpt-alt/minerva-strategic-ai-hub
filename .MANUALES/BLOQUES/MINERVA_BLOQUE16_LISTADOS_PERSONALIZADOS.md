# MINERVA — Bloque 16: Listados personalizados + Digests mail

> **Fuente de verdad del Bloque 16** (diseño).  
> Tema: listados preconfigurados por temática + suscripciones + **digest diario por mail**.  
> Complementa: maestro · Bloque 9 (compras/muelle/material) · Bloque 11 (calendario) · Bloque 15 (stock PT, cuando exista).
>
> **Estado:** 📋 Diseño (25 sep 2026). Sin implementación.  
> **Urgencia:** cero automatización de reporting; Gemma/Carlos/Ramón/Juan reciben info fragmentada.  
> **Killer feature:** mail 08:00 (laborables) con lo accionable **por rol**.

**Independencia:** el MVP de digests (material hoy, plan impresión, atrasadas…) **no espera** al Bloque 15. Los listados de stock **producto** se añaden cuando 15.1 exista.

---

## 1. Problema

| Quién | Necesita | Hoy |
|-------|----------|-----|
| **Gemma** | Qué material llega hoy (+ mañana) | Espera / pregunta a Ramón |
| **Carlos** | Plan impresión / planta hoy | Mira calendario / pipeline a mano |
| **Juan / Ramón** | Llegadas muelle, demoras OC | Correos y notas |
| **Antonio** (si aplica mesa) | Plan troquel hoy | Igual |
| **Albert / Jordi** | Foto del día | Preguntar a alguien |

Visión: cada uno abre el mail y sabe qué hacer **hoy**, con link a Minerva.

---

## 2. Qué NO es

- No Power BI / Tableau el día 1.  
- No `sql_query` libre editable en BD (inyección, drift, imposible de versionar).  
- No SMS/Slack en MVP (mail + pantalla web).  
- No sustituir dashboards vivos; el mail es **resumen**, la app es detalle.

---

## 3. Concepto

Un **listado** = clave estable en código + filtros guardados + columnas + suscriptores + plantilla mail.

```text
clave: material_llega_hoy
  → query en src/lib/listados/...
  → filtros: fecha, proveedor…
  → columnas fijas versionadas
  → suscriptores: gemma@, carlos@, juan@…
  → cron 08:00
```

**Crear listado** en UI = elegir plantilla (clave) + ajustar filtros/suscriptores, **no** escribir SQL.

---

## 4. Modelo de datos (propuesto)

### `prod_listados_definicion`

| Campo | Notas |
|-------|--------|
| `id` | uuid |
| `clave` | text unique — `ots_atrasadas`, `material_llega_hoy`, … |
| `nombre` / `descripcion` | UI |
| `tematica` | `produccion` \| `compras` \| `stock` \| `expedicion` \| `ventas` \| `gerencia` |
| `frecuencia` | `diaria` \| `semanal` \| `manual` |
| `hora_envio` | time, ej. 08:00 |
| `filtros_default` | jsonb |
| `activo` | bool |
| `created_at` / `updated_at` | |

La **implementación** de la query vive en código (`clave` → función). Opcional: snapshot de versión de columnas en jsonb solo para audit.

### `prod_listados_suscriptores`

`listado_id`, `usuario_id` o email, `incluir_si_vacio`, unique (listado, usuario).

### `prod_listados_envios`

Log: fecha, listado, num_filas, `datos_json` (snapshot), recipients, `estado_envio`.

### `prod_listados_filtros_usuario` (fase B)

Presets personales por usuario.

---

## 5. UX

### 5.1 `Reportes → Listados` (o bajo Portal)

- Grid por temática / “mis suscripciones”.  
- Abrir listado → tabla live + Export CSV/PDF.  
- Gestionar suscriptores (quién recibe el digest).  
- Gemma configura **quién** recibe “Material llega hoy” (Carlos, Ramón, Juan…).

### 5.2 Crear desde plantilla

Elegir clave semilla → nombre → filtros → suscriptores → guardar. Sin SQL.

---

## 6. Listados semilla (MVP)

### Producción

| Clave | Contenido | Destinatarios tipicos |
|-------|-----------|------------------------|
| `ots_atrasadas` | Entrega &lt; hoy, no cerradas | Carlos, Gemma, Albert |
| `plan_impresion_hoy` | Calendario / mesa ámbito Impresión hoy | Carlos |
| `plan_troquel_hoy` | Ámbito Troquel hoy | Antonio / mesa T |
| `plan_engomado_hoy` | Ámbito Engomado / Takeit | Planta, Gabri |

### Compras / muelle

| Clave | Contenido | Destinatarios |
|-------|-----------|---------------|
| `material_llega_hoy` | OC / recepción estimada = hoy (+ bloque “mañana” al final del mail) | Gemma, Carlos, Ramón, Juan |
| `ocs_demora` | Entrega vencida no recibida | Ramón, Gemma |
| `externos_pendientes` | Paso externo en tránsito | Ramón, Carlos |

### Stock / gerencia

| Clave | Contenido | Destinatarios |
|-------|-----------|---------------|
| `stock_material_critico` | ATP material B9 bajo mínimo | Gabri, Carlos |
| `stock_producto_critico` | **Tras B15** — PT/WIP bajo mínimo | Gabri, comercial |
| `snapshot_gerencia` | Atrasadas + llegadas + 1–2 alertas | Albert, Gemma, Jordi |

Ajustar nombres reales de usuarios en validación §9.

---

## 7. Digest mail (killer)

- **Cuándo:** 08:00 laborables (confirmar con Gemma/Albert).  
- **Qué:** secciones solo de listados a los que el usuario está suscrito; si todo vacío y `incluir_si_vacio = false` → no enviar.  
- **Cómo:** HTML corto + links a Minerva.  
- **Cron:** Supabase `pg_cron` / Edge Function / Make / n8n — decidir en implementación (credenciales mail ya existen en etiquetas compras; reutilizar patrón).
- **UTC:** `pg_cron` va en UTC; “08:00 Madrid” hay que resolver en código (CET/CEST).
- **Idempotencia:** un envío por (`listado_id`, día local); si el cron se dispara dos veces, no duplicar mail.
- **Calendario:** laborables + festivos + cierre agosto (config/lista).

Ejemplo secciones Gemma:

1. Material **hoy**  
2. Material **mañana** (resumen)  
3. Opcional: OCs demora  

Ejemplo Carlos: plan impresión hoy + atrasadas + material hoy (si suscrito).

---

## 8. Relación con otros bloques

| Bloque | Uso |
|-------|-----|
| **9** | Material crítico, compras, muelle |
| **11** | Plan por ámbito / detalle-día |
| **15** | Stock producto crítico (después) |
| **6** | OTs pendientes de revisión (opcional) |
| **Externos** | Pendientes recepción |

---

## 9. Preguntas abiertas

1. ¿Hora 08:00? ¿Solo laborables?  
2. ¿Quién puede crear/editar listados? (admin / gerencia / cada jefe su área)  
3. Columnas imprescindibles en “Material llega hoy”  
4. Definición de “crítico” (mínimos maestro vs hardcoded)  
5. Retención de `prod_listados_envios` (30 / 90 días)  
6. ¿SMS/Slack algún día?  
7. Lista exacta de correos por rol  

---

## 10. Fuera de MVP

- SQL editable por usuario  
- Power BI  
- Alertas push tiempo real  
- Filtros personales avanzados (fase B)  

---

## 11. Roadmap

### Fase A

| ID | Entregable |
|----|------------|
| **16.0** | Migración definición + suscriptores + envíos + RLS |
| **16.1** | Librería listados por `clave` (3–5 semillas: material hoy, atrasadas, plan impresión) |
| **16.2** | UI Listados + suscripciones |
| **16.3** | Cron digest 08:00 + plantilla HTML |
| **16.4** | Semillas restantes (troquel, OCs demora, externos, snapshot) |

### Fase B

| ID | Entregable |
|----|------------|
| **16.5** | Filtros usuario |
| **16.6** | Semilla stock producto (B15) |
| **16.7** | Slack / alertas críticas |
| **16.8** | Export Sheets |

---

## 12. Historial

| Fecha | Cambio |
|-------|--------|
| 25 sep 2026 | Creación (Claude) + niquelado Cursor: claves no SQL libre, independencia de B15, roles/plantas Minerva, digest Gemma material hoy+mañana. |

---

## 13. Próximo paso

Validar §9 con Gemma (hora + destinatarios material) y Carlos (plan impresión).  
Implementar Fase A en paralelo a diseño B15 si Manel prioriza digests.
