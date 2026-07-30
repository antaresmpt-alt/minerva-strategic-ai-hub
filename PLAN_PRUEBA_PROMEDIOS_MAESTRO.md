# Plan de prueba — Promedios maestro (Bloque 6.x)

> Objetivo: validar mediana / moda / horas-millar → botón «Actualizar promedios» → prefill «Usar maestro».
>
> **Estado (30 jul 2026):** ✅ **Validado en planta/oficina** con M-00003 (ANSILIT) + OTs reales.
> Ref. `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md` §7.1 · `MINERVA_HUB_CONTEXTO_MAESTRO.md`

## UI Maestro (jul 2026)

- Panel **Promedios desde histórico**: categóricos + tabla por proceso (impresión / troquel / engomado con prep+millar; **guillotina** y **desbroce** en horas absolutas).
- Recálculo: **Actualizar todas** | **Actualizar filtrados** | **Actualizar seleccionados** | **Recalcular este artículo**.
- **PDF ficha A4** del artículo (modal + icono fila): identidad, habituales, promedios, defaults.
- Migración: `horas_guillotina_*` / `horas_desbroce_*` en `prod_referencias`.

---

## 0. Tanda real ejecutada (30 jul 2026)

| Campo | Valor |
|-------|--------|
| **Referencia Minerva** | **M-00003** (EU1052 ANSILIT) |
| **Cantidad pedida Q** (histórico) | **3500** en las 3 OTs |
| **OTs en Producidas** | **98003**, **98004**, **35265** (n=3, ninguna excluida) |
| **OT prueba Q distinta** | **98014** (cabecera Optimus, Q=**8000**, sin despachar) |

### Horas reales (impresión / troquel / engomado) usadas en el motor

| OT | Prep imp. | Tiraje imp. | Prep troq. | Tiraje troq. | Prep eng. | Tiraje eng. | Guillotina | Desbroce |
|----|-----------|-------------|------------|--------------|-----------|-------------|------------|----------|
| 35265 | 0,5 | 1,2 | 1,2 | 1,5 | 0,15 | 1,2 | 0,7 | 0,6 |
| 98003 | 0,8 | 1,4 | 0,8 | 1,5 | 0,35 | 0,8 | 0,3 | 0,7 |
| 98004 | 0,5* | 1,0 | 1,0 | 1,5 | 0,25 | 1,0 | 0,5 | 0,5 |

\* 98004 tenía prep impresión = 5 h (teclado); parcheada a **0,5** en Producidas (trigger desactivado puntual).

### Promedios esperados / obtenidos en M-00003 (n=3)

| Campo | Esperado (mediana) | App / PDF |
|-------|-------------------|-----------|
| Prep impresión | **0,5** (no media 0,6) | ✅ 0,5 |
| Millar impresión | mediana(0,343 / 0,400 / 0,286) = **0,343** | ✅ |
| Prep troquel | **1** | ✅ |
| Millar troquel | **0,429** (1,5×1000/3500) | ✅ |
| Prep engomado | **0,25** | ✅ |
| Millar engomado | **0,286** | ✅ |
| Guillotina abs. | **0,5** | ✅ |
| Desbroce abs. | **0,6** | ✅ |
| Material / troquel / poses / caja / uds | moda | TPWHITE / TAM00534 / 4 / MN2L / 450 |

> **Mediana ≠ media:** con prep 0,5 / 0,8 / 0,5 la mediana es 0,5; la media sería 0,6.

### Prefill «Usar maestro» con Q=8000 (OT 98014) — ✅ OK

Tiraje = `millar × (Q/1000)` redondeado a 2 decimales:

| Proceso | Prep (absoluta) | Tiraje esperado | UI despacho |
|---------|-----------------|-----------------|-------------|
| Impresión | 0,5 | 0,343 × 8 = **2,74** | ✅ 0,5 / 2,74 |
| Troquel | 1 | 0,429 × 8 = **3,43** | ✅ 1 / 3,43 |
| Engomado | 0,25 | 0,286 × 8 = **2,29** | ✅ 0,25 / 2,29 |

---

## 1. Qué debe pasar (reglas)

| Tipo | Cálculo |
|------|---------|
| **Categóricos** | **Moda** |
| **Numéricos / prep / guillotina / desbroce** | **Mediana** absoluta |
| **Tiraje** | Mediana de `H × 1000 / Q` → en despacho: `millar × (Q'/1000)` |
| Escritura | Solo `*_promedio` / `*_muestra_n` / meta — **nunca** oficial ni habitual |
| Prefill | `oficial ?? promedio ?? habitual`, solo campos **vacíos** |

Filtros: `excluido_de_promedios = false`, con `referencia_id`, **MAX(version)** por OT.

---

## 2–4. Checklist genérico (plantilla)

Sigue siendo válido para futuras referencias: 3–4 OTs misma Q → Actualizar promedios → PDF ficha → Usar maestro con otra Q.

Checklist corta:

- [x] OTs en Producidas con misma referencia
- [x] Actualizar seleccionados / este artículo
- [x] Panel + PDF ficha coinciden con mediana
- [x] Habituales / oficiales no pisados
- [x] Usar maestro escala tiraje con Q

---

## 5. Código

| Pieza | Archivo |
|-------|---------|
| Motor | `src/lib/maestro-promedios-calc.ts` |
| Escritura BD | `src/lib/maestro-promedios-update.ts` |
| Prefill | `src/lib/maestro-prefill.ts` |
| PDF ficha | `src/lib/articulos-maestro-ficha-pdf.ts` |
| UI Maestro | `articulos-maestro-page.tsx` |
| «Usar maestro» | `despacho-wizard-dialog.tsx` |

Tests: `npx vitest run src/lib/maestro-promedios-calc.test.ts src/lib/maestro-prefill.test.ts src/lib/maestro-promedios-update.test.ts`

---

## 6. Resultado de esta tanda

| Fecha | Ref. | OTs | Q hist. | ¿OK? | Notas |
|-------|------|-----|---------|------|-------|
| 30 jul 2026 | M-00003 | 98003, 98004, 35265 | 3500 | ✅ | Prefill Q=8000 en **98014** OK; prep=mediana no media |
