import {
  API_BASE,
  buildSearchBody,
  jsonPost,
  mapCard,
  matchesLocation,
  parseSearchResponse,
  resolveCompanyId,
  withinDays,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  board: string
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
    const id = (c.id || "").slice(0, 14).padEnd(14)
    const title = (c.title || "").slice(0, 38).padEnd(38)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const date = (c.date || "—").slice(0, 10)
    return `${id} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(14) +
    " " +
    "TITLE".padEnd(38) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(24) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const companyId = await resolveCompanyId(opts.board)
    if (!companyId) {
      writeError(
        `Board "${opts.board}" não encontrado em jobs.compleo.app (verifique o uniqueLink)`,
        "BOARD_NOT_FOUND",
      )
      return 1
    }

    // Ask the API for enough rows to honor --limit after client-side filtering.
    const pageSize = Math.min(Math.max(opts.limit ?? 10, 10), 50)
    const body = buildSearchBody({
      companyId,
      query: opts.query,
      page: opts.page,
      pageSize,
    })
    const payload = await jsonPost(`${API_BASE}/${opts.board.toUpperCase()}`, body)
    const parsed = parseSearchResponse(payload)

    let cards = parsed.jobs.map((j) => mapCard(j, opts.board))
    cards = matchesLocation(cards, opts.location)
    cards = withinDays(cards, opts.jobage)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.workingModel || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
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
              total: parsed.total,
              per_page: pageSize,
              board: opts.board,
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
