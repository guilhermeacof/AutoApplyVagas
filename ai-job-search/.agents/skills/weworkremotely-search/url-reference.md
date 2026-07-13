# We Work Remotely RSS Reference

We Work Remotely (https://weworkremotely.com) is a global, English-language board for
fully-remote jobs. It publishes a public **RSS feed per category**; there is no JSON API
and no authentication. This skill parses the XML with regex (no XML libraries) and
combines the tech/QA-relevant category feeds.

> Personal use only — keep volume low; the CLI backs off on 429/5xx.

`robots.txt` allows crawling of the public listing and category paths (the RSS feeds are
public and linked from the site). No login is required to read the feeds.

## Feeds (search)

```
GET https://weworkremotely.com/categories/<category-slug>.rss
```

Category slugs combined by this skill (see `CATEGORIES` in `cli/src/helpers.ts`):

| Slug | Covers |
|------|--------|
| `remote-programming-jobs` | Umbrella — all programming (back-end, front-end, full-stack, etc.) |
| `remote-devops-sysadmin-jobs` | DevOps / sysadmin |

Other slugs exist (`remote-product-jobs`, `remote-design-jobs`, `remote-customer-support-jobs`,
`remote-sales-and-marketing-jobs`, `remote-back-end-programming-jobs`,
`remote-front-end-programming-jobs`, `remote-full-stack-programming-jobs`, …). The
back-end/front-end/full-stack feeds are subsets of `remote-programming-jobs`, so they are
intentionally not added (they would only produce duplicates). Add more slugs to
`CATEGORIES` if broader coverage is wanted.

Send a browser `User-Agent` and `Accept: application/rss+xml, application/xml, text/xml`.

Each feed returns ~16–25 recent `<item>` elements:

```xml
<item>
  <media:content url="https://.../logo.gif" type="image/png"/>
  <title>Highlevel: Product Solutions Engineer - Creator Platform</title>
  <region>Anywhere in the World</region>
  <category>Full-Stack Programming</category>
  <description>&lt;img .../&gt;&lt;p&gt;...HTML...&lt;/p&gt;</description>
  <pubDate>Tue, 30 Jun 2026 20:31:08 +0000</pubDate>
  <guid>https://weworkremotely.com/remote-jobs/highlevel-product-solutions-engineer-creator-platform</guid>
  <link>https://weworkremotely.com/remote-jobs/highlevel-product-solutions-engineer-creator-platform</link>
</item>
```

Field mapping to the shared JobCard contract:

| Contract field | Source |
|----------------|--------|
| `id` | slug from `<link>`/`<guid>` — the path segment after `/remote-jobs/` |
| `title` | `<title>` after `"Company: "` prefix is split off (the role) |
| `company` | `<title>` before the first `":"` (null if no colon) |
| `location` | `<region>` (free text, often "Anywhere in the World") |
| `date` | `<pubDate>` (RFC 822) → ISO 8601 |
| `url` | `<link>` (or `<guid>`) |
| `category` | `<category>` |

- Titles are consistently `Company: Role`.
- There is **no posting-age or query parameter** on the feeds; `--jobage`, `--query`, and
  pagination are all applied **client-side** after combining and deduplicating feeds.
- Deduplication is by `url` (falling back to `id`).

## Detail

There is no separate detail endpoint used: the full posting HTML lives inside each RSS
`<item>`'s `<description>`. `detail <id|url>` re-fetches the same category feeds, matches
the item whose link slug equals the requested id, and renders `description` (HTML → text).
If the slug is no longer present in the feeds (postings age off), it returns
`{"error": "...", "code": "NOT_FOUND"}` on stderr with exit 1.

## Notes

- No authentication required.
- Feeds contain only recent postings (~25 max per category), so historical lookups fail.
- The `<description>` HTML is stripped of tags and its entities decoded into readable text.
- Data source verified live 2026-07-13.
