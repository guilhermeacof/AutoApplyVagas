import {
  detailUrl,
  getJson,
  mapDetail,
  parseDetailTarget,
  writeError,
  type DetailResponse,
} from "../helpers.js"
import { COMPANIES, findCompany, type Company } from "../companies.js"

export interface DetailOpts {
  target: string
  format: "json" | "plain"
}

/**
 * Resolve the detail target to `{ company, externalPath }`.
 *   - "<company>:<externalPath>"  -> registry lookup by name/tenant
 *   - a full myworkdayjobs.com url -> tenant/dc/site parsed from the url; company name
 *     taken from the registry when the tenant is known, else the tenant string.
 */
function resolve(target: string): { company: Company; externalPath: string } | null {
  // company:externalPath form. Split on the FIRST colon so "/job/..." keeps its colons-free path.
  const colon = target.indexOf(":")
  const isUrl = /^https?:\/\//i.test(target)
  if (colon > 0 && !isUrl) {
    const name = target.slice(0, colon)
    const path = target.slice(colon + 1).trim()
    const c = findCompany(name)
    if (!c) return null
    if (!path.startsWith("/job/")) return null
    return { company: c, externalPath: path.replace(/\/+$/, "") }
  }
  const parsed = parseDetailTarget(target)
  if (!parsed) return null
  const known = COMPANIES.find((c) => c.tenant.toLowerCase() === parsed.tenant.toLowerCase())
  const company: Company =
    known ?? {
      name: parsed.tenant,
      tenant: parsed.tenant,
      dc: parsed.dc,
      site: parsed.site,
      lang: "",
    }
  return { company, externalPath: parsed.externalPath }
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const resolved = resolve(opts.target)
  if (!resolved) {
    writeError(
      `Não foi possível interpretar "${opts.target}". Use "<empresa>:/job/..." ou uma URL myworkdayjobs.com.`,
      "BAD_TARGET",
    )
    return 1
  }
  try {
    const url = detailUrl(resolved.company, resolved.externalPath)
    const data = await getJson<DetailResponse>(url)
    if (!data || !data.jobPostingInfo) {
      writeError("Vaga não encontrada", "NOT_FOUND")
      return 1
    }
    const job = mapDetail(data, resolved.company, resolved.externalPath)

    if (opts.format === "plain") {
      const lines = [
        job.title || "(sem título)",
        `${job.company} · ${job.location || "—"}`,
        job.date ? `Publicada: ${job.date}` : "",
        job.employmentType ? `Contrato: ${job.employmentType}` : "",
        "",
        job.description || "(sem descrição)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
