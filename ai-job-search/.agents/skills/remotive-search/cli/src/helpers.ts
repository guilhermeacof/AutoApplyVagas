// Data source: Remotive public JSON API (`https://remotive.com/api/remote-jobs`).
// Remotive is a curated remote-jobs board, so titles/tags are clean (unlike raw
// aggregators). The `search` query param is currently not honored server-side (it
// returns the full set), so we fetch the feed and filter/paginate client-side.

export const API_URL = "https://remotive.com/api/remote-jobs"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch JSON with exponential backoff on 429/5xx. Returns `null` on 404. */
export async function jsonFetch(url: string): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9,pt;q=0.8",
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
    return response.json()
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
  category: string | null
  type: string | null
  tags: string[]
}

export interface JobDetail extends JobCard {
  description: string | null
}

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

export interface RawJob {
  id?: number | string
  url?: string | null
  title?: string | null
  company_name?: string | null
  category?: string | null
  tags?: string[] | null
  job_type?: string | null
  publication_date?: string | null
  candidate_required_location?: string | null
  salary?: string | null
  description?: string | null
}

export function mapCard(o: RawJob): JobCard {
  const id = o.id != null ? String(o.id) : ""
  return {
    id,
    title: o.title ? String(o.title) : null,
    company: o.company_name ? String(o.company_name) : null,
    location: (o.candidate_required_location && String(o.candidate_required_location).trim()) || "Remoto",
    date: o.publication_date ?? null,
    url: (o.url && String(o.url)) || "https://remotive.com/",
    salary: (o.salary && String(o.salary).trim()) || null,
    category: o.category ?? null,
    type: o.job_type ?? null,
    tags: Array.isArray(o.tags) ? o.tags.map(String) : [],
  }
}

export function mapDetail(o: RawJob): JobDetail {
  return { ...mapCard(o), description: htmlToText(o.description) }
}

/** Pull the `jobs` array out of the Remotive payload. */
export function parseJobs(payload: unknown): RawJob[] {
  const obj = (payload ?? {}) as Record<string, unknown>
  return Array.isArray(obj.jobs) ? (obj.jobs as RawJob[]) : []
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * True if every query term matches: as a whole word in the title/company, or as a
 * tag. Remotive is curated (tags are clean), so tag matching is safe here.
 */
export function matchesQuery(o: RawJob, query?: string): boolean {
  if (!query || !query.trim()) return true
  const words = [(o.title || ""), (o.company_name || "")].join(" ").toLowerCase()
  const tags = (Array.isArray(o.tags) ? o.tags : []).map((t) => String(t).toLowerCase())
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => {
      if (tags.some((t) => t.includes(term))) return true
      return new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(words)
    })
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

/** Extract a Remotive job id from a bare id or a job URL. */
export function normalizeId(input: string): string | null {
  const bare = input.match(/^\d{3,}$/)
  if (bare) return input
  const url = input.match(/remote-jobs\/[^/]*?(\d{4,})/)
  if (url) return url[1]
  const anyNum = input.match(/(\d{4,})/)
  return anyNum ? anyNum[1] : null
}
