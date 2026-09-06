# MINERVA — Bloque 13: Visibilidad planta / comerciales / andon

> Brainstorming. **Sin implementación** salvo lo que se acuerde después de los 4–5 reales de septiembre.
> Origen: reunión 6 sep 2026 (Albert · Jordi · Gemma · Manel), demo completa ~3 h. Les gustó; ritmo acordado = más OTs reales, no más pantallas.
> Frases Albert (calendario vs comercial): `.MANUALES/BRIEFS/MINERVA_FRASES_ALBERT_06SEP2026.md`.
> Complementa: Pipeline existente · Bloque 11 calendario · Bloque 12 roles · Bloque 6 cierre · Bloque 7 albaranes.

**Estado:** 📋 Capturado 6 sep 2026.

---

## 0. En una frase

El calendario **ordena el día**. El pipeline **dice dónde está la OT**. Comercial necesita lo segundo, en solo lectura. Una TV tipo aeropuerto es la misma verdad, en grande.

---

## 1. Qué pidieron (reunión)

- Comerciales dejan de llamar a Albert/gerencia con *«¿y esto cuándo?»*.
- El calendario les ha gustado y lo ven útil; broma: en un año, pantalla tipo triage / aeropuerto (*dingdong*, OT xxxx impresa / en troquel / externo / engomada / terminada).
- Matiz a confirmar con Albert (7 sep): casi seguro *«el comercial pone la OT y ve el GPS sin molestar a planta»*.
- Paranoia útil (Manel): planta a vista de pájaro (compras → CTP → guillotina → impresión → troquel → desbroce → engomado → externos → transporte) con la cola de cada puesto.

**No es esta semana.** Esta semana: 4–5 OTs reales compra → producción.

---

## 2. Tres capas (no mezclar)

| Capa | Qué | Fuente de datos | Cuándo |
|------|-----|-----------------|--------|
| **13.1 Vista comercial** | Buscar OT / cliente → paso actual, siguiente, entrega, semáforo. Solo lectura. Sin mesa ni contenedor. | Pipeline (`pipeline-query` / `pipeline-data`) | Tras estabilizar reales; encaja Bloque 12 rol `comercial` |
| **13.2 Andon / aeropuerto** | Pantalla TV: eventos de planta (impresa, en proceso, recibida de externo, terminada). | Mismos pasos + ejecuciones + muelle | Después; visualización, no nuevo modelo |
| **13.3 Mapa de planta** | Layout dibujado + lista por máquina. Lean / andon. | Igual | Visión; layout real cambia → caro de mantener |

**Regla:** el calendario **no** se convierte en el call-center de comerciales.

---

## 3. Relación con lo que ya existe

- **Pipeline** (`/produccion/pipeline`): paso actual, siguiente, riesgo, fecha, badge `pendiente_revision`. Eso *es* el GPS. Falta cara comercial (menos columnas, más busca-OT, sin herramientas de oficina).
- **Calendario** (Bloque 11): orden del día I/D/T/E. Plan, no estado comercial.
- **Contenedor de ejecución**: lo que ve el operario. No es la pantalla de comercial.
- **Bloque 12**: landing por perfil; comercial no debe aterrizar en ejecución ni en mesa.

---

## 4. Fuera de este bloque (otras notas de la misma reunión)

Documentadas para no perderlas; **no son 13**:

| Tema | Dónde vive | Decisión 6 sep |
|------|------------|----------------|
| Lentitud Iniciar en contenedor | Bloque 11 / sesión 6 sep | **Hacer ya** (optimistic + fetch paralelo) |
| Cierre OT automático vs revisión | Bloque 6 | No auto-archivar a ciegas; `pendiente_revision` ya es automático |
| María José da por cerradas al albaranar | Bloque 7 | **No**: albarán ≠ cierre productivo. Cola de ya-producidas, más adelante |
| Promedios automáticos al terminar | Bloque 6 §7.1 | **No** al vuelo; botón / aviso de referencia sucia |

---

## 5. Criterios de hecho (cuando se abra 13.1)

- [ ] Comercial busca OT o cliente y ve estado + qué falta + entrega, sin editar planta.
- [ ] No usa el calendario como tablero de «dónde está mi pedido».
- [ ] Albert/gerencia dejan de ser el GPS humano para esas consultas (medir en uso, no en demo).

13.2 / 13.3: no hay criterios de hecho hasta que 13.1 exista y Albert confirme el matiz.
