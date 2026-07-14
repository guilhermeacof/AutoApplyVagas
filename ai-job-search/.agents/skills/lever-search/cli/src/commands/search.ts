import {
  API_BASE,
  jsonFetch,
  mapCard,
  matchesLocation,
  matchesQuery,
  parsePostings,
  withinDays,
  writeError,
  type JobCard,
} from "../helpers.js"
import { COMPANIES, findCompany, type Company } from "../companies.js"

export interface SearchOpts {
  query?: string
  location?: string
  /** Restrict to a single Lever token; undefined = all companies in the registry. */
  company?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

interface CompanyResult {
  company: Company
  cards: JobCard[]
  error?: string
}

/** Fetch one company's board. Never throws — failures are captured per company. */
async function fetchCompany(company: Company): Promise<CompanyResult> {
  try {
    const payload = await jsonFetch(`${API_BASE}/${company.token}?mode=json`)
    const cards = parsePostings(payload).map((p) => mapCard(company, p))
    return { company, cards }
  } catch (e) {
    return { company, cards: [], error: e instanceof Error ? e.message : String(e) }
  }
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "Nenhum resultado."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 14).padEnd(14)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const date = (c.date || "—").slice(0, 10)
    return `${title} ${company} ${loc} ${date}`
  })
  const header =
    "TITLE".padEnd(42) + " " + "COMPANY".padEnd(14) + " " + "LOCATION".padEnd(24) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    let targets: Company[]
    if (opts.company) {
      const c = findCompany(opts.company)
      if (!c) {
        writeError(
          `Empresa "${opts.company}" não está no registro. Use o comando "company" para ver os tokens disponíveis.`,
          "UNKNOWN_COMPANY",
        )
        return 1
      }
      targets = [c]
    } else {
      targets = COMPANIES
    }

    // One request per company (see personal-use / low-volume note in SKILL.md).
    const results = await Promise.all(targets.map(fetchCompany))
    const errors = results
      .filter((r) => r.error)
      .map((r) => ({ token: r.company.token, error: r.error }))

    let cards = results.flatMap((r) => r.cards)
    cards = cards.filter((c) => matchesQuery(c.title, opts.query))
    cards = cards.filter((c) => matchesLocation(c.location, opts.location))
    cards = withinDays(cards, opts.jobage)
    // Newest first; nulls last.
    cards.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0))

    const total = cards.length
    let paged = cards
    if (opts.limit !== undefined && opts.limit >= 0) {
      const start = (opts.page - 1) * opts.limit
      paged = cards.slice(start, start + opts.limit)
    }

    if (opts.format === "table") {
      process.stdout.write(renderTable(paged) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        paged
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.commitment || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: paged.length,
              total,
              page: opts.page,
              limit: opts.limit ?? null,
              companies: targets.length,
              tokens: targets.map((c) => c.token),
              ...(errors.length ? { errors } : {}),
            },
            results: paged,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
