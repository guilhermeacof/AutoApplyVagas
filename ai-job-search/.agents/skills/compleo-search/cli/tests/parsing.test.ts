import { describe, expect, test } from "bun:test";
import {
  buildSearchBody,
  formatLocation,
  htmlToText,
  mapCard,
  mapDetail,
  matchesLocation,
  parseDetailInput,
  parseSearchResponse,
  pkToCode,
  withinDays,
  type JobCard,
  type RawJob,
} from "../src/helpers";

const RAW: RawJob = {
  pk: "JOB:PK05328B",
  title: "Desenvolvedor Full Stack",
  customer: { value: "abc", label: "Espaço Laser Estética Avançada " },
  experienceLevel: { label: "Sênior", value: "CP10" },
  workingModel: { label: "Presencial", value: "CP3" },
  createdAt: "2026-05-15T17:51:40.936Z",
  openingDate: "2026-06-03T03:00:00.000Z",
  location: {
    country: { label: "Brasil", value: "31" },
    provinceOrState: { label: "São Paulo (SP)", value: "SP" },
    city: { label: "São Paulo", value: "9668" },
  },
};

describe("mapCard", () => {
  test("maps a raw hit into the shared contract shape", () => {
    const c = mapCard(RAW, "emphasys");
    expect(c.id).toBe("JOB:PK05328B");
    expect(c.title).toBe("Desenvolvedor Full Stack");
    expect(c.company).toBe("Espaço Laser Estética Avançada");
    expect(c.location).toBe("São Paulo - São Paulo (SP), Brasil");
    expect(c.date).toBe("2026-06-03T03:00:00.000Z");
    expect(c.url).toBe("https://jobs.compleo.app/emphasys/jobdetail/PK05328B");
    for (const key of ["id", "title", "company", "location", "date", "url"]) {
      expect(key in c).toBe(true);
    }
  });

  test("missing fields become null, never omitted", () => {
    const c = mapCard({ pk: "JOB:XY01" }, "acme");
    expect(c.title).toBeNull();
    expect(c.company).toBeNull();
    expect(c.location).toBeNull();
    expect(c.date).toBeNull();
  });
});

describe("parseSearchResponse", () => {
  test("reads fields[] and totalFiltered.value", () => {
    const p = parseSearchResponse({ fields: [RAW], totalFiltered: { value: 7 } });
    expect(p.jobs).toHaveLength(1);
    expect(p.total).toBe(7);
  });

  test("tolerates a malformed payload", () => {
    const p = parseSearchResponse(null);
    expect(p.jobs).toEqual([]);
    expect(p.total).toBeNull();
  });
});

describe("mapDetail", () => {
  test("strips HTML from the description", () => {
    const d = mapDetail(
      { ...RAW, description: "<p><strong>Atividades:</strong></p><ul><li>Codar</li></ul>" },
      "emphasys",
    );
    expect(d.description).toContain("Atividades:");
    expect(d.description).toContain("Codar");
    expect(d.description).not.toContain("<");
  });
});

describe("pk / detail input parsing", () => {
  test("pkToCode strips the JOB: prefix", () => {
    expect(pkToCode("JOB:PK05328B")).toBe("PK05328B");
    expect(pkToCode("PK05328B")).toBe("PK05328B");
  });

  test("parseDetailInput handles a full URL", () => {
    const r = parseDetailInput(
      "https://jobs.compleo.app/emphasys/jobdetail/PK05328B",
      "fallback",
    );
    expect(r).toEqual({ board: "emphasys", code: "PK05328B" });
  });

  test("parseDetailInput handles a bare pk with fallback board", () => {
    expect(parseDetailInput("JOB:PK05328B", "acme")).toEqual({
      board: "acme",
      code: "PK05328B",
    });
  });

  test("parseDetailInput rejects garbage", () => {
    expect(parseDetailInput("!!", "acme")).toBeNull();
  });
});

describe("client-side filters", () => {
  const cards: JobCard[] = [
    { ...mapCard(RAW, "emphasys") },
    { ...mapCard({ ...RAW, pk: "JOB:RJ02", location: { city: { label: "Rio de Janeiro" }, provinceOrState: { label: "Rio de Janeiro (RJ)" } } }, "emphasys") },
  ];

  test("matchesLocation is accent-insensitive", () => {
    expect(matchesLocation(cards, "sao paulo")).toHaveLength(1);
    expect(matchesLocation(cards, "rio")).toHaveLength(1);
    expect(matchesLocation(cards, undefined)).toHaveLength(2);
  });

  test("withinDays keeps recent postings", () => {
    const recent = mapCard({ ...RAW, openingDate: new Date().toISOString() }, "emphasys");
    expect(withinDays([recent], 7)).toHaveLength(1);
    expect(withinDays([mapCard(RAW, "emphasys")], 1)).toHaveLength(0);
  });
});

describe("buildSearchBody / formatLocation / htmlToText", () => {
  test("buildSearchBody includes companyId and mainSearch", () => {
    const b = buildSearchBody({ companyId: "2", query: "dev", page: 2, pageSize: 20 });
    expect(b.companyId).toBe("2");
    expect(b.mainSearch).toBe("dev");
    expect(b.pagination).toEqual({ currentPage: 2, pageSize: 20 });
  });

  test("formatLocation joins city/state/country", () => {
    expect(formatLocation(RAW)).toBe("São Paulo - São Paulo (SP), Brasil");
    expect(formatLocation({})).toBeNull();
  });

  test("htmlToText decodes entities and preserves breaks", () => {
    expect(htmlToText("<p>A &amp; B</p><p>C</p>")).toBe("A & B\nC");
    expect(htmlToText(null)).toBeNull();
  });
});
