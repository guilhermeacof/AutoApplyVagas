---
name: weworkremotely-search
version: 1.0.0
description: >
  Use this skill to search remote job listings on We Work Remotely (weworkremotely.com),
  a global, English-language job board for fully-remote roles in programming, DevOps,
  and other tech fields. Invoke when the user wants remote/home-office jobs, to look up
  a specific We Work Remotely posting, or to scrape WWR openings. Trigger phrases (EN):
  remote jobs, work from home jobs, find a remote job, We Work Remotely, WWR, remote
  developer jobs, remote engineer jobs, remote DevOps jobs. Gatilhos (PT): vagas
  remotas, trabalho remoto, home office, vagas home office, vaga remota internacional,
  emprego remoto, buscar vagas remotas no exterior.
context: fork
allowed-tools: Bash(bun run skills/weworkremotely-search/cli/src/cli.ts *)
---

# We Work Remotely Search Skill

Search live remote job listings from **We Work Remotely** (`weworkremotely.com`), a
global, English-language board for fully-remote roles. It reads WWR's public per-category
**RSS feeds** — no authentication, no API key, and **zero runtime dependencies**: it runs
with just `bun`.

> WWR publishes an RSS feed per category. This skill combines the tech/QA-relevant feeds
> (`remote-programming-jobs`, which is the umbrella covering back-end/front-end/full-stack,
> plus `remote-devops-sysadmin-jobs`), deduplicates by job URL, and filters client-side.

## ⚠️ Uso pessoal

Isto consome os feeds RSS públicos do We Work Remotely. **Mantenha o volume baixo e não
use para coleta em massa ou fins comerciais.** Use por sua conta e responsabilidade.

## When to use this skill

- Find fully-remote openings by keyword (role, technology, skill)
- Filter by posting recency
- Get the full description of a specific WWR posting

> All WWR roles are remote and English-language. This is a good fit for the "remote"
> deal-breaker, but note the postings are in English (candidate's English is intermediate).

## Commands

### Search job listings

```bash
bun run skills/weworkremotely-search/cli/src/cli.ts search [-q "<term>"] [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword filter (role, tech, skill), matched **client-side**
  against title + company + category. Recommended (e.g. `engineer`, `developer`, `devops`, `qa`).
- `--jobage <days>` — posted within N days (client-side filter on the posting date;
  the feeds have no age parameter). Omit for all postings.
- `--page <n>` — page number (1-indexed, 25 results per page, applied client-side).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

> There is no `--location` flag: WWR listings are remote and location is a free-text
> "region" (e.g. "Anywhere in the World"). To narrow by region, include the term in
> `--query` (e.g. `-q "USA"`), or filter the JSON output downstream on the `location` field.

### Fetch full job detail

```bash
bun run skills/weworkremotely-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the **slug** from a `search` result (e.g.
`highlevel-product-solutions-engineer-creator-platform`). You may also pass the full
`https://weworkremotely.com/remote-jobs/<slug>` URL. The description comes from the RSS
item (HTML → readable text).

## Usage examples

```bash
# Engineer roles, first 5, as a table
bun run skills/weworkremotely-search/cli/src/cli.ts search -q "engineer" --limit 5 --format table

# Developer roles as JSON (default)
bun run skills/weworkremotely-search/cli/src/cli.ts search -q "developer"

# DevOps roles posted in the last 7 days
bun run skills/weworkremotely-search/cli/src/cli.ts search -q "devops" --jobage 7 --format table

# QA / testing roles
bun run skills/weworkremotely-search/cli/src/cli.ts search -q "qa" --format table

# Full details for a specific posting
bun run skills/weworkremotely-search/cli/src/cli.ts detail highlevel-product-solutions-engineer-creator-platform --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is `{ "meta": { count, page, total, total_pages, per_page }, "results": [...] }`.
Each result has at least `id`, `title`, `company`, `location`, `date`, `url` (missing values
are `null`, never omitted), plus `category`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process
exits with code `1`.

## Notes

- Data source: We Work Remotely public category RSS feeds — no credentials required.
- Each feed returns ~25 items (recent postings only). Old postings drop off the feed, so
  `detail` may return `NOT_FOUND` for an expired slug.
- Titles are formatted `Company: Role`; the CLI splits them into `company` and `title`.
- The `id` is the URL slug (e.g. `acme-senior-backend-engineer`), not a numeric id.
- `--query` is matched client-side after combining feeds — a single strong keyword works best.
- `--jobage` and pagination are applied client-side (the RSS feeds expose no such params).
- WWR skews to engineering/product/DevOps; niche QA terms may return few matches — try
  `qa`, `test`, `quality`, `engineer`, or `developer`.
- The feeds rate-limit under load; the CLI retries 429/5xx with exponential backoff. Keep
  volume low (see personal-use note above).
