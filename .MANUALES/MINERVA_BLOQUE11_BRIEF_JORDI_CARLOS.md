# Bloque 11 — Brief para Jordi y Carlos

> **Versión:** **v2 — 27 ago 2026 noche**  
> **Leer antes del domingo** previo a demo lunes (merge `main` domingo noche)  
> **Para:** Jordi / Carlos (+ Ramón / Juan si cartelas) · **Duración:** ~15 min  
> **Documentación:** `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` §27 · `SESION_27AGO2026_BLOQUE11_DIA_COMPLETO.md`

---

## En una frase (modelo destino)

> **Despacho pone la OT en el circuito (como Optimus). El contenedor muestra todo lo que el itinerario deja hacer en cada sección. Carlos, Antonio y Gabri usan el calendario para ordenar el día. En offset (cuello de botella) se mantiene la secuencia fina — turnos y horas — encima del contenedor, no la mesa actual como puerta.**

---

## Qué hay nuevo desde el brief v1 (22 ago)

Si solo leíste la versión del 22 ago, esto es lo que **ya está en piloto** y veréis en la demo del lunes:

### 1. Atrasadas (calendario)

- Botón discreto **«Atrasadas (N)»** en la barra de filtros (solo si hay OTs vencidas).
- Abre un **modal** con el listado: OTs con fecha **anterior a hoy**, no hechas, **no se mueven solas**.
- Carlos debe mover la pastilla o marcar hecha — el sistema no auto-replanifica.

### 2. Pip de material (pastillas calendario)

- Punto de color en la esquina del badge I/D/T/E (patrón tipo Linear/GitHub).
- **No ocupa texto** — el tooltip en la letra muestra estado de compra/cartelado.
- Colores = mismo criterio que Pool (gris sin despacho, rojo/ámbar/verde según cartelas/muelle).
- OT prueba (≥ 98.000): pip amarillo; no cuenta en ATP de planta.

### 3. Valla LEGACY (Planificación OTs)

- Pestañas **Mesa diaria** y **Mesa semanal** solo visibles para **admin / gerencia** (badge **LEGACY**).
- Resto del equipo: **Pool de OTs** + **OTs en ejecución** + calendario — camino feliz sin mesa antigua.
- No es «apagado» del sistema viejo: es transición controlada mientras planta usa calendario + contenedor.

### 4. Otros (contexto demo)

- **Detalle del día** + PDF con **cartelas** (palet, material, formato, hojas carteladas).
- **Hoy planificado** en ejecución: orden del detalle; **mañana antes que tarde** en la lista.
- **Guillotina:** chip en ejecución I/D; en calendario solo tooltip. **Gate:** sin Guillotina cerrada, la OT no sale en Impresión.
- **Print:** PDF/imprimir en ventana nueva (no cierra Minerva al cancelar impresión).

**Validación clave (27 ago):** OT **98024** — Guillotina → Impresión → al cerrar I pastilla gris «Hecha» → Troquelado verde para la misma OT. Prueba de **itinerario autoriza, calendario ordena**.

---

## ⚠️ Cambio de comportamiento — cartelas (Ramón / Juan)

**Desde 27 ago**, al **cartelar un palet con una sola OT** en el wizard:

| Antes (habitual) | Ahora (default automático) |
|------------------|----------------------------|
| Reserva blanda o vacía → badge **«disponible»** aunque la OT esté enlazada | Reserva **dura** = todas las hojas del palet → badge **«reservado»** |

**Por qué lo hicimos:** si el palet se cartela para una OT, el ATP y el badge deben reflejar que ese material **ya está comprometido** — la reserva blanda dejaba «disponible» y otra OT podía intentar consumirlo.

**Qué puede sorprender:** Ramón o Juan intentan asignar ese palet a **otra OT** y encuentran el material **bloqueado** sin haber marcado reserva a mano.

**Varias OTs en el mismo palet:** sin cambio — reparto manual de reservas (como antes).

---

## Pregunta abierta — necesitamos respuesta vuestra (no técnica)

**Al cartelar con 1 sola OT, ¿queréis que el sistema reserve el palet en duro automáticamente (como está hoy), o preferís que quede «disponible» hasta que alguien marque la reserva explícitamente?**

| Si respondéis… | Consecuencia en planta |
|----------------|------------------------|
| **A) Mantener dura automática (hoy)** | El estado **no miente**: reservado = otra OT no puede tocarlo. Menos flexibilidad accidental. Hay que **liberar/reasignar** (Bloque 9.8) para mover material. |
| **B) Volver a blando por defecto** | Más flexibilidad al cartelar; el operario marca duro cuando quiera. Riesgo: badge «disponible» con OT ya enlazada; posible consumo cruzado si nadie revisa. |

**No es retórica:** si el lunes Ramón cartela y luego Juan no puede mover el palet, o si esperaban flexibilidad y ahora no la tienen, es esta decisión. Decidid **A o B** (o «A pero avisar siempre a almacén») y lo dejamos fijado antes del merge.

---

## Nota offset (si Carlos pregunta)

- **Sí cambia** el circuito: contenedor + detalle del día (no Pool/mesa como puerta).
- **No pierde** secuencia fina: orden 1-2-3, M/T, horas, PDF con cartelas.

---

## Por qué cambiamos de rumbo (resumen v1)

El atajo «enviar a cola de Mesa» obligaba a un PC antes de cada paso — Antonio y Gabri en planta no lo usarían. El botón **eliminado** (22 ago). El calendario y la ejecución **no se tiran**; cambia de dónde sale la lista del operario.

---

## Cómo funcionaría (3 capas)

| Capa | Pregunta | Quién |
|------|----------|-------|
| **Calendario** | ¿En qué orden el día? | Carlos, Antonio, Gabri, Rita |
| **Itinerario** | ¿Qué se puede hacer ahora? | Sistema |
| **Contenedor** | ¿Qué ve el operario? | Automático al despachar |

**Regla:** calendario **ordena**; itinerario **autoriza**.

---

## Preguntas para vosotros

1. ¿Calendario opcional os vale? (quien quiere ordena; quien no, cola por fecha entrega)
2. Troquelado/engomado: ¿solo «hoy» o varios días?
3. ¿Máquina concreta o basta orden en lista?
4. **Reserva dura con 1 OT:** **A o B** (tabla arriba) — **respuesta explícita pedida**

---

## Qué NO validar en la reunión

Fechas de merge, DnD en detalle-día, semáforos M/T en PDF (backlog).

---

## Lo que necesitamos oír

¿El modelo suena a cómo trabajáis? ¿Algo chirría? **Y la respuesta A/B sobre reserva dura.**

---

## Checklist antes del lunes

- [ ] Jordi y Carlos han leído **esta v2** (no solo brief 22 ago)
- [ ] Ramón / Juan informados del cambio reserva dura
- [ ] Respuesta **A o B** anotada en reunión o por email

---

*v1 22 ago 2026 · **v2 27 ago 2026** — Manel + Cursor*
