import {
  API_URL,
  jsonFetch,
  parseJobs,
  matchesQuery,
  mapCard,
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

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "Nenhum resultado."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const date = (c.date || "—").slice(0, 10)
    return `${c.id.padEnd(8)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(8) + " " + "TITLE".padEnd(40) + " " + "COMPANY".padEnd(22) + " " + "LOCATION".padEnd(20) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    // Pass the query along (harmless) even though Remotive currently ignores it —
    // the real filtering happens client-side over the returned feed.
    const url = opts.query ? `${API_URL}?search=${encodeURIComponent(opts.query)}` : API_URL
    const payload = await jsonFetch(url)
    const jobs = parseJobs(payload).filter((o) => matchesQuery(o, opts.query))
    const cards = withinDays(jobs.map(mapCard), opts.jobage)

    const total = cards.length
    const perPage = opts.limit && opts.limit > 0 ? opts.limit : 25
    const start = (opts.page - 1) * perPage
    const pageCards = cards.slice(start, start + perPage)

    if (opts.format === "table") {
      process.stdout.write(renderTable(pageCards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        pageCards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.salary || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: pageCards.length,
              page: opts.page,
              total,
              total_pages: Math.max(1, Math.ceil(total / perPage)),
              per_page: perPage,
            },
            results: pageCards,
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
