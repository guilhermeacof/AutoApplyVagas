# Workday CXS — endpoint & registry reference

**Platform:** Workday Recruiting external career sites (`*.myworkdayjobs.com`).
**API:** the public **CXS** JSON API that backs every Workday career site. HTTP 200, **no
authentication, no API key**. Responses are JSON (not HTML).

> Workday is a **per-company ATS.** Every employer has its own *tenant* hosted on one of
> Workday's data-center shards (`dc`: `wd1`, `wd3`, `wd5`, `wd103`, …) and exposes one or
> more career *sites*. There is no cross-company search — this skill keeps a registry
> (`cli/src/companies.ts`) and aggregates each company's CXS API.

## The four coordinates

Each company needs `{ tenant, dc, site, lang }`:

| Field | Meaning | Example |
|-------|---------|---------|
| `tenant` | Subdomain **and** CXS path segment (usually identical) | `redhat` |
| `dc` | Data-center shard in the host | `wd5`, `wd103` |
| `site` | External career-site id | `Jobs`, `AccentureCareers` |
| `lang` | Locale segment in the **public** URL (`""` when none; some use `en-US`). **Not** part of the CXS API URL. | `""` |

## Search endpoint (POST, JSON)

```
POST https://<tenant>.<dc>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
Content-Type: application/json

{ "appliedFacets": {}, "limit": 20, "offset": <n>, "searchText": "<query>" }
```

Response:

```jsonc
{
  "total": 154,                       // real count ONLY on offset=0; offset>0 returns 0
  "jobPostings": [
    {
      "title": "Software Engineer",
      "externalPath": "/job/Pune---Tower-6/Software-Engineer_R-056394-1",
      "locationsText": "Pune - Tower 6",   // ABSENT on some tenants (e.g. Accenture)
      "postedOn": "Posted Today",           // RELATIVE label (localized to Accept-Language)
      "bulletFields": ["R-056394"]          // [0]=reqId; some tenants add [1]=location
    }
  ],
  "facets": [ … ]                     // includes a Country facet; "Brazil" id is Workday-global
}
```

Field-mapping notes (see `cli/src/helpers.ts` → `mapPostings`):

| Result field | Source | Fallback |
|--------------|--------|----------|
| `id` | `bulletFields[0]` (requisition id) | trailing `_<req>` of `externalPath` |
| `title` | `title` | — |
| `location` | `locationsText` | `bulletFields[last]`, then the `/job/<Location>/` segment of `externalPath` |
| `date` | parsed from `postedOn` ("Posted 3 Days Ago" → ISO date) | `null` if unparseable |
| `url` | built: `https://<tenant>.<dc>.myworkdayjobs.com/[<lang>/]<site><externalPath>` | — |

**Pagination:** `limit` (page size, 20 works reliably) + `offset`. The `total` field is
only populated on the `offset=0` response; later pages report `total: 0`, so keep the max.

**Location facet:** filtering server-side needs opaque per-tenant facet ids in
`appliedFacets` (the Country facet's `parameter` was `"a"` on Red Hat, but this varies).
The skill filters location **client-side** by substring instead, which needs no ids.

## Detail endpoint (GET, JSON)

```
GET https://<tenant>.<dc>.myworkdayjobs.com/wday/cxs/<tenant>/<site><externalPath>
```

Note: the detail path is `<site>` **+** `externalPath` (which already begins with `/job/`).
The task's `/job<externalPath>` shorthand doubles the `/job`; the working form is
`<CXS base>/<site>` + `externalPath`.

Response:

```jsonc
{
  "jobPostingInfo": {
    "title": "Architect - Ansible with OCPv",
    "jobDescription": "<p>…rich HTML…</p>",   // HTML → stripped to text by htmlToText()
    "location": "Pune",
    "startDate": "2026-07-14",                // precise ISO date (better than postedOn)
    "postedOn": "Posted Today",
    "timeType": "Full time",                  // → employmentType
    "jobReqId": "R-056743",
    "externalUrl": "https://redhat.wd5.myworkdayjobs.com/Jobs/job/Pune/…"
  },
  "hiringOrganization": { … }
}
```

`detail` accepts either `"<company>:<externalPath>"` (registry lookup) or a full posting
URL (tenant/dc/site parsed from the URL — works for non-registry tenants too).

## Confirmed registry (all hire in Brazil)

| Company | tenant | dc | site | lang | CXS jobs endpoint |
|---------|--------|----|----- |------|-------------------|
| Red Hat | `redhat` | `wd5` | `Jobs` | `""` | `https://redhat.wd5.myworkdayjobs.com/wday/cxs/redhat/Jobs/jobs` |
| Accenture | `accenture` | `wd103` | `AccentureCareers` | `""` | `https://accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs` |
| NVIDIA | `nvidia` | `wd5` | `NVIDIAExternalCareerSite` | `""` | `https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs` |

Each was confirmed with a live POST returning real `jobPostings` **and** a `Country` facet
value `"Brazil"` with a non-zero count.

### Companies investigated but NOT included

- **Dell** — migrated off Workday to Oracle Cloud (`*.fa.ocs.oraclecloud.com`). No longer
  a Workday tenant.
- **AstraZeneca** (`astrazeneca.wd3` / `Careers`) — CXS works (1300+ jobs) but no Brazil
  country facet appeared, so it was left out of a Brazil-focused registry.
- **GE Aerospace / GE Vernova, Kyndryl, Thomson Reuters, Johnson Controls, SAP** — the
  guessed `dc`/`site` combos returned 404/422; their real coordinates weren't confirmed in
  this pass. Add them later using the recipe below once confirmed.

## How to confirm a new company

1. Open the company's careers page and follow redirects until the URL is
   `https://<tenant>.<dc>.myworkdayjobs.com/[<lang>/]<site>/…`. Read tenant, dc, site (and
   lang if present) straight from the URL. (Or grep the careers page HTML for
   `[a-z0-9]+\.wd\d+\.myworkdayjobs\.com`.)
2. Confirm the CXS endpoint responds with real jobs:
   ```bash
   curl -s -X POST "https://<tenant>.<dc>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs" \
     -H "Content-Type: application/json" \
     --data '{"appliedFacets":{},"limit":3,"offset":0,"searchText":"engineer"}'
   ```
   A `200` with a non-empty `jobPostings` array (and, for Brazil relevance, a `Brazil`
   value in the Country facet) means it's good.
3. Add one line to `cli/src/companies.ts`:
   ```ts
   { name: "Company", tenant: "<tenant>", dc: "<dc>", site: "<site>", lang: "<lang or empty>" },
   ```

## Contract

Commands `search` / `company` / `detail <company:path|url>`; flags `-q/--query`,
`-l/--location`, `-c/--company`, `--jobage`, `--page`, `--limit/-n`,
`--format json|table|plain` (default `json`). Search output
`{ meta:{count,page,limit,total,companies}, results:[{id,title,company,location,date,url}] }`;
missing values `null`. Errors → stderr `{ "error", "code" }`, exit 1. Backoff on 429/5xx.
Zero runtime dependencies.
