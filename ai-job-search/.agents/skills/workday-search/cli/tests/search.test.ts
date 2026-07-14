import { describe, test, expect } from "bun:test"
import { runCLI, parseJSON } from "./helpers"

// Live smoke tests — hit the public Workday CXS API of the registry companies. Kept to a
// couple of requests. If Workday is unreachable, these surface as failures rather than
// silently passing.
describe("workday CLI live search", () => {
  test("search -q 'engineer' returns real results with the contract shape", async () => {
    const result = await runCLI(["search", "-q", "engineer", "--limit", "6"])
    expect(result.exitCode).toBe(0)
    const out = parseJSON<{ meta: any; results: any[] }>(result)
    expect(out.results.length).toBeGreaterThan(0)
    const r = out.results[0]
    expect(r.id).toBeTruthy()
    expect(r.title).toBeTruthy()
    expect(r.url).toContain("myworkdayjobs.com")
    expect(r.company).toBeTruthy()
    for (const key of ["id", "title", "company", "location", "date", "url"]) {
      expect(key in r).toBe(true)
    }
    expect(out.meta.total).toBeGreaterThan(0)
  })

  test("-c restricts to a single registry company", async () => {
    const result = await runCLI(["search", "-q", "engineer", "-c", "Red Hat", "--limit", "5"])
    const out = parseJSON<{ results: any[] }>(result)
    expect(out.results.length).toBeGreaterThan(0)
    for (const r of out.results) expect(r.company).toBe("Red Hat")
  })

  test("--limit caps the number of results", async () => {
    const result = await runCLI(["search", "-q", "engineer", "--limit", "3"])
    const out = parseJSON<{ results: any[] }>(result)
    expect(out.results.length).toBeLessThanOrEqual(3)
  })
})
