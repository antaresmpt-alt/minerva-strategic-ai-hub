# Bloque 5 — Pool entrada etiquetas (spike diseño · 29 ago 2026)

> **Estado:** diseño acordado · **implementación pendiente** (tras merge Bloque 11)  
> **Objetivo lunes:** Rita puede probar bandeja + lista; Hugo sigue entrada manual + hoja de ruta igual.

---

## Flujo acordado

```
Bandeja izquierda (candidatas)     Lista derecha (Rita ordena)     Hugo
─────────────────────────────     ───────────────────────────     ────
OTs etiqueta en maestro      →    «Pool OTs a realizar»      →    Selecciona → Iniciar
(sin filtro despacho obligatorio)  (orden del día)                  → pantalla habitual
                                   sale de bandeja al mover         (prod_etiquetas_hoja_ruta)
```

- **Hugo no cambia** el resto del circuito (hoja de ruta, calendario mensual, muelle…).
- **Entrada manual** sigue válida si el pool está vacío.

---

## Filtro bandeja izquierda (v1)

| Incluir | Excluir |
|---------|---------|
| OT en maestro **identificada como etiqueta** (itinerario Konica / Troq_ETIQUETA / Num_ETIQUETA, plantilla ETIQUETA, o tipo Optimus cuando exista) | Ya en `prod_etiquetas_hoja_ruta` (Hugo las tiene o las terminó) |
| **No terminada** (OT no cerrada / sin fila `finalizado` en HR etiquetas) | Ya en lista derecha de Rita (plan del día) |
| Despachada o no — **marcar visualmente** (como material en calendario) | — |

**Sin filtro despacho obligatorio** (decisión 29 ago): Rita ve OTs nuevas en maestro aunque aún no estén despachadas; badge «sin despachar» si aplica.

---

## Acciones UI

1. **Rita:** arrastra o «Añadir al día» → sale de izquierda, entra en derecha.
2. **Hugo:** selecciona en lista (o Rita le pasa) → botón **Iniciar** → INSERT `prod_etiquetas_hoja_ruta` (como entrada express pre-rellenada) → abre flujo habitual.
3. Duplicados: reutilizar `findHojaRutaPorOtNumero` / diálogo existente.

---

## No hacer en v1

- Calendario producción letra K / segundo calendario Rita.
- OTs ejecución contenedor con redirect a Hugo.
- Tres columnas Konica / Troquel / Numeradora (itinerario basta).

---

## Referencias

- UI vacía: `etiquetas-digital-page.tsx` → tab «Pool entrada»
- Bloque 5 diseño: `FASES_HOJA_RUTA_DIGITAL.md` § Bloque 5
- Patrón bandeja: `calendario-bandeja.ts`
