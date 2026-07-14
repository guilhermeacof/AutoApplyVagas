// Registry of companies whose careers site is powered by the Lever ATS.
//
// Lever is per-company: each company exposes its own board under a "token"
// (the path segment in `https://api.lever.co/v0/postings/<token>`). This CLI
// aggregates across every company in this list, so adding a new Brazilian
// company is as simple as appending `{ token, name }` here — no other code
// changes needed.
//
// Only tokens that were confirmed to return real postings at build time are
// included. To add one, hit
//   https://api.lever.co/v0/postings/<token>?mode=json
// and confirm it returns a non-empty JSON array of postings.

export interface Company {
  /** Lever board token — the path segment in the API URL. */
  token: string
  /** Human-readable display name shown in results. */
  name: string
}

export const COMPANIES: Company[] = [
  { token: "cloudwalk", name: "CloudWalk" },
  { token: "neon", name: "Neon" },
  { token: "zippi", name: "Zippi" },
  { token: "tractian", name: "TRACTIAN" },
  { token: "starkbank", name: "Stark Bank" },
]

/** Look up a company by its Lever token (case-insensitive). */
export function findCompany(token: string): Company | undefined {
  const t = token.toLowerCase()
  return COMPANIES.find((c) => c.token === t)
}
