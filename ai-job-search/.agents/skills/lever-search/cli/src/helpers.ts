// Data source: Lever's public postings API (`https://api.lever.co/v0/postings/<token>`),
// the same JSON the company's own hosted board (jobs.lever.co/<token>) calls.
// No authentication, no API key. Lever is per-company, so a search aggregates
// one request per company token (see companies.ts).

import type { Company } from "./companies.js"

export const API_BASE = "https://api.lever.co/v0/postings"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/**
 * Fetch JSON with exponential backoff on 429/5xx. Returns `null` on a 404
 * (a token with no board) rather than throwing, so callers can treat it as
 * "no postings" instead of a hard failure.
 */
export async function jsonFetch(url: string): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/javascript, */*; q=0.01",
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
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  /** Composite id in the form "<token>:<postingId>". */
  id: string
  title: string | null
  company: string | null
  location: string | null
  /** ISO 8601 string derived from Lever's `createdAt` (ms epoch). */
  date: string | null
  url: string
  commitment: string | null
  team: string | null
  department: string | null
  workplaceType: string | null
}

export interface JobList {
  text: string | null
  content: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  lists: JobList[]
  additional: string | null
  applyUrl: string | null
}

/** Convert a Unicode code point to a string, dropping out-of-range values. */
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

export interface RawCategories {
  commitment?: string | null
  department?: string | null
  location?: string | null
  team?: string | null
}

export interface RawListItem {
  text?: string | null
  content?: string | null
}

export interface RawPosting {
  id?: string | null
  text?: string | null
  categories?: RawCategories | null
  createdAt?: number | null
  hostedUrl?: string | null
  applyUrl?: string | null
  workplaceType?: string | null
  descriptionPlain?: string | null
  description?: string | null
  additionalPlain?: string | null
  additional?: string | null
  lists?: RawListItem[] | null
}

/** Map a raw Lever posting to the shared JobCard shape. */
export function mapCard(company: Company, o: RawPosting): JobCard {
  const postingId = o.id != null ? String(o.id) : ""
  const cat = o.categories ?? {}
  return {
    id: `${company.token}:${postingId}`,
    title: o.text ? String(o.text) : null,
    company: company.name,
    location: cat.location ? String(cat.location) : null,
    date: typeof o.createdAt === "number" ? new Date(o.createdAt).toISOString() : null,
    url: o.hostedUrl ? String(o.hostedUrl) : `https://jobs.lever.co/${company.token}/${postingId}`,
    commitment: cat.commitment ? String(cat.commitment) : null,
    team: cat.team ? String(cat.team) : null,
    department: cat.department ? String(cat.department) : null,
    workplaceType: o.workplaceType ? String(o.workplaceType) : null,
  }
}

/** Map a raw Lever posting to the full JobDetail shape. */
export function mapDetail(company: Company, o: RawPosting): JobDetail {
  const lists: JobList[] = Array.isArray(o.lists)
    ? o.lists.map((l) => ({ text: htmlToText(l.text), content: htmlToText(l.content) }))
    : []
  // Prefer the plain-text variants Lever provides; fall back to stripping HTML.
  const description = o.descriptionPlain
    ? String(o.descriptionPlain).trim() || null
    : htmlToText(o.description)
  const additional = o.additionalPlain
    ? String(o.additionalPlain).trim() || null
    : htmlToText(o.additional)
  return {
    ...mapCard(company, o),
    description,
    lists,
    additional,
    applyUrl: (o.applyUrl && String(o.applyUrl).trim()) || null,
  }
}

/** Parse the array of postings a Lever board returns. */
export function parsePostings(payload: unknown): RawPosting[] {
  return Array.isArray(payload) ? (payload as RawPosting[]) : []
}

/**
 * Match a title against a query. Terms are split on whitespace and matched
 * per word (AND) — a card matches only if every term appears in the title.
 * Case-insensitive. An empty query matches everything.
 */
export function matchesQuery(title: string | null, query: string | undefined): boolean {
  if (!query || !query.trim()) return true
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const t = (title ?? "").toLowerCase()
  return terms.every((term) => t.includes(term))
}

/** Match a location field against a substring (case-insensitive). */
export function matchesLocation(location: string | null, filter: string | undefined): boolean {
  if (!filter || !filter.trim()) return true
  return (location ?? "").toLowerCase().includes(filter.toLowerCase())
}

/** Filter cards to those created within `days` (client-side, on `date`). */
export function withinDays(cards: JobCard[], days: number): JobCard[] {
  if (!days || days <= 0 || days >= 9999) return cards
  const cutoff = Date.now() - days * 86400_000
  return cards.filter((c) => {
    if (!c.date) return true
    const t = Date.parse(c.date)
    return isNaN(t) ? true : t >= cutoff
  })
}

export interface ParsedId {
  token: string
  id: string
}

/**
 * Parse a composite "<token>:<id>" id or a Lever hosted/apply URL
 * (`https://jobs.lever.co/<token>/<id>`) into its token and posting id.
 */
export function parseCompositeId(input: string): ParsedId | null {
  const trimmed = input.trim()
  // jobs.lever.co/<token>/<uuid>  (optionally /apply)
  const url = trimmed.match(/lever\.co\/([^/]+)\/([0-9a-fA-F-]{8,})/)
  if (url) return { token: url[1], id: url[2] }
  // <token>:<id>
  const colon = trimmed.match(/^([^:\s]+):([^\s]+)$/)
  if (colon) return { token: colon[1], id: colon[2] }
  return null
}
