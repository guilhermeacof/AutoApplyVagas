---
name: empregos-search
version: 1.0.0
description: >
  Use this skill to search job listings on Empregos.com.br, one of the largest
  general Brazilian job boards (all sectors, all of Brazil). Invoke when the user
  wants to find jobs / vacancies in Brazil on Empregos.com.br, look up a specific
  Empregos.com.br posting, or scrape Empregos.com.br openings. Trigger phrases
  (EN): find a job on Empregos.com.br, search Empregos jobs, jobs in Brazil,
  vacancies Brazil, look up this Empregos posting. Gatilhos (PT): buscar vagas no
  Empregos.com.br, vagas no Empregos, vagas de emprego no Brasil, procurar emprego
  no Empregos.com.br, ver esta vaga do Empregos, vaga de analista, vaga de QA,
  vagas Brasil.
context: fork
allowed-tools: Bash(bun run skills/empregos-search/cli/src/cli.ts *)
---

# Empregos.com.br Search Skill

Search live job listings from **Empregos.com.br**, a large general-purpose Brazilian
job board covering all sectors nationwide. It reads the site's **public,
server-rendered** search and detail pages (Nuxt SSR) — no authentication, no API key,
and **zero runtime dependencies**: it runs with just `bun`.

> Empregos.com.br renders its job cards directly in the HTML, so this skill parses that
> HTML with regex. There is no public JSON API; parsing anchors are documented in
> `url-reference.md` for when the markup changes.

## ⚠️ Uso pessoal

Isto lê as páginas públicas do Empregos.com.br. O `robots.txt` do site libera `/vagas/`
(usado para busca) e bloqueia `/curriculos/` e `/cursos/` (não usados aqui). **Mantenha
o volume baixo e não use para coleta em massa ou fins comerciais.** Use por sua conta e
responsabilidade.

## When to use this skill

- Search Empregos.com.br openings by keyword (cargo, skill)
- Filter by location (cidade/UF) and posting recency
- Get the full description of a specific Empregos.com.br posting

## Commands

### Search job listings

```bash
bun run skills/empregos-search/cli/src/cli.ts search -q "<termo>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (cargo, skill). **Required.**
  The term becomes a URL slug (e.g. `analista qa` → `/vagas/analista-qa`), so prefer a
  clear job title or role.
- `--location <text>` / `-l <text>` — location filter (city + UF). Pass it naturally,
  e.g. `-l "sao paulo sp"` or `-l "rio de janeiro rj"`; it is slugified and appended as
  `-em-<local>` to the search path.
- `--jobage <days>` — posted within N days (client-side filter on the posting date; the
  site has no age parameter). Omit for all postings.
- `--page <n>` — page number (1-indexed, ~20 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/empregos-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the vaga id from `search` results (e.g. `11592901`). You may also pass a full
`https://www.empregos.com.br/vaga/<id>/<slug>` URL. Returns the full description,
company, location, work model, contract type, posting date, and apply link.

## Usage examples

```bash
# QA analyst roles, first 5, as a table
bun run skills/empregos-search/cli/src/cli.ts search -q "analista qa" --limit 5 --format table

# Test analyst roles in São Paulo
bun run skills/empregos-search/cli/src/cli.ts search -q "analista de testes" -l "sao paulo sp" --format table

# Quality roles posted in the last 15 days
bun run skills/empregos-search/cli/src/cli.ts search -q "qualidade de software" --jobage 15 --format table

# Second page of developer roles
bun run skills/empregos-search/cli/src/cli.ts search -q "desenvolvedor" --page 2 --format table

# Full details for a specific posting
bun run skills/empregos-search/cli/src/cli.ts detail 11592901 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is `{ "meta": { count, page }, "results": [...] }`. Each result has at
least `id`, `title`, `company`, `location`, `date`, `url` (missing values are `null`,
never omitted), plus `salary`, `workplace` (Presencial/Remoto/Híbrido), `posted` (raw
"há N dias" string) and `daysAgo`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the
process exits with code `1`.

## Notes

- Data source: Empregos.com.br public server-rendered HTML — no credentials required.
- `--query` is **required**: the site's search is path-based (`/vagas/<slug>`), there is
  no keyword-less listing this skill targets.
- `--location` is optional and, when given, is folded into the search path as
  `/vagas/<termo>-em-<local>` (the site 301-redirects its `city/uf` forms to this shape).
- `date` is an ISO date (YYYY-MM-DD) computed from the relative "publicada há N dias"
  label; the raw label is also exposed as `posted`.
- `--jobage` is applied client-side (on the computed posting date) because the site has
  no age filter.
- The detail page occasionally embeds a rotating "featured" posting in its `og:`/JSON-LD
  meta tags (sometimes from a partner source); this skill deliberately parses the **main
  DOM** (h1, info grid, description block) and ignores those meta tags.
- Roughly 20 results per page. The site may rate-limit under load; the CLI retries
  429/5xx with exponential backoff. Keep volume low (see personal-use note above).
