# Trampos.co API Reference

Trampos.co (https://trampos.co/oportunidades) is a Brazilian tech/startup/creative job
board. Its public listings page is a JavaScript single-page app built with Ember (the
`frodo` bundle); the HTML served to a plain request contains **no** job data. This skill
therefore uses the same public JSON API the front-end calls — discovered in the `frodo`
JS bundle as `namespace: "api/v2"` with the `opportunities` resource.

> Personal use only — keep volume low; the CLI backs off on 429/5xx.

`robots.txt` allows everything except `/admin/` (`Disallow: /admin/`); the API and
listing paths are not disallowed.

## Search

```
GET https://trampos.co/api/v2/opportunities/
```

Query params (from the Ember route `queryParams: ["tr","lc","ct","tp"]`):

| Param | Meaning | Example |
|-------|---------|---------|
| `tr` | Free-text query (keywords) — matched as a phrase | `desenvolvedor`, `python`, `qualidade` |
| `lc` | Location filter (UF or city text) | `SP`, `Rio de Janeiro` |
| `ct` | Category slug | `ti`, `programacao`, `dados`, `design`, `marketing`, `social-media` |
| `tp` | Type slug | `emprego`, `estagio`, `freela` |
| `page` | Page number (1-indexed) | `1`, `2`, … |

Send `Accept: application/json` and an `X-Requested-With: XMLHttpRequest` header.

Response body:

```jsonc
{
  "opportunities": [
    {
      "id": 773418,
      "name": "Desenvolvedor(a) Back-End",
      "type_name": "Emprego", "type_slug": "emprego",
      "category_name": "Programação", "category_slug": "programacao",
      "state": "SP", "city": "Barueri",
      "home_office": true, "hybrid": false,
      "salary": "R$ 5.000 a R$ 8.000",
      "published_at": "2026-06-25T12:30:04.000-03:00",
      "custom_company_name": null,
      "apply_url": "",
      "company": { "id": 725665, "name": "TradeUp", "slug": "tradeup", "url": "https://trampos.co/tradeup" }
    }
  ],
  "pagination": { "total": 263, "total_pages": 22, "per_page": 12 },
  "types": [ { "name": "Emprego", "slug": "emprego", "count": 243 }, ... ],
  "categories": [ { "name": "Tecnologia da Informação", "slug": "ti", "count": 17 }, ... ]
}
```

Field mapping to the shared JobCard contract:

| Contract field | Source |
|----------------|--------|
| `id` | `id` (stringified) |
| `title` | `name` |
| `company` | `custom_company_name` || `company.name` |
| `location` | `city` + `state` + (`home_office` → "Remoto" / `hybrid` → "Híbrido") |
| `date` | `published_at` (ISO 8601) |
| `url` | `https://trampos.co/oportunidades/<id>` (canonical, HTTP 200) |
| `salary` | `salary` (free text, e.g. "NÃO DIVULGADA") |
| `category` | `category_name` |
| `type` | `type_name` |
| `remote` / `hybrid` | `home_office` / `hybrid` |

There is **no posting-age parameter**; `--jobage` is applied client-side on `published_at`.

## Detail

```
GET https://trampos.co/api/v2/opportunities/<id>
```

Returns a single posting wrapped in an `opportunity` key:

```jsonc
{
  "opportunity": {
    "id": 773418, "name": "...", "state": "SP", "city": "Barueri",
    "home_office": false, "hybrid": false, "salary": "...", "regime": "...",
    "description": "<html>...", "prerequisite": "<html>...", "desirable": "<html>...",
    "perks": "<html>...", "other_info": "<html>...", "comments": "<html>...",
    "apply_url": "", "apply_method": "...", "company": { "name": "..." }
  }
}
```

The rich text fields (`description`, `prerequisite`, `desirable`, `perks`, `other_info`)
are HTML strings; the CLI strips tags and decodes entities into readable text.

## Notes

- No authentication required.
- Page size is fixed at 12 (`per_page`).
- `tr` matches multi-word queries as a phrase, so a long string like `"quality assurance"`
  returns 0 while a single token (`qualidade`, `python`) returns matches.
- Ember config found in-page: `<meta name="frodo/config/environment" ...>` (`baseURL: /oportunidades`).
- Data source verified live 2026-07-13.
