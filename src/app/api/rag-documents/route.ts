import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { RAG_DOCUMENTS_TABLE } from "@/lib/rag-table";
import { supabase as supabaseAnon } from "@/lib/supabase";

function getRagClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAnon;
}

type MetadataRow = { metadata: unknown };

const PAGE_SIZE = 1000;

/**
 * Lista documentos únicos agrupando por `metadata.source` (chunks vectoriales).
 */
export async function GET() {
  try {
    const client = getRagClient();
    const rows: MetadataRow[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await client
        .from(RAG_DOCUMENTS_TABLE)
        .select("metadata")
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const batch = (data ?? []) as MetadataRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const counts = new Map<string, number>();
    for (const row of rows) {
      const meta = row.metadata as Record<string, unknown> | null;
      const source =
        meta && typeof meta.source === "string" ? meta.source.trim() : "";
      if (source) {
        counts.set(source, (counts.get(source) ?? 0) + 1);
      }
    }

    const documents = Array.from(counts.entries())
      .map(([nombre, chunks]) => ({ nombre, chunks }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return NextResponse.json({ documents });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Elimina todos los chunks cuyo `metadata.source` coincide con el valor dado.
 */
export async function DELETE(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source")?.trim();
  if (!source) {
    return NextResponse.json(
      { error: "Parámetro source requerido" },
      { status: 400 }
    );
  }

  try {
    const client = getRagClient();
    const { error, count } = await client
      .from(RAG_DOCUMENTS_TABLE)
      .delete({ count: "exact" })
      .contains("metadata", { source });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: count ?? 0 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
