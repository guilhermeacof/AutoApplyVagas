import { describe, test, expect } from "bun:test";
import {
  parseJobCards,
  parseTotal,
  extractDescriptionHtml,
  parseJobDetail,
  normalizeId,
  buildSearchUrl,
  htmlToText,
  withinDays,
  PAGE_SIZE,
} from "../src/helpers";

// A pair of SuccessFactors result rows, mirroring the live SONDA markup: each tile
// carries a desktop anchor (href before class) and a hidden mobile duplicate (class
// before href), plus a jobLocation copy inside the title cell to try to fool the parser.
const SEARCH_HTML = `
<span class="paginationLabel" aria-label="Resultados 1 a 40 de 57">Resultados 1 – 40 <b>de 57</b></span>
<tr class="data-row">
  <td class="colTitle" headers="hdrTitle">
    <span class="jobTitle hidden-phone">
      <a href="/job/Mansoes-do-Lago-Analista-de-Melhoria-de-Processos-Sr_-%28Qualidade%29-Dist/1399762100/" class="jobTitle-link">Analista de Melhoria de Processos Sr. (Qualidade)</a>
    </span>
    <div class="jobdetail-phone visible-phone">
      <span class="jobTitle visible-phone">
        <a class="jobTitle-link" href="/job/Mansoes-do-Lago-Analista-de-Melhoria-de-Processos-Sr_-%28Qualidade%29-Dist/1399762100/">Analista de Melhoria de Processos Sr. (Qualidade)</a>
      </span>
      <span class="jobLocation visible-phone"><span class="jobLocation">MOBILE JUNK</span></span>
    </div>
  </td>
  <td class="colLocation hidden-phone" headers="hdrLocation"><span class="jobLocation">Distrito Federal, Brasil</span></td>
  <td class="colDepartment hidden-phone" headers="hdrDepartment"><span class="jobDepartment">Proyectos</span></td>
  <td class="hidden-phone"></td>
</tr>
<tr class="data-row">
  <td class="colTitle" headers="hdrTitle">
    <span class="jobTitle hidden-phone">
      <a href="/job/Sitio-Pau-Brasil-Analista-FP&amp;A-Senior-S%C3%A3o/1381447100/" class="jobTitle-link">Analista FP&amp;A - Senior</a>
    </span>
  </td>
  <td class="colLocation hidden-phone" headers="hdrLocation"><span class="jobLocation">S&#227;o Paulo, Brasil</span></td>
  <td class="colDepartment hidden-phone" headers="hdrDepartment"><span class="jobDepartment">Finan&#231;as</span></td>
</tr>
`;

const DETAIL_HTML = `
<h1><span itemprop="title" data-careersite-propertyid="title" class="x">Analista de Melhoria de Processos Sr. (Qualidade)
</span></h1>
<span itemprop="address"><meta itemprop="addressLocality" content="Mansoes do Lago"><meta itemprop="addressRegion" content="Dist"><meta itemprop="addressCountry" content="Br"></span>
<meta itemprop="datePosted" content="Tue Jul 14 07:00:00 UTC 2026">
<meta itemprop="hiringOrganization" content="SONDA">
<span itemprop="description" data-careersite-propertyid="description">
  <span class="jobdescription"><p><strong>Viva a experi&#234;ncia SONDA</strong></p><ul><li>Automa&#231;&#227;o de testes</li><li>Caf&#233; <span>&#233;</span> obrigat&#243;rio</li></ul><p>#VempraSONDA! #LI-HYBRID</p></span>
</span>
`;

describe("parseJobCards", () => {
  const cards = parseJobCards(SEARCH_HTML);

  test("finds every data-row", () => {
    expect(cards).toHaveLength(2);
  });

  test("extracts id, title, location, department and builds an absolute URL", () => {
    const c = cards[0];
    expect(c.id).toBe("1399762100");
    expect(c.title).toBe("Analista de Melhoria de Processos Sr. (Qualidade)");
    expect(c.company).toBe("SONDA");
    expect(c.location).toBe("Distrito Federal, Brasil");
    expect(c.department).toBe("Proyectos");
    expect(c.date).toBeNull();
    expect(c.url).toBe(
      "https://carrera.sonda.com/job/Mansoes-do-Lago-Analista-de-Melhoria-de-Processos-Sr_-%28Qualidade%29-Dist/1399762100/",
    );
  });

  test("does not pick up the hidden mobile jobLocation duplicate", () => {
    expect(cards[0].location).not.toBe("MOBILE JUNK");
  });

  test("decodes entities in title, location, department and the URL", () => {
    const c = cards[1];
    expect(c.title).toBe("Analista FP&A - Senior");
    expect(c.location).toBe("São Paulo, Brasil");
    expect(c.department).toBe("Finanças");
    expect(c.url).toContain("Analista-FP&A-Senior");
  });

  test("every result carries the full contract shape", () => {
    for (const c of cards) {
      for (const key of ["id", "title", "company", "location", "date", "url"]) {
        expect(key in c).toBe(true);
      }
    }
  });
});

describe("parseTotal", () => {
  test("reads the total from the SuccessFactors pagination aria-label", () => {
    expect(parseTotal(SEARCH_HTML)).toBe(57);
  });
  test("returns null when no count is present", () => {
    expect(parseTotal("<div>no pagination here</div>")).toBeNull();
  });
});

describe("extractDescriptionHtml / detail", () => {
  test("balanced extraction captures the nested-span job ad in full", () => {
    const inner = extractDescriptionHtml(DETAIL_HTML)!;
    expect(inner).toContain("Viva a experi");
    expect(inner).toContain("#LI-HYBRID");
    // The closing </span> of the inner <span>é</span> must NOT end extraction early.
    expect(inner).toContain("obrigat");
  });

  test("parseJobDetail maps title, location, date, company and clean description", () => {
    const job = parseJobDetail(DETAIL_HTML, "1399762100", "https://carrera.sonda.com/job/x/1399762100/");
    expect(job.title).toBe("Analista de Melhoria de Processos Sr. (Qualidade)");
    expect(job.company).toBe("SONDA");
    expect(job.location).toBe("Mansoes do Lago, Dist, Br");
    expect(job.date).toBe("Tue Jul 14 07:00:00 UTC 2026");
    expect(job.description).toContain("Viva a experiência SONDA");
    expect(job.description).toContain("Café é obrigatório");
    expect(job.description).not.toContain("<");
  });
});

describe("htmlToText", () => {
  test("strips tags, decodes entities, returns null on empty", () => {
    expect(htmlToText("<p>Caf&#233;</p>")).toBe("Café");
    expect(htmlToText(null)).toBeNull();
    expect(htmlToText("")).toBeNull();
  });
});

describe("normalizeId", () => {
  test("accepts a bare numeric id and builds a fetchable URL", () => {
    const r = normalizeId("1399762100")!;
    expect(r.id).toBe("1399762100");
    expect(r.url).toContain("/job/x/1399762100/");
  });
  test("extracts id and preserves the slug from a full job URL", () => {
    const r = normalizeId("https://carrera.sonda.com/job/Some-Slug-Here/1381447100/")!;
    expect(r.id).toBe("1381447100");
    expect(r.url).toBe("https://carrera.sonda.com/job/Some-Slug-Here/1381447100/");
  });
  test("returns null when there is no id", () => {
    expect(normalizeId("not-an-id")).toBeNull();
  });
});

describe("buildSearchUrl", () => {
  test("maps query, page->startrow and the location facet", () => {
    const url = buildSearchUrl({ query: "analista", page: 2, location: "Distrito Federal, Brasil" });
    expect(url).toContain("q=analista");
    expect(url).toContain(`startrow=${PAGE_SIZE}`);
    expect(url).toContain("optionsFacetsDD_location=");
  });
  test("omits startrow on page 1", () => {
    expect(buildSearchUrl({ query: "x", page: 1 })).not.toContain("startrow");
  });
});

describe("withinDays", () => {
  test("keeps date-less list cards, drops old dated cards", () => {
    const kept = withinDays(
      [
        { id: "1", title: "a", company: "SONDA", location: null, department: null, date: null, url: "u" },
        { id: "2", title: "b", company: "SONDA", location: null, department: null, date: "2000-01-01T00:00:00Z", url: "u" },
      ],
      7,
    );
    expect(kept.map((c) => c.id)).toEqual(["1"]);
  });
});
