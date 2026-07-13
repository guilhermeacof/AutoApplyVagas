// Data source: Programathor (https://programathor.com.br), a Brazilian job board for
// developer / tech roles (many remote). The public listing pages are server-rendered
// HTML — the job cards are in the markup — so this CLI parses them with regex, splitting
// the page into per-card chunks and parsing each independently (one malformed card can
// never break the rest). No authentication and zero runtime dependencies: it runs with
// just `bun`.

export const SITE = "https://programathor.com.br"

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
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
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
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  seniority: string | null
  contract: string | null
  companySize: string | null
  remote: boolean | null
  expired: boolean
  tags: string[]
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  validThrough: string | null
  applyUrl: string | null
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points (e.g. emoji) decode
 * correctly, and drops out-of-range values instead of throwing.
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

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** Fold accents + lowercase for accent-insensitive matching. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Turn a free-text query into a Programathor tech-route slug. */
export function slugify(q: string): string {
  return fold(q)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const STOPWORDS = new Set(["de", "da", "do", "e", "a", "o", "para", "com", "em", "no", "na"])

/**
 * Client-side keyword predicate used when the native tech route returns nothing
 * (e.g. role queries like "desenvolvedor"). All non-stopword tokens must appear
 * (accent-insensitive substring) in the card's title/tags/company/level text.
 */
export function makeQueryFilter(query: string): (c: JobCard) => boolean {
  const tokens = fold(query)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  if (tokens.length === 0) return () => true
  return (c: JobCard) => {
    const hay = fold(
      [c.title, c.company, c.location, c.seniority, c.contract, ...c.tags]
        .filter(Boolean)
        .join(" "),
    )
    return tokens.every((t) => hay.includes(t))
  }
}

/** Pull the text after a FontAwesome icon span inside a card, e.g. `fa-briefcase`. */
function iconValue(chunk: string, icon: string): string | null {
  const m = chunk.match(new RegExp(`<i class='[^']*\\b${icon}'></i>([^<]*)</span>`, "i"))
  return m ? clean(m[1]) || null : null
}

/**
 * Parse a listing page into job cards. The page is split into per-card chunks on
 * the `cell-list` container div and each chunk is parsed independently.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split('<div class="cell-list ').slice(1)

  for (const chunk of chunks) {
    const linkMatch = chunk.match(/<a href="\/jobs\/(\d+)-([^"]*)"/)
    if (!linkMatch) continue
    const id = linkMatch[1]
    const slug = linkMatch[2]

    // Title lives in the <h3 class="... text-24 ...">; strip out badge/label
    // <span>s (e.g. "NOVA", "PRESENCIAL", "Vencida") interleaved with the title.
    const h3 = chunk.match(/<h3 class="[^"]*\btext-24\b[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)
    const title = h3
      ? clean(h3[1].replace(/<span[^>]*>[\s\S]*?<\/span>/gi, "")) || null
      : null

    // Expired listings render a red "Vencida" badge / dimmed (opacity) container.
    const expired = /<span[^>]*>\s*Vencida\s*<\/span>/i.test(chunk)

    const company = iconValue(chunk, "fa-briefcase")
    const location = iconValue(chunk, "fa-map-marker-alt")
    const companySize = iconValue(chunk, "fa-building")
    const salary = iconValue(chunk, "fa-money-bill-alt")
    const seniority = iconValue(chunk, "fa-chart-bar")
    const contract = iconValue(chunk, "fa-file-alt")
    const tags = [
      ...chunk.matchAll(/class='tag-list background-gray'>([^<]*)</gi),
    ].map((m) => clean(m[1]))

    results.push({
      id,
      title,
      company,
      location,
      date: null, // listing cards carry no posting date; populated on detail
      url: `${SITE}/jobs/${id}-${slug}`,
      salary,
      seniority,
      contract,
      companySize,
      remote: location ? /remoto|home ?office/i.test(location) : null,
      expired,
      tags,
    })
  }

  return results
}

/** Extract a numeric job id from a raw id, a Programathor URL, or a slug. */
export function normalizeId(input: string): string | null {
  const bare = input.match(/^\d{3,}$/)
  if (bare) return input
  const url = input.match(/jobs\/(\d{3,})/)
  if (url) return url[1]
  const anyNum = input.match(/(\d{4,})/)
  return anyNum ? anyNum[1] : null
}

/** Strip a rich-text HTML block to readable text, keeping paragraph breaks. */
function richTextToText(html: string): string | null {
  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<ins[\s\S]*?<\/ins>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
      .replace(/<h\d[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/** Parse a single job detail page. */
export function parseJobDetail(html: string, id: string, url: string): JobDetail {
  const title = html.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1]

  // The JSON-LD JobPosting block carries structured fields, but Programathor emits
  // it with unescaped newlines in `description` (invalid JSON), so we pull the
  // scalar fields out by regex rather than JSON.parse.
  const ld =
    html.match(
      /<script type="application\/ld\+json">\s*(\{[\s\S]*?"@type":\s*"JobPosting"[\s\S]*?)<\/script>/i,
    )?.[1] ?? ""
  const date = ld.match(/"datePosted":\s*"([^"]+)"/)?.[1] ?? null
  const validThrough = ld.match(/"validThrough":\s*"([^"]+)"/)?.[1] ?? null
  const employmentType = ld.match(/"employmentType":\s*"([^"]+)"/)?.[1] ?? null

  const company =
    clean(html.match(/<h2 class="font-bold-600[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "") || null

  // Meta rows in the header block (each icon-offer paragraph).
  const metaVal = (icon: string): string | null => {
    const m = html.match(
      new RegExp(`<i class="[^"]*\\b${icon}"></i></span>([\\s\\S]*?)</p>`, "i"),
    )
    return m ? clean(m[1]) || null : null
  }
  const companySize = metaVal("fa-building")
  const contract = metaVal("fa-file-alt")
  const salaryRaw = metaVal("fa-money-bill-alt")
  const salary = salaryRaw ? salaryRaw.replace(/^Sal[aá]rio:\s*/i, "") : null
  const seniority = metaVal("fa-signal")
  const locationRaw = metaVal("fa-globe")
  const location = locationRaw ? locationRaw.replace(/^Localiza[cç][aã]o:\s*/i, "").trim() : null

  const tags = [
    ...html.matchAll(/<span class="tag color-white tag-hover">([^<]*)<\/span>/gi),
  ].map((m) => clean(m[1]))

  const descBlock =
    html.match(/<div class="line-height-2-4">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1] ?? ""
  const description = descBlock ? richTextToText(descBlock) : null

  // Applying requires a Programathor account, so the button points to sign-up.
  const applyUrl = `${url}`

  return {
    id,
    title: title ? clean(title) : null,
    company,
    location,
    date,
    url,
    salary,
    seniority,
    contract,
    companySize,
    remote: location ? /remoto|home ?office|telecommute/i.test(location) : null,
    expired: /<span[^>]*>\s*Vencida\s*<\/span>/i.test(html),
    tags,
    description,
    employmentType,
    validThrough,
    applyUrl,
  }
}
