import {
  BASE_URL,
  htmlFetch,
  parseJobCards,
  slugify,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/**
 * Build the search URL. Empregos.com.br is path-based:
 *   /vagas/<keyword-slug>                       keyword only
 *   /vagas/<keyword-slug>-em-<location-slug>    keyword + location
 *   /vagas/<...>/<n>                            page n (n >= 2)
 */
export function buildUrl(opts: SearchOpts): string {
  let slug = slugify(opts.query)
  if (opts.location) {
    const locSlug = slugify(opts.location)
    if (locSlug) slug = `${slug}-em-${locSlug}`
  }
  let path = `/vagas/${slug}`
  if (opts.page > 1) path += `/${opts.page}`
  return `${BASE_URL}${path}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const date = c.posted || c.date || "—"
    return `${c.id.padEnd(10)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(10) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(22) +
    " POSTED"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    let cards = parseJobCards(html)

    // Client-side posting-age filter (the site has no age query parameter).
    if (opts.jobage < 9999) {
      cards = cards.filter((c) => c.daysAgo === null || c.daysAgo <= opts.jobage)
    }
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.workplace || "—"} · ${c.posted || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, page: opts.page }, results: cards },
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
