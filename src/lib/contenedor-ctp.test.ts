import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  CONTENEDOR_CTP_ID_PREFIX,
  contenedorCtpVirtualId,
  crearEjecucionLigeraCtp,
  isContenedorCtpVirtualId,
  parseContenedorCtpVirtualId,
} from "@/lib/contenedor-ctp";

function mockCtpClient(opts: {
  insert: { data: { id?: string } | null; error: { message: string } | null };
  update?: { error: { message: string } | null };
}): SupabaseClient {
  return {
    from() {
      return {
        insert() {
          return {
            select() {
              return {
                single: async () => opts.insert,
              };
            },
          };
        },
        update() {
          return {
            eq: async () => opts.update ?? { error: null },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const startInput = {
  otNumero: "98005",
  otPasoId: "paso-1",
  maquinaId: "maq-ctp",
  startImmediately: true,
};

describe("contenedor-ctp virtual ids", () => {
  it("builds and parses virtual ids", () => {
    const pasoId = "aecea240-1a06-484c-96c4-edefff81ec3c";
    const id = contenedorCtpVirtualId(pasoId);
    expect(id).toBe(`${CONTENEDOR_CTP_ID_PREFIX}${pasoId}`);
    expect(isContenedorCtpVirtualId(id)).toBe(true);
    expect(parseContenedorCtpVirtualId(id)).toBe(pasoId);
  });

  it("rejects non-virtual ids", () => {
    expect(isContenedorCtpVirtualId("29967319-7117-443c-8481-19badf074ecf")).toBe(
      false,
    );
    expect(parseContenedorCtpVirtualId("uuid-real")).toBeNull();
    expect(parseContenedorCtpVirtualId(CONTENEDOR_CTP_ID_PREFIX)).toBeNull();
  });
});

describe("crearEjecucionLigeraCtp (fallo de red)", () => {
  it("throws on insert failure and does not return an id", async () => {
    await expect(
      crearEjecucionLigeraCtp(
        mockCtpClient({
          insert: { data: null, error: { message: "Failed to fetch" } },
        }),
        startInput,
      ),
    ).rejects.toMatchObject({ message: "Failed to fetch" });
  });

  it("throws on start update failure so caller never materializes en_curso", async () => {
    await expect(
      crearEjecucionLigeraCtp(
        mockCtpClient({
          insert: { data: { id: "exec-1" }, error: null },
          update: { error: { message: "Failed to fetch" } },
        }),
        startInput,
      ),
    ).rejects.toMatchObject({ message: "Failed to fetch" });
  });

  it("returns id only after insert + start succeed", async () => {
    const created = await crearEjecucionLigeraCtp(
      mockCtpClient({
        insert: { data: { id: "exec-ok" }, error: null },
        update: { error: null },
      }),
      startInput,
    );
    expect(created).toEqual({ id: "exec-ok" });
  });
});
