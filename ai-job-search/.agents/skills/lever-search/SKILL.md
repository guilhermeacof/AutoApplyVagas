---
name: lever-search
version: 1.0.0
description: >
  Use this skill to search job listings across Brazilian tech companies that host
  their careers page on the Lever ATS (jobs.lever.co) — it aggregates postings from
  a registry of companies (CloudWalk, Neon, Zippi, TRACTIAN, Stark Bank) via Lever's
  public API. Invoke when the user wants to find jobs / vacancies at these companies,
  search Lever job boards, or look up a specific Lever posting. Trigger phrases (EN):
  find jobs on Lever, search Lever postings, jobs at CloudWalk / Neon / Zippi / TRACTIAN /
  Stark Bank, tech jobs in Brazil, look up this Lever posting. Gatilhos (PT): buscar
  vagas no Lever, vagas na CloudWalk, vagas na Neon, vagas na TRACTIAN, vaga de
  desenvolvedor, vaga de engenheiro, vaga de QA, ver esta vaga do Lever.
context: fork
allowed-tools: Bash(bun run skills/lever-search/cli/src/cli.ts *)
---

# Lever Search Skill

Search live job listings from Brazilian companies that host their careers page on the
**Lever** ATS. Lever is **per-company** — each company exposes its own board under a
"token" (e.g. `neon`, `cloudwalk`). This skill walks a **registry** of confirmed Brazilian
tokens and **aggregates** their postings into one result set, talking to Lever's public
JSON API (`https://api.lever.co/v0/postings/<token>`) — no authentication, no API key, and
**zero runtime dependencies** (just `bun`).

> Titles on these boards are often in **English** even for Brazil-based roles, so search
> both English (`engineer`, `developer`) and Portuguese (`desenvolvedor`, `qualidade`) terms.

## ⚠️ Uso pessoal

Isto consome a API pública do Lever da mesma forma que os sites `jobs.lever.co` fazem.
**Mantenha o volume baixo** (a busca faz 1 request por empresa) e não use para coleta em
massa ou fins comerciais. Use por sua conta e responsabilidade.

## Companies in the registry

`CloudWalk`, `Neon`, `Zippi`, `TRACTIAN`, `Stark Bank`. The registry lives in
`cli/src/companies.ts` (`{ token, name }`) — add a company by appending its confirmed
token there. List it any time with the `company` command.

## When to use this skill

- Search openings across all registered Lever companies by keyword (cargo, tecnologia, skill)
- Filter by location (`categories.location`) or posting recency
- Restrict to a single company (`-c <token>`)
- Get the full description of a specific Lever posting

## Commands

### Search job listings (aggregated across the registry)

```bash
bun run skills/lever-search/cli/src/cli.ts search [-q "<termo>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search over the **title**. Matched per word (AND):
  every term must appear. Case-insensitive. Ex.: `engineer`, `desenvolvedor`, `qa`.
- `--location <text>` / `-l <text>` — substring filter over `categories.location`
  (ex.: `Remoto`, `São Paulo`).
- `--company <token>` / `-c <token>` — restrict to ONE company from the registry (ex.: `neon`).
- `--jobage <days>` — posted within N days (client-side filter on `createdAt`). Omit for all.
- `--page <n>` — 1-indexed page (uses `--limit` as the page size).
- `--limit <n>` / `-n <n>` — page size / total results (client-side). Omit for all.
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/lever-search/cli/src/cli.ts detail <token:id | url> [--format json|plain]
```

`token:id` is the composite `id` from `search` results (ex.:
`neon:a053e021-e712-453c-9f8b-2e3194f5e7e9`). A `https://jobs.lever.co/<token>/<id>` URL also works.

### List the company registry

```bash
bun run skills/lever-search/cli/src/cli.ts company [--format json|table|plain]
```

## Usage examples

```bash
# Engineering roles across all companies, first 8, as a table
bun run skills/lever-search/cli/src/cli.ts search -q "engineer" --limit 8 --format table

# Remote developer roles
bun run skills/lever-search/cli/src/cli.ts search -q "desenvolvedor" -l "Remoto" --format table

# QA / quality roles
bun run skills/lever-search/cli/src/cli.ts search -q "qa" --format table

# Everything at Neon
bun run skills/lever-search/cli/src/cli.ts search -c neon --format table

# Full details for one posting
bun run skills/lever-search/cli/src/cli.ts detail neon:a053e021-e712-453c-9f8b-2e3194f5e7e9 --format plain

# Show the registry
bun run skills/lever-search/cli/src/cli.ts company --format table
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is
`{ "meta": { count, total, page, limit, companies, tokens }, "results": [...] }`.
Each result has at least `id`, `title`, `company`, `location`, `date`, `url` (missing values
are `null`, never omitted); `id` is the composite `<token>:<postingId>`. If a company's board
fails to load, its error is reported in `meta.errors` and the other companies still return.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process
exits with code `1`.

## Notes

- Data source: Lever public postings API — no credentials required. See `url-reference.md`.
- The API has **no server-side filters**; keyword/location/age filtering is client-side after
  fetching each company's full board (one request per company).
- Titles are often in **English** even for Brazilian roles — try English and Portuguese terms.
- Pagination is client-side over the aggregated, date-sorted (newest first) set.
- The API rate-limits under load; the CLI retries 429/5xx with exponential backoff. Keep volume
  low (see personal-use note above).
- Many Brazilian companies use Greenhouse/Gupy instead of Lever, so this registry is small by
  design — extend it in `cli/src/companies.ts` as you confirm more tokens.
