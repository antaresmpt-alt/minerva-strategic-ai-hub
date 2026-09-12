# Smoke STOP peor caso — OT **98045** (demo Gemma)

> **Objetivo:** comprar mal → cortar → descubrir el error en impresión → recuperar y seguir con el formato bueno.  
> **Caso:** **B** (ya cortado / consumido en guillotina — hay que **revertir consumo**).  
> **Roles:** oficina/admin = liberar + revertir + recompra · almacén = cartelar / asignar stock libre · mesa = ejecutar pasos.  
> **Relacionado:** `.MANUALES/BLOQUES/MINERVA_BLOQUE9_REASIGNACION_STOP.md` · manual `.MANUALES/MANUALES_USUARIO/MINERVA_MANUAL_CARTELAS_STOCK_REASIGNACION.md` §7.4

---

## Fase 0 — Partida

1. Abrir **Despachadas** → OT **98045**.
2. Comprobar: formato **65×92**, troquel **TAM00520** (necesita **72×102**), material vacío / sin compra.

---

## Fase 1 — Compra «mala» a propósito

3. **Generar compra** de la 98045 (Folding Zenith 350 · **65×92** · ~1000 h).
4. En **Compras**: confirmar → marcar **Recibido** (albarán lab, p. ej. `LAB-98045-P1`).

---

## Fase 2 — Reservar

5. En **Cartelas**: cartelar el material recibido y **reservar a OT 98045**.
6. Anotar nº de cartela (**#XXXXX**) y hojas.

---

## Fase 3 — Guillotina (consumo real)

7. Ejecutar **CTP** (si hace falta) y pasar a **Guillotina**.
8. Cerrar guillotina con esa cartela: corte **65×92 → 65×46** (mitad) · se **consume** el palet.
9. Comprobar: cartela a 0 h / consumida · Impresión queda con badge tipo **65×46 (GUILLOTINA)**.

---

## Fase 4 — El «ostras» (STOP en impresión)

10. Abrir **Impresión** de la 98045 y ver el formato cortado.
11. **Parar:** no tirar impresión con 65×46 si el trabajo es 72×51 / 72×102.
12. Decisión oficina: este material cortado **no sirve** para el troquel → Caso B.

---

## Fase 5 — Deshacer lo cortado (Caso B)

13. En el paso **Guillotina** (admin/oficina): **Revertir consumo** (9.8.5).
14. Comprobar ledger: el palet vuelve con hojas; formato real del palet = **65×46** (ya no es 65×92 entero).
15. **Liberar reserva** de esa cartela respecto a la 98045.
16. Reimprimir cartela como **stock libre** (65×46) y pegarla en el palet físico (queda para otro uso / merma / scrap — no mezclar con el pliego bueno).

---

## Fase 6 — Material correcto

17. **Lápiz despacho** 98045: formato **72×102** · guillotina plan **72×51** · hojas coherentes.
18. Camino material bueno (elegir uno):
    - **A)** Compra de corrección **72×102** a la 98045 → recibir → reservar, **o**
    - **B)** Compra **stock libre** 72×102 → cartelar → **asignar a 98045** (9.8.4).
19. Si Impresión sigue en mesa del intento malo: **Anular → Pool** y volver a planificar (fricción conocida).

---

## Fase 7 — Cierre feliz

20. Guillotina otra vez con cartela **72×102** → cierre consume → Impresión **72×51** / hojas ok · **sin** badge del formato malo.
21. (Opcional) Avanzar un poco Impresión para dejar constancia de que el smoke cerró.

---

## Qué debe quedar claro al final

| Pieza | Resultado |
|--------|-----------|
| Cartela P1 (65×…) | Libre / 65×46 / no ligada a 98045 |
| OC1 65×92 | Histórico intacto (no se anula) |
| Material bueno 72×102 | Reservado/consumido en 98045 |
| `estado_material` | Sale del STOP al cartelar/consumir bien |

---

## Notas para la demo

- En **Pendientes / cartelar** debería verse el **peso (kg)** calculado desde hojas + gramaje + formato (Residuos).
- Si la OT **98045** no existe aún, clonar desde **98016** o **98019** y ajustar despacho antes del smoke.
