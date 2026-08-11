import { describe, expect, it } from "vitest";
import {
  chunkValues,
  fetchAllInChunks,
  mapPool,
} from "@/lib/supabase-query-chunks";

describe("chunkValues", () => {
  it("trocea y deduplica", () => {
    expect(chunkValues([1, 1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe("mapPool", () => {
  it("respeta orden y concurrencia", async () => {
    let live = 0;
    let maxLive = 0;
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      live += 1;
      maxLive = Math.max(maxLive, live);
      await new Promise((r) => setTimeout(r, 20));
      live -= 1;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(maxLive).toBeLessThanOrEqual(2);
  });
});

describe("fetchAllInChunks", () => {
  it("paraleliza chunks y aplana", async () => {
    const calls: number[][] = [];
    const rows = await fetchAllInChunks(
      [1, 2, 3, 4, 5],
      2,
      async (chunk) => {
        calls.push(chunk);
        return chunk.map((n) => ({ id: n }));
      },
      3,
    );
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(calls.length).toBe(3);
  });
});
