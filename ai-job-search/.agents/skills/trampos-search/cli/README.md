# trampos-cli

CLI for searching jobs on **Trampos.co** — a Brazilian job board for tech, startup,
digital, marketing, and creative roles.

**Data source**: Trampos.co public JSON API (`/api/v2/opportunities` — list, and `/api/v2/opportunities/<id>` — detail).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> The Trampos.co listings page is a JavaScript single-page app (Ember), so there is no
> server-rendered HTML to scrape. This CLI calls the same public JSON API the site itself
> uses. **Personal use only** — keep volume low, no bulk/commercial use.

## Installation

```bash
cd .agents/skills/trampos-search/cli
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
# Developer roles, first 5
bun run src/cli.ts search -q "desenvolvedor" --limit 5 --format table

# Python roles in São Paulo
bun run src/cli.ts search -q "python" -l "SP" --format table

# IT category, last 7 days
bun run src/cli.ts search -c "ti" --jobage 7 --format table

# Full detail for one job
bun run src/cli.ts detail 773418 --format plain
```

See `../SKILL.md` for the full flag reference and the personal-use note, and
`../url-reference.md` for the API endpoints and field mapping.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (cargo / tecnologia / skill). Matched as a phrase — prefer one strong term. |
| `--location` | `-l` | Filter by location (UF like `SP`, or a city name). |
| `--category` | `-c` | Category slug (`ti`, `programacao`, `dados`, `design`, `marketing`, …). |
| `--jobage` | | Posted within N days (client-side filter on posting date). |
| `--page` | | 1-indexed page (12 results/page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
