# weworkremotely-cli

Zero-dependency `bun` CLI that searches remote jobs on
[We Work Remotely](https://weworkremotely.com) via its public category RSS feeds.

## Setup

```bash
bun install      # dev types only — no runtime dependencies
bun run typecheck
bun run test
```

## Usage

```bash
# Search (default JSON output)
bun run src/cli.ts search -q "engineer" --limit 5 --format table

# Full detail for one posting (id = the URL slug)
bun run src/cli.ts detail highlevel-product-solutions-engineer-creator-platform --format plain
```

Commands, flags, and output shape follow the shared portal-skill contract:
`search` + `detail <id|url>`; flags `-q/--query`, `--jobage`, `--page`, `--limit/-n`,
`--format json|table|plain`; JSON `{ meta, results }`; errors to stderr as
`{ "error", "code" }` with exit code 1.

Data source and field mapping are documented in `../url-reference.md`. Personal use only —
keep request volume low.
