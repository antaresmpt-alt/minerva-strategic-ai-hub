import { describe, expect, it } from "vitest";
import { isDecimalDraft, parseDecimalLoose } from "@/lib/parse-decimal-input";

describe("parseDecimalLoose", () => {
  it("acepta punto y coma como decimal", () => {
    expect(parseDecimalLoose("1.5")).toBe(1.5);
    expect(parseDecimalLoose("1,5")).toBe(1.5);
    expect(parseDecimalLoose("0,05")).toBe(0.05);
  });

  it("entiende miles con coma decimal ES", () => {
    expect(parseDecimalLoose("1.234,56")).toBe(1234.56);
  });

  it("entiende miles EN con punto decimal", () => {
    expect(parseDecimalLoose("1,234.56")).toBe(1234.56);
  });

  it("devuelve null si vacío o inválido", () => {
    expect(parseDecimalLoose("")).toBeNull();
    expect(parseDecimalLoose("  ")).toBeNull();
    expect(parseDecimalLoose("abc")).toBeNull();
  });
});

describe("isDecimalDraft", () => {
  it("permite borradores intermedios", () => {
    expect(isDecimalDraft("")).toBe(true);
    expect(isDecimalDraft("0")).toBe(true);
    expect(isDecimalDraft("0,")).toBe(true);
    expect(isDecimalDraft("0.")).toBe(true);
    expect(isDecimalDraft("-")).toBe(true);
    expect(isDecimalDraft("1,5")).toBe(true);
  });

  it("rechaza basura", () => {
    expect(isDecimalDraft("1a")).toBe(false);
    expect(isDecimalDraft("1,,2")).toBe(false);
  });
});
