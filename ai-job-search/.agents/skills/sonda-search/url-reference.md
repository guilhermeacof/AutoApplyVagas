# SONDA / SuccessFactors — endpoint & parsing reference

**Site:** `https://carrera.sonda.com`
**Platform:** SAP SuccessFactors ("Recruiting" / RMK) career site — **server-rendered
HTML**, HTTP 200, no authentication.

> This is a **reusable pattern.** SuccessFactors powers the careers sites of many large
> employers; the HTML anchors below are SF conventions, not SONDA-specific. To retarget
> this skill to another SF employer, change `BASE` and `COMPANY` in
> `cli/src/helpers.ts` (and, if their instance uses different facet parameter names,
> `buildSearchUrl`). Everything else is generic SuccessFactors parsing.

## robots.txt

`https://carrera.sonda.com/robots.txt` — `User-agent: *` disallows only
`/applybutton/`, `/talentcommunity/`, `/emailsubscribe/`, `/services/`, `/preapply/`,
`/error`, `/unsubscribe/`, `/reset/`. **`/search/` and `/job/` are allowed.**

## Search endpoint

```
GET https://carrera.sonda.com/search/?q=<keyword>&startrow=<offset>&optionsFacetsDD_location=<facet>
```

| Parameter | Meaning |
|-----------|---------|
| `q` | Keyword (cargo/skill/tecnologia). Empty `q=` returns all jobs. |
| `startrow` | Pagination **offset**, not a page number. Page size is **100**, so page N ⇒ `startrow = (N-1)*100`. Omit (or 0) for the first page. |
| `optionsFacetsDD_location` | Location facet. Value must equal a facet **label exactly**, e.g. `Distrito Federal, Brasil`, `São Paulo, Brasil`, `Panama`. |
| `optionsFacetsDD_department` | Department facet (not wired into the CLI; same mechanism if needed). |

**Page size = 100** (confirmed live: `startrow=0` → rows 1–100, `startrow=100` → 101+).

### Result cards (HTML)

Each posting is a table row: `<tr class="data-row">`. The parser splits on that boundary
and parses each row independently (one malformed row can't break the rest). Per row:

| Field | Anchor |
|-------|--------|
| `url` + `id` | `href="/job/<slug>/<id>/"` — first job anchor in the row. `id` is the numeric segment (e.g. `1399762100`). URL is `BASE + href` (entity-decoded). |
| `title` | First `<a ... class="jobTitle-link">TITLE</a>`. Attribute order differs between the desktop (`href` first) and hidden mobile (`class` first) copies — the href is matched independently of the title. |
| `location` | `<td class="colLocation ...">` → `<span class="jobLocation">Distrito Federal, Brasil</span>`. **Scope to the `colLocation` column** — a hidden mobile `jobLocation` duplicate lives inside the title cell. |
| `department` | `<td class="colDepartment ...">` → `<span class="jobDepartment">…</span>`. |
| `date` | **Not present** on the list page (no date column). Always `null`. |
| `company` | Not on the card; hard-coded to `SONDA`. |

### Total count

Pagination label / aria-label:
`aria-label="… resultados 1 a 100 de 142"` and
`<span class="paginationLabel">Resultados 1 – 100 de 142</span>`.
Parser reads `resultados \d+ a \d+ de (\d+)` (aria) with the paginationLabel `de (\d+)$`
as fallback → `meta.total`.

## Detail endpoint

```
GET https://carrera.sonda.com/job/<slug>/<id>/
```

A bare id also works with any slug: `/job/x/<id>/` resolves (SF ignores the slug).

**No JSON-LD `JobPosting`** on this instance. Data comes from microdata `<meta>` tags
and a description span:

| Field | Anchor |
|-------|--------|
| `title` | `<span itemprop="title" data-careersite-propertyid="title">TITLE</span>` |
| `location` | `<meta itemprop="addressLocality" content="…">` + `addressRegion` + `addressCountry`, joined with `, `. **SF truncates these** (slug-derived), e.g. `Mansoes do Lago, Dist, Br`. The search page has the clean location — prefer that. |
| `date` | `<meta itemprop="datePosted" content="Tue Jul 14 07:00:00 UTC 2026">` (`Date.parse`-able). |
| `company` | `<meta itemprop="hiringOrganization" content="SONDA">` — hard-coded to `SONDA`. |
| `description` | `<span class="jobdescription"> … rich HTML … </span>`, nested inside `itemprop="description"`. **Extracted by balanced `<span>`/`</span>` counting** — the ad contains nested `<span>`s, so a lazy regex stops early. Then stripped to clean text with paragraph breaks preserved. |
| `employmentType` | `<meta itemprop="employmentType">` if present (absent on observed pages → `null`). |

## Contract

Commands `search` / `detail <id|url>`; flags `-q/--query`, `-l/--location`, `--jobage`,
`--page`, `--limit/-n`, `--format json|table|plain` (default `json`). Output
`{ meta:{count,page,total,per_page}, results:[{id,title,company,location,department,date,url}] }`;
`company` always `"SONDA"`, missing values `null`. Errors → stderr
`{ "error", "code" }`, exit 1. Backoff on 429/5xx. Zero runtime dependencies.
