# Bloque 11 — Análisis: modelo contenedor vs. mesa por paso

> **Fecha:** 22 ago 2026 (rev. tarde: matiz calendario opcional, claim al iniciar, piloto CTP+Troquel)
> **Contexto:** tras el PR1 (rama `feature/bloque11-calendario-enviar-cola-mesa`) y la revisión del 21 ago noche.
> **Propósito:** validar el cambio de modelo mental contra práctica establecida en MES/ERP, con vistas a la compra de Odoo.
> **Veredicto:** el modelo nuevo es correcto. El PR1 queda como puente, no como arquitectura.
> **Complementa:** `.MANUALES/MINERVA_BLOQUE11_DECISION_CALENDARIO_CONTENEDOR.md` (**doc maestro de diseño 22 ago tarde**)

---

## 1. Qué pasó y por qué importa

El PR1 acorta el camino Pool → cola de Mesa desde el calendario. Funciona. Pero al probarlo con la OT 36163 apareció el problema real, que no es de UI:

> Cada paso del itinerario exige que **alguien se siente en un PC**, coloque la OT en Mesa y la lance. En una OT normal (CTP → guillotina → offset → troquel → desbroce → engomado) eso son **seis ciclos** de intervención humana de planificación.

Antonio (4 troqueladoras) y Gabri (engomado, desbroce, manipulados) **no están sentados en un PC**. Están en planta. Obligarles a ese circuito significa una de dos cosas:

1. No lo usan → el sistema se queda vacío y vuelven al papel.
2. Lo usan a regañadientes → Minerva se percibe **más lenta que Optimus**, que es exactamente el argumento que mataría el proyecto.

Esto no es un detalle de usabilidad. Es la diferencia entre sustituir Optimus o no.

---

## 2. Lo que se ha reinventado tiene nombre (y décadas de práctica)

El modelo al que se llegó por intuición —contenedor con lo disponible, calendario que solo ordena, itinerario que autoriza— es la combinación de tres conceptos estándar en fabricación:

| Concepto | Nombre en la industria | Qué dice |
|----------|------------------------|----------|
| Contenedor por sección | **Dispatch list** (MRP II, años 80) | Cada centro de trabajo tiene su lista de operaciones disponibles, ordenada por prioridad. No se "empuja" trabajo a la estación. |
| El trabajo aparece solo cuando se puede hacer | **Pull system** (Lean / TPS) | La estación tira del trabajo cuando tiene capacidad, en lugar de que un planificador lo empuje. |
| Mesa fina solo en offset | **Drum-Buffer-Rope** (Teoría de Restricciones) | Se planifica en detalle **solo el cuello de botella**; el resto sigue el ritmo sin planificación fina. |

**Implicación práctica del tercer punto:** el criterio para decidir qué sección lleva mesa no es "cuántas máquinas tiene" sino **"¿es el cuello de botella?"**. Hoy es la offset (una máquina, 12h/día, todo pasa por ahí). Si mañana el cuello se mueve al troquelado, ahí es donde tocaría mesa fina — no antes.

---

## 3. Comparativa con Odoo (relevante: se va a comprar)

Verificado en documentación oficial de Odoo (versiones 17–19, agosto 2026).

| Pieza del modelo Minerva | Equivalente en Odoo Shop Floor |
|--------------------------|-------------------------------|
| **Contenedor por sección** | Vista por centro de trabajo. Cada work center tiene su pantalla con sus work orders. |
| **Paso `disponible`** | Estado `Ready` de la work order (dependencias cumplidas). |
| **Disponible pero no ejecutable** | MO confirmada pero sin componentes → se ve quitando el filtro "Ready to Start". Dos ejes independientes: estado de la operación y disponibilidad de material. |
| **Claim (que dos no cojan la misma)** | Panel de operario: el empleado ficha, pulsa la orden, su avatar queda visible sobre ella. |
| **Itinerario como candado** | Work Order Dependencies ("Blocked By"). |
| **Calendario que ordena** | Scheduled Date + icono de estrella para priorizar. |
| **"Enviar a mesa" por paso** | **NO EXISTE.** No hay tal paso en Odoo. |

**La última fila es la conclusión del documento.** El ERP de referencia que se va a comprar no tiene el circuito que se estaba construyendo. No porque se les olvidara: porque no funciona en planta.

### Consecuencia estratégica

Si Minerva adopta el modelo contenedor, Minerva y Odoo hablarán el mismo idioma conceptual. Eso importa para:
- La migración futura de piezas entre sistemas.
- La formación: quien entienda uno entiende el otro.
- No pelearse con el modelo de Odoo cuando llegue.

### Aviso de licencia (verificar antes de comprar)

Shop Floor es un módulo de **Odoo Enterprise**, no está en Community. Si la compra contempla usar la vista de planta de Odoo en algún momento, hay que confirmar la edición.

---

## 4. Otras referencias (para no depender de un solo ejemplo)

**SAP PP:** separa explícitamente *programar* (fechas, capacidad) de **liberar** (`Release`, transacción CO02). Una orden liberada aparece en las listas de los centros de trabajo; nadie la "envía" máquina por máquina. La planificación de capacidad finita (CM01/CM21) es una herramienta **opcional** que se usa en los recursos críticos, no en todos.

**Sistemas MES en general:** el patrón dominante en planta es *pull* con lista por estación. El *push* (asignar trabajo concreto a operario concreto) se reserva para entornos con secuencia crítica o certificaciones por persona.

---

## 5. Las dos correcciones que sí haría al modelo nuevo

El modelo es correcto en lo esencial. Dos puntos concretos donde iría por otro camino:

### 5.1 No construir la cadena de calendarios (I → T → …)

La idea de *"para ordenar CTP miro el calendario I; si esa OT no tiene I, miro T"* es frágil:
- Rompe en cuanto una OT no encaja en la cadena prevista.
- Nadie va a poder explicar por qué una OT aparece donde aparece.
- Es imposible de depurar cuando falle.

**Práctica estándar:** la dispatch list tiene un **orden por defecto propio** (fecha de entrega, normalmente), y el calendario es un **override** para las que alguien ha priorizado explícitamente. No una cadena de fallbacks.

Traducción concreta:

```
Orden del contenedor:
  1º  Las que tienen pastilla en el calendario de MI ámbito para hoy  (orden del responsable)
  2º  El resto, por fecha de entrega ascendente                        (default sensato)
```

Con eso, una OT sin pastilla nunca desaparece ni acaba en un sitio raro: cae abajo, ordenada por urgencia real.

### 5.2 Modelar "disponible" y "ejecutable" como dos ejes, no como un estado

Es tentador crear un estado `esperando_material` en `prod_ot_pasos`. **No lo hagáis.** Serían dos verdades sobre el mismo campo y volvería el problema del "estado legacy que no se actualiza" que ya costó tres apariciones en el Bloque 9.

Odoo lo resuelve con dos ejes independientes, y es el patrón correcto:

| Eje | Fuente | Pregunta |
|-----|--------|----------|
| **Disponible** | `prod_ot_pasos.estado` | ¿El paso anterior está hecho? |
| **Ejecutable** | Consulta viva a compra/stock/cartela | ¿Hay material para trabajar? |

La UI muestra la combinación; la base de datos no almacena la combinación. Igual que `cantidad_libre` en el Bloque 9: **calculada, nunca almacenada**.

### 5.3 Calendario = clave de orden opcional (no "Familia A / Familia B")

No hay dos bandos de secciones. **El calendario es una clave de orden opcional en todas:** Carlos puede ordenar la cola de CTP desde el calendario sin que eso implique enviar a mesa ni ningún trámite extra; si no lo hace, la cola sigue por fecha de entrega. Una sola regla de orden para todo (pastilla primero si existe, entrega después).

---

## 6. Respuesta a "¿activo / no activo?"

La pregunta era: ¿el despacho activa el circuito automáticamente, o Carlos tiene que pulsar "activar"?

**Recomendación: automático al despachar, con válvula de escape.**

Razonamiento:
- SAP sí tiene un `Release` explícito, pero es un ERP con departamento de planificación dedicado.
- Odoo lo hace automático al confirmar.
- **Optimus lo hace automático**, y ese es el listón de comparación real. Un paso manual extra se percibirá como retroceso.

La válvula de escape: poder **retener** una OT concreta (marca "bloqueada / no lanzar todavía") para los casos excepcionales. Es decir: activar no es un trámite obligatorio; retener sí es una acción posible.

Esto también resuelve la carrera "Antonio se adelanta a Carlos": **no puede**. Aunque Antonio ponga la OT en su calendario T para el día 12, si el paso de troquel no está `disponible` porque falta imprimir, no se ejecuta. El itinerario autoriza; el calendario solo ordena. No hace falta ninguna regla de "Antonio no puede poner fecha anterior a la de Carlos".

---

## 7. Patrones de UI/UX aplicables (probados en planta)

| Patrón | Qué es | Dónde se usa |
|--------|--------|--------------|
| **Vista por centro de trabajo por defecto** | El operario entra y ve *su* sección, sin filtrar nada | Odoo Shop Floor, la mayoría de MES |
| **Dos secciones visuales** | "Hoy / planificadas" y "Listas sin planificar" | Dispatch lists clásicas |
| **Claim visible** | Avatar/nombre sobre el trabajo en curso | Odoo (panel de operario) |
| **Reordenar por arrastre en lista** | Ordenar 1-2-3-4, sin asignar slots ni horas | Kanban / listas de tareas |
| **Objetivos táctiles grandes** | Tablet en planta, manos sucias, de pie | Todos los MES modernos |
| **Filtro guardado por usuario** | No repetir la selección cada vez | Estándar |
| **Por defecto solo ejecutable** | Lista corta = lo que se puede hacer ya; interruptor para ver todo | Odoo filtro "Ready to Start" |

**Nota sobre el orden dentro del día para Antonio (4 troqueladoras):** no hace falta asignar máquina. Basta con que Antonio ordene la lista (1, 2, 3, 4, 5) y los operarios cojan de arriba. Asignar máquina concreta es una capa posterior y probablemente innecesaria — en Optimus tampoco existe y llevan años así.

---

## 8. Riesgos reales del modelo nuevo (no mencionados hasta ahora)

### 8.1 El contenedor de CTP va a ser enorme
Si despacho = entra al contenedor, y CTP es casi siempre el primer paso, la cola de CTP contendrá **todo lo despachado y no empezado**. Con las OTs a un mes vista que hay ahora, pueden ser cientos.

→ El orden por defecto (§5.1) no es un detalle estético: es lo que hace la pantalla usable o inútil. Sin buen orden, el contenedor es peor que el montón de papeles de Carlos.

→ **Solución complementaria (Odoo):** por defecto mostrar **solo lo ejecutable** (paso disponible + material OK); interruptor para ver el resto ("lo que viene"). Reduce el tamaño de la lista sin depender solo del orden.

### 8.2 Claim sin cierre
Un operario coge una OT, se va a comer / termina el turno / se olvida. La OT queda bloqueada para los demás.

→ **Decisión de diseño (22 ago):** claim = **iniciar**, no reservar por adelantado. El avatar aparece al pulsar empezar, físicamente en la máquina (como Odoo). "Empezó y se fue" = pausa (ya resuelto). **No** implementar reserva previa en fase 3: crearía estado nuevo, abandono y timeouts.

### 8.3 Previsión para Antonio y Gabri
Van a preguntar "¿cuándo me llega esto?". No es un sistema nuevo: es **dejarles ver el calendario de Impresión**. Si ven cuándo se imprime, saben cuándo colocar su T o su E.

→ Requiere que el calendario permita ver ámbitos ajenos en modo lectura (lo que Manel describía como "tipo Outlook": activar/desactivar calendarios superpuestos). Eso es un patrón conocido y bien entendido por cualquier usuario.

### 8.4 El papel no desaparece de golpe
La hoja física seguirá circulando un tiempo. Lo importante es que **deje de ser la fuente de verdad**: si se pierde, el contenedor sigue diciendo qué toca. Durante la transición conviven, y eso está bien.

---

## 9. Alcance realista: qué se tira y qué se reutiliza

La sensación de "hay que rehacerlo todo" no se corresponde con lo que hay en código — pero **tampoco** hay que minimizar el trabajo gordo.

**Ya funciona (no hay que reinventarlo):**
- Al despachar, el **primer paso queda `disponible`** (`prod-ot-itinerario-client.ts`)
- El **trigger avanza el itinerario** cuando se cierra un paso
- Toda la pantalla de ejecución (`ExecutionCard`, formularios por proceso, cierre con consumo de cartela)
- El calendario I/T/D/E completo
- Los gates de material del Bloque 9
- Mesa (se queda para offset / cuello de botella)

**El trabajo de verdad (no es "conectar cables"):**
- **Desacoplar la ejecución de la mesa:** hoy la lista del operario nace de `prod_mesa_ejecuciones`, que exige máquina y slot. Hay que alimentarla desde pasos `disponible` sin pasar por mesa (salvo offset).
- La consulta del contenedor: pasos filtrados por sección + orden calendario/entrega
- Claim al iniciar (operario + máquina)
- Filtro por defecto "solo ejecutable" + toggle ver todo

**Se jubila como arquitectura:**
- Pool como paso obligatorio del camino feliz
- Mesa como requisito en secciones que no son cuello de botella
- "Enviar a mesa" por cada paso del itinerario (**botón retirado del calendario 22 ago tarde**)

**Procesos sin calendario (contenedor puro):** CTP, guillotina, desbroce, manipulados internos, externos Ramón. Solo **I/D/T/E** tienen pastilla en calendario.

**Se aparca (no se tira):**
- PR1 (rama `feature/bloque11-calendario-enviar-cola-mesa`, sin mergear). Piezas reutilizables: label paso, espejo, lib `pasar-a-mesa`, gates.

### Piloto recomendado

**CTP + Troquelado** (no CTP + Engomado): cubren los dos extremos — cola simple sin elección de máquina (CTP) y cola con varias máquinas + claim real (troquel, el caso que rompió el modelo viejo con Antonio). Con esos dos validados, el resto es repetición.

---

## 10. Las tres preguntas que quedan abiertas

Para cerrar con Jordi/Carlos (y con Antonio/Gabri cuando vuelvan):

1. **¿Os vale que el calendario sea opcional en todas las secciones?** — quien quiera ordena el día con pastillas; quien no, la cola sigue por fecha de entrega.
2. **En troquelado y engomado, ¿preferís ver "hoy" o un listado de varios días?**
3. **¿Hace falta asignar máquina, o basta con ordenar la lista y que el operario coja?** — la hipótesis es que basta con ordenar, porque es lo que hacen hoy con Optimus.

---

## 11. Conclusión

El modelo al que se llegó anoche coincide con:
- La práctica estándar de MRP II (dispatch list)
- Los principios de Lean (pull)
- La Teoría de Restricciones (planificar solo el cuello de botella)
- **La implementación real de Odoo**, que es el ERP que se va a comprar

El circuito "enviar a mesa en cada paso" no existe en ninguno de esos sistemas. No es una omisión: es que empuja el trabajo de planificación a personas que están en planta, no en un despacho.

**El PR1 no se tira, se aparca.** Y el retraso sobre el TEST está justificado: es preferible mover la fecha unas semanas que estrenar con un modelo que Antonio y Gabri no van a usar.

---

*Análisis elaborado sobre la sesión Manel + Cursor del 21 ago 2026, con verificación de documentación oficial de Odoo (Shop Floor, versiones 17–19). Rev. 22 ago: matiz calendario opcional, claim al iniciar, §9 precisado, piloto CTP+Troquel. Rev. 22 ago tarde: enlace doc diseño completo; procesos contenedor puro; PR1 UI retirada.*
