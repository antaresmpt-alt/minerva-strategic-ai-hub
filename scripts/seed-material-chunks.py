#!/usr/bin/env python3
"""Imprime SQL INSERT por lotes para prod_etiquetas_material_catalogo."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rows = json.loads(
    (ROOT / "supabase/seeds/etiquetas_material_catalogo.json").read_text(encoding="utf-8")
)

CHUNK = 40


def esc(s):
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def row_sql(r):
    price = "null" if r["price_m2"] is None else str(r["price_m2"])
    return (
        f"({esc(r['marca'])}, {esc(r['categoria'])}, {esc(r['item_number'])}, "
        f"{esc(r['face_name'])}, {esc(r['adhesive'])}, {esc(r['backing'])}, "
        f"{price}, {esc(r['ean_code'])}, {esc(r['notes'])}, {esc(r['stock_dimensions'])}, true)"
    )


header = """insert into public.prod_etiquetas_material_catalogo (
  marca, categoria, item_number, face_name, adhesive, backing,
  price_m2, ean_code, notes, stock_dimensions, activo
)
select v.marca, v.categoria, v.item_number, v.face_name, v.adhesive, v.backing,
  v.price_m2, v.ean_code, v.notes, v.stock_dimensions, v.activo
from (values
"""

footer = """
) as v(
  marca, categoria, item_number, face_name, adhesive, backing,
  price_m2, ean_code, notes, stock_dimensions, activo
);
"""

out_dir = ROOT / "scripts" / "_seed_chunks"
out_dir.mkdir(exist_ok=True)
for i in range(0, len(rows), CHUNK):
    chunk = rows[i : i + CHUNK]
    part = i // CHUNK + 1
    sql = header + ",\n".join(row_sql(r) for r in chunk) + footer
    path = out_dir / f"chunk_{part}.sql"
    path.write_text(sql, encoding="utf-8")
    print(path, len(sql))
