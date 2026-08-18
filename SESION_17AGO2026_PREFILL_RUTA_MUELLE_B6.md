# Sesión 17 ago 2026 — Prefill Ruta · Externos Ramón/Juan · Cartela admin · OT 98016

> **Fuente de esta jornada.** Validado en campo con OT **98016**. Commit + push a `main` al cierre.  
> Sesión anterior: `SESION_14AGO2026_EJECUCION_LISTA.md` (14 ago tarde).

---

## Mensaje clave

Camino a TEST septiembre, validado E2E en **98016** (CTP → Guillotina → Impresión EXTERNA → Plastificado → Troquelado):

1. **Ajustar itinerario** siembra `datos_proceso` (horas) al insertar pasos; redespacho actualiza pendientes.
2. **Ramón envía** brutas + netas deseadas; **Juan recibe** viendo ambas; el siguiente paso encadena **recibidas**.
3. **Cartela admin** en paso cerrado (oficina/admin): corregir consumo sin reabrir.
4. **Bloque 6.x** avisos al cierre + comparar versiones (código mañana; comparar OK en 98009).
5. **Troquelado** rellena hojas a troquelar con la salida real del anterior (no se queda en el plan 2000).

---

## 1. Prefill horas al añadir proceso en Ruta

### Problema

`insertarPasosEnColaViva` insertaba filas en `prod_ot_pasos` **sin** `datos_proceso`. El paso entraba en ejecución sin horas previstas (impresión, troquel, engomado…).

### Solución

- Nuevo módulo `src/lib/prod-ot-itinerario-seed.ts`:
  - Carga cabecera de `produccion_ot_despachadas` + extras desde pasos bloqueados.
  - Reutiliza `buildDatosProcesoSeed` (misma lógica que wizard de despacho).
- `insertarPasosEnColaViva` ( `src/lib/prod-ot-itinerario-client.ts` ):
  - Antes de borrar la cola editable, **preserva** `datos_proceso` por `slot.key` (id del paso).
  - Para pasos **nuevos**, siembra desde despacho.
  - Merge con `mergeDatosProcesoSeed` (no pisa ejecución ya capturada si reaparece el mismo slot).
- Llamadas con `otNumero`: `ajustar-itinerario-dialog.tsx`, `despacho-wizard-dialog.tsx`.

### Prueba sugerida

1. OT despachada con horas en cabecera (p. ej. troquel/engomado en despacho).
2. OTs Despachadas → **Ruta** → añadir un proceso pendiente (troquel, engomado…).
3. Ejecución / Hoja de ruta → comprobar `horas_*_previsto` en el paso nuevo.

---

## 2. Muelle externos — enviadas vs recibidas

### Regla de negocio (acordada 17 ago)

| Quién | Qué | Rol |
|-------|-----|-----|
| Ramón (Externos) | **Enviadas** (ej. 1600 h) | Referencia / trazabilidad |
| Juan (Muelle) | **Recibidas** (ej. 1300 h) | **Dato real** del proceso externo |
| Siguiente paso | Prefill / semáforo | Solo **recibidas**, no enviadas ni teóricas |

Papel/cartelas en muelle: **sin cambios**. Sin flujo rígido de parciales: Juan apunta lo que llega, albarán/foto/notas opcionales.

### Implementación

`src/components/produccion/muelle/muelle-recepcion-page.tsx`:

- Carga `ot_paso_id`, `hojas_enviadas`, `hojas_recibidas_muelle`.
- UI: bloque **Enviadas (producción)** + **Pedidas/esperadas**; campo **Hojas recibidas (dato real)**.
- Tarjeta lista: badge `Env. N h` si hay enviadas.
- Al finalizar/parcial: `persistExternoRecepcionMuelle`:
  - UPDATE `prod_seguimiento_externos`: `hojas_recibidas_muelle`, `unidades_recibidas_muelle`, `fecha_recepcion_muelle`.
  - `mergeDatosProcesoExternoPaso` → `prod_ot_pasos.datos_proceso` (`hojas_recibidas_muelle`, `numero_hojas`).

Encadenado: `hoja-ruta-salida-encadenado.ts` / `outputField: hojas_recibidas_muelle` en externos.

### Prueba sugerida

1. OT con paso externo (impresión externa 21 o acabado hojas): Ramón marca **Enviado** con hojas (ej. 98015 / 1600).
2. Muelle → Externos → recepcionar **1300** h.
3. Troquel / impresión siguiente: prefill ≈ 1300, no 1600.

---

## 3. Bloque 6.x — avisos calidad al cierre

### Qué hace

En **Cerrar y enviar a histórico** (`CierreOtDialog`), bloque rojo **informativo** (no bloquea):

- Material vacío / gramaje 0
- Producida ≫ pedida (>15 %) o ≪ pedida (<50 %)
- Incidencias en pasos

Archivos: `src/lib/prod-ot-cierre-avisos.ts`, wiring en `hoja-ruta-ot-dialog.tsx` + `cierre-ot-dialog.tsx`.  
Tests: `src/lib/prod-ot-cierre-avisos.test.ts` (vitest).

### Prueba sugerida

OT en «Listo para cerrar» con datos coherentes → sin avisos rojos. OT tipo 99906 (sobreproducción) → aviso visible; cierre sigue permitido.

---

## 4. Bloque 6.x — comparar versiones OT

### Qué hace

En **Producidas / Histórico**, si la misma OT tiene **≥2 versiones** archivadas, botón **v.** abre diff de columnas planas (pedida/producida, material, horas, merma, obs. revisión…).

Archivos:

- `src/lib/prod-ot-producidas-versiones.ts`
- `src/components/produccion/producidas/producida-versiones-compare-dialog.tsx`
- `producidas-page.tsx`

### Prueba sugerida

OT reabierta y cerrada de nuevo → dos filas v1/v2 → comparar.

---

## 5. Aparcado (no tocado hoy)

- **Digital / PDF**: OK v1 para primera tanda TEST; reevaluar con Rita + Patricia/Paula en uso diario.
- Guillotina: flujo de cierre + **corregir cartela** sí se tocó (98016). Pulido de UI de Guillotina sigue aparcado.
- Bloques 11, 12, 5 puente Rita→Hugo: sin cambios.

---

## 6. Archivos tocados

Ver git commit de esta sesión. Áreas: itinerario seed, muelle, cierre B6, producidas, cartela admin, externos envío brutas/netas, troquel prefill.

Verificación local: `tsc --noEmit` OK · vitest `externos-envio-brief.test.ts` + `prod-ot-cierre-avisos.test.ts` OK.

---

## 8. Tarde 17 ago — validación OT 98016

### Itinerario / Ruta
- Quitar/insertar Troquelado + Guardar: OK (tras fix delete→insert: bump de orden, seed SELECT sin columnas inexistentes).
- Redespacho troquel TAM00520 + horas 1+1: merge `datos_proceso` en **todos** los pendientes, no solo si cambia la cola.
- Caja MN1L + 400 estuches: OK al re-guardar lápiz. PDF hoja de ruta OK.

### Cartela Guillotina (olvidada al cerrar)
- Palet **99018** 1000 h asignadas; Guillotina cerró sin consumo.
- **Corregir cartela** (oficina/admin/gerencia) desde hoja de ruta o OTs en ejecución (filtro Terminadas): ID Stock + hojas → RPC consumo, paso sigue `finalizado`.
- **Editar paso** (oficina/admin/gerencia) sin reabrir. **Reabrir paso** solo admin/gerencia si el siguiente no está en marcha/finalizado.
- Mesa diaria/semanal: sin botones admin (a propósito).
- Al cerrar: si la OT tiene cartela(s), aviso fuerte + auto-select si hay una sola; confirmar bloqueado sin ID+hojas.
- 98016: consumo 99018 1000 h validado; botón Corregir desaparece.

### Externos Ramón → Muelle Juan
- Imprimir fuera Offset → proceso 21; cola Externos.
- Modal Enviado: **brutas** (salida Guillotina 2000, no el 200 del plan) + **netas a recibir** (default = brutas; Ramón bajó a 1800).
- No sembrar `hojas_enviadas` del despacho al crear seguimiento (pisaba lo real).
- Muelle: tarjeta `Env. N h` + `Netas N h`; modal **Enviadas** + **Netas deseadas**. Aviso ámbar solo si recibidas < netas.
- 98016 impresión: envío 2000/1800, Juan 1850 (dentro de merma). Plastificado: 1850/1800, Juan 1800.

### Troquelado
- Encadenado veía 1800 (aviso sobreproducción) pero **hojas a troquelar** se quedaba en plan 2000.
- Fix: igual que Desbroce — si hay salida real del anterior, pisa el campo de trabajo y guarda el plan en `hojas_troquelar_plan`.

### Pendiente (hablar otro día)
- ~~Desasignar/reasignar cartela~~ → spec **9.8** 18 ago: `MINERVA_BLOQUE9_REASIGNACION_STOP.md` (OT **98019**).
- Cabecera despacho 98016 (netas 200 del plan) — no bloquea el flujo; Ramón ya no depende de eso al enviar.

---

## 9. Retomar

- [x] Prueba de campo 98016 (Ruta, cartela, Imprimir fuera, Ramón, Juan, plastificado, troquel).
- [x] Commit + push a `main`.
- [x] Cartelas desasignar/reasignar: spec 9.8 (18 ago) — `MINERVA_BLOQUE9_REASIGNACION_STOP.md`.
- [ ] Siguiente foco: **9.8.1 + 9.8.1b** (no Bloque 11 hasta cerrar STOP).
