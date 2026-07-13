// Data source: Trampos.co public JSON API (`/api/v2/opportunities`), the same
// endpoint the site's Ember front-end ("frodo") calls. No authentication required.
// The public listings page is a JS single-page app, so there is no server-rendered
// HTML to parse — everything comes from this JSON API instead.

export const API_BASE = "https://trampos.co/api/v2/opportunities"
export const SITE_BASE = "https://trampos.co/oportunidades"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/**
 * Fetch JSON with exponential backoff on 429/5xx. Returns `null` on a 404
 * (rather than throwing) so callers can treat "not found" as an empty result.
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
        "X-Requested-With": "XMLHttpRequest",
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
  remote: boolean | null
  hybrid: boolean | null
}

export interface JobDetail extends JobCard {
  description: string | null
  prerequisite: string | null
  desirable: string | null
  perks: string | null
  otherInfo: string | null
  regime: string | null
  applyUrl: string | null
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points (e.g. emoji, U+1F600)
 * decode correctly, and drops out-of-range values instead of throwing.
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

interface RawCompany {
  name?: string | null
}

export interface RawOpportunity {
  id?: number | string
  name?: string | null
  custom_company_name?: string | null
  company?: RawCompany | null
  state?: string | null
  city?: string | null
  home_office?: boolean | null
  hybrid?: boolean | null
  published_at?: string | null
  salary?: string | null
  category_name?: string | null
  type_name?: string | null
  apply_url?: string | null
  apply_method?: string | null
  regime?: string | null
  description?: string | null
  prerequisite?: string | null
  desirable?: string | null
  perks?: string | null
  other_info?: string | null
}

/** Human-readable location from city/state plus remote/hybrid flags. */
function formatLocation(o: RawOpportunity): string | null {
  const bits: string[] = []
  const place = [o.city, o.state].filter((p) => p && String(p).trim()).join(" - ")
  if (place) bits.push(place)
  if (o.home_office) bits.push("Remoto")
  else if (o.hybrid) bits.push("Híbrido")
  return bits.length ? bits.join(" · ") : null
}

function companyName(o: RawOpportunity): string | null {
  const custom = o.custom_company_name && String(o.custom_company_name).trim()
  if (custom) return custom
  const name = o.company?.name && String(o.company.name).trim()
  return name || null
}

/** Map a raw API opportunity to the shared JobCard shape. */
export function mapCard(o: RawOpportunity): JobCard {
  const id = o.id != null ? String(o.id) : ""
  return {
    id,
    title: o.name ? String(o.name) : null,
    company: companyName(o),
    location: formatLocation(o),
    date: o.published_at ?? null,
    url: id ? `${SITE_BASE}/${id}` : SITE_BASE,
    salary: o.salary ?? null,
    category: o.category_name ?? null,
    type: o.type_name ?? null,
    remote: o.home_office ?? null,
    hybrid: o.hybrid ?? null,
  }
}

/** Map a raw API opportunity to the full JobDetail shape. */
export function mapDetail(o: RawOpportunity): JobDetail {
  return {
    ...mapCard(o),
    description: htmlToText(o.description),
    prerequisite: htmlToText(o.prerequisite),
    desirable: htmlToText(o.desirable),
    perks: htmlToText(o.perks),
    otherInfo: htmlToText(o.other_info),
    regime: o.regime ? String(o.regime) : null,
    applyUrl: (o.apply_url && String(o.apply_url).trim()) || null,
  }
}

export interface Pagination {
  total: number | null
  total_pages: number | null
  per_page: number | null
}

export interface SearchResponse {
  opportunities: RawOpportunity[]
  pagination: Pagination
}

/** Normalize the search API payload into a predictable shape. */
export function parseSearchResponse(payload: unknown): SearchResponse {
  const obj = (payload ?? {}) as Record<string, unknown>
  const opportunities = Array.isArray(obj.opportunities)
    ? (obj.opportunities as RawOpportunity[])
    : []
  const p = (obj.pagination ?? {}) as Record<string, unknown>
  return {
    opportunities,
    pagination: {
      total: typeof p.total === "number" ? p.total : null,
      total_pages: typeof p.total_pages === "number" ? p.total_pages : null,
      per_page: typeof p.per_page === "number" ? p.per_page : null,
    },
  }
}

/** Extract a numeric opportunity id from a raw id, a URL, or a slug. */
export function normalizeId(input: string): string | null {
  const bare = input.match(/^\d{3,}$/)
  if (bare) return input
  // .../oportunidades/773774-slug-here  or  .../oportunidades/773774
  const url = input.match(/oportunidades\/(\d{3,})/)
  if (url) return url[1]
  const anyNum = input.match(/(\d{4,})/)
  return anyNum ? anyNum[1] : null
}

/** Filter cards to those posted within `days` (client-side; API has no age param). */
export function withinDays(cards: JobCard[], days: number): JobCard[] {
  if (!days || days <= 0 || days >= 9999) return cards
  const cutoff = Date.now() - days * 86400_000
  return cards.filter((c) => {
    if (!c.date) return true
    const t = Date.parse(c.date)
    return isNaN(t) ? true : t >= cutoff
  })
}
