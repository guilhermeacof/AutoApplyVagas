# workday-cli

CLI for searching jobs across companies whose careers site runs on **Workday**
(`*.myworkdayjobs.com`) — the ATS behind many large multinationals that hire in Brazil.

**Data source**: the public Workday **CXS** JSON API (`/wday/cxs/<tenant>/<site>/jobs`),
which backs every `*.myworkdayjobs.com` career site.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> Workday is a **per-company ATS** — each employer has its own tenant. This CLI keeps a
> registry (`src/companies.ts`) of confirmed companies and aggregates their CXS APIs.
> The endpoints and field mapping are documented in `../url-reference.md`.
> **Personal use only** — keep volume low, no bulk/commercial use.

## Installation

```bash
cd .agents/skills/workday-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search job listings, aggregated across the registry |
| `company` | List the registry companies and their coordinates |
| `detail` | Fetch full detail for a single job (by `company:path` or URL) |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Engineering roles across all companies, first 8
bun run src/cli.ts search -q "engineer" --limit 8 --format table

# QA roles at Accenture only
bun run src/cli.ts search -q "qa" -c "Accenture" --format table

# Developer roles posted in the last 7 days
bun run src/cli.ts search -q "developer" --jobage 7 --format table

# List the registry
bun run src/cli.ts company

# Full detail for one job (company:externalPath, or a posting URL)
bun run src/cli.ts detail "Red Hat:/job/Pune/Software-Engineer_R-056394-1" --format plain
```

See `../SKILL.md` for the full flag reference and the personal-use note, and
`../url-reference.md` for the endpoints, field mapping, and how to add a company.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keyword (cargo / tecnologia / skill). |
| `--location` | `-l` | Client-side substring filter over each posting's location (e.g. `"Brazil"`, `"São Paulo"`). Scans the fetched window only. |
| `--company` | `-c` | Restrict to ONE registry company (substring of name/tenant). |
| `--jobage` | | Posted within N days (over the date parsed from `postedOn`). |
| `--page` | | 1-indexed page over the aggregated stream. |
| `--limit` | `-n` | Results per page (default 20). |
| `--format` | | `json` \| `table` \| `plain`. |

## Notes

- `company` is the registry name (e.g. `"Red Hat"`). Confirmed companies: Red Hat,
  Accenture, NVIDIA — all hire in Brazil. Add more in `src/companies.ts`.
- `date` comes from Workday's relative `postedOn` label ("Posted 3 Days Ago" → an ISO
  date); `detail` returns a precise `startDate`.
- Workday reports the real `total` only on the first page; the CLI keeps the max.
- Location filtering is client-side (Workday's server-side facet needs opaque per-tenant
  ids); combine `-l` with `-q` and a larger `--limit` to widen the scan.
