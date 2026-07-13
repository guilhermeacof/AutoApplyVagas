# Programathor HTML Reference

Programathor (https://programathor.com.br) is a Brazilian developer/tech job board. Its
listing and detail pages are **server-rendered HTML** — the job cards are present in the
markup of a plain `GET`, so this skill parses them with regex (split into per-card chunks,
parse each independently). No authentication is required to read listings; applying
requires a Programathor account.

> Personal use only — keep volume low; the CLI backs off on 429/5xx.

`robots.txt` allows the job paths. It only disallows `/admin/`, `/user/`, `/users/`, and
`/company/`; `/jobs`, `/jobs-<tech>`, and `/jobs/<id>` are **not** disallowed.

## Search

There is **no free-text search parameter** on `/jobs`. Search is faceted:

| Route / Param | Meaning | Example |
|---------------|---------|---------|
| `GET /jobs` | Full listing (15 cards/page) | `/jobs` |
| `GET /jobs-<slug>` | Technology / tag route (server-side keyword) | `/jobs-python`, `/jobs-quality-assurance`, `/jobs-testes-funcionais` |
| `?page=<n>` | Pagination (1-indexed, 15/page) | `/jobs?page=2` |
| `?place=<cidade>` | City filter | `/jobs?place=São Paulo` |
| `?remoto=true` | Remote only | `/jobs?remoto=true` |
| `?contract_type=<t>` | `CLT` \| `PJ` \| `Estágio` | `/jobs?contract_type=PJ` |
| `?expertise=<n>` | `Júnior` \| `Pleno` \| `Sênior` | `/jobs?expertise=Sênior` |
| `?company_type=<t>` | `Startup` \| `Grande empresa` \| `Pequena/média empresa` | — |

The CLI's `-q/--query` slugifies the query and tries `/jobs-<slug>` first; if empty, it
falls back to fetching `/jobs?page=…` pages and filtering cards client-side. Facet flags
(`place`, `remoto`, `contract_type`, `expertise`) are appended to whichever route is used.
`/jobs-<slug>?page=<n>` also paginates.

### Card anchors (per job card on a listing page)

Each card is a `<div class="cell-list …">` block. Fields parsed:

| Contract field | Anchor in the card HTML |
|----------------|--------------------------|
| `id` + `url` + slug | `<a href="/jobs/<id>-<slug>">` |
| `title` | `<h3 class="… text-24 …">TITLE</h3>` — inner `<span>` badges (`NOVA`, `Vencida`, `📍 PRESENCIAL`) are stripped before reading the text |
| `company` | `<span><i class='fa fa-briefcase'></i>COMPANY</span>` |
| `location` | `<span><i class='fas fa-map-marker-alt'></i>LOCATION</span>` (e.g. `Remoto`, `São Paulo/SP  (Híbrido)`) |
| `companySize` | `<span><i class='fa fa-building'></i>…</span>` |
| `salary` | `<span><i class='far fa-money-bill-alt'></i>…</span>` (optional) |
| `seniority` | `<span><i class='far fa-chart-bar'></i>…</span>` |
| `contract` | `<span><i class='far fa-file-alt'></i>PJ\|CLT\|Estágio</span>` |
| `tags` | `<span class='tag-list background-gray'>TAG</span>` (repeated) |
| `remote` | derived: `location` matches `/remoto\|home office/i` |
| `expired` | card contains a `<span>Vencida</span>` badge (dimmed `opacity-60p` container) |
| `date` | **not present on listing cards** → always `null` in search |

## Detail

```
GET https://programathor.com.br/jobs/<id>        (redirects to /jobs/<id>-<slug>)
```

| Contract field | Source |
|----------------|--------|
| `title` | `<h1>TITLE</h1>` in the header block |
| `company` | `<h2 class="font-bold-600 text-30"><a href="/companies/…">NAME</a></h2>` |
| `companySize` / `contract` / `salary` / `seniority` / `location` | header meta rows `<p><span class="icon-offer"><i class="… fa-building\|fa-file-alt\|fa-money-bill-alt\|fa-signal\|fa-globe"></i></span> VALUE</p>` |
| `tags` | `<span class="tag color-white tag-hover">TAG</span>` |
| `description` | `<div class="line-height-2-4">…</div>` — the `<h3>` section headers (Descrição da empresa, Atividades e Responsabilidades, Requisitos) plus `<p>` bodies; scripts/`<ins>` ads stripped, tags removed, entities decoded, paragraph breaks preserved |
| `date` (`datePosted`) | JSON-LD `<script type="application/ld+json">` with `"@type":"JobPosting"` → `"datePosted"` |
| `validThrough` | same JSON-LD → `"validThrough"` |
| `employmentType` | same JSON-LD → `"employmentType"` (e.g. `CONTRACTOR`, `FULL_TIME`) |

> **JSON-LD caveat:** Programathor emits the `JobPosting` JSON-LD with *unescaped
> newlines* inside the `description` string, which makes the block invalid JSON. Do **not**
> `JSON.parse` it — extract the scalar fields (`datePosted`, `validThrough`,
> `employmentType`) by regex, and take the human description from the HTML
> `line-height-2-4` block instead.

## Notes

- No authentication required to read listings/details.
- Page size is fixed at 15 (`per_page`).
- Applying is gated behind sign-up (`/users/sign_up`); there is no public direct-apply URL,
  so the CLI reports the posting URL itself as the apply/reference link.
- Data source verified live 2026-07-13.
