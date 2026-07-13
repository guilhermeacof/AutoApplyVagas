import { test, expect, describe } from "bun:test"
import { slugify, parsePosted, parseJobCards } from "../src/helpers.js"
import { buildUrl } from "../src/commands/search.js"

describe("slugify", () => {
  test("lowercases, strips accents, hyphenates", () => {
    expect(slugify("Analista QA")).toBe("analista-qa")
    expect(slugify("São Paulo SP")).toBe("sao-paulo-sp")
    expect(slugify("  Qualidade  de   Software ")).toBe("qualidade-de-software")
  })
})

describe("parsePosted", () => {
  test("parses 'há N dias'", () => {
    expect(parsePosted("há 58 dias").daysAgo).toBe(58)
    expect(parsePosted("ha 3 dias").daysAgo).toBe(3)
  })
  test("hoje/ontem", () => {
    expect(parsePosted("hoje").daysAgo).toBe(0)
    expect(parsePosted("ontem").daysAgo).toBe(1)
  })
  test("hours count as today", () => {
    expect(parsePosted("há 5 horas").daysAgo).toBe(0)
  })
  test("returns a valid ISO date", () => {
    const r = parsePosted("há 2 dias")
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  test("unrecognized -> nulls", () => {
    expect(parsePosted("nunca").daysAgo).toBeNull()
    expect(parsePosted("nunca").date).toBeNull()
  })
})

describe("buildUrl", () => {
  const base = { jobage: 9999, page: 1, format: "json" as const }
  test("keyword only", () => {
    expect(buildUrl({ ...base, query: "analista qa" })).toBe(
      "https://www.empregos.com.br/vagas/analista-qa",
    )
  })
  test("keyword + location", () => {
    expect(buildUrl({ ...base, query: "analista qa", location: "sao paulo sp" })).toBe(
      "https://www.empregos.com.br/vagas/analista-qa-em-sao-paulo-sp",
    )
  })
  test("pagination appends /n for page >= 2", () => {
    expect(buildUrl({ ...base, query: "analista qa", page: 2 })).toBe(
      "https://www.empregos.com.br/vagas/analista-qa/2",
    )
  })
})

describe("parseJobCards", () => {
  test("parses a synthetic card chunk", () => {
    const html = `
      <div role="button" aria-label="Abrir detalhes da vaga Analista QA Pleno" expand-clickable-area="true">
        <img alt="Logo da empresa Acme Tech">
        <h2><span>Analista QA Pleno</span></h2>
        <img src="location-on-outline.svg"><h3 title="São Paulo, SP">São Paulo, SP</h3>
        <img src="emoji-people.svg"><span>Remoto</span>
        <img src="payments-outline.svg"><h3>R$ 5.000</h3>
        <img src="event-outline.svg"><h3>Publicada há 4 dias</h3>
        <a href="/vaga/12345678/analista-qa-pleno-em-sao-paulo-sp">Mais detalhes</a>
      </div>`
    const cards = parseJobCards(html)
    expect(cards.length).toBe(1)
    const c = cards[0]!
    expect(c.id).toBe("12345678")
    expect(c.title).toBe("Analista QA Pleno")
    expect(c.company).toBe("Acme Tech")
    expect(c.location).toBe("São Paulo, SP")
    expect(c.workplace).toBe("Remoto")
    expect(c.salary).toBe("R$ 5.000")
    expect(c.daysAgo).toBe(4)
    expect(c.url).toBe("https://www.empregos.com.br/vaga/12345678/analista-qa-pleno-em-sao-paulo-sp")
  })
})
