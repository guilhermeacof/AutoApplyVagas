import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

// Live smoke tests — hit carrera.sonda.com. Kept to a couple of requests. If SONDA
// is unreachable, these will surface as failures rather than silently passing.
describe("SONDA CLI live search", () => {
  test("search -q 'analista' returns real results with the contract shape", async () => {
    const result = await runCLI(["search", "-q", "analista", "--limit", "5"]);
    expect(result.exitCode).toBe(0);
    const out = parseJSON<{ meta: any; results: any[] }>(result);
    expect(out.results.length).toBeGreaterThan(0);
    const r = out.results[0];
    expect(r.id).toBeTruthy();
    expect(r.title).toBeTruthy();
    expect(r.url).toContain("carrera.sonda.com/job/");
    expect(r.company).toBe("SONDA");
    for (const key of ["id", "title", "company", "location", "date", "url"]) {
      expect(key in r).toBe(true);
    }
  });

  test("--limit caps the number of results", async () => {
    const result = await runCLI(["search", "-q", "analista", "--limit", "3"]);
    const out = parseJSON<{ results: any[] }>(result);
    expect(out.results.length).toBeLessThanOrEqual(3);
  });
});
