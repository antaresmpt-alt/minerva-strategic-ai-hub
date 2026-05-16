#!/usr/bin/env python3
"""Genera fragmento SQL VALUES desde supabase/seeds/etiquetas_material_catalogo.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rows = json.loads(
    (ROOT / "supabase/seeds/etiquetas_material_catalogo.json").read_text(encoding="utf-8")
)


def esc(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


lines: list[str] = []
for r in rows:
    price = "null" if r["price_m2"] is None else str(r["price_m2"])
    lines.append(
        f"({esc(r['marca'])}, {esc(r['categoria'])}, {esc(r['item_number'])}, "
        f"{esc(r['face_name'])}, {esc(r['adhesive'])}, {esc(r['backing'])}, "
        f"{price}, {esc(r['ean_code'])}, {esc(r['notes'])}, {esc(r['stock_dimensions'])}, true)"
    )

out = ROOT / "supabase/migrations/_etiquetas_material_seed_values.sql"
out.write_text(",\n".join(lines), encoding="utf-8")
print(f"Wrote {len(lines)} rows to {out}")
