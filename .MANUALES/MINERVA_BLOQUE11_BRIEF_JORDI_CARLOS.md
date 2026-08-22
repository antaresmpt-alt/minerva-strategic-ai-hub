# Bloque 11 — Brief para Jordi y Carlos

> **Fecha:** 22 ago 2026 · **Para:** conversación planta (Jordi / Carlos) · **Duración:** ~10 min
> **Documentación completa:** `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` · `.MANUALES/MINERVA_BLOQUE11_ANALISIS_CONTENEDOR_VS_MESA.md`

---

## En una frase (modelo destino)

> **Despacho pone la OT en el circuito (como Optimus). El contenedor muestra todo lo que el itinerario deja hacer en cada sección. Carlos, Antonio y Gabri usan el calendario para ordenar el día. En offset (cuello de botella) se mantiene la secuencia fina — turnos y horas — encima del contenedor, no la mesa actual como puerta.**

---

## Nota para quien lleve la reunión (offset)

Si Carlos pregunta *«¿en offset no cambia nada?»* — la respuesta honesta es:

- **Sí cambia** el circuito: Abraham/David verán la OT en el **contenedor** y trabajarán desde ahí (como el resto de secciones), **sin** pasar por Pool ni por «lanzar desde mesa».
- **No pierde** lo que hoy le importa: el **detalle fino del día** (orden 1-2-3, turnos, horas, PDF) sigue existiendo — es la pantalla «Organizar detalle del día», no la mesa antigua como obligatorio previo.
- En resumen: **le añadimos contenedor; no le quitamos la planificación fina.**

---

## Por qué cambiamos de rumbo (sin drama)

Probamos un atajo desde el calendario ("enviar a cola de Mesa" en cada paso). Funciona en pantalla, pero **obliga a alguien sentado en un PC** a pasar por Mesa antes de cada paso — CTP, guillotina, offset, troquel, desbroce, engomado. Antonio y Gabri **no están en un PC**; están en planta. Si el sistema les pide eso, o no lo usan o lo viven más lento que Optimus.

Eso no es un detalle de botones: es la diferencia entre sustituir Optimus o no. Por eso paramos **antes** del TEST, no después.

**Sobre el calendario del TEST:** esto puede mover la fecha del TEST unas semanas. Lo digo con claridad porque es la primera pregunta que haría cualquiera en vuestra situación. Preferimos eso a estrenar en septiembre un modelo que Antonio y Gabri, en la práctica, no van a usar — y volver al papel con la sensación de que Minerva es más lento que Optimus. El trabajo ya hecho no se pierde; el cambio es de arquitectura, no de empezar de cero.

Lo que ya tenéis hecho (calendario, pastillas, ejecución, material) **no se tira**. Cambia **de dónde sale la lista del operario** y **para qué sirve el calendario**.

---

## Cómo funcionaría (3 capas)

| Capa | Pregunta que responde | Quién la mueve |
|------|----------------------|----------------|
| **Calendario** | ¿En qué orden quiero el día? (opcional) | Carlos, Antonio, Gabri, Rita |
| **Itinerario** | ¿Qué se puede hacer ahora? | El sistema (paso anterior hecho) |
| **Contenedor** | ¿Qué ve el operario en su sección? | Automático al despachar |

**Regla clave:** el calendario **ordena**. El itinerario **autoriza**. Si falta imprimir, no se troquela aunque la pastilla diga "hoy".

**Bandeja lateral (próximo paso):** panel «Despachadas / sin planificar» sustituirá las hojas Optimus en la mesa de Carlos — filas compactas, sin botón «enviar a mesa».

**Mesa:** en el modelo nuevo **no ejecuta** en ninguna sección (tampoco offset). Solo «organizar detalle del día» para secuencia fina donde haga falta (hoy offset: turnos/horas/PDF **encima** del contenedor).

---

## Tres preguntas para vosotros

1. **¿Os vale que el calendario sea opcional?** — quien quiera ordena el día con pastillas; quien no, la cola sigue por fecha de entrega. Aplica a CTP igual que a troquel.

2. **En troquelado y engomado, ¿preferís ver solo "hoy" o un listado de varios días?**

3. **¿Hace falta asignar máquina concreta, o basta con ordenar la lista y que el operario coja?**

---

## Qué NO os pedimos que validéis hoy

- Fechas técnicas de implementación (piloto CTP + troquelado, fases internas).
- Detalle de pantallas (filtro "solo lo que se puede hacer ya" vs "ver todo lo que viene"; bandeja lateral).
- El botón "enviar a cola" del calendario: **eliminado** (22 ago); no era el modelo final.

---

## Lo que sí necesitamos oír

¿Este modelo **suena a cómo trabajáis** (lista + calendario para ordenar + offset con secuencia fina)? ¿Algo chirría antes de que lo construyamos?

---

*Preparado por Manel + Cursor, 22 ago 2026.*
