---
name: sonda-search
version: 1.0.0
description: >
  Use this skill to search job openings at SONDA, a large Latin-American IT services
  consultancy, on its careers site carrera.sonda.com (a SAP SuccessFactors career site).
  Invoke when the user wants to find SONDA jobs/vacancies, look up a specific SONDA
  posting, or scrape SONDA openings. Trigger phrases (EN): SONDA jobs, SONDA IT jobs,
  search SONDA careers, jobs at SONDA, look up this SONDA posting, SONDA vacancies.
  Gatilhos (PT): vagas SONDA, vagas na SONDA, vagas de TI na SONDA, SONDA IT, carreiras
  SONDA, oportunidades SONDA, procurar emprego na SONDA, ver esta vaga da SONDA,
  buscar vaga na SONDA.
context: fork
allowed-tools: Bash(bun run skills/sonda-search/cli/src/cli.ts *)
---

# SONDA Search Skill

Search live job openings at **SONDA** (a large Latin-American IT services consultancy)
from its careers site **carrera.sonda.com**. The site runs on **SAP SuccessFactors**
(the same "career site" software many large employers use), and both the results page
and the job-detail page are **server-rendered HTML** — this skill parses them directly
with regex. No authentication, no API key, and **zero runtime dependencies**: it runs
with just `bun`.

The `company` field is always **"SONDA"**. Because SuccessFactors is a reusable pattern,
the parsing anchors are documented in `url-reference.md` and the base host is a single
constant (`BASE` in `cli/src/helpers.ts`) — retargeting to another SuccessFactors
employer means changing `BASE`/`COMPANY`, not rewriting the parsers.

## ⚠️ Uso pessoal

Isto lê as páginas públicas do carrera.sonda.com da mesma forma que um navegador.
**Mantenha o volume baixo e não use para coleta em massa ou fins comerciais.** Use por
sua conta e responsabilidade. `robots.txt` do site permite `/search/` e `/job/`
(bloqueia apenas rotas de apply/subscribe/services).

## When to use this skill

- Search SONDA openings by keyword (cargo, tecnologia, skill)
- Filter by location using SONDA's own location facet
- Get the full description of a specific SONDA posting

## Commands

### Search job listings

```bash
bun run skills/sonda-search/cli/src/cli.ts search [-q "<termo>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (cargo, skill, tecnologia). Recommended.
- `--location <text>` / `-l <text>` — SuccessFactors location facet. The value must match
  a **facet label exactly**, e.g. `"Distrito Federal, Brasil"`, `"São Paulo, Brasil"`,
  `"Panama"`. A wrong value silently returns the unfiltered list.
- `--jobage <days>` — posted within N days. **The SONDA results list carries no posting
  date**, so this filter has no effect on `search` output (all list cards have
  `date: null` and are kept). Posting date *is* available on the `detail` page.
- `--page <n>` — page number (1-indexed). SuccessFactors serves up to **100 results per
  page**; the CLI maps `--page n` to `startrow=(n-1)*100`.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/sonda-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric id from `search` results (e.g. `1399762100`). You may also pass a
full `https://carrera.sonda.com/job/<slug>/<id>/` URL. Returns the full description
(clean text, paragraph breaks preserved), location, posting date, and apply URL.

## Usage examples

```bash
# Analyst roles, first 8, as a table
bun run skills/sonda-search/cli/src/cli.ts search -q "analista" --limit 8 --format table

# Quality/QA roles (finds "Analista de Melhoria de Processos Sr. (Qualidade)")
bun run skills/sonda-search/cli/src/cli.ts search -q "qualidade" --format table

# DevOps roles in the Federal District
bun run skills/sonda-search/cli/src/cli.ts search -q "devops" -l "Distrito Federal, Brasil" --format table

# QA automation roles
bun run skills/sonda-search/cli/src/cli.ts search -q "testes" --format table

# Full details for a specific posting
bun run skills/sonda-search/cli/src/cli.ts detail 1399762100 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is `{ "meta": { count, page, total, per_page }, "results": [...] }`.
Each result has `id`, `title`, `company` (always `"SONDA"`), `location`, `department`,
`date` (always `null` on search), `url` — missing values are `null`, never omitted.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the
process exits with code `1`.

## Notes

- **Data source:** carrera.sonda.com — SAP SuccessFactors, server-rendered HTML, no auth.
- **Company is fixed** to `"SONDA"`; this is a single-employer skill.
- **SONDA posts across Latin America** — results include roles in Brazil, Chile, Panamá,
  México etc., in both Portuguese and Spanish. Use `-l` to narrow to a location facet.
- **No date on the list page.** SuccessFactors' results table has no posting-date column,
  so `search` results always have `date: null` and `--jobage` cannot filter them. The
  `detail` page does expose `datePosted` (via microdata), which `detail` returns.
- **Detail location is slug-derived** and often truncated by SuccessFactors (e.g.
  `"Mansoes do Lago, Dist, Br"`). The **search** page carries the clean, human location
  (e.g. `"Distrito Federal, Brasil"`), so prefer the search result's `location` field.
- **Page size is 100.** `--page 2` fetches `startrow=100` (results 101+).
- The site rate-limits under load; the CLI retries 429/5xx with exponential backoff.
  Keep volume low (see personal-use note above).
- `url-reference.md` records the SuccessFactors HTML anchors — the file to consult if the
  site changes its markup.
