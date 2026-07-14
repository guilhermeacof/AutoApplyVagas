import { describe, test, expect } from "bun:test"
import { parsePostedOn, mapPostings, publicUrl, parseDetailTarget } from "../src/helpers"
import { COMPANIES, findCompany } from "../src/companies"

const redhat = COMPANIES.find((c) => c.tenant === "redhat")!

describe("parsePostedOn", () => {
  const now = new Date("2026-07-14T12:00:00Z")
  test("Posted Today -> today", () => {
    expect(parsePostedOn("Posted Today", now)).toBe("2026-07-14")
  })
  test("Posted Yesterday -> yesterday", () => {
    expect(parsePostedOn("Posted Yesterday", now)).toBe("2026-07-13")
  })
  test("Posted 3 Days Ago -> minus 3", () => {
    expect(parsePostedOn("Posted 3 Days Ago", now)).toBe("2026-07-11")
  })
  test("Posted 30+ Days Ago -> minus 30", () => {
    expect(parsePostedOn("Posted 30+ Days Ago", now)).toBe("2026-06-14")
  })
  test("unparseable -> null", () => {
    expect(parsePostedOn("Recently posted", now)).toBeNull()
    expect(parsePostedOn(null, now)).toBeNull()
  })
})

describe("publicUrl", () => {
  test("no-lang tenant builds host/site/externalPath", () => {
    expect(publicUrl(redhat, "/job/Pune/Software-Engineer_R-1")).toBe(
      "https://redhat.wd5.myworkdayjobs.com/Jobs/job/Pune/Software-Engineer_R-1",
    )
  })
})

describe("mapPostings", () => {
  test("maps a raw CXS posting into the contract shape", () => {
    const cards = mapPostings(
      {
        total: 1,
        jobPostings: [
          {
            title: "Software Engineer",
            externalPath: "/job/Pune/Software-Engineer_R-056394-1",
            locationsText: "Pune - Tower 6",
            postedOn: "Posted Today",
            bulletFields: ["R-056394"],
          },
        ],
      },
      redhat,
      new Date("2026-07-14T12:00:00Z"),
    )
    expect(cards.length).toBe(1)
    const c = cards[0]
    expect(c.id).toBe("R-056394")
    expect(c.title).toBe("Software Engineer")
    expect(c.company).toBe("Red Hat")
    expect(c.location).toBe("Pune - Tower 6")
    expect(c.date).toBe("2026-07-14")
    expect(c.url).toContain("redhat.wd5.myworkdayjobs.com/Jobs/job/Pune/")
  })
})

describe("parseDetailTarget", () => {
  test("parses a public url into tenant/dc/site/externalPath", () => {
    const t = parseDetailTarget(
      "https://redhat.wd5.myworkdayjobs.com/Jobs/job/Pune/Software-Engineer_R-1",
    )
    expect(t).not.toBeNull()
    expect(t!.tenant).toBe("redhat")
    expect(t!.dc).toBe("wd5")
    expect(t!.site).toBe("Jobs")
    expect(t!.externalPath).toBe("/job/Pune/Software-Engineer_R-1")
  })
  test("parses a url with a lang segment", () => {
    const t = parseDetailTarget(
      "https://acme.wd1.myworkdayjobs.com/en-US/Careers/job/SP/Dev_R-2",
    )
    expect(t!.site).toBe("Careers")
    expect(t!.externalPath).toBe("/job/SP/Dev_R-2")
  })
})

describe("findCompany", () => {
  test("matches by substring and by tenant", () => {
    expect(findCompany("red hat")?.tenant).toBe("redhat")
    expect(findCompany("accenture")?.name).toBe("Accenture")
    expect(findCompany("nvidia")?.tenant).toBe("nvidia")
    expect(findCompany("nonexistent-co")).toBeUndefined()
  })
})
