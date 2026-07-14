# Lever API reference

Data source for `lever-search`. The **Lever** ATS powers the hosted careers board at
`https://jobs.lever.co/<token>`. That board is backed by a public JSON API — no
authentication, no API key. Lever is **per-company**: each company has its own `<token>`
(the path segment). This skill aggregates across a registry of tokens.

## Endpoints

### List postings for a company

```
GET https://api.lever.co/v0/postings/<token>?mode=json
```

Returns a **JSON array** of postings. A token with no public board returns HTTP `404`
(treated as "no postings", not an error). Example: `https://api.lever.co/v0/postings/neon?mode=json`.

### Single posting detail

```
GET https://api.lever.co/v0/postings/<token>/<id>?mode=json
```

Returns a **single posting object** (same shape as a list element, with full description
fields). `404` if the id does not exist.

`<id>` is a UUID (e.g. `a053e021-e712-453c-9f8b-2e3194f5e7e9`).

## Posting fields used

Both endpoints return objects with these fields (only the ones this skill reads are listed):

| Field | Meaning | Mapped to |
|-------|---------|-----------|
| `id` | UUID of the posting | second half of the composite `id` (`<token>:<id>`) |
| `text` | Job title | `title` |
| `categories.location` | Location string (e.g. `Remoto`, `São Paulo, SP`) | `location` (also the `-l` filter target) |
| `categories.commitment` | Contract type (e.g. `CLT`) | `commitment` |
| `categories.team` | Team name | `team` |
| `categories.department` | Department | `department` |
| `createdAt` | Creation time, **ms epoch** | `date` (converted to ISO 8601); `--jobage` filter target |
| `workplaceType` | `remote` / `hybrid` / `onsite` | `workplaceType` |
| `hostedUrl` | Public posting URL (`jobs.lever.co/<token>/<id>`) | `url` |
| `applyUrl` | Apply URL | `applyUrl` (detail only) |
| `descriptionPlain` / `description` | Body text (plain preferred, else HTML stripped) | `description` (detail only) |
| `additionalPlain` / `additional` | Extra body text | `additional` (detail only) |
| `lists[]` | Array of `{ text, content }` (e.g. Requirements/Benefits) | `lists` (detail only) |

## Company registry

Confirmed Brazilian tokens live in `cli/src/companies.ts`. To validate a candidate token,
hit the list endpoint and confirm a non-empty array:

```bash
curl "https://api.lever.co/v0/postings/<token>?mode=json"
```

Tokens confirmed returning real postings at build time (2026-07): `cloudwalk` (CloudWalk),
`neon` (Neon), `zippi` (Zippi), `tractian` (TRACTIAN), `starkbank` (Stark Bank).

Tokens probed that did **not** exist on Lever (returned 404, listed so they aren't re-tried):
creditas, ifood, pismo, dock, olist, hotmart, contaazul, buser, loggi, quinto-andar, nubank,
stone, ebanx, picpay, and others — many Brazilian companies use Greenhouse/Gupy instead of Lever.

## Notes / quirks

- The API has **no server-side keyword, location, or age filter** — everything is client-side
  after fetching each company's full board. Boards are small (tens of postings), so one request
  per company is cheap.
- Titles are frequently in **English** even for Brazil-based, Portuguese-speaking roles, so
  keyword search should try English terms (`engineer`, `developer`) as well as Portuguese.
- Pagination is client-side over the aggregated set: `--limit` is the page size and `--page`
  selects the 1-indexed page. Without `--limit`, all results are returned on page 1.
- Rate limiting: the CLI retries `429`/`5xx` with exponential backoff + jitter (max ~6 tries).
