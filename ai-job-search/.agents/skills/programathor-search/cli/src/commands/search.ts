import {
  SITE,
  htmlFetch,
  parseJobCards,
  makeQueryFilter,
  slugify,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  tech?: string
  location?: string
  remote?: boolean
  contract?: string
  seniority?: string
  includeExpired?: boolean
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/** Max listing pages to crawl in the client-side fallback (keeps volume low). */
const MAX_FALLBACK_PAGES = 8

function buildUrl(route: string, opts: SearchOpts, page: number): string {
  const params = new URLSearchParams()
  if (opts.location) params.set("place", opts.location)
  if (opts.remote) params.set("remoto", "true")
  if (opts.contract) params.set("contract_type", opts.contract)
  if (opts.seniority) params.set("expertise", opts.seniority)
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return `${SITE}${route}${qs ? `?${qs}` : ""}`
}

async function fetchPage(route: string, opts: SearchOpts, page: number): Promise<JobCard[]> {
  const html = await htmlFetch(buildUrl(route, opts, page))
  return html ? parseJobCards(html) : []
}

function keep(cards: JobCard[], opts: SearchOpts): JobCard[] {
  return opts.includeExpired ? cards : cards.filter((c) => !c.expired)
}

/**
 * Client-side keyword fallback: crawl the general `/jobs` listing, filter each
 * page by the query, and window to the requested page/limit. Used when the
 * native tech route (`/jobs-<slug>`) yields nothing (e.g. role queries).
 */
async function fallbackFilter(opts: SearchOpts): Promise<JobCard[]> {
  const match = makeQueryFilter(opts.query!)
  const effLimit = opts.limit ?? 15
  const need = opts.page * effLimit
  const matched: JobCard[] = []
  for (let p = 1; p <= MAX_FALLBACK_PAGES; p++) {
    const cards = await fetchPage("/jobs", opts, p)
    if (cards.length === 0) break
    matched.push(...keep(cards, opts).filter(match))
    if (matched.length >= need) break
    if (cards.length < 15) break // last page reached (raw count)
  }
  const start = (opts.page - 1) * effLimit
  return opts.limit != null
    ? matched.slice(start, start + opts.limit)
    : matched.slice(start, start + effLimit)
}

async function collect(opts: SearchOpts): Promise<{ cards: JobCard[]; source: string }> {
  // Explicit tech route wins.
  if (opts.tech) {
    const cards = keep(await fetchPage(`/jobs-${opts.tech}`, opts, opts.page), opts)
    return { cards: applyLimit(cards, opts.limit), source: "tech" }
  }
  // Free-text query: try Programathor's own tech route first (server-side), then
  // fall back to client-side keyword filtering over the general listing.
  if (opts.query) {
    const native = keep(await fetchPage(`/jobs-${slugify(opts.query)}`, opts, opts.page), opts)
    if (native.length > 0) return { cards: applyLimit(native, opts.limit), source: "tech-route" }
    if (opts.page === 1) return { cards: await fallbackFilter(opts), source: "filter" }
    return { cards: [], source: "tech-route" }
  }
  // No query: just fetch the requested page of the general listing.
  const cards = keep(await fetchPage("/jobs", opts, opts.page), opts)
  return { cards: applyLimit(cards, opts.limit), source: "listing" }
}

function applyLimit(cards: JobCard[], limit?: number): JobCard[] {
  return limit != null && limit >= 0 ? cards.slice(0, limit) : cards
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "Nenhum resultado."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const lvl = (c.seniority || "—").slice(0, 8)
    return `${c.id.padEnd(7)} ${title} ${company} ${loc} ${lvl}`
  })
  const header =
    "ID".padEnd(7) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(22) +
    " LEVEL"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const { cards, source } = await collect(opts)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        (cards.length
          ? cards
              .map(
                (c) =>
                  `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.contract || "—"} · ${c.salary || "—"}\n  id: ${c.id}\n  ${c.url}`,
              )
              .join("\n\n")
          : "Nenhum resultado.") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: { count: cards.length, page: opts.page, source },
            results: cards,
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
