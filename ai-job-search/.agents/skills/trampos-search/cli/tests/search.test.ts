import { afterEach, describe, expect, test } from "bun:test";
import { runSearch } from "../src/commands/search";

const originalFetch = globalThis.fetch;
const originalStdoutWrite = process.stdout.write;

function apiResponse() {
  return new Response(
    JSON.stringify({
      opportunities: [
        {
          id: 123456,
          name: "Engenheiro(a) de QA",
          company: { name: "Acme" },
          state: "SP",
          city: "São Paulo",
          home_office: true,
          published_at: new Date().toISOString(),
          salary: "R$ 8.000",
          category_name: "Tecnologia da Informação",
          type_name: "Emprego",
        },
      ],
      pagination: { total: 1, total_pages: 1, per_page: 12 },
    }),
    { headers: { "content-type": "application/json" } },
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.stdout.write = originalStdoutWrite;
});

function captureStdout(): () => string {
  let stdout = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  return () => stdout;
}

describe("runSearch", () => {
  test("--limit 0 emits zero results", async () => {
    globalThis.fetch = (async () => apiResponse()) as typeof fetch;
    const get = captureStdout();

    const code = await runSearch({ jobage: 9999, page: 1, limit: 0, format: "json" });

    expect(code).toBe(0);
    expect(JSON.parse(get()).results).toHaveLength(0);
  });

  test("maps a result into the shared contract shape", async () => {
    globalThis.fetch = (async () => apiResponse()) as typeof fetch;
    const get = captureStdout();

    const code = await runSearch({ jobage: 9999, page: 1, format: "json" });

    expect(code).toBe(0);
    const out = JSON.parse(get());
    expect(out.meta.count).toBe(1);
    const r = out.results[0];
    expect(r.id).toBe("123456");
    expect(r.title).toBe("Engenheiro(a) de QA");
    expect(r.company).toBe("Acme");
    expect(r.url).toBe("https://trampos.co/oportunidades/123456");
    for (const key of ["id", "title", "company", "location", "date", "url"]) {
      expect(key in r).toBe(true);
    }
  });
});
