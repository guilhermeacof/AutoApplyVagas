import { describe, expect, test } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

interface SearchOut {
  meta: { count: number; page: number; board: string };
  results: Array<{ id: string; title: string | null; company: string | null; url: string }>;
}

// Live smoke tests against the public Emphasys Compleo board. Kept minimal to
// respect the "keep volume low" note. The board is small; "analista" reliably
// returns several hits.
describe("compleo search (live)", () => {
  test("search returns real results with populated id/title/url", async () => {
    const result = await runCLI(["search", "-q", "analista", "--limit", "5", "--format", "json"]);
    const out = parseJSON<SearchOut>(result);
    expect(out.meta.board).toBe("emphasys");
    expect(out.results.length).toBeGreaterThan(0);
    const r = out.results[0];
    expect(r.id).toBeTruthy();
    expect(r.title).toBeTruthy();
    expect(r.url).toContain("jobs.compleo.app");
  });

  test("--limit 0 emits zero results", async () => {
    const result = await runCLI(["search", "-q", "analista", "--limit", "0", "--format", "json"]);
    const out = parseJSON<SearchOut>(result);
    expect(out.results).toHaveLength(0);
  });

  test("an unknown board exits 1 with BOARD_NOT_FOUND", async () => {
    const result = await runCLI([
      "search",
      "-b",
      "definitely-not-a-real-board-xyz",
      "-q",
      "dev",
    ]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr) as { code?: string };
    expect(err.code).toBe("BOARD_NOT_FOUND");
  });
});
