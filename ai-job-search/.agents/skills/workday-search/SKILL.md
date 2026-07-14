---
name: workday-search
version: 1.0.0
description: >
  Use this skill to search job openings across companies that run their careers on
  Workday (*.myworkdayjobs.com) — the ATS used by large multinationals that hire in
  Brazil. Workday is a PER-COMPANY ATS: this skill walks a registry of confirmed
  companies (Red Hat, Accenture, NVIDIA) and aggregates their public CXS JSON API.
  Invoke when the user wants to find Workday jobs/vacancies, search a specific
  Workday company, or look up a Workday posting by URL.
  Trigger phrases (EN): Workday jobs, myworkdayjobs, jobs on Workday, Red Hat jobs,
  Accenture jobs, NVIDIA jobs, search Workday careers, look up this Workday posting.
  Gatilhos (PT): vagas Workday, vagas no Workday, vagas na Red Hat, vagas na Accenture,
  vagas na NVIDIA, carreiras Workday, buscar vaga no myworkdayjobs, ver esta vaga do Workday,
  vagas em multinacional, oportunidades Workday.
context: fork
allowed-tools: Bash(bun run skills/workday-search/cli/src/cli.ts *)
---

# Workday Search Skill

Search live job openings across companies whose careers site runs on **Workday**
(`*.myworkdayjobs.com`) — the ATS behind many large multinationals that hire in Brazil.

Workday is a **per-company ATS**: every employer has its own *tenant* on one of Workday's
data centers, so there is no single search endpoint. This skill keeps a **registry** of
confirmed companies (`cli/src/companies.ts`) and, on each `search`, hits every company's
public **CXS JSON API** and **aggregates** the results. No authentication, no API key, and
**zero runtime dependencies**: it runs with just `bun`.

## Empresas confirmadas no registro

| Empresa | tenant.dc | site | vagas Brasil (facet) |
|---------|-----------|------|----------------------|
| Red Hat | `redhat.wd5` | `Jobs` | ~12 |
| Accenture | `accenture.wd103` | `AccentureCareers` | ~178 |
| NVIDIA | `nvidia.wd5` | `NVIDIAExternalCareerSite` | presente |

Cada uma foi confirmada batendo no endpoint CXS e vendo `jobPostings` reais + facet de país
"Brazil". Para adicionar outra empresa, edite `cli/src/companies.ts` (ver `url-reference.md`
→ "Como confirmar uma nova empresa").

## ⚠️ Uso pessoal

Isto lê a API pública CXS do Workday da mesma forma que o site de carreiras faz.
**Mantenha o volume baixo e não use para coleta em massa ou fins comerciais.** Use por sua
conta e responsabilidade.

## When to use this skill

- Search openings across all registry companies by keyword (cargo, tecnologia, skill)
- Restrict to a single company with `-c/--company`
- Filter by location (client-side) and posting age
- Get the full description of a specific posting (`detail`)

## Commands

### Search job listings (aggregated across the registry)

```bash
bun run skills/workday-search/cli/src/cli.ts search [-q "<termo>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword (cargo, skill, tecnologia). Recommended.
- `--location <text>` / `-l <text>` — **client-side** substring filter over each posting's
  location. Ex.: `"Brazil"`, `"São Paulo"`, `"Remote"`. It only scans the results already
  fetched, so combine it with `-q` and, if needed, a larger `--limit`/`--page` to widen the
  scan (see Notes).
- `--company <name>` / `-c <name>` — restrict to ONE registry company (substring of the
  name or tenant, e.g. `-c "Red Hat"`, `-c accenture`).
- `--jobage <days>` — posted within N days. Applied over the date parsed from Workday's
  relative `postedOn` label ("Posted 3 Days Ago" → a real date). Undated cards are kept.
- `--page <n>` — page (1-indexed) over the aggregated stream. Default `1`.
- `--limit <n>` / `-n <n>` — results per page. Default `20`.
- `--format json|table|plain` — default `json`.

### List the registry

```bash
bun run skills/workday-search/cli/src/cli.ts company
```

Prints the confirmed companies and their `{tenant, dc, site, lang}` coordinates.

### Fetch full job detail

```bash
bun run skills/workday-search/cli/src/cli.ts detail "<empresa>:<externalPath>" [--format json|plain]
bun run skills/workday-search/cli/src/cli.ts detail "<url myworkdayjobs.com>"  [--format json|plain]
```

Two ways to point at a posting:
- **`<company>:<externalPath>`** — the company name from the registry plus the Workday
  `externalPath` (starts with `/job/...`), e.g.
  `"Red Hat:/job/Pune/Software-Engineer_R-056394-1"`.
- **A full posting URL** — the `url` field returned by `search` (e.g.
  `https://redhat.wd5.myworkdayjobs.com/Jobs/job/Pune/...`). tenant/dc/site are parsed
  from the URL, so this works even for companies not in the registry.

## Usage examples

```bash
# Engineering roles across the whole registry, as a table
bun run skills/workday-search/cli/src/cli.ts search -q "engineer" --limit 8 --format table

# QA/testing roles at Accenture only
bun run skills/workday-search/cli/src/cli.ts search -q "qa" -c "Accenture" --limit 10 --format table

# Developer roles posted in the last week
bun run skills/workday-search/cli/src/cli.ts search -q "developer" --jobage 7 --format table

# Red Hat roles in Pune (client-side location filter)
bun run skills/workday-search/cli/src/cli.ts search -q "engineer" -c "Red Hat" -l "Pune" --format table

# List the registry
bun run skills/workday-search/cli/src/cli.ts company

# Full details for a specific posting
bun run skills/workday-search/cli/src/cli.ts detail "Red Hat:/job/Pune/Software-Engineer_R-056394-1" --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing a `url` to `detail` |
| `table` | Quick human-readable scanning (shows company column) |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is
`{ "meta": { count, page, limit, total, companies:{<name>:<total>} }, "results": [...] }`.
Each result has `id`, `title`, `company`, `location`, `date`, `url` — missing values are
`null`, never omitted. `company` is the registry name (e.g. `"Red Hat"`).

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process
exits with code `1`.

## Notes

- **Data source:** the public Workday CXS JSON API (`/wday/cxs/<tenant>/<site>/jobs`), no
  auth. Documented in `url-reference.md`.
- **Per-company aggregation.** `search` fires one request set per registry company and
  round-robin interleaves the results so every company appears. `meta.companies` reports
  each company's total.
- **`total` quirk.** Workday returns the real `total` only on the first (offset 0) response;
  paginated responses report `total: 0`. The CLI keeps the largest value seen.
- **Location filter is client-side.** Workday's location facet needs opaque per-tenant ids,
  so `-l` filters the fetched window by substring instead. It works best with a keyword
  query; to scan more of a company's list, raise `--limit` or advance `--page`. Volume is
  capped at 5 CXS requests per company to stay light.
- **`postedOn` is relative.** Search cards carry labels like "Posted 3 Days Ago" /
  "Posted 30+ Days Ago" (localized to pt-BR: "Publicada..."); the CLI parses them to a real
  date for `date` and `--jobage`. The `detail` page exposes a precise ISO `startDate`.
- **Location text is localized.** Because requests send `Accept-Language: pt-BR`, Workday
  may return "3 Locais" instead of "3 Locations". Harmless.
- **Adding a company** is a one-line edit to `cli/src/companies.ts` — see `url-reference.md`.
