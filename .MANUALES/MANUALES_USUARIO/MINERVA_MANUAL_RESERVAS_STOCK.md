# Minerva Hub — Manual: Reservas de material y corrección de errores

> **Versión 1 — borrador conceptual (18 ago 2026).** Explica el *qué* y el *por qué*.
> Falta añadir capturas de pantalla y pasos exactos cuando esté probado en planta con la OT 98019.
> Fuente técnica completa: `.MANUALES/BLOQUES/MINERVA_BLOQUE9_REASIGNACION_STOP.md` (para Manel / desarrollo).

---

## 1. ¿Por qué existe esto?

A veces se compra o se corta el papel equivocado. Pasa. El problema no es que se equivoque alguien — el problema es que hasta ahora no había una forma clara de decir "esto ya no vale para esta OT" sin liar el stock o perder el rastro de qué se compró.

Este módulo resuelve eso. Y tiene un objetivo más grande que corregir un error puntual:

> **Que cuando alguien pregunte "¿qué material tenemos de verdad?", la pantalla diga la verdad** — sin tener que ir al pasillo a comprobarlo con tus propios ojos.

---

## 2. Tres ideas que hay que tener claras

**1. La pantalla manda, no lo que "se supone" que hay.**
Si algo no está marcado en el sistema, para Minerva no existe — aunque esté físicamente en el pasillo. Por eso es tan importante marcar las cosas cuando pasan (liberar, usar, mover), aunque parezca burocracia de más.

**2. Nunca se borra un error, se corrige y se sigue.**
Si compramos algo mal, esa compra **no desaparece** — queda visible, marcada como no válida, y se genera una compra nueva. Así, si dentro de un mes alguien pregunta "¿por qué compramos esto dos veces?", la respuesta está en la pantalla, no en la memoria de nadie.

**3. Avisa, no bloquea.**
Cuando el sistema detecta que algo no cuadra (por ejemplo, el papel es más pequeño que lo que el troquel necesita), **avisa** con un mensaje — no impide seguir. La decisión final la toma una persona, no el sistema.

---

## 3. ¿Quién hace qué?

| Persona | Qué puede hacer |
|---|---|
| **Ramón / Oficina técnica / Gerencia** | Decide si un error se corrige comprando de nuevo o usando stock que ya hay. Es quien "libera" un material mal asignado. |
| **Juan (almacén)** | Una vez oficina ha decidido "usa este otro palet que ya tenemos", Juan es quien lo asigna físicamente a la OT. Esto lo hace igual que hoy — no cambia nada para él salvo que ahora también puede recibir avisos de "este palet viene de un error, formato tal". |
| **Emma** | Ve en Compras y en OTs Despachadas el estado real: si hay una compra corregida, la ve junto a la original, no en vez de la original. |
| **Maquinistas (CTP, Guillotina)** | Verán un aviso en pantalla si el material no cuadra con lo que el troquel necesita, antes de trabajar con él. No tienen que hacer nada especial — solo leer el aviso y avisar a oficina si sale. |

---

## 4. Las tres situaciones típicas

### Situación A — Nos damos cuenta antes de cortar nada
Ejemplo: se compró papel de 65×92, pero cuando se va a hacer la plancha en CTP, se ve que el troquel necesita un pliego de 72×102.

**Qué pasa:**
1. Aparece un aviso en pantalla (CTP o Guillotina).
2. Oficina técnica **libera** ese material de la OT — deja de estar reservado para ella.
3. Ese material liberado no desaparece: sigue en el almacén, disponible para cualquier otra OT que sí necesite ese formato.
4. Oficina decide: ¿compramos de nuevo el formato correcto, o hay ya algo en stock que sirve?
5. Se recibe, se cartela, se asigna a la OT.
6. Se avisa si hace falta actualizar el despacho (los cortes previstos).

### Situación B — Ya se ha cortado el material antes de darnos cuenta
Ejemplo: Guillotina ya cortó el papel, y es al ir a imprimir cuando se ve que no vale.

**Qué pasa:** parecido a la Situación A, pero con un paso extra — hay que "deshacer" el consumo que ya se había registrado antes de poder liberar el material, porque ese papel ya no es el pliego original, es un formato más pequeño (el que resultó del corte). Ese material cortado no se pierde de vista: queda en el sistema con su medida real, así si otra OT necesita exactamente ese tamaño, puede usarlo.

### Situación C — Ya tenemos algo en stock que nos vale
Ejemplo: tenemos un palet de 75×105 comprado "para lo que haga falta", sin ser de ninguna OT en concreto, y resulta que nos sirve para la OT que se ha equivocado de formato.

**Qué pasa:** oficina asigna ese material directamente a la OT (o le dice a Juan que lo haga), y se actualiza el despacho con las instrucciones de corte correctas para Miguel (ej. "antes cortabas por la mitad, ahora corta y refila a tal medida").

---

## 5. Lo que NO cambia

- El día a día de Juan en el muelle (recepcionar, cartelar) sigue igual.
- Comprar material normal, sin errores, sigue exactamente igual que hoy.
- Esto **no** sustituye ni afecta a Optimus mientras siga corriendo en paralelo.

---

## 6. Pendiente de añadir (cuando esté probado en planta)

- [ ] Capturas de pantalla de cada paso
- [ ] Nombres exactos de los botones tal como quedaron en la app
- [ ] Ejemplo real con la OT de prueba (98019) documentado paso a paso
- [ ] Preguntas frecuentes recogidas tras el primer uso real en planta
