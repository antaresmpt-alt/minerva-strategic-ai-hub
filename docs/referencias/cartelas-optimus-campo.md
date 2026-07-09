# Referencia campo — Cartelas Optimus vs Minerva

> Recopilación de ejemplos reales (jun 2026): cartelas impresas, albaranes anotados por Emma,
> consumo en planta (David, Speedmaster CD 102). Complementa `MINERVA_BLOQUE9_MATERIAL_CARTELAS.md` §3.
>
> PDF de ejemplo en esta carpeta: `cartela-optimus-ejemplo.pdf`

---

## Flujo completo (albarán → cartela → máquina)

```text
Albarán proveedor (a veces sin OT en el papel)
    ↓ Emma anota: OT o STOCK + ID Stock (+ ID Entrada Optimus entre paréntesis)
Cartela impresa (ID Stock grande en el palet)
    ↓ Maquinista (ej. David en CD 102)
Optimus RDC → Consumir material: Id stock → código artículo + descripción + cantidad hojas
```

**Minerva hoy:** cartelado (9.0–9.1b) + **Stock ATP + import Optimus con diff (9.2)** + **consumo operativo al cerrar impresión (9.4)** + **semáforo pool ATP** + **9.3 ajuste/split palet** + muelle→cartelas (9.5) + STOCK sin OC + multi-línea (9.6a–d) + pool «Ver cartelas» + lote tintas + asistente IA Stock MVP (9.9). **Siguiente:** cierre OT sobrantes (Bloque 6), sync marcar agotados, 9.7 OCR.

---

## Cartelas Optimus impresas — patrón canónico (CARPAPSA G6-3305, 15-jun-2026)

Tres palets, misma OT, mismo albarán:

| ID Stock | Cód. artículo | Hojas | Ref. Lote | Nota entrega | Id entrada |
|----------|---------------|-------|-----------|--------------|------------|
| **10.204** | PHFOAL235072001020 | 2.400 | 36016 - TEIKIT (T007) | G6-3305 | 5979 |
| **10.205** | PHFOAL235072001020 | 2.400 | 36016 - TEIKIT (T007) | G6-3305 | 5980 |
| **10.206** | PHFOAL235072001020 | 1.000 | 36016 - TEIKIT (T007) | G6-3305 | 5981 |

**Estructura visual Optimus (de arriba a abajo):**

1. Cabecera “Material” + hora impresión  
2. Id. Stock, Cód. Artículo, descripción (material + gr + formato + marca)  
3. Cantidad en hojas  
4. **ID Stock en tipografía muy grande** (centro)  
5. Origen: proveedor + código + (Id entrada) + nombre  
6. Recibido (fecha/hora)  
7. Nota Entrega (= nº albarán proveedor)  
8. Ref. Lote (= OT + nombre trabajo)

---

## Cartelas físicas adicionales (fotos planta)

| ID Stock | Proveedor | Cód. artículo | Material | OT | Nota entrega | in / out h | Anotación mano |
|----------|-----------|---------------|----------|-----|--------------|------------|----------------|
| **10.207** | CARPAPSA (000082) | PHFOAL27007201020 | Folding 270gr 72×102 | 104014 | G6-3314 | 1.650 / 1.650 | “10 C” |
| **10.211** | euronkarpa (000110) | — | Kraftliner 275gr 72×102 | 35741 | 2.729 | 4.400 / 4.400 | “ZO 10 C” |

**Notas:** el código artículo no siempre aparece en etiqueta (10.211 sin código). La ubicación a veces se escribe a mano en el borde aunque Optimus “Referencia estante” en consumo vaya vacía.

---

## Minerva vs Optimus — campos en etiqueta

| Campo Optimus | Minerva (`cartela-print.tsx`) | Notas |
|---------------|-------------------------------|-------|
| ID Stock grande | ✅ | Elemento dominante |
| Cód. artículo | ✅ si existe en BD | Opcional al cartelar; David no lo teclea |
| Material + gr + formato | ✅ | |
| Cantidad in / out | ✅ `cantidad_inicial` / `cantidad_actual` | |
| Proveedor (+ código) | ✅ nombre; sin código 000082 aún | |
| Nota Entrega | ✅ `nota_entrega` = albarán | |
| Ref. Lote | ✅ | |
| Id entrada (5979…) | ❌ no en print | Sustituido por `recepcion_id` interno |
| Cabecera “Material” | ❌ | Cosmético |
| FSC/PEFC en etiqueta | Parcial | Flags en print si marcados en wizard |
| Ubicación fila | Parcial | Catálogo UI; Juan valora uso en almacén |

---

## Albaranes con anotaciones Emma (jun 2026)

Patrón habitual en el papel del proveedor:

```text
Material impreso + comanda/OT (subrayado) + ID Stock a mano + (ID Entrada Optimus) + a veces hojas
```

### Papers Tordera — STOCK sin OT (§3b Insight 1)

| Albarán | Material | Cantidad | Anotación Emma |
|---------|----------|----------|----------------|
| **AV26-04179** | OFFSET 102×72 200gr | 29,38 kg | **STOCK** → 10299 (ID 6029) |
| **AV26-04187** | OFFSET 70×100 300gr | 52,50 kg | **STOCK** → 10298 (ID 6028) |

Caso habitual, no excepción → fase **9.6 STOCK sin OC**.

### Papers Tordera — con OT (proveedor no indica OT en albarán)

| Albarán | OT anotada | ID Stock |
|---------|------------|----------|
| **AV26-04186** | 36033 INKPRESS | 10297 (ID 6027) |

### CARPAPSA

| Albarán | Detalle | ID Stock / OT |
|---------|---------|---------------|
| **B26-2525** | 2 palets × 1.500 h Allyking 295gr | 10295-10296 (ID 6095-6096), OT **36023** |
| **G6-3426** | Varias líneas / pedidos tachados y corregidos | 10376-77 (6052-63) DOLS XL PEQUEÑO · **10378** (6064) DOLS XL MEDIANO; OTs 35970, 36040, 36041 |
| **G6-3305** (etiqueta envío) | Doc. 2026G63305, bulto 2/7 | Pedidos: 35990, 35949, 36016A, 36016B |

### Otros proveedores

| Albarán | Detalle |
|---------|---------|
| **euronkarpa 2.725** | Rangos 10312-14, 10315-16, 10333-35, 10353-60 por comanda |
| **Unión papelera A560040815** | 10309 (6058) 6250 H · 10364 (6059) · 10370 (6060) |

### Minerva — smoke piloto (misma lógica digitalizada)

| ID Stock | Albarán | OT | Notas |
|----------|---------|-----|-------|
| 10310 | g3-9999 | 98010-01 | Barco; hijas 01/02/03 en wizard |
| 10311–12 | G6-3305 | 35990 | |
| 10313 | G6-3426 | 35970 | Prueba wizard tabs jun 2026 |

### Cierre impresión → hoja de ruta (9.4-preview)

| OT | ID Stock (prueba) | Validado |
|----|-------------------|----------|
| **35858** | 10.310 / 10.313 | ✅ `Cerrar proceso` + `HojaRutaOtDialog` + PDF |

---

## Consumo en planta — David (Speedmaster CD 102, Optimus RDC)

Confirmado en visita a planta (jun 2026):

1. Fichar en recurso (Heidelberg CD 72×102 5C+L).  
2. Pestaña **Consumir material**.  
3. Teclear **Id stock** (ej. 10309, 10314, 10207).  
4. Optimus rellena **código artículo** + descripción.  
5. Introducir **cantidad** en hojas.  
6. Cerrar fichaje: buenas / malas (ej. 5.500 + 250 HOJAS).

**Referencia estante** en consumo: suele ir **vacía** (aunque Juan use ubicación en almacén).

**Diseño Minerva:**

| Fase | Estado | Comportamiento |
|------|--------|----------------|
| **9.4-preview** | ✅ 25 jun 2026 | Cerrar proceso (impresión 1/2) → ID Stock + hojas en `datos_proceso` + hoja de ruta/PDF. |
| **9.4 operativo** | ✅ **5 jul 2026** | Mismo punto + RPC `prod_stock_registrar_consumo` → `cantidad_actual` + `prod_stock_movimientos`. **Todas las OTs.** |

**Impresión cartelas (5 jul):** `src/lib/cartela-print-html.ts` — popup HTML aislado; 2 copias (cartelas) / 1 copia (stock). Ver §15.6.3 Bloque 9.

Archivos consumo: `src/lib/cartela-stock-consumo.ts`, `cartela-cierre-block.tsx`, `planificacion-ots-ejecucion-tab.tsx`, migración `20260705150000`.

---

## Dos contadores en Optimus

| Concepto | Ejemplo | En Minerva |
|----------|---------|------------|
| **ID Stock** | 10.204, 10309 | `prod_stock_palets.id_stock` (desde 10.310) |
| **ID Entrada** | 5979, 6029 | `recepcion_id` / recepción muelle (no en etiqueta) |

Emma anota ambos en el albarán; en Minerva basta **ID Stock** visible.

---

## Decisiones de producto (piloto)

| Tema | Decisión |
|------|----------|
| **Código artículo** | Campo en BD + wizard + print **si existe**. No obligatorio para crear cartela. En consumo se resuelve por lookup desde `id_stock`. Maestro de artículos → fase posterior. |
| **Ubicación fila** | Mantener en cartelado (Emma/Juan). Imprimir si se rellena. No pedir al maquinista en 9.4. |
| **STOCK sin OT** | Checkbox “Stock libre” en wizard; albaranes Tordera = casos de prueba para 9.6. |
| **Barco multi-hija** | Misma cartela puede referenciar 98010-02 + 98010-03; quitar OT padre 98010 del prefill (pendiente UX). |
| **Un albarán, un sistema** | Si se cartela en Minerva (piloto), no duplicar en Optimus (§13c). |

---

## Maestro de artículos Optimus (`maestro-articulos-optimus.xlsx`)

Export pantalla **Materiales y subcontrataciones** (468 filas, jun 2026). Copia en esta carpeta.

### Composición por clase

| Código de clase | Filas | Uso en cartelas |
|-----------------|------:|-----------------|
| **PAP HOJA** | 366 | Materia prima en palets (folding, offset, estucado…) |
| TERMINADO | 36 | Producto terminado (futuro capa PT) |
| SUBCONTRAT | 25 | Externos |
| CAJAS | 12 | Embalajes |
| TINTAS KG | 9 | Consumibles |
| PAP BOBINA / PAP BOBI N | 9 | Bobinas |
| Resto | 11 | Cauchos, planchas, pallets… |

Dentro de **PAP HOJA**: ~121 códigos “Folding…”, ~15 `PHFOAL*` (Allyking), existe **`PH-NO-DE-STOCK`** (“Papel hoja no de stock”) — refleja que en la práctica usan genéricos y afinan después.

### Código vs realidad (cómo trabaja la planta)

| Fase | Qué pasa con el código |
|------|-------------------------|
| **Presupuesto** | Foldings blancos **genéricos**; poco caso al PHFOAL exacto |
| **Compra / OC** | Material legible (tipo + gr + formato); código puede no coincidir aún |
| **Entrada / cartela (Emma)** | Ahí se asigna el **código Optimus correcto** al palet |
| **Máquina (David)** | Solo **Id stock** → Optimus rellena código desde la ficha de stock |

El maestro Optimus es **rígido** (un código por variante gramaje×formato×marca), pero el proceso es **flexible**: el snapshot operativo es la **cartela**, no el presupuesto.

### Patrón de código PAP HOJA (orientativo)

Ejemplo `PHFOAL235072001020` → *Folding 235 gr/m² 72×102 – ALLYKING*:

- Prefijo tipo (`PH` hoja, `PHF` folding, `PHO` offset…)  
- Marca / familia (`OAL` = Allyking, etc.)  
- Gramaje + dimensiones embebidos en el string  

No hace falta replicar la lógica de generación en Minerva: basta **lookup** o selección asistida.

### Minerva: qué maestro es cuál (no mezclar)

| Sistema | Tabla / módulo | Códigos | Para qué |
|---------|----------------|---------|----------|
| **Optimus** | Materiales (este Excel) | `PHFOAL…`, `PHOFF…` | Stock material, cartela, consumo |
| **Minerva** | `prod_referencias` | `M-00001…` | **Referencias cliente** (cajas, trabajos) — no es el mismo maestro |
| **Minerva legacy** | `almacen_materiales` | nombres agregados | MRP viejo — sustituido por cartelas (§12 Bloque 9) |

`prod_stock_palets.codigo_articulo` = **snapshot opcional** del código Optimus en el momento de cartelar, no FK obligatoria al presupuesto.

### Estrategia de enlace cartela ↔ maestro (propuesta)

**Fase piloto (ahora)** — sin bloquear a Emma:

1. Cartela = `material_nombre` + `gramaje` + `formato` + `id_stock` (como hoy).  
2. `codigo_articulo` **opcional** (manual o vacío).  
3. Consumo 9.4 operativo: lookup por `id_stock`, no por código. (Preview 9.4 ya guarda en `datos_proceso`.)

**Fase 9.1c / 9.2** — asistencia sin rigidez:

1. Tabla `prod_materiales_stock` (import periódico desde este Excel o API Optimus).  
2. En wizard cartelas: **combobox buscar** por descripción / gr / formato → sugiere código; Emma confirma.  
3. Si no hay match → dejar vacío o `PH-NO-DE-STOCK` equivalente Minerva.  
4. Regla: **nunca impedir crear cartela** por falta de código.

**No hacer en piloto:**

- Obligar código en presupuesto Bloque 10.  
- Mantener 468 filas a mano en UI.  
- Unificar `prod_referencias` (cliente) con códigos PH (material).

### Códigos de cartelas reales vs Excel

| Código en cartela | En export jun 2026 |
|-------------------|-------------------|
| PHFOAL235072001020 | ✅ |
| PHFOAL27007201020 | ✅ |
| PHOFF09006500900 | ✅ |
| PIIKRL27507201020 | ❌ no en export (posible alta posterior o typo) |

---

## Secuencia ID Stock (jun 2026)

- Optimus en uso: ~10.309–10.378+ (albaranes anotados).  
- Minerva piloto: desde **10.310**, smoke hasta **10.313+**.  
- Sin solapamiento problemático si se mantiene la secuencia Minerva por encima del último Optimus activo (verificar antes de producción).

---

*Última actualización: 5 jul 2026 — 9.4 operativo consumo stock; import Optimus; impresión HTML; lote tintas; IA Stock MVP. Fuentes: fotos planta, albaranes, RDC David, reunión Ramón, export maestro Optimus (468 artículos).*
