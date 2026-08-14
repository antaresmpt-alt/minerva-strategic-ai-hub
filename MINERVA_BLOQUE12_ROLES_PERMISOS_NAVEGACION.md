# MINERVA — Bloque 12: Roles, permisos y navegación por perfil

> Brief de implementación del **rediseño de identidad / “su Minerva”**.
> Diseño detallado (estado actual del código, ejes 1–3, límites): `MINERVA_ROLES_Y_NAVEGACION.md`.
>
> **Estado:** 📋 Capturado 11 ago 2026 — **sin implementación aún** (landing/menú). 14 ago: dato Ramón tableta/máquina + lista gorda ejecución en `main`.
> **Prioridad estratégica:** alta para septiembre (usuarios reales de planta + gestores). No bloquea Pipeline / 8.4 / afinados en curso.

**Complementa:** `MINERVA_HUB_CONTEXTO_MAESTRO.md` · `MINERVA_ROLES_Y_NAVEGACION.md` · permisos almacén en `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md`.

---

## 0. En una frase

Hoy Minerva es una app “de oficina técnica” con menú grande.  
Para el paralelo: **cada persona entra en su mundo** — el maquinista solo marca planta; el gestor ve planificación, stock, despacho, etc.

---

## 1. Por qué ahora (septiembre 2026)

- Van a entrar **usuarios nuevos** (no solo Manel / cuentas genéricas de departamento).
- Operarios (impresión, troquel, engomado, CTP…) no deben navegar Pipeline, Maestro, Settings…
- Gestores (Jordi, Ramón, Carlos, Albert, Manel, Zaida, Rita; Hugo es caso aparte) sí necesitan visión amplia.
- Sin esto, el paralelo se ensucia: gente perdida en pantallas que no les tocan.

**Decisión de ritmo (11 ago):** no abrir este bloque ya (cabeza ocupada en afinar producción). Documentar y retomar cuando toque pulir onboarding de usuarios.

---

## 2. Dos mundos UX

### 2.1 Operarios de planta (“marcador”)

Pantalla casi única: **ejecución de proceso** (iniciar / rellenar / cerrar).

- Landing → `/produccion/ejecucion` (shell ya recorta menú si solo tiene módulo `produccion_ejecucion`).
- Filtro a **su máquina** (Ramón 14 ago: **una tableta por máquina**; turnos Abraham/David en la misma tableta, no a la vez).
- El resto (despacho, pipeline, maestro, stock avanzado…) **transparente / oculto**.
- Roles típicos hoy: `impresion`, `digital`, `troquelado`, `engomado`, `ctp`, (y análogos).
- Desbroce / manipulados: tableta **no confirmada** (Ramón no lo sabe).

### 2.2 Gestores

Home rico según rol: calendario, pool, stock/cartelas, despacho, pipeline, producidas…

| Persona | Enfoque (orientativo) |
|---------|------------------------|
| Jordi | Planificación / calendario / pool |
| Carlos | Calendario + lanzamiento suave (ver B11) |
| Ramón | Stock / cartelas / autorización |
| Albert / Gemma | Gerencia — visión global |
| Manel / Zaida | Oficina técnica — despacho, maestro, HR |
| Rita | Digital + externos / puente a Hugo (B5) |
| Hugo | Etiquetas (módulo ya maduro; casi su Minerva) |

Admin / gerencia: acceso total (como hoy `FULL_ACCESS_ROLES`).

---

## 3. MVP del Bloque 12 (cuando se abra)

Orden práctico (no reescribir permisos de cero):

1. **Landing por perfil**  
   - Operario → `/produccion/ejecucion` (cola de su máquina cuando B12 filtre).  
   - Gestor → calendario o home acordado.  
   - Hugo → etiquetas digital.

   **Interino 14 ago (no es B12):** `/produccion` redirige al maestro de OTs para todo el mundo con módulo producción. Sustituir esta redirección cuando se abra el landing por rol.

   **Campo 14 ago (Ramón):** 1 tableta/máquina (impresión, troquel, engomado; Teikit a confirmar). No tableta personal. Identidad = quién está de turno en esa máquina.

2. **Menú que oculta** lo no permitido (no solo “bloqueado al entrar”).

3. **Usuarios reales** (sustituir `impresion@`, `digital@`… por personas).

4. **Ajustes `role_permissions`** por módulo ya existentes (`produccion_ejecucion`, etc.) sin inventar motor nuevo.

**Fuera del MVP 12 (después):**

- Eje 1: multi-rol / capacidades (`MINERVA_ROLES_Y_NAVEGACION.md` §A.3).
- Eje 2: permisos por función (`cartelas.crear`, …).
- Eje 3: permiso por recurso (solo máquina CD 102).

---

## 4. Relación con el sistema actual

Ya existe cimiento:

| Pieza | Ruta |
|-------|------|
| Matriz estática | `src/lib/permissions.ts` |
| Capa dinámica | `role_permissions` + `src/lib/role-permissions-fetch.ts` |
| Roles asignables | `ASSIGNABLE_ROLES` en permissions |

**No** reescribir `permissions.ts` entero. Extender y **consumir** en navegación / redirect post-login.

Detalle de límites (un rol por usuario, granularidad módulo…): ver Parte A del doc de diseño.

---

## 5. Relación con otros bloques

| Bloque | Enlace |
|-------|--------|
| **9** Almacén | Juan vs Emma/Ramón ya esbozado; B12 debe respetarlo al ocultar Cartelas a Juan |
| **5** Etiquetas | Hugo ya casi en “su Minerva”; B12 formaliza landing |
| **11** Calendario | Gestores (Carlos/Jordi) aterrizan ahí; operarios no |
| **8** Contenedor | Sin impacto directo en roles MVP |
| **Pipeline** | Visible a gestores; oculto a operarios de línea |

---

## 6. Criterios de hecho (MVP)

- [ ] Login operario → aterriza en ejecución; no ve menú de despacho/maestro/settings (salvo admin).
- [ ] Tableta de máquina muestra (idealmente) solo esa cola; admin sigue viendo todas.
- [ ] Login gestor → aterriza en home acordado; ve módulos de su rol.
- [ ] Login Hugo → etiquetas.
- [ ] Al menos un usuario real por perfil piloto (impresión, troquel, engomado, CTP, OT, gerencia).
- [ ] Documentado en maestro qué rol → qué landing.

---

## 7. Retomar aquí

1. Leer `MINERVA_ROLES_Y_NAVEGACION.md` (Partes A–B) + este brief.
2. Decidir landing exacta por rol (tabla §2.2 + operarios).
3. Implementar redirect post-login + filtro de nav.
4. Crear/ajustar usuarios reales en Supabase Auth + `profiles` + `role_permissions`.
5. Probar con 1 operario + 1 gestor antes de desplegar a toda la planta.

---

## 8. Historial

| Fecha | Cambio |
|-------|--------|
| 11 ago 2026 | Creación Bloque 12 a partir de sesión Manel: paralelo sept, dos mundos (marcador vs gestor), MVP landing+menú, aparcado de implementación inmediata a favor de Pipeline/afinados. |
| 14 ago 2026 | Ramón: 1 tableta/máquina (no personal); turnos secuenciales. Lista gorda ejecución ya en `main` (admin aún ve menús). `SESION_14AGO2026_EJECUCION_LISTA.md`. |
