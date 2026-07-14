# sonda-cli

CLI for searching jobs at **SONDA** — a large Latin-American IT services consultancy —
on its careers site **carrera.sonda.com**.

**Data source**: `carrera.sonda.com` — a **SAP SuccessFactors** career site. Both the
results page (`/search/`) and the job-detail page (`/job/<slug>/<id>/`) are
server-rendered HTML, parsed with regex.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> SuccessFactors is a reusable pattern — the same software backs many employers' career
> sites. The parsing anchors are documented in `../url-reference.md`, and the target host
> is a single `BASE` constant in `src/helpers.ts`. **Personal use only** — keep volume
> low, no bulk/commercial use.

## Installation

```bash
cd .agents/skills/sonda-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Analyst roles, first 8
bun run src/cli.ts search -q "analista" --limit 8 --format table

# Quality/QA roles
bun run src/cli.ts search -q "qualidade" --format table

# DevOps roles in the Federal District (exact facet label)
bun run src/cli.ts search -q "devops" -l "Distrito Federal, Brasil" --format table

# Full detail for one job
bun run src/cli.ts detail 1399762100 --format plain
```

See `../SKILL.md` for the full flag reference and the personal-use note, and
`../url-reference.md` for the endpoints and field mapping.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keyword (cargo / tecnologia / skill). |
| `--location` | `-l` | SuccessFactors location facet — must match a facet label exactly (e.g. `"São Paulo, Brasil"`). |
| `--jobage` | | Posted within N days. **No effect on `search`**: the SONDA list page has no dates. |
| `--page` | | 1-indexed page (up to 100 results/page; `startrow=(n-1)*100`). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Notes

- `company` is always `"SONDA"` (single-employer skill).
- `date` is `null` on `search` (no date column on the list); `detail` returns `datePosted`.
- `detail` location is slug-derived and often truncated by SuccessFactors — the clean
  location lives on the `search` result.
