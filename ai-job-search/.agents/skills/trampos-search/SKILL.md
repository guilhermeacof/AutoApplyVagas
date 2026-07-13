---
name: trampos-search
version: 1.0.0
description: >
  Use this skill to search job listings on Trampos.co, a Brazilian job board for
  tech, startup, digital, marketing, and creative roles. Invoke when the user wants
  to find jobs / vacancies in Brazil on Trampos, look up a specific Trampos posting,
  or scrape Trampos openings. Trigger phrases (EN): find a job on Trampos, search
  Trampos jobs, tech jobs in Brazil, startup jobs Brazil, look up this Trampos posting.
  Gatilhos (PT): buscar vagas no Trampos, vagas de tecnologia no Brasil, vagas em
  startups, oportunidades no Trampos.co, procurar emprego no Trampos, ver esta vaga
  do Trampos, vaga de desenvolvedor, vaga de QA.
context: fork
allowed-tools: Bash(bun run skills/trampos-search/cli/src/cli.ts *)
---

# Trampos.co Search Skill

Search live job listings from **Trampos.co**, a Brazilian job board focused on tech,
startup, digital, marketing, and creative roles. It talks to Trampos' public JSON API
(`/api/v2/opportunities`) — no authentication, no API key, and **zero runtime
dependencies**: it runs with just `bun`.

> The Trampos.co listings page is a JavaScript single-page app (Ember). This skill uses
> the same public JSON API the site's own front-end calls, so no HTML scraping or
> headless browser is involved.

## ⚠️ Uso pessoal

Isto consome a API pública do Trampos.co da mesma forma que o site faz. **Mantenha o
volume baixo e não use para coleta em massa ou fins comerciais.** Use por sua conta e
responsabilidade.

## When to use this skill

- Search Trampos.co openings by keyword (cargo, tecnologia, skill)
- Filter by location (UF/cidade), category, or posting recency
- Get the full description of a specific Trampos.co posting

## Commands

### Search job listings

```bash
bun run skills/trampos-search/cli/src/cli.ts search [-q "<termo>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (cargo, tecnologia, skill). Recommended.
  Multi-word queries are matched as a phrase, so prefer a single strong term
  (e.g. `desenvolvedor`, `python`, `qualidade`).
- `--location <text>` / `-l <text>` — filter by location (UF like `SP`/`RJ`, or a city name).
- `--category <slug>` / `-c <slug>` — category slug: `ti`, `programacao`, `dados`, `design`,
  `marketing`, `social-media`, `midia`, `comercial`, `rh`, `administrativo`, etc.
- `--jobage <days>` — posted within N days (client-side filter on the posting date; the
  API has no age parameter). Omit for all postings.
- `--page <n>` — page number (1-indexed, 12 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/trampos-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the opportunity id from `search` results (e.g. `773418`). You may also pass a full
`https://trampos.co/oportunidades/<id>-<slug>` URL. Returns the full description,
prerequisites, desirable skills, perks, work regime, and apply link.

## Usage examples

```bash
# Developer roles, first 5, as a table
bun run skills/trampos-search/cli/src/cli.ts search -q "desenvolvedor" --limit 5 --format table

# Python roles in São Paulo
bun run skills/trampos-search/cli/src/cli.ts search -q "python" -l "SP" --format table

# IT-category openings posted in the last 7 days
bun run skills/trampos-search/cli/src/cli.ts search -c "ti" --jobage 7 --format table

# QA / quality roles
bun run skills/trampos-search/cli/src/cli.ts search -q "qualidade" --format table

# Full details for a specific posting
bun run skills/trampos-search/cli/src/cli.ts detail 773418 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is `{ "meta": { count, page, total, total_pages, per_page }, "results": [...] }`.
Each result has at least `id`, `title`, `company`, `location`, `date`, `url` (missing values
are `null`, never omitted), plus `salary`, `category`, `type`, `remote`, `hybrid`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process
exits with code `1`.

## Notes

- Data source: Trampos.co public JSON API — no credentials required.
- Page size is fixed at 12 results per page (`per_page`).
- Trampos.co is a **tech/startup/creative** board, so its role mix skews to marketing,
  social media, design, and product/engineering. Niche QA/testing terms return few or no
  results; `desenvolvedor`, `python`, and `qualidade` are examples that do return matches.
- `--query` matches as a phrase; a single strong keyword works better than a long string.
- `--jobage` is applied client-side (on the posting date) because the API has no age filter.
- Location (`state`/`city`) plus the `home_office`/`hybrid` flags are folded into a single
  `location` string (e.g. `São Paulo - SP · Remoto`); `remote`/`hybrid` are also exposed as
  booleans.
- The API rate-limits under load; the CLI retries 429/5xx with exponential backoff. Keep
  volume low (see personal-use note above).
