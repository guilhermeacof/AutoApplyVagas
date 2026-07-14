import { COMPANIES } from "../companies.js"

export interface CompanyOpts {
  format: "json" | "table" | "plain"
}

/** List the company registry (does not hit the network). */
export function runCompany(opts: CompanyOpts): number {
  if (opts.format === "table") {
    const rows = COMPANIES.map((c) => `${c.token.padEnd(14)} ${c.name}`)
    const header = "TOKEN".padEnd(14) + " NAME"
    process.stdout.write([header, "-".repeat(header.length), ...rows].join("\n") + "\n")
  } else if (opts.format === "plain") {
    process.stdout.write(COMPANIES.map((c) => `${c.name} (${c.token})`).join("\n") + "\n")
  } else {
    process.stdout.write(
      JSON.stringify(
        { meta: { count: COMPANIES.length }, results: COMPANIES },
        null,
        2,
      ) + "\n",
    )
  }
  return 0
}
