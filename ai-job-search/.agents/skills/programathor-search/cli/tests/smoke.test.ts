import { test, expect } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResult {
  meta: { count: number; page: number; source: string }
  results: Array<{
    id: string
    title: string | null
    company: string | null
    location: string | null
    date: string | null
    url: string
  }>
}

test("search returns real results with populated id/title/url", async () => {
  const res = await runCLI(["search", "-q", "desenvolvedor", "--limit", "5"])
  expect(res.exitCode).toBe(0)
  const data = parseJSON<SearchResult>(res)
  expect(Array.isArray(data.results)).toBe(true)
  expect(data.results.length).toBeGreaterThan(0)
  const first = data.results[0]
  expect(first.id).toMatch(/^\d+$/)
  expect(first.title && first.title.length).toBeTruthy()
  expect(first.url).toContain("programathor.com.br/jobs/")
}, 30000)

test("detail returns a readable description for a searched id", async () => {
  const search = await runCLI(["search", "-q", "desenvolvedor", "--limit", "1"])
  const data = parseJSON<SearchResult>(search)
  const id = data.results[0].id
  const res = await runCLI(["detail", id, "--format", "plain"])
  expect(res.exitCode).toBe(0)
  expect(res.stdout.length).toBeGreaterThan(50)
  expect(res.stdout).not.toContain("<")
}, 30000)

test("missing detail id exits 1 with a JSON error on stderr", async () => {
  const res = await runCLI(["detail"])
  expect(res.exitCode).toBe(1)
  expect(res.stdout).toBe("")
  const err = JSON.parse(res.stderr)
  expect(err.code).toBe("NO_ID")
})

test("unknown command exits 1 with a JSON error on stderr", async () => {
  const res = await runCLI(["frobnicate"])
  expect(res.exitCode).toBe(1)
  const err = JSON.parse(res.stderr)
  expect(err.code).toBe("BAD_CMD")
})
