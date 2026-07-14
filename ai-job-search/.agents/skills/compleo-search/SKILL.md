---
name: compleo-search
version: 1.0.0
description: >
  Use this skill to search job listings on public career boards powered by the
  Compleo ATS (jobs.compleo.app), used by many Brazilian companies and IT
  consultancies on their own careers sites. Invoke when the user wants to find
  jobs / vacancies on a Compleo board, search a company's Compleo careers page,
  or look up a specific Compleo posting. Trigger phrases (EN): find a job on
  Compleo, search Compleo jobs, jobs on a Compleo career board, Brazilian company
  careers page, look up this Compleo posting. Gatilhos (PT): buscar vagas no
  Compleo, vagas em empresas que usam Compleo, vagas Brasil, board de vagas
  Compleo, procurar emprego em site de carreiras Compleo, ver esta vaga do
  Compleo, vaga de desenvolvedor, vaga de analista, vaga de QA.
context: fork
allowed-tools: Bash(bun run skills/compleo-search/cli/src/cli.ts *)
---

# Compleo ATS Search Skill

Search live job listings from public **Compleo ATS** career boards — the careers
sites (`jobs.compleo.app/<board>/joblist`) that many Brazilian companies and IT
consultancies run on the Compleo applicant-tracking system. It talks to the board's
public JSON API (`POST api.compleo.app/job/careerjoblist/<BOARD>`) for search and
parses the server-rendered job page for detail — no authentication, no API key, and
**zero runtime dependencies**: it runs with just `bun`.

> Each Compleo board belongs to **one** company. Consultancy/staffing boards (for
> example the default board, `emphasys`) list openings for many **client** companies —
> so the `company` field of each result is that client (the real employer), which is
> exactly the "empresa" you want on a multi-company board. There is **no** global
> search across all Compleo boards; choose a board with `-b`.

## ⚠️ Uso pessoal

Isto consome os endpoints públicos dos boards Compleo da mesma forma que o site faz
(`robots.txt` permite tudo). **Mantenha o volume baixo e não use para coleta em massa
ou fins comerciais.** Use por sua conta e responsabilidade.

## When to use this skill

- Search a Compleo board's openings by keyword (cargo, tecnologia, skill)
- Filter by location (client-side) or posting recency
- Get the full description of a specific Compleo posting

## Commands

### Search job listings

```bash
bun run skills/compleo-search/cli/src/cli.ts search [-q "<termo>"] [-b <board>] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search. Matched against the job **title and
  description only** (not the company name or location). A single strong term works best
  (e.g. `desenvolvedor`, `analista`, `oracle`).
- `--board <link>` / `-b <link>` — which Compleo board (the company's `uniqueLink`, i.e.
  the `<company>` in `<company>.compleo.com.br`). Default: `emphasys`.
- `--location <text>` / `-l <text>` — filter by location (city/UF). Applied **client-side**
  as an accent-insensitive substring match over the fetched page (the API filters
  location only via faceted buckets).
- `--jobage <days>` — posted within N days (client-side filter on the opening date; the
  API has no age parameter). Omit for all postings.
- `--page <n>` — page number (1-indexed).
- `--limit <n>` / `-n <n>` — cap total results emitted (also sets the API page size,
  clamped 10–50).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/compleo-search/cli/src/cli.ts detail <id|url> [-b <board>] [--format json|plain]
```

`id` is the `pk` from `search` results (e.g. `JOB:PK05328B` — the bare code `PK05328B`
also works). Pass `-b <board>` for a bare id, or give a full
`https://jobs.compleo.app/<board>/jobdetail/<code>` URL (board is read from it). Returns
the full description, responsibilities, requirements, working model, and dates.

## Usage examples

```bash
# Developer roles on the default (emphasys) board, first 5, as a table
bun run skills/compleo-search/cli/src/cli.ts search -q "desenvolvedor" --limit 5 --format table

# Analyst roles
bun run skills/compleo-search/cli/src/cli.ts search -q "analista" --format table

# Oracle roles in São Paulo (location filtered client-side)
bun run skills/compleo-search/cli/src/cli.ts search -q "oracle" -l "São Paulo" --format table

# Search a different company's Compleo board
bun run skills/compleo-search/cli/src/cli.ts search -q "qualidade" -b <company> --format table

# Full details for a specific posting
bun run skills/compleo-search/cli/src/cli.ts detail JOB:PK05328B -b emphasys --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is `{ "meta": { count, page, total, per_page, board }, "results": [...] }`.
Each result has at least `id`, `title`, `company`, `location`, `date`, `url` (missing
values are `null`, never omitted), plus `workingModel`, `experienceLevel`, `board`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the
process exits with code `1`.

## Notes

- Data source: public Compleo board API + server-rendered job pages — no credentials.
- **Multi-empresa:** `company` = the client company (`customer`) of the job. Only search
  results carry it; the `detail` page has no customer field, so `company` is `null` there.
- `-b`/`--board` selects the company's Compleo board (its `uniqueLink`). The CLI resolves
  the required numeric `companyId` automatically by scraping the board page; an unknown
  board exits 1 with `BOARD_NOT_FOUND`.
- Keyword search hits **title + description only**. `--location` and `--jobage` are
  applied client-side (see `url-reference.md`).
- Boards are usually small (dozens of jobs at most), so niche terms (e.g. `qa`) often
  return 0 results — that is expected, not an error.
- The API rate-limits under load; the CLI retries 429/5xx with exponential backoff. Keep
  volume low (see personal-use note above).
