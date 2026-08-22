import { describe, expect, it } from "vitest";

import {
  CONTENEDOR_TROQUEL_ID_PREFIX,
  contenedorTroquelVirtualId,
  isContenedorTroquelVirtualId,
  parseContenedorTroquelVirtualId,
} from "@/lib/contenedor-troquel";

describe("contenedor-troquel virtual ids", () => {
  it("builds and parses virtual ids", () => {
    const pasoId = "aecea240-1a06-484c-96c4-edefff81ec3c";
    const id = contenedorTroquelVirtualId(pasoId);
    expect(id).toBe(`${CONTENEDOR_TROQUEL_ID_PREFIX}${pasoId}`);
    expect(isContenedorTroquelVirtualId(id)).toBe(true);
    expect(parseContenedorTroquelVirtualId(id)).toBe(pasoId);
  });

  it("rejects non-virtual ids", () => {
    expect(
      isContenedorTroquelVirtualId("29967319-7117-443c-8481-19badf074ecf"),
    ).toBe(false);
    expect(parseContenedorTroquelVirtualId("uuid-real")).toBeNull();
    expect(parseContenedorTroquelVirtualId(CONTENEDOR_TROQUEL_ID_PREFIX)).toBeNull();
  });
});
