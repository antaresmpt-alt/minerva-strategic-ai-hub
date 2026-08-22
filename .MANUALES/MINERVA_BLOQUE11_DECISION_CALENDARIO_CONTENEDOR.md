# Bloque 11 — Calendario, bandeja, contenedor y mesa (decisión de diseño)

> **Fecha:** 21 ago 2026 · **Rev. completa:** **22 ago 2026 tarde** (brainstorming Manel + Claude Opus + Cursor)
> **Estado:** diseño **cerrado** para implementación · validación planta pendiente (Jordi / Carlos)
> **Complementa:** `MINERVA_BLOQUE11_CALENDARIO_MAESTRO_LANZAMIENTO.md` · `.MANUALES/MINERVA_BLOQUE11_ANALISIS_CONTENEDOR_VS_MESA.md` · `.MANUALES/MINERVA_BLOQUE11_BRIEF_JORDI_CARLOS.md`
> **Código 22 ago tarde:** botón «Enviar a cola de Mesa» **retirado** del calendario (`calendario-produccion-page.tsx`). Motor contenedor: **pendiente**.

---

## 0. Veredicto ejecutivo

| Tema | Decisión |
|------|----------|
| **Sustituir Optimus** | Despacho ≈ launch; operario tira del **contenedor** (pull) |
| **Calendario I/D/T/E** | **Planning visual** del responsable — Carlos ya lo usa como mesa real |
| **Bandeja izquierda** | **Computada** (sin filas auto en BD al despachar); sustituye hojas Optimus / Excel |
| **Contenedor** | Lista por sección desde pasos `disponible`; **desacoplar** de `prod_mesa_ejecuciones` |
| **Mesa (repensada)** | **No ejecuta.** «Organizar detalle del día» — archivos **nuevos**; LEGACY intacto |
| **PR1 «Enviar a cola»** | **Retirado del calendario** (22 ago). Rama/lib aparcados para LEGACY |
| **Retener OT** | Excepción válida (diseño); **no construir** hasta que lo pidan |
| **Piloto contenedor** | CTP + Troquelado |
| **Piloto planning** | Bandeja + calendario con **Carlos**; detalle del día cuando quite Excel |

**Frase enseñable (Jordi/Carlos):**

> Despacho pone la OT en el circuito (como Optimus). El contenedor muestra todo lo que el itinerario deja hacer en cada sección. Carlos, Antonio y Gabri usan el calendario solo para ordenar el día de su gente. Mesa queda solo donde el cuello de botella lo exija (hoy: offset).

---

## 1. Evidencia de campo (no hipótesis)

Observaciones **22 ago 2026**:

- Carlos lleva **semanas** con el calendario Minerva en la **segunda pantalla**.
- Gemma (CTP) usa **listado/PDF del calendario** impreso como guía.
- Carlos planifica en Minerva y **copia a Excel** el listado del día → faena doble que bandeja + detalle del día deben eliminar.

**Implicación:** la pregunta ya no es «¿adoptarán el calendario?». Es «¿cómo quitamos Excel, Pool y mesa como puertas obligatorias?».

---

## 2. Mapa conceptual

```mermaid
flowchart TB
  subgraph despacho [Despacho]
    D[OT despachada]
  end
  subgraph plan [Planificación]
    B[Bandeja computada - filas compactas]
    C[Calendario I/D/T/E - pastillas en días]
    MD[Organizar detalle del día - opcional]
  end
  subgraph exec [Ejecución]
    K[Contenedor por sección]
    E[Modal / pantalla de trabajo]
  end
  subgraph legacy [LEGACY - admin/gerencia]
    P[Pool + Mesa clásica]
  end
  D --> K
  D --> B
  B -->|Colocar en calendario| C
  C --> MD
  C -.->|ordena| K
  K --> E
  P -.->|transición| K
```

> **§11:** este diagrama es **mapa conceptual**, no plan de trabajo secuencial.

---

## 3. Tres capas + regla de oro

| Capa | Pregunta | Fuente de verdad | Quién mueve |
|------|----------|------------------|-------------|
| **Calendario** | ¿Cuándo **quiero** que se haga? ¿Orden del día? | `prod_calendario_produccion_ot` | Carlos, Rita, Antonio, Gabri |
| **Itinerario** | ¿Qué **se puede** hacer ahora? | `prod_ot_pasos.estado` | Sistema (trigger) |
| **Contenedor** | ¿Qué ve y hace el operario? | Hoy: `prod_mesa_ejecuciones` → **destino:** pasos `disponible` | Operario |

> **El calendario ORDENA. El itinerario AUTORIZA.**

### Dos ejes independientes (Bloque 9)

| Eje | Fuente | Pregunta |
|-----|--------|----------|
| **Disponible** | `prod_ot_pasos.estado` | ¿Paso anterior hecho? |
| **Ejecutable** | Consulta viva compra/stock/cartela | ¿Hay material? |

**No** almacenar `esperando_material` en BD. UI: por defecto **solo ejecutable**; toggle «ver todo».

---

## 4. Dos tipos de proceso

### 4.1 Calendario — ámbitos I / D / T / E

| Ámbito | Responsable | Rol |
|--------|-------------|-----|
| **I** Impresión offset | Carlos (+ Jordi) | Planning principal |
| **D** Digital | Rita | Igual en su ámbito |
| **T** Troquelado | Antonio | Orden del día + previsión |
| **E** Engomado | Gabri | Orden del día + previsión |

Una OT puede tener **pastillas en varios ámbitos y fechas** (estela: I hecha día 5, T planificada día 8, E día 10). **No** auto-mover al día siguiente; queda **vencida visible**; el responsable mueve manualmente.

### 4.2 Contenedor puro — sin calendario propio

| Proceso | Notas |
|---------|--------|
| **CTP** | Orden heredado de I de Carlos o fallback entrega |
| **Guillotina** | Contenedor; Miguel tira de lista |
| **Desbroce** | Área engomado; Gabri ordena vía E / contenedor |
| **Manipulados internos** | Contenedor |
| **Externos (Ramón)** | Módulo actual; pastilla refleja «externo» mientras dure |

---

## 5. Bandeja computada (panel izquierdo)

Sustituye **hojas HR de Optimus** en la mesa de Carlos.

| Aspecto | Decisión |
|---------|----------|
| **UI** | Filas compactas (1 por OT); pastillas solo en calendario con día |
| **Toggle** | «Ocultar panel» / «Mostrar panel» (patrón IDE/Edge) |
| **Interacción** | **Sin drag** desde bandeja. «Colocar en calendario…» o flujo actual |
| **Datos** | **Query computada** — no auto-insert al despachar (`fecha` obligatoria en BD) |
| **Al colocar** | Desaparece de bandeja (para ese ámbito) |

### Filtro por defecto — cadena de **visualización**

⚠️ **No** confundir con cadena de **autorización** (§3). Solo ordena qué se ve primero. Toggle «ver todas».

| Responsable | Bandeja por defecto |
|-------------|---------------------|
| **Carlos (I)** | Despachadas con impresión, **sin pastilla I** |
| **Rita (D)** | Análogo digital |
| **Antonio (T)** | Con troquel sin pastilla T, **I colocada o hecha** |
| **Gabri (E)** | Con engomado sin pastilla E, **T colocada o hecha** |

**Overlay calendarios** (tipo Outlook): Antonio/Gabri ven I de Carlos mientras planifican T/E.

---

## 6. «Organizar detalle del día» (mesa repensada)

### 6.1 Qué muere en el camino feliz

- Mesa como **puerta** a ejecución (`launchExecution`).
- Mesa **semanal** (calendario la sustituye).
- Pool como paso obligatorio.

### 6.2 Qué es la pantalla nueva

Flujo desde calendario (día X + ámbito) → botón **«Organizar detalle del día»**:

```
┌─────────────────────────────────────────────────────┐
│ Izquierda: OTs de ESE día (del calendario)          │
│ Derecha: columnas máquina × turno (drag, horas)     │
│ Navegar día ±1 · sábado · PDF · cálculo horas       │
│ NO lanza ejecución                                  │
└─────────────────────────────────────────────────────┘
         ↓
Contenedor refleja orden (operario)
```

**Composición del día (v1):** añadir/quitar/mover OTs entre días = **calendario**. Detalle = **solo orden fino** por máquina/turno. Atajos desde detalle = fase posterior si lo piden.

**Piloto:** solo **Carlos** (offset, 1 máquina → orden 1-2-3). Si quita Excel, extender a Antonio/Gabri.

### 6.3 LEGACY vs archivos nuevos

| LEGACY (sin tocar, tab admin/gerencia) | Nuevo (implementar) |
|----------------------------------------|---------------------|
| `planificacion-pool-ots-tab-v2.tsx` | Bandeja en calendario |
| `planificacion-mesa-diaria-tab.tsx` | `planificacion-detalle-dia-tab.tsx` (nombre orientativo) |
| `planificacion-mesa-secuenciacion-tab.tsx` | No replicar semanal |
| `planificacion-pasar-a-mesa.ts` | Solo LEGACY |

**Reutilizar libs:** `planificacion-mesa-diaria.ts`, `types/planificacion-mesa.ts`, lógica horas/turnos/sábado/PDF donde aplique.

**Diferencias clave vs mesa actual:**

| Mesa LEGACY | Detalle del día |
|-------------|-----------------|
| OTs desde Pool (`enviada_mesa`) | OTs desde **calendario del día** |
| `launchExecution` obligatorio | **No ejecuta** |
| Semanal + diaria | Solo **día** (+ navegar ±1) |

Persistencia del orden por máquina: decidir en spike (reutilizar `prod_mesa_planificacion_trabajos` con otro origen vs tabla ligera).

### 6.4 Offset (cuello de botella)

Secuencia fina con turnos/horas vía detalle del día o evolución mesa **sin** ser puerta de ejecución. Criterio: **Drum-Buffer-Rope**.

---

## 7. Contenedor y ejecución

### Trabajo de verdad (motor)

| ✅ Ya funciona | ❌ Falta |
|---------------|---------|
| Primer paso `disponible` al despachar | Lista operario **sin** mesa obligatoria |
| Trigger avanza itinerario | Claim = **iniciar** |
| `ExecutionCard`, cartelas, gates 9 | Gate material por **proceso** |

### UI ejecución

- Lista fina; **modal grande** o pantalla completa al abrir OT.
- **Orden arreglos:** filtro + orden **antes** que modal.

---

## 8. PR1 — retirada del calendario

| Pieza | Estado |
|-------|--------|
| Label paso, espejo lectura, semáforos, PDF | ✅ Mantener |
| Botón «Enviar a cola de Mesa» | ❌ **Retirado** (22 ago tarde) |
| `planificacion-pasar-a-mesa.ts` | LEGACY / rama feature |
| Rama `feature/bloque11-calendario-enviar-cola-mesa` | Sin merge como arquitectura |

---

## 9. Retener (futuro)

Toggle «Retener / no lanzar aún»: OT despachada excluida del contenedor hasta liberación. **No construir** hasta demanda.

---

## 10. LEGACY

Pestaña **Planificación clásica (Pool / Mesa)** — solo **admin / gerencia** durante transición.

---

## 11. Orden conceptual ≠ orden de construcción

El diagrama §2 **no** implica terminar contenedor antes de bandeja.

| Track A — Motor | Track B — Planning UI |
|-----------------|----------------------|
| Contenedor + ejecución sin mesa | Bandeja + toggle panel |
| Claim al iniciar | Overlay calendarios |
| Filtro ejecutable | Detalle del día (Carlos) |
| Piloto CTP + Troquel | Quitar Excel |

La bandeja **no depende** del contenedor; solo de despacho + itinerario (operativos).

---

## 12. Fases

| Fase | Entregable |
|------|------------|
| **0** | Validar brief Jordi/Carlos |
| **1a** | Contenedor + modal ejecución (CTP + T) |
| **1b** | Bandeja computada + ocultar panel (Carlos) |
| **2** | Filtros cadena bandeja + overlay |
| **3** | Detalle del día — Carlos |
| **4** | Offset secuencia fina |
| **5** | LEGACY tab |

---

## 13. Decisiones cerradas

| # | Decisión |
|---|----------|
| 13.1 | Calendario ordena; itinerario autoriza |
| 13.2 | Bandeja **computada** |
| 13.3 | Filtro cadena = **visualización** |
| 13.4 | CTP/guillotina/desbroce/manipulados = contenedor |
| 13.5 | Solo I/D/T/E en calendario |
| 13.6 | Mesa nueva **no ejecuta**; archivos nuevos; LEGACY intacto |
| 13.7 | Composición día v1 = calendario; detalle = orden fino |
| 13.8 | Claim = iniciar |
| 13.9 | No auto-mover vencidas |
| 13.10 | PR1 botón fuera calendario |
| 13.11 | Retener = diseño, no build |
| 13.12 | Gate por proceso = pendiente |

---

## 14. Checklist

- [x] Documentar modelo completo
- [x] Retirar botón «Enviar a cola» del calendario
- [ ] Validar brief Jordi/Carlos
- [ ] Spike bandeja computada
- [ ] Spike contenedor `prod_ot_pasos`
- [ ] Spike persistencia detalle del día
- [ ] Ejecución modal
- [ ] Detalle del día (Carlos)
- [ ] LEGACY tab

---

## 15. Referencias código

| Pieza | Archivo | Notas |
|-------|---------|-------|
| Itinerario | `prod-ot-itinerario-client.ts` | Paso 1 disponible |
| Calendario | `calendario-produccion-page.tsx` | Sin botón cola |
| Espejo | `calendario-mesa-espejo.ts` | Lectura |
| Pasar a mesa | `planificacion-pasar-a-mesa.ts` | LEGACY |
| Mesa diaria LEGACY | `planificacion-mesa-diaria-tab.tsx` | No modificar camino feliz |
| Detalle día (futuro) | `planificacion-detalle-dia-tab.tsx` | Por crear |
| Helpers mesa | `planificacion-mesa-diaria.ts` | Reutilizar |
| Ejecución | `planificacion-ots-ejecucion-tab.tsx` | Contenedor + modal |

---

## 16. Resumen una página

1. Carlos **ya usa** el calendario — reforzarlo.
2. **Bandeja computada** quita hojas Optimus y Excel (con detalle del día).
3. **Contenedor** sustituye Pool/Mesa como puerta.
4. **CTP/guillotina/desbroce/manipulados** = contenedor; **I/D/T/E** = calendario.
5. **Detalle del día** = mesa nueva en **archivos nuevos**, no ejecuta; LEGACY vive en `.tsx` actuales.
6. **Construcción en paralelo:** motor + UI planning.
7. **PR1 botón eliminado** del calendario.

---

*Manel + Claude Opus + Cursor · 21–22 ago 2026*
