# programathor-cli

CLI for searching **developer / tech jobs** on **Programathor**
(https://programathor.com.br) — a Brazilian job board with many remote roles.

**Data source**: Programathor server-rendered HTML (`/jobs`, `/jobs-<tech>` — list; `/jobs/<id>-<slug>` — detail).
**Authentication**: None required to read listings.
**Dependencies**: None (plain `bun` + `fetch` + regex parsing). `bun install` is optional and only pulls dev type defs.

> The listing pages are server-rendered, so the job cards are parsed directly from the
> HTML (split into per-card chunks, one card parsed at a time). **Personal use only** —
> keep volume low, no bulk/commercial use.

## Installation

```bash
cd .agents/skills/programathor-search/cli
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

# Python roles, remote only
bun run src/cli.ts search -q "python" --remote --format table

# QA / testing via the native technology route
bun run src/cli.ts search -t "quality-assurance" --format table

# Full detail for one job
bun run src/cli.ts detail 33665 --format plain
```

See `../SKILL.md` for the full flag reference and the personal-use note, and
`../url-reference.md` for the HTML anchors and field mapping.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Free-text keyword. Tries `/jobs-<slug>` first, then a client-side filter over the listing. |
| `--tech` | `-t` | Technology route directly (`python`, `java`, `quality-assurance`, …). Strongest filter. |
| `--location` | `-l` | City filter (`place` param). |
| `--remote` | | Remote openings only. |
| `--contract` | | `CLT` \| `PJ` \| `Estágio`. |
| `--seniority` | `-s` | `Júnior` \| `Pleno` \| `Sênior`. |
| `--include-expired` | | Include expired ("Vencida") postings (hidden by default). |
| `--jobage` | | Not supported on search (cards carry no date); accepted but ignored. |
| `--page` | | 1-indexed page (15 results/page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
