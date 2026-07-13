import { test, expect } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResult {
  meta: { count: number; page: number; total: number | null }
  results: Array<{ id: string; title: string | null; company: string | null; url: string }>
}

test("search returns real results with id/title/url", async () => {
  // "engineer" is broad enough to reliably match curated Remotive titles.
  const res = await runCLI(["search", "-q", "engineer", "--limit", "5"])
  const data = parseJSON<SearchResult>(res)
  expect(Array.isArray(data.results)).toBe(true)
  expect(data.results.length).toBeGreaterThan(0)
  const first = data.results[0]
  expect(first.id).toBeTruthy()
  expect(first.title).toBeTruthy()
  expect(first.url).toContain("remotive.com")
}, 30000)

test("table format renders a header", async () => {
  const res = await runCLI(["search", "-q", "developer", "--limit", "3", "--format", "table"])
  expect(res.exitCode).toBe(0)
  expect(res.stdout).toContain("TITLE")
}, 30000)

test("bogus flag value exits 1 with JSON error on stderr", async () => {
  const res = await runCLI(["search", "--limit", "abc"])
  expect(res.exitCode).toBe(1)
  expect(res.stderr).toContain("BAD_ARG")
}, 30000)

test("detail requires an id", async () => {
  const res = await runCLI(["detail"])
  expect(res.exitCode).toBe(1)
  expect(res.stderr).toContain("NO_ID")
}, 30000)
