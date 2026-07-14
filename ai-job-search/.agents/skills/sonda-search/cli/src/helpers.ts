// Data source: SONDA's careers site (https://carrera.sonda.com), a SAP
// SuccessFactors ("Recruiting"/RMK) career site. The search results page and the
// job-detail page are BOTH server-rendered HTML (HTTP 200, no auth), so we parse
// them with regex in per-card chunks — no headless browser, zero runtime deps.
//
// SuccessFactors is a reusable pattern: dozens of large employers run the exact
// same career-site software. The anchors below (`tr.data-row`, `a.jobTitle-link`,
// `span.jobLocation`, `itemprop="description"`, the `span.jobdescription` block)
// are SF conventions, not SONDA-specific. To retarget this to another SF employer,
// change BASE / COMPANY and, if needed, the facet parameter names.

/** Base career-site host. Change this to retarget the skill to another SF site. */
export const BASE = "https://carrera.sonda.com"
export const SEARCH_URL = `${BASE}/search/`
/** SuccessFactors serves up to 100 job cards per results page (counted from the live
 *  page: startrow=0 returns rows 1–100, startrow=100 returns 101–onward). */
export const PAGE_SIZE = 100
/** This skill is SONDA-focused: `company` is always this. */
export const COMPANY = "SONDA"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,es;q=0.8,en;q=0.7",
      },
      redirect: "follow",
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string | null
  company: string
  location: string | null
  department: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  applyUrl: string
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points decode correctly, and drops
 * out-of-range values instead of throwing.
 */
function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** Collapse a snippet of inline HTML to clean, entity-decoded text. */
export function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** Strip a rich HTML block to readable text, preserving paragraph/line breaks. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = String(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/** Build the search URL. Location maps to the SF `optionsFacetsDD_location` facet. */
export function buildSearchUrl(opts: {
  query?: string
  location?: string
  page: number
}): string {
  const params = new URLSearchParams()
  params.set("q", opts.query ?? "")
  if (opts.location) params.set("optionsFacetsDD_location", opts.location)
  const startrow = Math.max(0, (opts.page - 1) * PAGE_SIZE)
  if (startrow > 0) params.set("startrow", String(startrow))
  return `${SEARCH_URL}?${params.toString()}`
}

/**
 * Parse the SuccessFactors results table. Each posting is a `<tr class="data-row">`;
 * we split on that boundary and parse each row independently so one malformed card
 * cannot break the rest. SONDA's results page carries no posting date, so `date`
 * is always null here (the detail page does expose `datePosted`).
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/<tr[^>]*\bclass="[^"]*\bdata-row\b[^"]*"[^>]*>/i).slice(1)

  for (const chunk of chunks) {
    // First job anchor: href="/job/<slug>/<id>/". Attribute order varies between
    // the desktop and mobile copies of the tile, so match href independently.
    const hrefMatch = chunk.match(/href="(\/job\/[^"]*?\/(\d+)\/?)"/i)
    if (!hrefMatch) continue
    const id = hrefMatch[2]
    const url = BASE + decodeHtmlEntities(hrefMatch[1])

    const titleMatch = chunk.match(/class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i)
    const title = titleMatch ? clean(titleMatch[1]) || null : null
    if (!title) continue

    // Location + department live in their own columns; scope to the column so we
    // don't pick up the hidden mobile duplicate that sits inside the title cell.
    const locMatch = chunk.match(
      /colLocation[\s\S]*?<span class="jobLocation">([\s\S]*?)<\/span>/i,
    )
    const location = locMatch ? clean(locMatch[1]) || null : null

    const depMatch = chunk.match(
      /colDepartment[\s\S]*?<span class="jobDepartment">([\s\S]*?)<\/span>/i,
    )
    const department = depMatch ? clean(depMatch[1]) || null : null

    results.push({
      id,
      title,
      company: COMPANY,
      location,
      department,
      date: null,
      url,
    })
  }

  return results
}

/**
 * Total result count from the SuccessFactors pagination label
 * ("Resultados 1 – 40 de 40" / aria "resultados 1 a 40 de 40"). Returns null if
 * the page markup changes and no count can be read.
 */
export function parseTotal(html: string): number | null {
  const aria = html.match(/resultados\s+\d+\s+a\s+\d+\s+de\s+([\d.,]+)/i)
  if (aria) return toInt(aria[1])
  const label = html.match(/class="paginationLabel"[^>]*>([\s\S]*?)<\/span>/i)
  if (label) {
    const m = clean(label[1]).match(/de\s+([\d.,]+)\s*$/i)
    if (m) return toInt(m[1])
  }
  return null
}

function toInt(s: string): number | null {
  const n = parseInt(s.replace(/[.,]/g, ""), 10)
  return isNaN(n) ? null : n
}

/**
 * Extract the content of the first balanced `<span class="jobdescription">...</span>`.
 * The job ad contains nested `<span>`s, so a lazy regex would stop early — we walk
 * `<span>` / `</span>` tokens and cut at the point the opening span closes.
 */
export function extractDescriptionHtml(html: string): string | null {
  const open = html.search(/<span[^>]*\bclass="jobdescription"[^>]*>/i)
  if (open < 0) return null
  const startTag = html.slice(open).match(/^<span[^>]*>/i)
  if (!startTag) return null
  const contentStart = open + startTag[0].length
  const tokenRe = /<span\b[^>]*>|<\/span>/gi
  tokenRe.lastIndex = contentStart
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(html)) !== null) {
    if (m[0].toLowerCase().startsWith("</span")) {
      depth--
      if (depth === 0) return html.slice(contentStart, m.index)
    } else {
      depth++
    }
  }
  return html.slice(contentStart)
}

/** Extract a `content="..."` value from a microdata `<meta itemprop="name">` tag. */
function metaProp(html: string, prop: string): string | null {
  const m = html.match(
    new RegExp(`itemprop="${prop}"[^>]*content="([^"]*)"`, "i"),
  )
  return m ? clean(m[1]) || null : null
}

/**
 * Parse a SuccessFactors job-detail page. Title comes from the
 * `itemprop="title"` span; location/date/company from the microdata `<meta>` tags;
 * the description from the balanced `span.jobdescription` block.
 */
export function parseJobDetail(html: string, id: string, url: string): JobDetail {
  const titleMatch = html.match(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i)
  const title = titleMatch ? clean(titleMatch[1]) || null : null

  const locality = metaProp(html, "addressLocality")
  const region = metaProp(html, "addressRegion")
  const country = metaProp(html, "addressCountry")
  const location =
    [locality, region, country].filter((p) => p).join(", ") || null

  const date = metaProp(html, "datePosted")
  const employmentType = metaProp(html, "employmentType")

  const description = htmlToText(extractDescriptionHtml(html))

  return {
    id,
    title,
    company: COMPANY,
    location,
    department: null,
    date,
    url,
    description,
    employmentType,
    applyUrl: url,
  }
}

/**
 * Resolve a bare id, a job URL, or a job slug to `{ id, url }`. When only an id is
 * given we can still fetch: SuccessFactors accepts `/job/x/<id>/` with any slug.
 */
export function normalizeId(input: string): { id: string; url: string } | null {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/job\/([^/]+)\/(\d+)\/?/i)
  if (urlMatch) {
    return { id: urlMatch[2], url: `${BASE}/job/${urlMatch[1]}/${urlMatch[2]}/` }
  }
  const bare = trimmed.match(/^(\d{4,})$/)
  if (bare) return { id: bare[1], url: `${BASE}/job/x/${bare[1]}/` }
  const anyNum = trimmed.match(/(\d{4,})/)
  if (anyNum) return { id: anyNum[1], url: `${BASE}/job/x/${anyNum[1]}/` }
  return null
}

/** Client-side posting-age filter. SONDA's list has no dates, so this only ever
 *  filters `detail`-sourced cards; list cards (date=null) are always kept. */
export function withinDays(cards: JobCard[], days: number): JobCard[] {
  if (!days || days <= 0 || days >= 9999) return cards
  const cutoff = Date.now() - days * 86400_000
  return cards.filter((c) => {
    if (!c.date) return true
    const t = Date.parse(c.date)
    return isNaN(t) ? true : t >= cutoff
  })
}
