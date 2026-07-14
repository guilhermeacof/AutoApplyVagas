import {
  API_BASE,
  jsonFetch,
  mapDetail,
  parseCompositeId,
  writeError,
  type RawPosting,
} from "../helpers.js"
import { findCompany, type Company } from "../companies.js"

export interface DetailOpts {
  /** "<token>:<id>" or a Lever hosted/apply URL. */
  ref: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const parsed = parseCompositeId(opts.ref)
  if (!parsed) {
    writeError(
      `Não foi possível extrair "<token>:<id>" de "${opts.ref}". Use o id do search (ex.: neon:a053e021-...) ou a URL da vaga.`,
      "BAD_ID",
    )
    return 1
  }
  // The company may be outside the registry (e.g. a URL for an unlisted token);
  // fall back to a synthetic company using the token as its display name.
  const company: Company = findCompany(parsed.token) ?? {
    token: parsed.token,
    name: parsed.token,
  }
  try {
    const payload = await jsonFetch(`${API_BASE}/${parsed.token}/${parsed.id}?mode=json`)
    if (!payload) {
      writeError("Vaga não encontrada", "NOT_FOUND")
      return 1
    }
    const raw = (Array.isArray(payload) ? payload[0] : payload) as RawPosting
    const job = mapDetail(company, raw)

    if (opts.format === "plain") {
      const lines = [
        job.title || "(sem título)",
        `${job.company || "—"} · ${job.location || "—"}`,
        job.commitment ? `Contrato: ${job.commitment}` : "",
        job.workplaceType ? `Modelo: ${job.workplaceType}` : "",
        job.team ? `Time: ${job.team}` : "",
        job.department ? `Departamento: ${job.department}` : "",
        "",
        job.description || "(sem descrição)",
      ]
      for (const l of job.lists) {
        if (l.text || l.content) {
          lines.push("", l.text ? `${l.text}:` : "", l.content || "")
        }
      }
      if (job.additional) lines.push("", job.additional)
      lines.push("", `URL: ${job.url}`)
      if (job.applyUrl) lines.push(`Candidatar: ${job.applyUrl}`)
      process.stdout.write(lines.filter((l) => l !== "").join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
