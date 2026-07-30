# Plan de prueba — Promedios maestro (Bloque 6.x)

> Prueba manual corta: **1 OT base → 4 réplicas** con horas ligeramente distintas.
> Objetivo: validar mediana / moda / horas-millar → botón «Actualizar promedios» → prefill «Usar maestro».

## UI Maestro (jul 2026)

- Panel **Promedios desde histórico**: categóricos + tabla por proceso (impresión / troquel / engomado con prep+millar; **guillotina** y **desbroce** en horas absolutas).
- Recálculo: **Actualizar todas** | **Actualizar filtrados** | **Actualizar seleccionados** (checkboxes) | **Recalcular este artículo** en el modal.
- Migración: `horas_guillotina_*` / `horas_desbroce_*` en `prod_referencias`.
>
> Fecha: 28 jul 2026 · Ref. `MINERVA_BLOQUE6_HISTORICO_PRODUCIDAS.md` §7.1

---

## 0. Datos de la tanda (rellenar)

| Campo | Valor |
|-------|--------|
| **OT base** (plantilla) | ________________ |
| **Referencia Minerva** (mismo código en las 4) | ________________ |
| **Cantidad pedida Q** (ideal: **igual** en las 4) | ________________ |
| **Réplica 1** | OT nº ________ |
| **Réplica 2** | OT nº ________ |
| **Réplica 3** | OT nº ________ |
| **Réplica 4** | OT nº ________ |

> Cuando tengas los 4 números, pégalos aquí (o pásamelos) y rellenamos la tabla de horas esperadas.

---

## 1. Qué debe pasar (reglas a comprobar)

| Tipo | Cálculo | Ejemplo |
|------|---------|---------|
| **Categóricos** (material, troquel, tintas, engomado, caja…) | **Moda** (más frecuente) | 3× «Zenith» + 1× otro → Zenith |
| **Numéricos** (poses, gramaje, merma, **prep** horas) | **Mediana** | Prep 0,4 / 0,5 / 0,6 / 0,8 → mediana = **0,55** |
| **Tiraje** | Primero `horas_millar = H × 1000 / Q`, luego **mediana** de esos millar | Ver §3 |
| Escritura | Solo columnas `*_promedio` + `promedios_*` | **Nunca** toca `*_oficial` ni `*_habitual` |
| Prefill despacho | `oficial ?? promedio ?? habitual` | Botón «Usar maestro», solo campos **vacíos** |

Filtros del motor:

- Solo filas en `prod_ot_producidas` con `excluido_de_promedios = false`
- Con `referencia_id` relleno
- **MAX(version)** por `ot_numero` (si reabres y vuelves a cerrar, cuenta la última)

---

## 2. Preparación de las 4 OTs

1. Elige **1 OT real** ya razonable (misma referencia, ruta simple).
2. Crea / despacha **4 OTs nuevas** clonando esa (mismos datos técnicos + **misma referencia Minerva**).
3. Ideal: **misma cantidad pedida Q** en las 4 (si no, el millar sigue siendo válido, pero la mediana de millar es más fácil de verificar a mano con Q fija).
4. En ejecución, completa itinerario y pon **horas reales distintas** (prep + tiraje) — ver plantilla §3.
5. Cierra las 4 a histórico (`prod_ot_producidas`). Comprueba en `/produccion/producidas` que:
   - aparecen las 4
   - `referencia_id` / código Minerva OK
   - **no** están marcadas como excluidas de promedios

---

## 3. Plantilla de horas (rellenar al probar)

Usa impresión (o troquel/engomado — misma lógica). Ejemplo con **Q = 5000**:

| OT | Prep impresión real (h) | Tiraje impresión real H (h) | Millar = H×1000/Q |
|----|-------------------------|-----------------------------|-------------------|
| R1 | 0,40 | 2,00 | 0,400 |
| R2 | 0,50 | 2,40 | 0,480 |
| R3 | 0,60 | 2,60 | 0,520 |
| R4 | 0,80 | 3,00 | 0,600 |

**Esperado tras «Actualizar promedios»** (n = 4):

| Campo maestro | Esperado | Cómo se obtiene |
|---------------|----------|-----------------|
| `horas_prep_impresion_promedio` | **0,55** | mediana de 0,40 / 0,50 / 0,60 / 0,80 |
| `horas_prep_impresion_muestra_n` | **4** | |
| `horas_millar_impresion_promedio` | **0,5** | mediana de 0,40 / 0,48 / 0,52 / 0,60 |
| `horas_millar_impresion_muestra_n` | **4** | |
| `promedios_basados_en_n_ots` | **4** | |
| `promedios_actualizados_at` | ahora | |

> Sustituye los números por los tuyos reales y recalcula a mano (o pídeme que calcule cuando tengas la tabla).

**Material / troquel / tintas:** deja 3 iguales y 1 distinta → la moda debe ser el valor mayoritario.

---

## 4. Checklist de prueba (orden)

### A. Histórico
- [ ] Las 4 OTs cerradas visibles en Producidas
- [ ] Misma referencia Minerva
- [ ] Ninguna excluida de promedios

### B. Botón Maestro
- [ ] Ir a **Maestro de Artículos**
- [ ] Pulsar **«Actualizar promedios»** → confirmar
- [ ] Toast: referencias actualizadas / OTs usadas (esperable ≥ 1 ref, ≥ 4 OTs si solo hay estas)
- [ ] Abrir el artículo → panel **«Promedios desde histórico»**: fecha + «4 OTs» (o n correcto)

### C. Valores en BD / UI
- [ ] Prep / millar coinciden con la mediana (§3)
- [ ] Campos `*_habitual` **sin cambiar**
- [ ] Campos `*_oficial` (si había alguno) **sin cambiar**

### D. Prefill despacho (Paso D)
- [ ] Abrir wizard despacho de una OT **nueva** con esa referencia
- [ ] Dejar vacíos material / poses / horas…
- [ ] **«Usar maestro»**
- [ ] Rellena desde promedio (si no hay oficial)
- [ ] Si cantidad del pedido = Q' → tiraje ≈ `millar × (Q'/1000)`
  - Ej. millar 0,5 y Q' = 8000 → tiraje ≈ **4,0 h**
- [ ] Campos ya rellenados a mano **no** se pisan

### E. Exclusión (opcional, 2 min)
- [ ] En Producidas, marcar 1 OT como excluida de promedios
- [ ] Volver a **Actualizar promedios**
- [ ] `promedios_basados_en_n_ots` = **3** y mediana recalculada sin esa OT

---

## 5. Dónde mirar en código (si algo falla)

| Pieza | Archivo |
|-------|---------|
| Motor | `src/lib/maestro-promedios-calc.ts` |
| Escritura BD | `src/lib/maestro-promedios-update.ts` |
| Prefill | `src/lib/maestro-prefill.ts` |
| Botón Maestro | `articulos-maestro-page.tsx` |
| «Usar maestro» | `despacho-wizard-dialog.tsx` |

Tests unitarios: `npx vitest run src/lib/maestro-promedios-calc.test.ts src/lib/maestro-prefill.test.ts`

---

## 6. Resultado de esta tanda

| Fecha | OT base | Réplicas | ¿OK? | Notas |
|-------|---------|----------|------|-------|
| | | | ☐ | |

---

## Cómo usarlo conmigo

1. Pásame: **OT base + 4 números de réplica + Q + tabla de horas reales** (prep/tiraje por proceso que quieras validar).
2. Te devuelvo la **mediana/moda esperada** lista para contrastar con el Maestro tras pulsar el botón.
