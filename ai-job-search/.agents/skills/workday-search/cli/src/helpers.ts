// Data source: the public Workday "CXS" JSON API that backs every *.myworkdayjobs.com
// career site. No authentication, no API key. Workday is a PER-COMPANY ATS, so this
// skill walks a registry of companies (src/companies.ts) and aggregates their results.
//
// Two endpoints per company (see url-reference.md):
//   POST https://<tenant>.<dc>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
//        body {"appliedFacets":{},"limit":N,"offset":M,"searchText":"<query>"}
//        -> { total, jobPostings:[{ title, externalPath, locationsText, postedOn, bulletFields }] }
//   GET  https://<tenant>.<dc>.myworkdayjobs.com/wday/cxs/<tenant>/<site><externalPath>
//        -> { jobPostingInfo:{ title, jobDescription(HTML), location, startDate, timeType,
//                              jobReqId, postedOn, externalUrl, ... } }
//
// Zero runtime dependencies: plain bun + fetch + regex.

import type { Company } from "./companies.js"

/** Workday serves up to 20 job cards per CXS request by default. */
export const PAGE_SIZE = 20

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// ── URL builders ────────────────────────────────────────────────────────────

/** CXS host, e.g. https://redhat.wd5.myworkdayjobs.com */
export function host(c: Company): string {
  return `https://${c.tenant}.${c.dc}.myworkdayjobs.com`
}

/** CXS search endpoint (POST). */
export function searchUrl(c: Company): string {
  return `${host(c)}/wday/cxs/${c.tenant}/${c.site}/jobs`
}

/** CXS detail endpoint (GET). `externalPath` already begins with "/job/...". */
export function detailUrl(c: Company, externalPath: string): string {
  return `${host(c)}/wday/cxs/${c.tenant}/${c.site}${externalPath}`
}

/** Public, human-facing job url built from the registry coordinates + externalPath. */
export function publicUrl(c: Company, externalPath: string): string {
  const lang = c.lang ? `/${c.lang}` : ""
  return `${host(c)}${lang}/${c.site}${externalPath}`
}

// ── HTTP ──────────────────────────────────────────────────────────────────

/** POST JSON with exponential backoff on 429/5xx. Returns parsed JSON, or null on 404. */
export async function postJson<T = any>(url: string, body: unknown): Promise<T | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": UA,
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      body: JSON.stringify(body),
      redirect: "follow",
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as T
  }
  throw new Error("Request failed after max retries")
}

/** GET JSON with the same backoff policy. Returns null on 404. */
export async function getJson<T = any>(url: string): Promise<T | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as T
  }
  throw new Error("Request failed after max retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── HTML → text (job descriptions are HTML) ─────────────────────────────────

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

// ── postedOn → ISO date ─────────────────────────────────────────────────────

/**
 * Workday search cards carry a RELATIVE posting label in `postedOn`, e.g.
 * "Posted Today", "Posted Yesterday", "Posted 3 Days Ago", "Posted 30+ Days Ago".
 * Parse it to a best-effort ISO date (YYYY-MM-DD) so `--jobage` can filter. Returns
 * null when the label can't be understood (the raw label is kept in `postedRaw`).
 */
export function parsePostedOn(postedOn: string | null | undefined, now: Date = new Date()): string | null {
  if (!postedOn) return null
  const s = postedOn.toLowerCase()
  let daysAgo: number | null = null
  if (/\btoday\b|\bhoje\b/.test(s)) daysAgo = 0
  else if (/\byesterday\b|\bontem\b/.test(s)) daysAgo = 1
  else {
    const m = s.match(/(\d+)\s*\+?\s*(day|days|dia|dias)/)
    if (m) daysAgo = parseInt(m[1], 10)
    else {
      const w = s.match(/(\d+)\s*\+?\s*(week|weeks|semana|semanas)/)
      if (w) daysAgo = parseInt(w[1], 10) * 7
      else {
        const mo = s.match(/(\d+)\s*\+?\s*(month|months|mes|meses|mês)/)
        if (mo) daysAgo = parseInt(mo[1], 10) * 30
      }
    }
  }
  if (daysAgo === null) return null
  const d = new Date(now.getTime() - daysAgo * 86400_000)
  return d.toISOString().slice(0, 10)
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface JobCard {
  id: string
  title: string | null
  company: string
  location: string | null
  date: string | null
  url: string
  /** Raw Workday posting label, e.g. "Posted 3 Days Ago". Kept for transparency. */
  postedRaw: string | null
  /** Workday externalPath ("/job/..."), used by `detail`. */
  externalPath: string
}

export interface JobDetail {
  id: string
  title: string | null
  company: string
  location: string | null
  date: string | null
  url: string
  description: string | null
  employmentType: string | null
  applyUrl: string
}

// ── Search parsing ──────────────────────────────────────────────────────────

export interface SearchResponse {
  total?: number
  jobPostings?: Array<{
    title?: string
    externalPath?: string
    locationsText?: string
    postedOn?: string
    bulletFields?: string[]
  }>
}

/** Map one company's raw CXS jobPostings into normalized JobCards. */
export function mapPostings(data: SearchResponse, c: Company, now: Date = new Date()): JobCard[] {
  const out: JobCard[] = []
  for (const p of data.jobPostings ?? []) {
    const externalPath = p.externalPath ?? ""
    if (!externalPath) continue
    // Prefer the requisition id (bulletFields[0], e.g. "R-056743"); fall back to the
    // trailing "_<req>" segment of the externalPath.
    const reqFromPath = externalPath.match(/_([A-Za-z0-9-]+)$/)
    const bullets = p.bulletFields ?? []
    const id = bullets[0] || (reqFromPath ? reqFromPath[1] : externalPath)
    // Location: some tenants (Red Hat, NVIDIA) send `locationsText`; others (Accenture)
    // omit it and carry the location in bulletFields[1]; as a last resort, use the
    // location segment of the externalPath ("/job/<Location>/...").
    const pathLoc = externalPath.match(/^\/job\/([^/]+)\//)
    const location =
      p.locationsText ||
      (bullets.length > 1 ? bullets[bullets.length - 1] : null) ||
      (pathLoc ? decodeURIComponent(pathLoc[1]).replace(/-+/g, " ").trim() : null)
    out.push({
      id,
      title: p.title ?? null,
      company: c.name,
      location,
      date: parsePostedOn(p.postedOn, now),
      url: publicUrl(c, externalPath),
      postedRaw: p.postedOn ?? null,
      externalPath,
    })
  }
  return out
}

// ── Detail parsing ──────────────────────────────────────────────────────────

export interface DetailResponse {
  jobPostingInfo?: {
    title?: string
    jobDescription?: string
    location?: string
    startDate?: string
    postedOn?: string
    timeType?: string
    jobReqId?: string
    externalUrl?: string
    additionalLocations?: Array<{ descriptor?: string }>
  }
}

export function mapDetail(
  data: DetailResponse,
  c: Company,
  externalPath: string,
  now: Date = new Date(),
): JobDetail {
  const info = data.jobPostingInfo ?? {}
  const reqFromPath = externalPath.match(/_([A-Za-z0-9-]+)$/)
  const id = info.jobReqId || (reqFromPath ? reqFromPath[1] : externalPath)
  const url = info.externalUrl || publicUrl(c, externalPath)
  return {
    id,
    title: info.title ?? null,
    company: c.name,
    location: info.location ?? null,
    // startDate is a real ISO date; fall back to parsing the relative postedOn label.
    date: info.startDate || parsePostedOn(info.postedOn, now),
    url,
    description: htmlToText(info.jobDescription),
    employmentType: info.timeType ?? null,
    applyUrl: url,
  }
}

/**
 * Resolve a detail target to `{ tenant, dc, site, externalPath }` from either:
 *   - a public/CXS url:  https://<tenant>.<dc>.myworkdayjobs.com/[<lang>/]<site>/job/...
 *   - a "<company>:<externalPath>" pair (company matched against the registry)
 * Returns null when it can't be parsed. `resolveCompanyByTenant` supplies the display
 * name (and any known lang) for a url-derived target.
 */
export function parseDetailTarget(
  input: string,
): { tenant: string; dc: string; site: string; externalPath: string } | null {
  const trimmed = input.trim()
  // Full URL form.
  const urlMatch = trimmed.match(
    /https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:([a-z]{2}-[A-Z]{2})\/)?([^/]+)(\/job\/.+)$/i,
  )
  if (urlMatch) {
    return {
      tenant: urlMatch[1],
      dc: urlMatch[2],
      site: urlMatch[4],
      externalPath: stripTrailingSlash(urlMatch[5]),
    }
  }
  return null
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "")
}
