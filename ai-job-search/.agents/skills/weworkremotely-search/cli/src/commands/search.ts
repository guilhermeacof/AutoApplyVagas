import {
  CATEGORIES,
  FEED_BASE,
  textFetch,
  parseItems,
  mapCard,
  matchesQuery,
  dedupe,
  withinDays,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const PAGE_SIZE = 25

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const id = (c.id || "").slice(0, 30).padEnd(30)
    const title = (c.title || "").slice(0, 38).padEnd(38)
    const company = (c.company || "—").slice(0, 20).padEnd(20)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const date = (c.date || "—").slice(0, 10)
    return `${id} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(30) +
    " " +
    "TITLE".padEnd(38) +
    " " +
    "COMPANY".padEnd(20) +
    " " +
    "LOCATION".padEnd(22) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    // Fetch each category feed and combine. A failing individual feed should not
    // abort the whole search — collect what we can.
    const all: JobCard[] = []
    for (const cat of CATEGORIES) {
      const xml = await textFetch(`${FEED_BASE}/${cat}.rss`)
      const cards = parseItems(xml).map(mapCard).filter((c) => c.id)
      all.push(...cards)
    }

    let cards = dedupe(all)
    cards = cards.filter((c) => matchesQuery(c, opts.query))
    cards = withinDays(cards, opts.jobage)

    const total = cards.length
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const start = (opts.page - 1) * PAGE_SIZE
    let paged = cards.slice(start, start + PAGE_SIZE)
    if (opts.limit !== undefined && opts.limit >= 0) paged = paged.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(paged) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        paged
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: paged.length,
              page: opts.page,
              total,
              total_pages: totalPages,
              per_page: PAGE_SIZE,
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
