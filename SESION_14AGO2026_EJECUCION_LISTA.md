# Sesión 14 ago 2026 (tarde) — Lista gorda de OTs en ejecución

> **Fuente de esta jornada (tarde).** Commits en `main`: `7ed10a9` (lista), `4a57f03` (perf). Deploy: Vercel rama `main`.  
> Mañana del mismo día: `SESION_14AGO2026_MANIPULADOS_ENCAJAR.md`.  
> Ayer: `SESION_13AGO2026_DERIVAR_EXTERNA_ITINERARIO.md`.

---

## Mensaje clave

La cola de **OTs en ejecución** deja de ser una rejilla de tarjetas siempre montadas. Es una **lista gorda táctil** (semáforo por hacer / en curso / pausada). El parte completo solo se abre al expandir. En tableta se validó iniciar, pausar y ver el mismo estado en el PC.

---

## 1. Lista + semáforo

| Antes | Ahora |
|-------|--------|
| Grid de `ExecutionCard` siempre montadas | Filas gordas (`min-h-16`); una expandida a la vez |
| «Pendiente inicio» | **Por hacer** (azul `sky`) |
| En curso / pausada | Verde `emerald` / ámbar `amber` |
| Finalizadas mezcladas o en sección aparte | Ocultas en filtro **Activas**; **Terminadas de hoy** = solo lectura |

Reglas de cola:

- Orden: **en curso** → **pausada** → **por hacer**.
- Al entrar, si hay una **en curso**, queda expandida.
- Expandir = el `ExecutionCard` de siempre (no se recortan campos). Lazy-mount: el formulario no existe hasta abrir.
- Cerrada: no se reabre ni se editan cantidades. Banner «Proceso cerrado · solo consulta».
- El reloj (p. ej. 71 h en CTP de prueba) también sirve de **atasco**: OT en curso días = investigar (espera de cliente, no cerrada, etc.). Pausar con motivo congela el semáforo en ámbar.

Filtros: Activas · En curso · Pausadas · Por hacer · Terminadas de hoy · Finalizadas (tope 200) · Todas (activas + histórico reciente).

Archivo: `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx`.  
Ruta tableta (sin Excel/PDF): `/produccion/ejecucion` (`tabletMode`).  
Admin sigue viendo la pestaña dentro de Planificación OT's (`/produccion/ots`).

---

## 2. Prueba en tableta (admin)

Vista bien de dedo. Apuntes (no bloquean):

- **Menús de oficina** se comen pantalla porque se entra como **admin** en `/produccion/ots`. El maquinista, con módulo solo `produccion_ejecucion`, aterriza en `/produccion/ejecucion` y el shell recorta el resto (`onlyExecution` en `produccion-shell.tsx`). Eso es Bloque 12, no esta lista.
- Engomado / troquel / impresión: el parte sigue largo al desplegar. Impresión tiene pantalla grande; CTP usa PC. Troquel y engomado: **probar en uso** antes de compactar.
- Primera carga y recarga tras cerrar: muy lentas en tableta → §3.

Campo: se lanzó un proceso, se pausó un CTP, el PC lo reflejó.

---

## 3. Rendimiento (`4a57f03`)

Misma clase que Pool/Pipeline: se pedía **todo** `prod_mesa_ejecuciones` (`select *`) y luego se filtraba en el cliente; al cerrar se relanzaba `loadData` entero (despacho, pausas, itinerario **dos veces**, catálogos…).

Ahora:

- Query acotada al filtro (por defecto **activas**); columnas explícitas, no `*`.
- Una sola lectura de `prod_ot_pasos` (itinerario + finalizados en memoria).
- Catálogos (máquinas, motivos, cajas, tipos engomado) y rol: **una vez por sesión**, no en cada Recargar.
- Recargar **no vacía** la lista mientras llega el dato.
- Planificación: Pool / mesa / pipeline / ejecución se **montan solo al abrir** la pestaña (`dynamic` + `subtab === …`), como el maestro de OTs.

---

## 4. Ramón — tabletas (14 ago, WhatsApp)

No es tableta personal ni de departamento.

| Hecho | Detalle |
|-------|---------|
| **Una tableta por máquina** | Impresión, troquel, engomado (Teikit a confirmar). Desbroce / manipulados: Ramón no lo sabe → no asumir tableta ahí. |
| **Turnos, no concurrentes** | Abraham y David: misma máquina/tableta, cada uno en su turno. |
| **El registro es de la máquina** | No «quién se llevó el iPad». |

Implicación Bloque 12 (no implementar ahora): landing operario = cola de **esa** máquina; al relevo, quién está de maquinista (no 30 logins personales tipo Optimus). Admin sigue viendo «Todas las máquinas».

---

## 5. Commits / archivos

| Commit | Qué |
|--------|-----|
| `7ed10a9` | Lista gorda, semáforo, lazy `ExecutionCard`, terminadas de hoy |
| `4a57f03` | Query activas, catálogos cacheados, pestañas Planificación lazy |

- `src/components/produccion/planificacion/planificacion-ots-ejecucion-tab.tsx`
- `src/components/produccion/planificacion/planificacion-ots-page.tsx`
- `src/app/produccion/ejecucion/page.tsx` (ya existía; `tabletMode`)
- `src/components/produccion/produccion-shell.tsx` (`onlyExecution`)

---

## 6. Pendiente (no de esta sesión)

- Compactar parte engomado/troquel **si** el uso en mesa lo pide.
- Bloque 12: landing operario, ocultar menú, filtro máquina = tableta.
- Prefill horas al añadir proceso en Ruta; muelle netas vs brutas.
