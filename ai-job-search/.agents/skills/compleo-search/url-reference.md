# Compleo ATS — Data Source Reference

Compleo is a Brazilian ATS. Companies that use it get a public career board at
`https://jobs.compleo.app/<uniqueLink>/joblist` (a Next.js app). The board is a JS
SPA, but the data behind it is public and unauthenticated, from two sources:

1. **Search** — the same JSON API the front-end calls (Elasticsearch-backed).
2. **Detail** — the job's own page is server-rendered; the full record is embedded
   in `__NEXT_DATA__`.

> `vagas.compleo.com.br` (the root) is a generic "Trabalhe Conosco" spontaneous-
> application page, **not** a job list. The actual boards live on `jobs.compleo.app`.
> Each company's own careers subdomain (`<company>.compleo.com.br`) links out to its
> `jobs.compleo.app/<uniqueLink>/joblist`.

`robots.txt` (both `vagas.compleo.com.br` and the per-company subdomains) is
`User-agent: * / Disallow:` — i.e. **everything is allowed**. Keep volume low anyway;
the CLI backs off on 429/5xx.

## Resolving a board's `companyId`

The search API requires a numeric `companyId` in the POST body. It is not the same as
the `uniqueLink`. Scrape it once from the board page's `__NEXT_DATA__`:

```
GET https://jobs.compleo.app/<uniqueLink>/joblist
```

`props.pageProps.companyId` → e.g. `"2"` for `emphasys`. (Fallback regex:
`"companyId"\s*:\s*"?(\d+)"?`.) A 404 or missing id means the board does not exist.

## Search

```
POST https://api.compleo.app/job/careerjoblist/<UNIQUELINK>
Content-Type: application/json
Origin: https://jobs.compleo.app
```

`<UNIQUELINK>` is the board slug (the site uses upper-case, e.g. `EMPHASYS`; lower-case
also works). Request body (captured live from the board's own XHR):

```jsonc
{
  "companyId": "2",            // REQUIRED — from the board page (500 without it)
  "filterUpdated": true,
  "buckets": {},               // faceted filters (state/city/workingModel/category)
  "mainSearch": "desenvolvedor", // free-text; matched against title + description only
  "searchAsYouType": false,
  "customSearch": {},
  "advancedSearch": {},
  "pagination": { "currentPage": 1, "pageSize": 10 },
  "geoLocation": {},
  "sort": {},                  // e.g. {"_score":{"order":1,"orderType":"desc"}}
  "updateAggsAfterFilter": false,
  "otherGenericParams": {},
  "language": "pt-BR"
}
```

Response:

```jsonc
{
  "fields": [                  // <-- the job hits
    {
      "pk": "JOB:PK05328B",
      "title": "Desenvolvedor Full Stack",
      "customer": { "value": "…", "label": "Espaço Laser Estética Avançada" },
      "experienceLevel": { "label": "Sênior", "value": "CP10" },
      "workingModel": { "label": "Presencial", "value": "CP3" },  // Remoto/Hibrido/Presencial
      "createdAt": "2026-05-15T17:51:40.936Z",
      "lastUpdatedAt": "2026-07-06T15:30:23.913Z",
      "location": {
        "country": { "label": "Brasil", "value": "31" },
        "provinceOrState": { "label": "São Paulo (SP)", "value": "SP" },
        "city": { "label": "São Paulo", "value": "9668" }
      }
    }
  ],
  "totalFiltered": { "value": 8 },   // total matching the query
  "aggregations": { … },             // facet counts (state/city/workingModel/category)
  "currentPage": 1, "pageSize": 10, "fromValue": 0
}
```

Field mapping to the shared JobCard contract:

| Contract field | Source |
|----------------|--------|
| `id` | `pk` (e.g. `JOB:PK05328B`) |
| `title` | `title` |
| `company` | `customer.label` (the client company — the real employer) |
| `location` | `location.city.label` + `provinceOrState.label` + `country.label` |
| `date` | `openingDate` ?? `createdAt` ?? `lastUpdatedAt` |
| `url` | `https://jobs.compleo.app/<board>/jobdetail/<pk without "JOB:">` |
| `workingModel` | `workingModel.label` |
| `experienceLevel` | `experienceLevel.label` |

### Filtering notes

- **Keyword** (`mainSearch`) matches **title + description only** — not the customer
  name and not location text.
- **Location** and **posting age**: the API's native location filter uses faceted
  `buckets` (state/city, by exact label) whose payload format is not stable/obvious, and
  there is no posting-age parameter. So the CLI applies `--location` (substring,
  accent-insensitive) and `--jobage` (on `openingDate`) **client-side**, over the
  fetched page — same approach `trampos-search` uses for `--jobage`.
- **Pagination**: `pagination.currentPage` (1-indexed) + `pageSize` (the CLI sets
  `pageSize` from `--limit`, clamped to 10–50).

## Detail

The detail page is fully server-rendered — no API call needed:

```
GET https://jobs.compleo.app/<board>/jobdetail/<code>
```

`<code>` is the `pk` with the `JOB:` prefix stripped (`JOB:PK05328B` → `PK05328B`).
Parse `__NEXT_DATA__` → `props.pageProps.jobViewData`:

```jsonc
{
  "pk": "JOB:PK05328B",
  "title": "Desenvolvedor Full Stack",
  "description": "<p><strong>Atividades:</strong></p>…",  // HTML → stripped to text
  "responsibilities": "…", "requirements": "…",           // may be empty strings
  "location": { … },                                       // same shape as search
  "workingModel": { "label": "Presencial", … },
  "openingDate": "2026-06-03T03:00:00.000Z",
  "createdAt": "…", "hiringEndDate": null, "employmentType": null
}
```

Note: `jobViewData` has **no `customer`** (unlike search hits), so `detail` cannot show
the client company; `company` comes back `null` there.

## Notes

- No authentication required for search or detail.
- Default board in the CLI is `emphasys` (an IT consultancy board in SP with a genuine
  multi-empresa mix: Grupo Ultragaz, Banco Rabobank, Salux Technology, etc.). Point at
  any other board with `-b <uniqueLink>` (the `<company>` in `<company>.compleo.com.br`).
- Boards are typically small (emphasys had ~8 open jobs), so niche terms often return
  0 — expected, not a bug.
- Data source verified live 2026-07-14 (buildId `VZ04dUByOtObQeRLbHElH`; the request
  body was captured from the board's own `careerjoblist` XHR).
