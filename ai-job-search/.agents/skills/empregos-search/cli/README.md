# empregos-cli

Zero-dependency CLI for searching jobs on **Empregos.com.br** (Brazil). Reads the site's
public server-rendered pages with plain `bun` + `fetch` + regex — no runtime
dependencies, no authentication.

## Setup

```bash
cd .agents/skills/empregos-search/cli
bun install     # dev types only (typescript, @types/bun)
bun run typecheck
```

## Usage

```bash
# Search (json | table | plain; default json)
bun run src/cli.ts search -q "analista qa" --limit 5 --format table
bun run src/cli.ts search -q "analista de testes" -l "sao paulo sp" --format table
bun run src/cli.ts search -q "qualidade de software" --jobage 15

# Detail (by id or full /vaga/<id>/<slug> URL)
bun run src/cli.ts detail 11592901 --format plain
```

Search flags: `-q/--query` (required), `-l/--location`, `--jobage <days>`, `--page <n>`,
`-n/--limit <n>`, `--format json|table|plain`.

JSON search output: `{ "meta": { count, page }, "results": [{ id, title, company,
location, date, url, salary, workplace, posted, daysAgo }...] }`. Errors go to stderr as
`{ "error", "code" }` with exit code 1.

## Tests

```bash
bun run test
```

Covers slugify / date parsing / URL building / card parsing (offline), flag validation,
and a live search smoke test.

## How it works

Empregos.com.br has no public JSON API; it renders job cards in the HTML (Nuxt SSR). The
CLI splits the search page into per-card chunks and parses each with regex. Parsing
anchors and URL patterns are documented in `../url-reference.md`. **Personal use only —
keep volume low.**
