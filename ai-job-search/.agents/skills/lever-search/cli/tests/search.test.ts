import { afterEach, describe, expect, test } from "bun:test"
import { runSearch } from "../src/commands/search"

const originalFetch = globalThis.fetch
const originalStdoutWrite = process.stdout.write

function posting(id: string, text: string, location: string, createdAt: number) {
  return {
    id,
    text,
    categories: { commitment: "CLT", location, team: "T", department: "D" },
    createdAt,
    hostedUrl: `https://jobs.lever.co/x/${id}`,
    workplaceType: "remote",
  }
}

/** Mock every Lever board request to return one posting per company. */
function mockBoards() {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url)
    // One posting whose title contains "Engineer" and one that does not.
    const body = [
      posting("eng-1", "Software Engineer", "Remoto", Date.now()),
      posting("mkt-1", "Analista de Marketing", "São Paulo, SP", 946684800000),
    ]
    if (!u.includes("mode=json")) return new Response("[]")
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
  process.stdout.write = originalStdoutWrite
})

function captureStdout(): () => string {
  let stdout = ""
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString()
    return true
  }) as typeof process.stdout.write
  return () => stdout
}

describe("runSearch (aggregation + contract)", () => {
  test("query filters per word across companies", async () => {
    mockBoards()
    const get = captureStdout()
    const code = await runSearch({ query: "engineer", jobage: 9999, page: 1, format: "json" })
    expect(code).toBe(0)
    const out = JSON.parse(get())
    // Only the "Software Engineer" postings survive, one per registry company.
    expect(out.results.length).toBeGreaterThanOrEqual(1)
    for (const r of out.results) {
      expect(r.title).toBe("Software Engineer")
      expect(r.id).toMatch(/^[^:]+:eng-1$/)
      for (const key of ["id", "title", "company", "location", "date", "url"]) {
        expect(key in r).toBe(true)
      }
    }
    expect(out.meta.companies).toBeGreaterThanOrEqual(1)
  })

  test("--company restricts to one token", async () => {
    mockBoards()
    const get = captureStdout()
    const code = await runSearch({
      company: "neon",
      jobage: 9999,
      page: 1,
      format: "json",
    })
    expect(code).toBe(0)
    const out = JSON.parse(get())
    expect(out.meta.tokens).toEqual(["neon"])
    for (const r of out.results) expect(r.id.startsWith("neon:")).toBe(true)
  })

  test("--limit 0 emits zero results", async () => {
    mockBoards()
    const get = captureStdout()
    const code = await runSearch({ jobage: 9999, page: 1, limit: 0, format: "json" })
    expect(code).toBe(0)
    expect(JSON.parse(get()).results).toHaveLength(0)
  })

  test("location filter matches categories.location", async () => {
    mockBoards()
    const get = captureStdout()
    const code = await runSearch({
      location: "são paulo",
      jobage: 9999,
      page: 1,
      format: "json",
    })
    expect(code).toBe(0)
    const out = JSON.parse(get())
    for (const r of out.results) expect(r.location.toLowerCase()).toContain("são paulo")
  })
})
