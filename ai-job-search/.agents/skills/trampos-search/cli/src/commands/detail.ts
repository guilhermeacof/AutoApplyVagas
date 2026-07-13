import {
  API_BASE,
  jsonFetch,
  mapDetail,
  normalizeId,
  writeError,
  type RawOpportunity,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Não foi possível extrair um id de vaga de "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const payload = await jsonFetch(`${API_BASE}/${id}`)
    if (!payload) {
      writeError("Vaga não encontrada", "NOT_FOUND")
      return 1
    }
    const raw = (payload as Record<string, unknown>).opportunity ?? payload
    const job = mapDetail(raw as RawOpportunity)

    if (opts.format === "plain") {
      const lines = [
        job.title || "(sem título)",
        `${job.company || "—"} · ${job.location || "—"}`,
        job.salary ? `Salário: ${job.salary}` : "",
        job.regime ? `Regime: ${job.regime}` : "",
        job.type ? `Tipo: ${job.type}` : "",
        job.category ? `Categoria: ${job.category}` : "",
        "",
        job.description || "(sem descrição)",
        job.prerequisite ? `\nPré-requisitos:\n${job.prerequisite}` : "",
        job.desirable ? `\nDesejável:\n${job.desirable}` : "",
        job.perks ? `\nBenefícios:\n${job.perks}` : "",
        job.otherInfo ? `\nOutras informações:\n${job.otherInfo}` : "",
        "",
        `URL: ${job.url}`,
        job.applyUrl ? `Candidatar: ${job.applyUrl}` : "",
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
