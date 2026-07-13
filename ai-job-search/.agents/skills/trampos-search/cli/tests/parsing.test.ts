import { describe, test, expect } from "bun:test";
import {
  mapCard,
  mapDetail,
  htmlToText,
  normalizeId,
  parseSearchResponse,
  withinDays,
  type RawOpportunity,
} from "../src/helpers";

const sample: RawOpportunity = {
  id: 773418,
  name: "Desenvolvedor(a) Back-End",
  company: { name: "Acme" },
  state: "SP",
  city: "Barueri",
  home_office: true,
  hybrid: false,
  published_at: "2026-06-25T12:30:04.000-03:00",
  salary: "R$ 5.000 a R$ 8.000",
  category_name: "Programação",
  type_name: "Emprego",
  description: "<p>Vaga para dev</p><ul><li>Node</li><li>Café &#xE9; obrigat&#243;rio</li></ul>",
  prerequisite: "<p>Experiência com APIs</p>",
};

describe("mapCard", () => {
  test("maps core fields and builds a canonical URL", () => {
    const c = mapCard(sample);
    expect(c.id).toBe("773418");
    expect(c.title).toBe("Desenvolvedor(a) Back-End");
    expect(c.company).toBe("Acme");
    expect(c.url).toBe("https://trampos.co/oportunidades/773418");
    expect(c.date).toBe("2026-06-25T12:30:04.000-03:00");
    expect(c.salary).toBe("R$ 5.000 a R$ 8.000");
  });

  test("location combines city/state and remote flag", () => {
    expect(mapCard(sample).location).toBe("Barueri - SP · Remoto");
  });

  test("custom_company_name takes precedence over company.name", () => {
    const c = mapCard({ ...sample, custom_company_name: "Custom Co" });
    expect(c.company).toBe("Custom Co");
  });

  test("hybrid flag renders when not remote", () => {
    const c = mapCard({ ...sample, home_office: false, hybrid: true });
    expect(c.location).toBe("Barueri - SP · Híbrido");
  });

  test("missing values become null, never omitted", () => {
    const c = mapCard({ id: 1 });
    expect(c.title).toBeNull();
    expect(c.company).toBeNull();
    expect(c.location).toBeNull();
    expect(c.date).toBeNull();
  });
});

describe("htmlToText", () => {
  test("strips tags, preserves breaks, decodes entities", () => {
    const t = mapDetail(sample).description!;
    expect(t).toContain("Vaga para dev");
    expect(t).toContain("Café é obrigatório");
    expect(t).not.toContain("<");
  });

  test("decodes hex numeric entities (&#xE9; -> é)", () => {
    expect(htmlToText("Caf&#xE9;")).toBe("Café");
  });

  test("returns null for empty/undefined input", () => {
    expect(htmlToText(null)).toBeNull();
    expect(htmlToText("")).toBeNull();
  });
});

describe("normalizeId", () => {
  test("accepts a bare numeric id", () => {
    expect(normalizeId("773418")).toBe("773418");
  });
  test("extracts id from a full listing URL", () => {
    expect(normalizeId("https://trampos.co/oportunidades/773418-desenvolvedor-back-end")).toBe("773418");
  });
  test("returns null when there is no id", () => {
    expect(normalizeId("abc")).toBeNull();
  });
});

describe("parseSearchResponse", () => {
  test("normalizes opportunities and pagination", () => {
    const r = parseSearchResponse({
      opportunities: [sample],
      pagination: { total: 42, total_pages: 4, per_page: 12 },
    });
    expect(r.opportunities).toHaveLength(1);
    expect(r.pagination.total).toBe(42);
  });
  test("tolerates a missing payload", () => {
    const r = parseSearchResponse(null);
    expect(r.opportunities).toEqual([]);
    expect(r.pagination.total).toBeNull();
  });
});

describe("withinDays", () => {
  test("keeps recent, drops old", () => {
    const recent = mapCard({ ...sample, id: 1, published_at: new Date().toISOString() });
    const old = mapCard({ ...sample, id: 2, published_at: "2000-01-01T00:00:00.000-03:00" });
    const kept = withinDays([recent, old], 7);
    expect(kept.map((c) => c.id)).toEqual(["1"]);
  });
  test("days=9999 keeps everything", () => {
    const old = mapCard({ ...sample, id: 2, published_at: "2000-01-01T00:00:00.000-03:00" });
    expect(withinDays([old], 9999)).toHaveLength(1);
  });
});
