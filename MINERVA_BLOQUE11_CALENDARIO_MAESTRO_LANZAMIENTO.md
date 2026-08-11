# MINERVA — Bloque 11: Calendario OT como maestro de planificación y lanzamiento

> Documento de brainstorming / diseño.
> Origen: feedback Albert + sesión Manel (28 jul 2026). Actualizado **11 ago 2026** tras uso real (Carlos/Jordi) y matiz de lanzamiento prudente.
>
> Complementa: Calendario Producción actual (`MINERVA_BLOQUE9` §15.11–15.13), Mesa / Pool / Ejecución, **Bloque 12** (gestores aterrizan aquí).
> Estado: **en uso como planificador**; visión “master + lanzar” aún por diseñar con cuidado (no a saco).

---

## 0. En una frase

Hoy: Pool → Mesa → planificar → lanzar → ejecutar → cerrar.  
Mañana (visión Albert/Carlos): **el calendario es el sitio donde se planifica y se lanza**; la mesa/tareas del maquinista reciben el trabajo ya “enviado” desde ahí.  
**Matiz Manel (11 ago):** planificar/mover fechas = sí; lanzar = suave (a mesa/pool) **sin pisar** el plan de otra máquina/día.

---

## 1. Problema / oportunidad

- Carlos (y jefes) **ya se están acostumbrando** a planificar OTs en el **Calendario Producción** (ámbitos I/D/T/E).
- El flujo clásico (pool → enviar a mesa → planificar máquina/día/turno → iniciar) es otro sitio mental: duplica el “dónde va esto”.
- Si el calendario ya dice “impresión el día 20”, ¿por qué no **lanzar desde ahí** y que al maquinista le salga en su pestaña de tareas?

---

## 2. Visión (flujo deseado)

Ejemplo narrado en sesión:

1. **Carlos** coloca la OT **35666** el **día 20** en el calendario (ámbito Impresión).
2. Ese día (o desde esa pastilla) puede marcarla como **pasada a mesa / lista para lanzar** y **lanzar la OT (el paso del ámbito)** desde el propio calendario.
3. Al **maquinista** le aparece ya en su pestaña de **tareas a ejecutar**.
4. Cuando termina: la pastilla del calendario cambia de **color** → Carlos ve que **se ha ejecutado**.
5. Siguiente proceso (p. ej. Troquelado): en el calendario (ámbito **T**) la OT aparece como lista; **Antonio** la lanza desde ahí.
6. Si el **día X no se hizo**: se **replanifica** (mover pastilla / otra fecha) — el calendario sigue siendo la fuente de verdad de “cuándo”.

**Principio:** el calendario es el **master** de *cuándo* se hace cada ámbito; el lanzamiento y el semáforo visual cierran el círculo con planta.

---

## 3. Qué ya existe (no reinventar)

| Pieza | Estado hoy | Relación con Bloque 11 |
|-------|------------|------------------------|
| Calendario multi-ámbito I/D/T/E | ✅ | Base visual + permisos por rol |
| Semáforo pastilla (ámbar/verde/navy/gris) | ✅ | Ya refleja estado del paso del ámbito; **no** auto-mueve fechas |
| Mesa planificación (máquina × día × turno) | ✅ | Hoy es el sitio de “plan fino”; habría que decidir si sigue o se reduce |
| Pool / enviar a mesa | ✅ | Posible solape o sustitución parcial |
| Ejecución / tareas maquinista | ✅ | Destino del “lanzar desde calendario” |
| `prod_calendario_produccion_ot` | ✅ | Una fila fecha+OT+ámbito (+ orden) |

---

## 4. Decisiones a cerrar (cuando se retome)

1. **¿El calendario sustituye la Mesa o la alimenta?**
   - A) Lanzar desde calendario = crear/actualizar trabajo en mesa + poner en cola ejecución.
   - B) Calendario lanza directo a ejecución (mesa solo para detalle máquina/turno).
   - C) Híbrido: calendario = fecha/ámbito; mesa = máquina concreta (opcional).
2. **Granularidad del “lanzar”:** ¿un paso del itinerario (impresión / troquel / engomado) o la OT entera?
3. **Estados en pastilla:** planificada → pasada a mesa / lanzada → en curso → hecha → (¿replanificada?). Colores y quién puede cambiar cada uno.
4. **Quién lanza:** solo jefes (Carlos/Albert) vs también el maquinista “acepta” desde calendario.
5. **Replanificación:** mover fecha = ¿cancela lanzamiento pendiente? ¿aviso si ya está en curso?
6. **Ámbitos vs itinerario:** si la OT no tiene paso de ese ámbito, ¿no se puede colocar o se avisa?
7. **Convivencia** con Pool actual durante una transición (no romper lo que ya usan).

---

## 5. MVP tentativo (cuando se priorice)

Orden sugerido, barato → rico:

| Orden | Pieza | Valor |
|-------|-------|--------|
| 1 | Desde pastilla: acción **«Pasar a mesa / Lanzar»** (ámbito activo) | Un solo sitio mental |
| 2 | Refresco semáforo / color al cerrar paso en ejecución | Carlos ve “hecho” sin salir del calendario |
| 3 | Filtro “solo mías / solo pendientes de lanzar” por rol | Maquinistas y jefes |
| 4 | Replanificar (cortar/pegar o drag) con reglas si ya lanzada | Día X no hecho |
| 5 | Reducir dependencia del Pool para el camino feliz | Menos pantallas |

**Fuera de MVP inicial:** sustituir por completo la Mesa; automatismos de fechas; IA de carga.

---

## 6. Riesgos

- Duplicar estado (calendario vs mesa vs pasos) si no hay una sola fuente de verdad al lanzar.
- Operarios confundidos si ven calendario y mesa a la vez (mitigar con **Bloque 12**: ellos solo ejecución).
- **Conflicto de capacidad:** Carlos lanza/coloca para el día 9 en troquel y Antonio ya tenía carga el día 8 en esa máquina → el sistema **no debería dejarlo pasar en silencio** (bloquear o aviso fuerte + confirmación).
- Lanzar directo a slot de mesa sin “confirmar plan” puede romper la carga real de planta.

### 6.1 Política de lanzamiento recomendada (11 ago)

| Acción | ¿OK? | Nota |
|--------|------|------|
| Mover pastilla / cambiar día | Sí | Core del éxito actual |
| Marcar hecho / ver colores HR | Sí | Ya existe |
| Lanzar → pool / “listo en mesa” **sin** slot | Preferible MVP | Menos daño |
| Lanzar → mesa con máquina/día/turno | Solo con reglas | Evitar pisar planes ajenos |
| Confirmar plan (batch) | Deseable | Antes de “oficializar” carga |

---

## 7. Opinión rápida (diseño)

**La idea es coherente** con cómo están usando ya la herramienta: planifican en el calendario → el sistema debería **cerrar el círculo** ahí (lanzar + ver hecho), en lugar de obligar un segundo circuito Pool/Mesa.

No tiraría la Mesa de golpe: el calendario es excelente para **fecha + ámbito + estado**; la Mesa sigue útil para **máquina/turno/carga**. El puente natural es: *colocar en calendario* ⇒ *lanzar paso* ⇒ *aparece en tareas* ⇒ *al cerrar, pastilla navy*.

| Riesgo | Nota |
|--------|------|
| Dos “verdades” (calendario vs mesa) | Definir master explícito; el otro es vista o legacy |
| Lanzar sin máquina concreta | ¿Asignación automática, última máquina, o obligar a elegir? |
| Contenedor / hijas | Calendario hoy piensa OT; Bloque 8 complica |
| Sobrecarga UI del calendario | Ya es denso; acciones deben ser 1–2 clics, no otro wizard enorme |
| Permisos | Hoy escritura por ámbito/rol; lanzar es más sensible — ver Bloque 12 |

Retomar con Albert/Carlos: validar si “lanzar” implica elegir máquina o solo “liberar a planta”.

---

## 8. Retomar aquí

- [ ] Revisar este brief con Albert / Carlos (5–10 min)
- [ ] Elegir modelo A/B/C (§4.1) + política §6.1
- [ ] Boceto UX pastilla (estados + 1 botón)
- [ ] Spike técnico: reutilizar APIs de “enviar a mesa” / iniciar paso desde UI calendario
- [ ] Encajar con Bloque 6 cierre y promedios (sin mezcla)
- [ ] Reglas de conflicto máquina/día antes de lanzar a slot

**No empezar código de lanzamiento agresivo** hasta cerrar §4.1, §5 y §6.1.

