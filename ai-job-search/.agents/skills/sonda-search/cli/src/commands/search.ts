import {
  buildSearchUrl,
  htmlFetch,
  parseJobCards,
  parseTotal,
  withinDays,
  writeError,
  PAGE_SIZE,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "Nenhum resultado."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 44).padEnd(44)
    const loc = (c.location || "—").slice(0, 28).padEnd(28)
    const dep = (c.department || "—").slice(0, 20)
    return `${c.id.padEnd(12)} ${title} ${loc} ${dep}`
  })
  const header =
    "ID".padEnd(12) + " " + "TITLE".padEnd(44) + " " + "LOCATION".padEnd(28) + " DEPARTMENT"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildSearchUrl(opts))
    const total = parseTotal(html)
    let cards = parseJobCards(html)
    cards = withinDays(cards, opts.jobage)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company} · ${c.location || "—"} · ${c.department || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: cards.length,
              page: opts.page,
              total,
              per_page: PAGE_SIZE,
            },
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
