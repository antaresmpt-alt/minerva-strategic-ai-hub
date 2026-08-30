# Documentación Minerva Hub

Toda la documentación de producto vive bajo `.MANUALES/`. En la **raíz del repo** solo quedan `README.md`, `AGENTS.md` y `CLAUDE.md` (entrada para agentes IA).

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| [`CONTEXTO/`](CONTEXTO/) | Maestro global, contexto técnico, roadmaps `FASES_*` |
| [`BLOQUES/`](BLOQUES/) | Diseño y decisiones por bloque (`MINERVA_BLOQUE*`) |
| [`SESIONES/`](SESIONES/) | Diarios de sesión (`SESION_DDMMMAAAA_*.md`) |
| [`BRIEFS/`](BRIEFS/) | Briefings, guías, reuniones, inventarios |
| [`MANUALES_USUARIO/`](MANUALES_USUARIO/) | Manuales operativos para planta |

## Punto de entrada

1. **Visión y estado global:** [`CONTEXTO/MINERVA_HUB_CONTEXTO_MAESTRO.md`](CONTEXTO/MINERVA_HUB_CONTEXTO_MAESTRO.md)
2. **Detalle técnico repo:** [`CONTEXTO/MINERVA_CONTEXTO_TECNICO.md`](CONTEXTO/MINERVA_CONTEXTO_TECNICO.md)
3. **Roadmap hoja de ruta:** [`CONTEXTO/FASES_HOJA_RUTA_DIGITAL.md`](CONTEXTO/FASES_HOJA_RUTA_DIGITAL.md)
4. **Sesión activa:** ver comentario en [`../CLAUDE.md`](../CLAUDE.md)

## Convención nuevos archivos

- Sesión nueva → `SESIONES/SESION_DDMMMAAAA_TEMA.md`
- Decisión de bloque → `BLOQUES/MINERVA_BLOQUEn_….md`
- Brief / guía → `BRIEFS/…`
- Manual planta → `MANUALES_USUARIO/…`
- Tras crear o mover un doc, actualizar el maestro y `CLAUDE.md` si es sesión activa.

## Fuera de `.MANUALES`

- [`docs/`](../docs/) — notas técnicas puntuales (CTP pendiente, referencias Optimus).
- [`supabase/migrations/`](../supabase/migrations/) — SQL y README de migraciones.
