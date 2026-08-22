import { describe, expect, it } from "vitest";

import {
  CONTENEDOR_CTP_ID_PREFIX,
  contenedorCtpVirtualId,
  isContenedorCtpVirtualId,
  parseContenedorCtpVirtualId,
} from "@/lib/contenedor-ctp";

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
