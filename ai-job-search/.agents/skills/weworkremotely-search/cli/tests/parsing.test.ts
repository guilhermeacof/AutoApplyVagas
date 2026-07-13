import { describe, test, expect } from "bun:test";
import {
  parseItems,
  mapCard,
  mapDetail,
  htmlToText,
  normalizeId,
  slugFromLink,
  matchesQuery,
  dedupe,
  withinDays,
} from "../src/helpers";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Highlevel: Product Solutions Engineer - Creator Platform</title>
    <region>Anywhere in the World</region>
    <category>Full-Stack Programming</category>
    <description>&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Node&lt;/li&gt;&lt;li&gt;Caf&#233; obrigat&#243;rio&lt;/li&gt;&lt;/ul&gt;</description>
    <pubDate>Tue, 30 Jun 2026 20:31:08 +0000</pubDate>
    <guid>https://weworkremotely.com/remote-jobs/highlevel-product-solutions-engineer-creator-platform</guid>
    <link>https://weworkremotely.com/remote-jobs/highlevel-product-solutions-engineer-creator-platform</link>
  </item>
  <item>
    <title>NoColonRoleOnly</title>
    <description>&lt;p&gt;desc&lt;/p&gt;</description>
    <pubDate>Mon, 29 Jun 2026 10:00:00 +0000</pubDate>
    <link>https://weworkremotely.com/remote-jobs/nocolon-role-only</link>
  </item>
</channel></rss>`;

describe("parseItems + mapCard", () => {
  const items = parseItems(SAMPLE_XML);

  test("parses every item in the feed", () => {
    expect(items).toHaveLength(2);
  });

  test("splits 'Company: Role' into company and title", () => {
    const c = mapCard(items[0]);
    expect(c.company).toBe("Highlevel");
    expect(c.title).toBe("Product Solutions Engineer - Creator Platform");
  });

  test("id is the slug from the link, url is preserved", () => {
    const c = mapCard(items[0]);
    expect(c.id).toBe("highlevel-product-solutions-engineer-creator-platform");
    expect(c.url).toBe("https://weworkremotely.com/remote-jobs/highlevel-product-solutions-engineer-creator-platform");
  });

  test("region maps to location, pubDate to an ISO date", () => {
    const c = mapCard(items[0]);
    expect(c.location).toBe("Anywhere in the World");
    expect(c.date).toBe("2026-06-30T20:31:08.000Z");
  });

  test("title without a colon keeps company null", () => {
    const c = mapCard(items[1]);
    expect(c.company).toBeNull();
    expect(c.title).toBe("NoColonRoleOnly");
  });

  test("missing values are null, never omitted", () => {
    const c = mapCard(items[1]);
    for (const key of ["id", "title", "company", "location", "date", "url"]) {
      expect(key in c).toBe(true);
    }
    expect(c.location).toBeNull();
  });

  test("tolerates empty/garbage input", () => {
    expect(parseItems("")).toEqual([]);
    expect(parseItems("<rss></rss>")).toEqual([]);
  });
});

describe("mapDetail + htmlToText", () => {
  test("decodes entities and strips tags in the description", () => {
    const d = mapDetail(parseItems(SAMPLE_XML)[0]);
    expect(d.description).toContain("Build & ship");
    expect(d.description).toContain("Café obrigatório");
    expect(d.description).not.toContain("<");
  });

  test("returns null for empty/undefined input", () => {
    expect(htmlToText(null)).toBeNull();
    expect(htmlToText("")).toBeNull();
  });
});

describe("slugFromLink / normalizeId", () => {
  test("extracts slug from a full URL", () => {
    expect(slugFromLink("https://weworkremotely.com/remote-jobs/acme-senior-dev")).toBe("acme-senior-dev");
  });
  test("normalizeId accepts a bare slug", () => {
    expect(normalizeId("acme-senior-dev")).toBe("acme-senior-dev");
  });
  test("normalizeId extracts slug from a URL", () => {
    expect(normalizeId("https://weworkremotely.com/remote-jobs/acme-senior-dev")).toBe("acme-senior-dev");
  });
  test("normalizeId rejects empty input", () => {
    expect(normalizeId("   ")).toBeNull();
  });
});

describe("matchesQuery / dedupe / withinDays", () => {
  const items = parseItems(SAMPLE_XML).map(mapCard);

  test("query matches against title/company/category, case-insensitive", () => {
    expect(matchesQuery(items[0], "engineer")).toBe(true);
    expect(matchesQuery(items[0], "HIGHLEVEL")).toBe(true);
    expect(matchesQuery(items[0], "nonexistent")).toBe(false);
    expect(matchesQuery(items[0], undefined)).toBe(true);
  });

  test("dedupe drops repeated urls", () => {
    expect(dedupe([...items, items[0]])).toHaveLength(2);
  });

  test("withinDays keeps recent, drops old; 9999 keeps all", () => {
    const recent = mapCard({ ...parseItems(SAMPLE_XML)[0], pubDate: new Date().toUTCString() });
    const old = mapCard({ ...parseItems(SAMPLE_XML)[0], link: "https://weworkremotely.com/remote-jobs/old", pubDate: "Sat, 01 Jan 2000 00:00:00 +0000" });
    expect(withinDays([recent, old], 7).map((c) => c.id)).toEqual([recent.id]);
    expect(withinDays([old], 9999)).toHaveLength(1);
  });
});
