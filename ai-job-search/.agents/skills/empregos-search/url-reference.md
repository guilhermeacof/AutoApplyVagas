# Empregos.com.br — endpoint & parsing reference

Data source: **public server-rendered HTML** (Nuxt SSR). No JSON API, no auth.
This file documents the URL patterns and HTML anchors the CLI relies on, so a
maintainer can repair the parsers when the markup changes.

## Access / terms

- `robots.txt` (https://www.empregos.com.br/robots.txt) allows `/vagas/` (search) and
  does **not** disallow `/vaga/` (detail). It disallows `/curriculos/`, `/cursos/`,
  `/curso/`, `/administracao/`, `/pagamento/` — none of which this skill touches.
- No login required to view listings or detail pages. Personal-use-only warning is in
  `SKILL.md` (keep volume low).

## Search URL pattern

Path-based (no query string for keyword/location):

| Intent | URL |
|--------|-----|
| Keyword only | `https://www.empregos.com.br/vagas/<keyword-slug>` |
| Keyword + location | `https://www.empregos.com.br/vagas/<keyword-slug>-em-<location-slug>` |
| Page N (N ≥ 2) | append `/<N>` to either form |

- Slug rule: lowercase, strip accents (NFD + remove combining marks), replace runs of
  non-alphanumerics with `-`, trim leading/trailing `-`. `"analista qa"` → `analista-qa`.
- The site's alternate location forms `/vagas/<kw>/<city>/<uf>` and `/vagas/<kw>/<uf>`
  **301-redirect** to the `-em-` form, so the CLI builds the `-em-` form directly.
- ~20 job cards per page.
- Charset: page declares `charset=utf-8` and the bytes are valid UTF-8 (`fetch().text()`
  decodes correctly).

## Search result card anchors

Each card starts with an accessibility label; the CLI splits the page on this marker and
parses each chunk independently:

- **Card boundary / title:** `aria-label="Abrir detalhes da vaga <TITLE>"` — TITLE is the
  text up to the next `"`.
- **id + slug + detail URL:** first `/vaga/(\d+)/([^"?#\s]+)` in the chunk (the "Mais
  detalhes" anchor). Detail URL = `https://www.empregos.com.br/vaga/<id>/<slug>`.
- **Company:** `alt="Logo da empresa <NAME>"` (fallback: anchor text of a
  `href=".../empresa/..."` link).
- **Location:** `<h3 title="City, UF">` following the `location-on-outline` icon.
- **Workplace:** `<span>Presencial|Remoto|Híbrido</span>` following the `emoji-people` icon.
- **Salary:** `<h3>…</h3>` following the `payments-outline` icon (often "A combinar").
- **Posting date:** `<h3>Publicada há N dias</h3>` following the `event-outline` icon.
  Parsed to `daysAgo` and an ISO `date` (today − N days). Also handles `hoje`, `ontem`,
  `há N horas` (→ 0 days), `há N semanas` (×7), `há N meses` (×30).

## Detail URL pattern

- `https://www.empregos.com.br/vaga/<id>` — the **bare id works** (returns HTTP 200; the
  slug is optional). Full `/vaga/<id>/<slug>` URLs also work.

## Detail page anchors

- **Title:** `<h1 class="text-xl …">TITLE</h1>`.
- **Company:** `<h2>` inside the anchor to `/empresa/…` (`/empresa/[^"]*"…>\s*<h2>NAME</h2>`).
- **Info grid:** repeating `<p class="title …">LABEL</p><h3 …>VALUE</h3>` pairs. Labels
  seen: `Localidade`, `Tipo de vaga` (work model), `Nº de vagas`, `Publicado há`, and
  sometimes `Salário` / `Contratação`.
- **Description:** `Descrição da vaga` `</h3>` followed by
  `<div class="text-cinza90 break-words">…</div>` — no nested `<div>` inside, so a
  non-greedy match to the first `</div>` is safe. `<br>`, `</p>`, `</li>` etc. are
  converted to newlines; tags stripped; HTML entities decoded.
- **Apply link:** `href="…/formulario-curriculo?vagaTitulo=…&vg=<id>"` (vaga-specific;
  the CLI prefers the `vg=`-carrying link over the generic `/formulario-curriculo`).

## Known quirks

- The detail page's `og:title` / `og:url` / `application/ld+json` (`JobPosting`) meta
  tags sometimes describe a **different, rotating "featured" posting** (occasionally from
  a partner such as infojobs) rather than the main vaga. **Do not trust the meta tags for
  detail** — parse the main DOM (h1 + info grid + description block), which is what the
  CLI does.
