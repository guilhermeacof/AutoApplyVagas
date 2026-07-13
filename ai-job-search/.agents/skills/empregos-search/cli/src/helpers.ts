// Data source: Empregos.com.br public server-rendered HTML (Nuxt SSR). No auth.
// Search page (/vagas/<slug>) returns a list of job cards; detail (/vaga/<id>)
// returns a single posting. Both are parsed with regex: each card is split into
// an independent chunk so one malformed card cannot break the rest.

export const BASE_URL = "https://www.empregos.com.br"

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
  title: string
  company: string | null
  location: string | null
  date: string | null // ISO date (YYYY-MM-DD) computed from "publicada há N dias"
  url: string
  salary: string | null
  workplace: string | null // Presencial | Remoto | Híbrido
  posted: string | null // raw relative-time string, e.g. "há 58 dias"
  daysAgo: number | null // integer days since posting (for --jobage)
}

export interface JobDetail extends JobCard {
  description: string | null
  contractType: string | null
  vacancies: string | null
  applyUrl: string | null
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

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** Slugify a term for the /vagas/<slug> path: lowercase, strip accents, hyphenate. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Parse the relative-time string ("há 58 dias", "hoje", "ontem", "há 3 horas")
 * into { daysAgo, isoDate }. Returns nulls if unrecognized.
 */
export function parsePosted(raw: string): { daysAgo: number | null; date: string | null } {
  const text = raw.toLowerCase().trim()
  let daysAgo: number | null = null
  if (/\bhoje\b/.test(text) || /\bh[áa]\s+\d+\s*(hora|minuto)/.test(text)) {
    daysAgo = 0
  } else if (/\bontem\b/.test(text)) {
    daysAgo = 1
  } else {
    const d = text.match(/\bh[áa]\s+(\d+)\s*dias?\b/)
    if (d) daysAgo = parseInt(d[1], 10)
    else {
      const w = text.match(/\bh[áa]\s+(\d+)\s*(semana|m[eê]s|mes)/)
      if (w) daysAgo = parseInt(w[1], 10) * (/(semana)/.test(text) ? 7 : 30)
    }
  }
  if (daysAgo === null) return { daysAgo: null, date: null }
  const dt = new Date()
  dt.setDate(dt.getDate() - daysAgo)
  return { daysAgo, date: dt.toISOString().slice(0, 10) }
}

/**
 * Parse the search results page. Each card begins with the accessibility label
 * `aria-label="Abrir detalhes da vaga <TITLE>"`; we split on that marker and
 * parse each chunk independently.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const marker = /aria-label="Abrir detalhes da vaga /
  const chunks = html.split(marker).slice(1)

  for (const chunk of chunks) {
    // Title is the text immediately after the marker, up to the closing quote.
    const titleMatch = chunk.match(/^([^"]+)"/)
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : null
    if (!title) continue

    // id + slug from the "Mais detalhes" detail link.
    const linkMatch = chunk.match(/\/vaga\/(\d+)\/([^"?#\s]+)/)
    if (!linkMatch) continue
    const id = linkMatch[1]
    const slug = linkMatch[2]

    // Company from the logo alt text ("Logo da empresa <NAME>"), falling back
    // to the company anchor text.
    let company: string | null = null
    const alt = chunk.match(/alt="Logo da empresa ([^"]+)"/i)
    if (alt) company = decodeHtmlEntities(alt[1]).trim()
    if (!company) {
      const anchor = chunk.match(/href="[^"]*\/empresa\/[^"]*"[^>]*>([^<]+)<\/a>/i)
      if (anchor) company = clean(anchor[1]) || null
    }

    // Location: the <h3 title="City, UF"> after the location icon.
    let location: string | null = null
    const loc = chunk.match(/location-on-outline[\s\S]*?<h3[^>]*title="([^"]+)"/i)
    if (loc) location = decodeHtmlEntities(loc[1]).trim()

    // Workplace type: Presencial | Remoto | Híbrido.
    let workplace: string | null = null
    const wp = chunk.match(/emoji-people[\s\S]*?<span>([^<]+)<\/span>/i)
    if (wp) workplace = clean(wp[1]) || null

    // Salary (may be "A combinar").
    let salary: string | null = null
    const sal = chunk.match(/payments-outline[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/i)
    if (sal) salary = clean(sal[1]) || null

    // Posting date: "Publicada há N dias".
    let posted: string | null = null
    const dt = chunk.match(/event-outline[\s\S]*?<h3[^>]*>\s*Publicad[ao]\s+([^<]+?)\s*<\/h3>/i)
    if (dt) posted = clean(dt[1]) || null
    const { daysAgo, date } = posted ? parsePosted(posted) : { daysAgo: null, date: null }

    results.push({
      id,
      title,
      company,
      location,
      date,
      url: `${BASE_URL}/vaga/${id}/${slug}`,
      salary,
      workplace,
      posted,
      daysAgo,
    })
  }

  return results
}

/** Parse the single-job detail page. */
export function parseJobDetail(html: string, id: string): JobDetail {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = titleMatch ? clean(titleMatch[1]) : "(sem título)"

  // Company: the <h2> inside the anchor to /empresa/.
  let company: string | null = null
  const org = html.match(/\/empresa\/[^"]*"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/i)
  if (org) company = clean(org[1]) || null

  // Info grid: <p class="title ...">LABEL</p> <h3 ...>VALUE</h3>.
  const info: Record<string, string> = {}
  const infoRe = /<p class="title[^"]*"[^>]*>([\s\S]*?)<\/p>\s*<h3[^>]*>([\s\S]*?)<\/h3>/gi
  let im: RegExpExecArray | null
  while ((im = infoRe.exec(html)) !== null) {
    info[clean(im[1]).toLowerCase()] = clean(im[2])
  }
  const location = info["localidade"] ?? null
  const workplace = info["tipo de vaga"] ?? null
  const vacancies = info["nº de vagas"] ?? info["n de vagas"] ?? info["no de vagas"] ?? null
  const salary = info["salário"] ?? info["salario"] ?? null
  const contractType = info["contratação"] ?? info["contratacao"] ?? info["regime"] ?? null
  const postedRaw = info["publicado há"] ?? info["publicado ha"] ?? null
  const posted = postedRaw ? `há ${postedRaw}` : null
  const { daysAgo, date } = posted ? parsePosted(posted) : { daysAgo: null, date: null }

  // Description block: keep paragraph/line breaks as newlines.
  let description: string | null = null
  const desc = html.match(
    /Descri[^<]*<\/h3>\s*<div class="text-cinza90 break-words"[^>]*>([\s\S]*?)<\/div>/i,
  )
  if (desc) {
    const withBreaks = desc[1]
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    description = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim() || null
  }

  // Apply link (candidate registration form for this vaga). Prefer the
  // vaga-specific link (carries ?vg=<id>) over the generic signup link.
  let applyUrl: string | null = null
  const apply =
    html.match(/href="([^"]*formulario-curriculo\?[^"]*vg=\d+[^"]*)"/i) ??
    html.match(/href="([^"]*formulario-curriculo[^"]*)"/i)
  if (apply) {
    const href = decodeHtmlEntities(apply[1])
    applyUrl = href.startsWith("http") ? href : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`
  }

  return {
    id,
    title,
    company,
    location,
    date,
    url: `${BASE_URL}/vaga/${id}`,
    salary,
    workplace,
    posted,
    daysAgo,
    description,
    contractType,
    vacancies,
    applyUrl,
  }
}
