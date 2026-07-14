# lever-cli

Aggregates job listings across Brazilian companies that host their careers page on the
**Lever ATS**, via Lever's public postings API (`https://api.lever.co/v0/postings/<token>`).
No authentication, no API key, **zero runtime dependencies** — runs with just `bun`.

Lever is per-company: each company exposes its own board under a *token*. This CLI walks a
registry of tokens (`src/companies.ts`) and merges their postings into one result set.

## Install (dev types only)

```bash
bun install
```

## Commands

```bash
bun run src/cli.ts search  [-q "<termo>"] [-l "<local>"] [-c <token>] [--jobage N] [--page N] [--limit N] [--format json|table|plain]
bun run src/cli.ts detail  <token:id | url> [--format json|plain]
bun run src/cli.ts company [--format json|table|plain]
```

- `search` fetches **one request per company** in the registry, then filters/sorts/paginates
  client-side. `-q` matches per word (AND) over the title; `-l` is a substring match over the
  Lever `categories.location`; `--jobage` filters on `createdAt`.
- `detail` accepts the composite `id` from `search` (`<token>:<postingId>`) or a
  `jobs.lever.co/<token>/<id>` URL.
- `company` prints the registry (no network).

## Scripts

- `bun run start` — run the CLI
- `bun run typecheck` — `tsc --noEmit`
- `bun run test` — `bun test` (includes live smoke tests against the real API)

## Adding a company

Append `{ token, name }` to `COMPANIES` in `src/companies.ts`. Confirm the token first:

```bash
curl "https://api.lever.co/v0/postings/<token>?mode=json"
```

It should return a non-empty JSON array of postings. See `../url-reference.md` for the API shape.
