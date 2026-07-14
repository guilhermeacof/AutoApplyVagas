import { describe, test, expect } from "bun:test"
import {
  mapCard,
  mapDetail,
  htmlToText,
  matchesQuery,
  matchesLocation,
  parseCompositeId,
  parsePostings,
  withinDays,
  type RawPosting,
} from "../src/helpers"
import type { Company } from "../src/companies"

const company: Company = { token: "neon", name: "Neon" }

const sample: RawPosting = {
  id: "a053e021-e712-453c-9f8b-2e3194f5e7e9",
  text: "Software Engineer - Backend",
  categories: {
    commitment: "CLT",
    department: "Engineering",
    location: "Remoto",
    team: "Platform",
  },
  createdAt: 1783105404121,
  hostedUrl: "https://jobs.lever.co/neon/a053e021-e712-453c-9f8b-2e3194f5e7e9",
  applyUrl: "https://jobs.lever.co/neon/a053e021-e712-453c-9f8b-2e3194f5e7e9/apply",
  workplaceType: "remote",
  descriptionPlain: "Build great things.",
  description: "<p>Build <b>great</b> things.</p>",
  lists: [{ text: "Requirements", content: "<ul><li>Node</li><li>Caf&#233;</li></ul>" }],
}

describe("mapCard", () => {
  test("builds composite id and core fields", () => {
    const c = mapCard(company, sample)
    expect(c.id).toBe("neon:a053e021-e712-453c-9f8b-2e3194f5e7e9")
    expect(c.title).toBe("Software Engineer - Backend")
    expect(c.company).toBe("Neon")
    expect(c.location).toBe("Remoto")
    expect(c.commitment).toBe("CLT")
    expect(c.url).toBe("https://jobs.lever.co/neon/a053e021-e712-453c-9f8b-2e3194f5e7e9")
  })

  test("createdAt ms becomes an ISO date string", () => {
    expect(mapCard(company, sample).date).toBe(new Date(1783105404121).toISOString())
  })

  test("missing values become null, never omitted", () => {
    const c = mapCard(company, { id: "x1" })
    expect(c.title).toBeNull()
    expect(c.location).toBeNull()
    expect(c.date).toBeNull()
    for (const key of ["id", "title", "company", "location", "date", "url"]) {
      expect(key in c).toBe(true)
    }
  })
})

describe("mapDetail", () => {
  test("prefers descriptionPlain and decodes list entities", () => {
    const d = mapDetail(company, sample)
    expect(d.description).toBe("Build great things.")
    expect(d.lists[0].text).toBe("Requirements")
    expect(d.lists[0].content).toContain("Café")
    expect(d.lists[0].content).not.toContain("<")
    expect(d.applyUrl).toContain("/apply")
  })

  test("falls back to stripping HTML when no plain text", () => {
    const d = mapDetail(company, { ...sample, descriptionPlain: null })
    expect(d.description).toContain("Build")
    expect(d.description).not.toContain("<")
  })
})

describe("htmlToText", () => {
  test("decodes hex numeric entities", () => {
    expect(htmlToText("Caf&#xE9;")).toBe("Café")
  })
  test("returns null for empty/undefined input", () => {
    expect(htmlToText(null)).toBeNull()
    expect(htmlToText("")).toBeNull()
  })
})

describe("matchesQuery (per-word AND)", () => {
  test("single short term matches case-insensitively", () => {
    expect(matchesQuery("Software Engineer", "engineer")).toBe(true)
    expect(matchesQuery("Analista de QA", "qa")).toBe(true)
  })
  test("all terms must be present", () => {
    expect(matchesQuery("Backend Engineer", "backend engineer")).toBe(true)
    expect(matchesQuery("Backend Engineer", "backend frontend")).toBe(false)
  })
  test("empty query matches everything", () => {
    expect(matchesQuery("anything", undefined)).toBe(true)
    expect(matchesQuery(null, "")).toBe(true)
  })
})

describe("matchesLocation", () => {
  test("substring, case-insensitive", () => {
    expect(matchesLocation("São Paulo, SP", "são paulo")).toBe(true)
    expect(matchesLocation("Remoto", "remoto")).toBe(true)
    expect(matchesLocation("São Paulo", "rio")).toBe(false)
  })
  test("empty filter matches everything", () => {
    expect(matchesLocation(null, undefined)).toBe(true)
  })
})

describe("parseCompositeId", () => {
  test("parses token:id", () => {
    expect(parseCompositeId("neon:abc-123")).toEqual({ token: "neon", id: "abc-123" })
  })
  test("parses a hosted URL", () => {
    expect(
      parseCompositeId("https://jobs.lever.co/cloudwalk/a053e021-e712-453c-9f8b-2e3194f5e7e9"),
    ).toEqual({ token: "cloudwalk", id: "a053e021-e712-453c-9f8b-2e3194f5e7e9" })
  })
  test("returns null when unparseable", () => {
    expect(parseCompositeId("nonsense")).toBeNull()
  })
})

describe("parsePostings", () => {
  test("returns the array as-is", () => {
    expect(parsePostings([sample])).toHaveLength(1)
  })
  test("tolerates a non-array payload", () => {
    expect(parsePostings(null)).toEqual([])
    expect(parsePostings({})).toEqual([])
  })
})

describe("withinDays", () => {
  test("keeps recent, drops old", () => {
    const recent = mapCard(company, { ...sample, id: "1", createdAt: Date.now() })
    const old = mapCard(company, { ...sample, id: "2", createdAt: 946684800000 })
    const kept = withinDays([recent, old], 7)
    expect(kept.map((c) => c.id)).toEqual(["neon:1"])
  })
  test("days=9999 keeps everything", () => {
    const old = mapCard(company, { ...sample, id: "2", createdAt: 946684800000 })
    expect(withinDays([old], 9999)).toHaveLength(1)
  })
})
