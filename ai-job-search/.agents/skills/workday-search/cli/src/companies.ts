// Registry of companies whose careers run on Workday and that hire in Brazil.
//
// Workday is a PER-COMPANY ATS: every employer has its own "tenant" hosted on one of
// Workday's data centers (dc: wd1/wd3/wd5/wd103/...), and exposes one or more career
// "sites". The public CXS JSON API needs four coordinates to reach a company's jobs:
//
//   { tenant, dc, site, lang }
//
// - tenant : the subdomain and the CXS path segment (usually the same string)
// - dc     : the Workday data-center shard in the host (wd1, wd3, wd5, wd103, ...)
// - site   : the external career-site id (e.g. "Jobs", "AccentureCareers")
// - lang   : optional locale segment in the PUBLIC url ("" when the site has none;
//            some tenants use "en-US"). It does NOT appear in the CXS API url.
//
// Every entry below was CONFIRMED live: the CXS endpoint returned real jobPostings and
// a Brazil country facet. To add a company, open its careers page, follow the redirect
// to `*.myworkdayjobs.com/[<lang>/]<site>/...`, read tenant/dc/site/lang from the URL,
// then confirm it responds (see url-reference.md → "How to confirm a new company").

export interface Company {
  /** Human-readable registry name. Also what `-c/--company` and `detail <name>:<path>` match (case-insensitive substring). */
  name: string
  /** Subdomain + CXS path segment, e.g. "redhat". */
  tenant: string
  /** Workday data-center shard in the host, e.g. "wd5", "wd103". */
  dc: string
  /** External career-site id, e.g. "Jobs", "AccentureCareers". */
  site: string
  /** Locale segment in the PUBLIC url ("" when the site uses none). Not part of the CXS api url. */
  lang: string
}

export const COMPANIES: Company[] = [
  // Red Hat — 154 postings live, Brazil facet count 12. Public url has no lang segment.
  { name: "Red Hat", tenant: "redhat", dc: "wd5", site: "Jobs", lang: "" },
  // Accenture — 2000+ postings, Brazil facet count ~178. Note the unusual dc "wd103".
  { name: "Accenture", tenant: "accenture", dc: "wd103", site: "AccentureCareers", lang: "" },
  // NVIDIA — 2000+ postings, Brazil facet present. Public url has no lang segment.
  { name: "NVIDIA", tenant: "nvidia", dc: "wd5", site: "NVIDIAExternalCareerSite", lang: "" },
]

/** Find a registry company by case-insensitive substring of its name (or exact tenant). */
export function findCompany(query: string): Company | undefined {
  const q = query.trim().toLowerCase()
  return (
    COMPANIES.find((c) => c.name.toLowerCase() === q || c.tenant.toLowerCase() === q) ??
    COMPANIES.find((c) => c.name.toLowerCase().includes(q) || c.tenant.toLowerCase().includes(q))
  )
}
