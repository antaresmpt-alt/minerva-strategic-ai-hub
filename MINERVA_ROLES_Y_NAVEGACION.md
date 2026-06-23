# MINERVA — Roles, Permisos y Navegación

> Documento de diseño y toma de decisiones (**fuente de verdad** de identidad, permisos y arquitectura de información).
> Complementa `MINERVA_HUB_CONTEXTO_MAESTRO.md`. No describe un bloque funcional concreto, sino una **capa transversal** que afecta a toda la app.
>
> **Estado:** 📋 Diseño / análisis — **sin implementación** (el sistema actual sigue vigente).
> **Creado:** 23 jun 2026.
> **Idea central:** cada usuario debe entrar en **"su Minerva"** — ver solo lo que le toca, hacer solo lo que le toca. Admin/Gerencia ven todo.

**Relacionado:** permisos de almacén → `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` · roles de planta (CTP, etc.) → `MINERVA_HUB_CONTEXTO_MAESTRO.md`.

---

## 0. Por qué este documento

El sistema de roles/accesos se diseñó al principio para una app más pequeña. A medida que se añadían funciones (impresión, logística, muelle, CTP, etiquetas…), se fueron creando pestañas y roles **de forma incremental**, sin un plan global. Hoy funciona y está razonablemente segmentado, pero se acumulan dos necesidades:

1. **Permisos más finos** — quién puede qué, hasta nivel de función y de recurso (ej. un maquinista que solo ve *su* máquina).
2. **Navegación reorganizada** — cómo se presenta lo que cada usuario puede ver, para que su Minerva sea limpia y sin ruido.

Son **dos caras de lo mismo** (qué puedes ↔ qué ves), por eso van juntas aquí. El rediseño es **un bloque propio futuro**, no urgente, y **no bloquea** Bloque 9 ni el trabajo actual.

---

# PARTE A — Permisos (quién puede qué)

## A.1 Estado actual (verificado en código, 23 jun 2026)

El sistema es **híbrido en dos capas**:

| Capa | Dónde | Qué hace |
|------|-------|----------|
| **Matriz estática** | `src/lib/permissions.ts` | `if (rol === "impresion") …` — reglas por defecto (fallback). |
| **Capa dinámica** | tabla `role_permissions` (rol × módulo → on/off) | **Tiene prioridad** sobre la estática. Permite cambiar accesos desde BD/Settings sin tocar código. Carga: `src/lib/role-permissions-fetch.ts`. |

**Módulos actuales** (`HubModuleId`): `sales`, `sem`, `seo`, `etiquetas_digital`, `muelle`, `produccion`, `produccion_ejecucion`, `chat`, `settings`.

**Roles asignables** (`ASSIGNABLE_ROLES`): `admin`, `gerencia`, `comercial`, `produccion`, `impresion`, `digital`, `troquelado`, `engomado`, `logistica`, `almacen`, `ctp`, `administracion`, `oficina_tecnica`.

- `admin` / `gerencia` → **acceso total** (`FULL_ACCESS_ROLES`).
- `almacen` (Juan) → hoy `chat` + `muelle`.
- Acceso resuelto por: módulo (`canAccessHubModule`), página (`canAccessPagePath`), API (`canAccessApiRoute`).

## A.2 Límites del modelo actual

1. **Un usuario = un solo rol** (`profiles.role`). Para alguien que hace impresión *y* engomado hay que inventar un rol combinado → no escala.
2. **Granularidad solo a "módulo"** — puedes decir "ve Producción / no", pero no "puede crear cartelas pero no autorizar traspasos".
3. **Sin permiso por recurso** — no se puede expresar "Abraham ve **solo** la CD 102". El átomo es el módulo, no la máquina/OT/sección.

## A.3 Plan de evolución — 3 ejes (por fases)

> No reescribir de cero. La capa dinámica `role_permissions` ya es el cimiento correcto; se **extiende**.

### Eje 1 — Usuario con varios roles / capacidades
Pasar de `profiles.role` (uno) a **N roles por usuario** (`user_roles`) o, mejor, a **capacidades** (`user_permissions`: usuario × módulo/función). Resuelve ~80% del dolor: ya no se inventan roles combinados.

### Eje 2 — Granularidad de "función"
Bajar el átomo de módulo a **acción**: `cartelas.crear`, `stock.entregar`, `traspaso.autorizar`, etc. Encaja ampliando `role_permissions` con nombres de función, no solo de módulo.

### Eje 3 — Permiso por recurso (caso Abraham / CD 102)
Scoping por recurso: tabla tipo `user_maquinas` (o `user_secciones`) y filtrar las queries por ella. **Es la fase más invasiva** (toca muchas consultas). Dejar para el final.

**Orden recomendado:** Eje 1 → Eje 2 → Eje 3.

## A.4 Qué NO hacer

- **No reescribir `permissions.ts` entero** sin necesidad inmediata: funciona y está segmentado.
- **No bloquear Bloque 9** por el rediseño: para cartelas basta con el rol `almacen` actual + dar visibilidad a los nuevos módulos/funciones vía `role_permissions`.
- No mezclar el rediseño grande con el trabajo de features en curso.

## A.5 Permisos del Bloque 9 (lo concreto a corto plazo)

Para cartelas/stock (sin rediseño): reutilizar `almacen` y, al crear las pantallas, añadir módulos/funciones nuevos.

```
Juan  (almacen) → Muelle + Cartelas (crear/imprimir) + Stock (consulta + entrega libre + traspaso con autorizado_por)
Emma           → lo de Juan + correcciones + casos complejos + supervisión
Ramón          → todo lo anterior + autoriza traspasos de reserva
Admin/Gerencia → todo
```

- Emma y Juan crean cartelas **en paralelo sin pisarse** (`id_stock` único + `created_by`). El sistema no bloquea, registra quién hizo qué.
- "Autorizar traspaso" = **campo `autorizado_por`** en el movimiento (§7.6 Bloque 9), no rol exclusivo. Juan lo ejecuta.

---

# PARTE B — Navegación (qué ve cada uno)

## B.1 Problema actual

El menú superior y las pestañas crecieron de forma incremental. Hoy hay pestañas genéricas que se añadieron según hacían falta, sin una arquitectura de información pensada por **perfil de usuario**. Resultado: usuarios que ven entradas de menú que no usan, y una estructura que no escala bien al añadir Bloque 9 (almacén/cartelas) y futuros módulos.

## B.2 Objetivo — "la Minerva de cada uno"

Al entrar, cada usuario ve **solo su mundo**:

- **Juan (almacén):** Muelle + Cartelas + Stock. Nada más. Mobile-first.
- **Rita (digital/etiquetas):** su flujo de etiquetas + acabados.
- **Marc / Gemma (CTP):** preimpresión + lo que necesiten de producción.
- **Abraham (impresión):** ejecución de **su** máquina (CD 102), idealmente solo esa.
- **Comercial:** ventas / SEM / SEO.
- **Admin / Gerencia:** **todo**.

La navegación se deriva de los permisos: si no puedes, no lo ves (no solo "bloqueado al entrar").

## B.3 Relación permiso ↔ pantalla

| Permiso (Parte A) | Navegación (Parte B) |
|-------------------|----------------------|
| *Quién puede qué* | *Cómo se organiza lo que puede ver* |
| `role_permissions`, capacidades | menú superior, pestañas, landing por perfil |
| Backend / control de acceso | UX / arquitectura de información |

Van acopladas: el rediseño de permisos (Ejes 1–3) **habilita** una navegación por perfil, y la navegación **consume** esos permisos para mostrar/ocultar.

## B.4 Pendiente de decidir (cuando se aborde el bloque)

- **Landing por perfil**: ¿cada rol aterriza en su pantalla principal (Juan → Muelle, Abraham → su máquina) en vez de un home genérico?
- **Estructura del menú**: ¿agrupar por área (Producción, Almacén, Comercial) o por flujo?
- **Ocultar vs. deshabilitar**: ¿lo no permitido desaparece del menú o se muestra atenuado?
- **Multi-rol en UI**: si un usuario tiene varias capacidades (Eje 1), ¿cómo se presenta? ¿Selector de "modo" o todo junto?

---

## C. Decisiones registradas (23 jun 2026)

- El rediseño de roles/permisos/navegación es **un bloque propio futuro**, planificado, no metido con calzador. No es urgente y **no bloquea** Bloque 9.
- **`administracion` no es `almacen`**: son roles distintos; almacén (Juan) no lleva permisos administrativos.
- Usuarios reales futuros sustituirán a los provisionales por departamento (`logistica@`, `almacen@`, `digital@`…): Rita→digital, Marc→ctp, Abraham→impresión (idealmente solo CD 102), etc.
- Cada **nuevo módulo** que se cree (incluido Bloque 9) se diseña ya pensando en **función fina** (ej. separar `cartelas` de `stock`) para facilitar la migración a los Ejes 1–3.

---

## D. Historial del documento

| Fecha | Cambio |
|-------|--------|
| 23 jun 2026 | Creación. Parte A (permisos: estado real, límites, plan 3 ejes, permisos Bloque 9). Parte B (navegación: objetivo "Minerva de cada uno", relación permiso↔pantalla, pendientes). Decisiones registradas. |
