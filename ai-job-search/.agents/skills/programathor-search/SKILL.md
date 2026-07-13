---
name: programathor-search
version: 1.0.0
description: >
  Use this skill to search job listings on Programathor (programathor.com.br), a
  Brazilian job board for developer / tech roles with many remote positions.
  Invoke when the user wants to find dev/tech jobs in Brazil (vagas tech Brasil/remoto),
  look up a specific Programathor posting, or scrape Programathor openings.
  Trigger phrases (EN): find a job on Programathor, search Programathor jobs, developer
  jobs in Brazil, remote tech jobs Brazil, look up this Programathor posting.
  Gatilhos (PT): buscar vagas no Programathor, vagas de tecnologia no Brasil, vagas
  remotas para desenvolvedor, vaga de programador, vaga de QA, vaga de desenvolvedor,
  procurar emprego dev no Programathor, ver esta vaga do Programathor.
context: fork
allowed-tools: Bash(bun run skills/programathor-search/cli/src/cli.ts *)
---

# Programathor Search Skill

Search live job listings from **Programathor** (https://programathor.com.br), a Brazilian
job board focused on developer / tech roles, with a strong share of remote positions.
The listing and detail pages are **server-rendered HTML**, so this skill parses the job
cards directly with regex — no authentication, no API key, and **zero runtime
dependencies**: it runs with just `bun`.

## ⚠️ Uso pessoal

Isto lê páginas públicas do Programathor. `robots.txt` libera `/jobs` (bloqueia apenas
`/admin`, `/user`, `/users`, `/company`). **Mantenha o volume baixo e não use para coleta
em massa ou fins comerciais.** Use por sua conta e responsabilidade.

## When to use this skill

- Search Programathor openings by keyword (cargo, tecnologia, skill)
- Filter by technology, seniority, contract type, remote, or city
- Get the full description of a specific Programathor posting

## Commands

### Search job listings

```bash
bun run skills/programathor-search/cli/src/cli.ts search [-q "<termo>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — free-text keyword. It first tries Programathor's own
  technology route (`/jobs-<slug>`); if that returns nothing (e.g. a role phrase like
  `desenvolvedor`) it falls back to client-side keyword filtering over the general listing.
- `--tech <slug>` / `-t <slug>` — use a Programathor technology route directly, e.g.
  `python`, `java`, `react`, `quality-assurance`, `testes-funcionais`. Strongest filter
  (server-side).
- `--location <cidade>` / `-l <cidade>` — filter by city (`place` parameter), e.g. `"São Paulo"`.
- `--remote` — remote openings only.
- `--contract <tipo>` — `CLT`, `PJ`, or `Estágio`.
- `--seniority <nível>` / `-s <nível>` — `Júnior`, `Pleno`, or `Sênior`.
- `--include-expired` — include expired ("Vencida") postings (hidden by default).
- `--jobage <days>` — **not supported on search**: listing cards carry no posting date,
  so this flag is accepted but ignored. The posting date is available on `detail`.
- `--page <n>` — page number (1-indexed, 15 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/programathor-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job id from `search` results (e.g. `33665`). You may also pass a full
`https://programathor.com.br/jobs/<id>-<slug>` URL. Returns the full description,
company, location, contract, seniority, salary, technologies, posting date, and
valid-through date (from the page's JSON-LD `JobPosting`).

## Usage examples

```bash
# Developer roles, first 5, as a table
bun run skills/programathor-search/cli/src/cli.ts search -q "desenvolvedor" --limit 5 --format table

# Python roles, remote only
bun run skills/programathor-search/cli/src/cli.ts search -q "python" --remote --format table

# QA / testing via the native technology route
bun run skills/programathor-search/cli/src/cli.ts search -t "quality-assurance" --format table

# Senior analyst roles
bun run skills/programathor-search/cli/src/cli.ts search -q "analista" -s "Sênior" --format table

# Full details for a specific posting
bun run skills/programathor-search/cli/src/cli.ts detail 33665 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is `{ "meta": { count, page, source }, "results": [...] }`. Each result
has at least `id`, `title`, `company`, `location`, `date`, `url` (missing values are
`null`, never omitted), plus `salary`, `seniority`, `contract`, `companySize`, `remote`,
`expired`, and `tags`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the
process exits with code `1`.

## Notes

- Data source: Programathor server-rendered HTML at `/jobs`, `/jobs-<tech>`, and
  `/jobs/<id>-<slug>`. See `url-reference.md` for the exact anchors parsed.
- Page size is fixed at 15 cards per page.
- **Listing cards have no posting date** (`date` is always `null` in `search`). The date
  (`datePosted`) and validity (`validThrough`) come from the detail page's JSON-LD.
  Because of this, `--jobage` is not supported on search.
- **Expired jobs are hidden by default.** Programathor keeps expired ("Vencida") postings
  in its listings (some technology routes such as `quality-assurance` may be *entirely*
  expired at a given moment); pass `--include-expired` to see them. When a keyword returns
  "Nenhum resultado", it usually means there are no *active* postings for that term right now.
- `--query` strategy: it slugifies the query and tries `/jobs-<slug>` first (Programathor's
  own tag search, server-side). Multi-word tech terms work well (`"quality assurance"` →
  `/jobs-quality-assurance`). Role phrases that are not technologies (`desenvolvedor`,
  `analista de testes`) fall back to a client-side keyword filter over the general listing
  (all non-stopword tokens must match title/tags/company). The `--tech` flag skips straight
  to the native route.
- The site rate-limits under load; the CLI retries 429/5xx with exponential backoff. Keep
  volume low (see personal-use note above).
