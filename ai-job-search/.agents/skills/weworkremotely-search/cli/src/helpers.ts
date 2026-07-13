// Data source: We Work Remotely public category RSS feeds
// (e.g. https://weworkremotely.com/categories/remote-programming-jobs.rss).
// No authentication and zero runtime dependencies — the feeds are plain XML, parsed
// with regex (no XML/HTTP libraries). Several tech/QA-relevant category feeds are
// combined and deduplicated by job URL.

export const FEED_BASE = "https://weworkremotely.com/categories"
export const SITE_BASE = "https://weworkremotely.com/remote-jobs"

// Category feed slugs combined for tech/QA searches. `remote-programming-jobs` is the
// umbrella feed that already includes back-end/front-end/full-stack items, so pairing it
// with the DevOps/sysadmin feed keeps request volume low while covering engineering/QA.
export const CATEGORIES = [
  "remote-programming-jobs",
  "remote-devops-sysadmin-jobs",
]

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/**
 * Fetch text (RSS/XML) with exponential backoff on 429/5xx. Returns `null` on a 404
 * (rather than throwing) so callers can treat "not found" as an empty result.
 */
export async function textFetch(url: string): Promise<string | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/rss+xml, application/xml, text/xml, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
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
    if (response.status === 404) return null
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
  category: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points (e.g. emoji, U+1F600)
 * decode correctly, and drops out-of-range values instead of throwing.
 */
function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
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

/** Strip HTML down to readable text, preserving paragraph/line breaks. */
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

export interface RawItem {
  title: string | null
  link: string | null
  region: string | null
  category: string | null
  pubDate: string | null
  descriptionHtml: string | null
}

/** Pull the inner text of the first `<tag>...</tag>` from a chunk. */
function tag(chunk: string, name: string): string | null {
  const m = chunk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))
  if (!m) return null
  const raw = m[1]
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim()
  return raw || null
}

/**
 * Split the RSS feed into per-item chunks and parse each independently, so one
 * malformed `<item>` cannot break the rest. Returns raw item fields.
 */
export function parseItems(xml: string | null | undefined): RawItem[] {
  if (!xml) return []
  const chunks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
  const items: RawItem[] = []
  for (const chunk of chunks) {
    try {
      const titleRaw = tag(chunk, "title")
      items.push({
        title: titleRaw ? decodeHtmlEntities(titleRaw) : null,
        link: tag(chunk, "link") ?? tag(chunk, "guid"),
        region: (() => {
          const r = tag(chunk, "region")
          return r ? decodeHtmlEntities(r) : null
        })(),
        category: (() => {
          const c = tag(chunk, "category")
          return c ? decodeHtmlEntities(c) : null
        })(),
        pubDate: tag(chunk, "pubDate"),
        // The RSS <description> is entity-encoded HTML (&lt;p&gt;...). Decode it once
        // here so it becomes real HTML; htmlToText then strips tags and decodes any
        // remaining (double-encoded) entities.
        descriptionHtml: (() => {
          const d = tag(chunk, "description")
          return d ? decodeHtmlEntities(d) : null
        })(),
      })
    } catch {
      // skip a malformed item rather than aborting the whole feed
    }
  }
  return items
}

/** Extract the slug id from a WWR job URL (the path after `/remote-jobs/`). */
export function slugFromLink(link: string | null | undefined): string {
  if (!link) return ""
  const m = link.match(/remote-jobs\/([^/?#]+)/i)
  return m ? m[1] : ""
}

/** Split a "Company: Role" title into { company, title(role) }. */
function splitTitle(raw: string | null): { company: string | null; title: string | null } {
  if (!raw) return { company: null, title: null }
  const idx = raw.indexOf(":")
  if (idx === -1) return { company: null, title: raw.trim() || null }
  const company = raw.slice(0, idx).trim()
  const role = raw.slice(idx + 1).trim()
  return { company: company || null, title: role || raw.trim() || null }
}

/** Convert an RFC-822 pubDate to an ISO 8601 string; fall back to the raw value. */
function toIsoDate(pubDate: string | null): string | null {
  if (!pubDate) return null
  const t = Date.parse(pubDate)
  return isNaN(t) ? pubDate : new Date(t).toISOString()
}

/** Map a raw RSS item to the shared JobCard shape. */
export function mapCard(item: RawItem): JobCard {
  const { company, title } = splitTitle(item.title)
  const id = slugFromLink(item.link)
  return {
    id,
    title,
    company,
    location: item.region,
    date: toIsoDate(item.pubDate),
    url: item.link ?? (id ? `${SITE_BASE}/${id}` : SITE_BASE),
    category: item.category,
  }
}

/** Map a raw RSS item to the full JobDetail shape (with readable description text). */
export function mapDetail(item: RawItem): JobDetail {
  return {
    ...mapCard(item),
    description: htmlToText(item.descriptionHtml),
  }
}

/** Case-insensitive keyword match against title + company + category. */
export function matchesQuery(card: JobCard, query: string | undefined): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [card.title, card.company, card.category].filter(Boolean).join(" ").toLowerCase()
  return hay.includes(q)
}

/** Deduplicate cards by url (falling back to id), preserving first occurrence. */
export function dedupe(cards: JobCard[]): JobCard[] {
  const seen = new Set<string>()
  const out: JobCard[] = []
  for (const c of cards) {
    const key = c.url || c.id
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(c)
  }
  return out
}

/** Extract a slug id from a raw slug or a full WWR job URL. */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const fromUrl = slugFromLink(trimmed)
  if (fromUrl) return fromUrl
  // bare slug: letters/digits/hyphens
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return trimmed
  return null
}

/** Filter cards to those posted within `days` (client-side). */
export function withinDays(cards: JobCard[], days: number): JobCard[] {
  if (!days || days <= 0 || days >= 9999) return cards
  const cutoff = Date.now() - days * 86400_000
  return cards.filter((c) => {
    if (!c.date) return true
    const t = Date.parse(c.date)
    return isNaN(t) ? true : t >= cutoff
  })
}
