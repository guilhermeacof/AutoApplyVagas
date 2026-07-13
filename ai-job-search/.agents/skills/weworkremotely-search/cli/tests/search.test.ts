import { afterEach, describe, expect, test } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

interface SearchOutput {
  meta: { count: number; page: number; total: number | null; total_pages: number | null; per_page: number | null };
  results: Array<{ id: string; title: string | null; company: string | null; location: string | null; date: string | null; url: string }>;
}

describe("weworkremotely CLI live search", () => {
  test("search -q engineer returns real, well-formed results", async () => {
    const result = await runCLI(["search", "-q", "engineer", "--limit", "5"]);
    const out = parseJSON<SearchOutput>(result);
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results.length).toBeLessThanOrEqual(5);
    const r = out.results[0];
    for (const key of ["id", "title", "company", "location", "date", "url"]) {
      expect(key in r).toBe(true);
    }
    expect(r.id).toBeTruthy();
    expect(r.title).toBeTruthy();
    expect(r.url).toContain("weworkremotely.com/remote-jobs/");
    // -q filter really narrows: every result mentions the query somewhere.
    for (const item of out.results) {
      const hay = [item.title, item.company].filter(Boolean).join(" ").toLowerCase();
      expect(hay).toContain("engineer");
    }
  }, 30000);

  test("--limit 0 emits zero results but valid meta", async () => {
    const result = await runCLI(["search", "-q", "developer", "--limit", "0"]);
    const out = parseJSON<SearchOutput>(result);
    expect(out.results).toHaveLength(0);
    expect(out.meta.count).toBe(0);
  }, 30000);
});
