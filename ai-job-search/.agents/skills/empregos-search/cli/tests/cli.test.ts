import { test, expect, describe } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResponse {
  meta: { count: number; page: number }
  results: Array<{
    id: string
    title: string
    company: string | null
    location: string | null
    date: string | null
    url: string
  }>
}

describe("flag validation", () => {
  test("search without --query exits 1 with a JSON error on stderr", async () => {
    const r = await runCLI(["search"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    const err = JSON.parse(r.stderr)
    expect(err.code).toBe("NO_QUERY")
  })

  test("detail without an id exits 1 with a JSON error", async () => {
    const r = await runCLI(["detail"])
    expect(r.exitCode).toBe(1)
    const err = JSON.parse(r.stderr)
    expect(err.code).toBe("NO_ID")
  })

  test("bad --jobage exits 1", async () => {
    const r = await runCLI(["search", "-q", "analista qa", "--jobage", "abc"])
    expect(r.exitCode).toBe(1)
    const err = JSON.parse(r.stderr)
    expect(err.code).toBe("BAD_ARG")
  })

  test("unknown command exits 1", async () => {
    const r = await runCLI(["frobnicate"])
    expect(r.exitCode).toBe(1)
    const err = JSON.parse(r.stderr)
    expect(err.code).toBe("BAD_CMD")
  })
})

describe("live search (smoke)", () => {
  test("search returns real results with populated id/title/url", async () => {
    const r = await runCLI(["search", "-q", "analista qa", "--limit", "5"])
    const data = parseJSON<SearchResponse>(r)
    expect(Array.isArray(data.results)).toBe(true)
    expect(data.results.length).toBeGreaterThan(0)
    const first = data.results[0]!
    expect(first.id).toMatch(/^\d+$/)
    expect(first.title.length).toBeGreaterThan(0)
    expect(first.title).not.toContain("<")
    expect(first.url).toContain("empregos.com.br/vaga/")
  })
})
