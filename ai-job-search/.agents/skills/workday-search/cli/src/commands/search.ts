import {
  searchUrl,
  postJson,
  mapPostings,
  writeError,
  PAGE_SIZE,
  type JobCard,
  type SearchResponse,
} from "../helpers.js"
import { COMPANIES, findCompany, type Company } from "../companies.js"

export interface SearchOpts {
  query?: string
  location?: string
  company?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/** Hard cap on CXS requests per company, to keep volume low. */
const MAX_REQS_PER_COMPANY = 5

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "Nenhum resultado."
  const rows = cards.map((c) => {
    const company = (c.company || "—").slice(0, 12).padEnd(12)
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const date = (c.date || c.postedRaw || "—").slice(0, 16)
    return `${company} ${title} ${loc} ${date}`
  })
  const header =
    "COMPANY".padEnd(12) + " " + "TITLE".padEnd(40) + " " + "LOCATION".padEnd(24) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

/** Fetch a company's cards up to `want` matches, paging the CXS endpoint. */
async function fetchCompany(c: Company, opts: SearchOpts, want: number): Promise<{ cards: JobCard[]; total: number }> {
  const collected: JobCard[] = []
  let total = 0
  const now = new Date()
  for (let req = 0; req < MAX_REQS_PER_COMPANY; req++) {
    const offset = req * PAGE_SIZE
    const data = await postJson<SearchResponse>(searchUrl(c), {
      appliedFacets: {},
      limit: PAGE_SIZE,
      offset,
      searchText: opts.query ?? "",
    })
    if (!data) break
    // Workday reports the real `total` only on the offset=0 response; paginated
    // responses (offset>0) come back with total:0. Keep the largest seen.
    if (typeof data.total === "number" && data.total > total) total = data.total
    let cards = mapPostings(data, c, now)
    // Client-side location filter (Workday's location facet needs opaque ids; a
    // substring match on locationsText is simpler and good enough).
    if (opts.location) {
      const needle = opts.location.toLowerCase()
      cards = cards.filter((x) => (x.location || "").toLowerCase().includes(needle))
    }
    // Client-side job-age filter over the parsed posting date.
    if (opts.jobage < 9999) {
      const cutoff = now.getTime() - opts.jobage * 86400_000
      cards = cards.filter((x) => {
        if (!x.date) return true // keep undated cards rather than drop silently
        const t = Date.parse(x.date)
        return isNaN(t) ? true : t >= cutoff
      })
    }
    collected.push(...cards)
    const returned = data.jobPostings?.length ?? 0
    if (returned < PAGE_SIZE) break // exhausted this company
    if (collected.length >= want) break
  }
  return { cards: collected, total }
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    let targets: Company[] = COMPANIES
    if (opts.company) {
      const found = findCompany(opts.company)
      if (!found) {
        writeError(
          `Empresa "${opts.company}" não está no registro. Conhecidas: ${COMPANIES.map((c) => c.name).join(", ")}`,
          "UNKNOWN_COMPANY",
        )
        return 1
      }
      targets = [found]
    }

    const perPage = opts.limit ?? PAGE_SIZE
    const want = opts.page * perPage // aggregate enough to reach the requested page window

    const perCompany: JobCard[][] = []
    const totals: Record<string, number> = {}
    let grandTotal = 0
    for (const c of targets) {
      const { cards, total } = await fetchCompany(c, opts, Math.ceil(want / targets.length) + PAGE_SIZE)
      perCompany.push(cards)
      totals[c.name] = total
      grandTotal += total
    }

    // Round-robin interleave so the aggregated view surfaces every company, not just
    // whichever tenant happened to be fetched first.
    const all: JobCard[] = []
    const maxLen = Math.max(0, ...perCompany.map((l) => l.length))
    for (let i = 0; i < maxLen; i++) {
      for (const list of perCompany) {
        if (i < list.length) all.push(list[i])
      }
    }

    // Page window over the aggregated stream.
    const start = (opts.page - 1) * perPage
    const windowed = all.slice(start, start + perPage)

    if (opts.format === "table") {
      process.stdout.write(renderTable(windowed) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        windowed
          .map(
            (c) =>
              `${c.title}\n  ${c.company} · ${c.location || "—"} · ${c.date || c.postedRaw || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: windowed.length,
              page: opts.page,
              limit: perPage,
              total: grandTotal,
              companies: totals,
            },
            results: windowed.map(({ postedRaw, externalPath, ...r }) => r),
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
