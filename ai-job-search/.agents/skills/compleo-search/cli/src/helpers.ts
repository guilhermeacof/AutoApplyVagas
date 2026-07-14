// Data source: the Compleo ATS public career boards, hosted at
// `https://jobs.compleo.app/<uniqueLink>/joblist`. Each company that uses Compleo
// gets its own board (a Next.js app). The board itself is a JS SPA, but two public,
// unauthenticated data sources back it:
//
//   1. Search — the same JSON API the board's front-end calls:
//        POST https://api.compleo.app/job/careerjoblist/<UNIQUELINK>
//      It returns Elasticsearch-style hits in `fields[]`. A `companyId` (an integer
//      unique to the board) is required in the body; we scrape it once from the
//      board's server-rendered `__NEXT_DATA__`.
//   2. Detail — the job's own page is server-rendered: the full record (including the
//        HTML description) is embedded in `__NEXT_DATA__` at `pageProps.jobViewData`,
//        so `detail` just fetches the page and parses that JSON — no API call needed.
//
// Consultancy/staffing boards (e.g. Emphasys) list openings for many *client*
// companies; each hit carries a `customer` — that is the real employer and is what we
// surface as `company`. Zero runtime dependencies: plain `bun` + `fetch` + regex.

export const JOBS_BASE = "https://jobs.compleo.app"
export const API_BASE = "https://api.compleo.app/job/careerjoblist"
export const DEFAULT_BOARD = "emphasys"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

async function backoff(attempt: number, delay: number): Promise<number> {
  const jitter = Math.floor(Math.random() * 500)
  await new Promise((r) => setTimeout(r, delay + jitter))
  return Math.min(delay * 2, 8000)
}

/**
 * POST a JSON body and parse the JSON response, with exponential backoff on
 * 429/5xx. Returns `null` on 404 so callers can treat "not found" as empty.
 */
export async function jsonPost(url: string, body: unknown): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Content-Type": "application/json",
        Origin: JOBS_BASE,
      },
      body: JSON.stringify(body),
      redirect: "follow",
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      delay = await backoff(attempt, delay)
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

/** GET an HTML page, with exponential backoff on 429/5xx. `null` on 404. */
export async function textFetch(url: string): Promise<string | null> {
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
      delay = await backoff(attempt, delay)
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

/** Extract and parse the `__NEXT_DATA__` JSON blob from a Compleo board page. */
export function extractNextData(html: string): Record<string, unknown> | null {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  )
  if (!m) return null
  try {
    return JSON.parse(m[1]) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Read `props.pageProps` out of a parsed `__NEXT_DATA__` object. */
export function pageProps(nextData: Record<string, unknown> | null): Record<string, unknown> {
  const props = (nextData?.props ?? {}) as Record<string, unknown>
  return (props.pageProps ?? {}) as Record<string, unknown>
}

/**
 * Resolve the numeric `companyId` for a board by scraping its joblist page.
 * Returns `null` if the board does not exist (404) or the page has no id.
 */
export async function resolveCompanyId(board: string): Promise<string | null> {
  const html = await textFetch(`${JOBS_BASE}/${board}/joblist`)
  if (!html) return null
  const pp = pageProps(extractNextData(html))
  const cid = pp.companyId
  if (cid != null && String(cid).trim()) return String(cid)
  // Fallback: a plain regex in case the shape shifts.
  const m = html.match(/"companyId"\s*:\s*"?(\d+)"?/)
  return m ? m[1] : null
}

// ---- HTML → text ---------------------------------------------------------

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

// ---- Raw record shapes (from the API / page __NEXT_DATA__) ---------------

interface Labeled {
  label?: string | null
  value?: string | null
  [k: string]: unknown
}

export interface RawJob {
  pk?: string | null
  title?: string | null
  customer?: Labeled | null
  experienceLevel?: Labeled | null
  workingModel?: Labeled | null
  employmentType?: Labeled | string | null
  createdAt?: string | null
  lastUpdatedAt?: string | null
  openingDate?: string | null
  hiringEndDate?: string | null
  location?: {
    country?: Labeled | null
    provinceOrState?: Labeled | null
    city?: Labeled | null
  } | null
  description?: string | null
  responsibilities?: string | null
  requirements?: string | null
}

export interface JobCard {
  id: string
  title: string | null
  company: string | null
  location: string | null
  date: string | null
  url: string
  workingModel: string | null
  experienceLevel: string | null
  board: string
}

export interface JobDetail extends JobCard {
  description: string | null
  responsibilities: string | null
  requirements: string | null
  employmentType: string | null
  hiringEndDate: string | null
}

function label(x: Labeled | string | null | undefined): string | null {
  if (x == null) return null
  if (typeof x === "string") return x.trim() || null
  const l = x.label && String(x.label).trim()
  return l || null
}

/** Human-readable location from city / state / country labels. */
export function formatLocation(job: RawJob): string | null {
  const loc = job.location
  if (!loc) return null
  const city = label(loc.city)
  const state = label(loc.provinceOrState)
  const country = label(loc.country)
  const place = [city, state].filter(Boolean).join(" - ")
  const bits = [place, country].filter(Boolean)
  return bits.length ? bits.join(", ") : null
}

/**
 * Strip the `JOB:` prefix from a pk to get the short code used in detail-page
 * URLs. `JOB:PK05328B` → `PK05328B`. Passes through anything already short.
 */
export function pkToCode(pk: string): string {
  return pk.replace(/^JOB:/i, "").trim()
}

/** Map a raw API/page job into the shared JobCard shape. */
export function mapCard(job: RawJob, board: string): JobCard {
  const pk = job.pk ? String(job.pk) : ""
  const code = pk ? pkToCode(pk) : ""
  return {
    id: pk || code,
    title: job.title ? String(job.title) : null,
    company: label(job.customer),
    location: formatLocation(job),
    date: job.openingDate ?? job.createdAt ?? job.lastUpdatedAt ?? null,
    url: code ? `${JOBS_BASE}/${board}/jobdetail/${code}` : `${JOBS_BASE}/${board}/joblist`,
    workingModel: label(job.workingModel),
    experienceLevel: label(job.experienceLevel),
    board,
  }
}

/** Map a raw detail record (page `jobViewData`) into the full JobDetail shape. */
export function mapDetail(job: RawJob, board: string): JobDetail {
  return {
    ...mapCard(job, board),
    description: htmlToText(job.description),
    responsibilities: htmlToText(job.responsibilities),
    requirements: htmlToText(job.requirements),
    employmentType: label(job.employmentType as Labeled | string | null),
    hiringEndDate: job.hiringEndDate ?? null,
  }
}

export interface SearchResponse {
  jobs: RawJob[]
  total: number | null
}

/** Normalize the careerjoblist API payload into a predictable shape. */
export function parseSearchResponse(payload: unknown): SearchResponse {
  const obj = (payload ?? {}) as Record<string, unknown>
  const jobs = Array.isArray(obj.fields) ? (obj.fields as RawJob[]) : []
  const tf = obj.totalFiltered as { value?: unknown } | undefined
  const total =
    tf && typeof tf.value === "number"
      ? tf.value
      : typeof obj.totalRecords === "number"
        ? (obj.totalRecords as number)
        : null
  return { jobs, total }
}

/** Client-side substring match on the location string (API filters via facets). */
export function matchesLocation(cards: JobCard[], loc: string | undefined): JobCard[] {
  if (!loc || !loc.trim()) return cards
  const needle = loc
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
  return cards.filter((c) => {
    const hay = (c.location || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
    return hay.includes(needle)
  })
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

/** Build the careerjoblist POST body the board's front-end sends. */
export function buildSearchBody(opts: {
  companyId: string
  query?: string
  page: number
  pageSize: number
}): Record<string, unknown> {
  return {
    companyId: opts.companyId,
    filterUpdated: true,
    buckets: {},
    mainSearch: opts.query ?? "",
    searchAsYouType: false,
    customSearch: {},
    advancedSearch: {},
    pagination: { currentPage: opts.page, pageSize: opts.pageSize },
    geoLocation: {},
    sort: {},
    updateAggsAfterFilter: false,
    otherGenericParams: {},
    language: "pt-BR",
  }
}

/**
 * Extract a job code + board from a detail id or URL.
 * Accepts: `JOB:PK05328B`, `PK05328B`, or a full
 * `https://jobs.compleo.app/<board>/jobdetail/<code>` URL.
 */
export function parseDetailInput(
  input: string,
  fallbackBoard: string,
): { board: string; code: string } | null {
  const urlMatch = input.match(
    /jobs\.compleo\.app\/([^/]+)\/jobdetail\/([A-Za-z0-9:]+)/i,
  )
  if (urlMatch) return { board: urlMatch[1], code: pkToCode(urlMatch[2]) }
  const code = pkToCode(input)
  if (/^[A-Za-z0-9]{4,}$/.test(code)) return { board: fallbackBoard, code }
  return null
}
