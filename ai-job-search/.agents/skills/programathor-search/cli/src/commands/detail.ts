import { SITE, htmlFetch, parseJobDetail, normalizeId, writeError } from "../helpers.js"

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
    // The canonical URL is /jobs/<id>-<slug>; /jobs/<id> redirects to it, so we
    // can fetch by id alone (htmlFetch follows redirects).
    const url = `${SITE}/jobs/${id}`
    const html = await htmlFetch(url)
    if (!html) {
      writeError("Vaga não encontrada", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id, url)

    if (opts.format === "plain") {
      const lines = [
        job.title || "(sem título)",
        `${job.company || "—"} · ${job.location || "—"}`,
        job.contract ? `Contrato: ${job.contract}` : "",
        job.seniority ? `Nível: ${job.seniority}` : "",
        job.salary ? `Salário: ${job.salary}` : "",
        job.companySize ? `Empresa: ${job.companySize}` : "",
        job.date ? `Publicada: ${job.date}` : "",
        job.validThrough ? `Válida até: ${job.validThrough}` : "",
        job.tags.length ? `Tecnologias: ${job.tags.join(", ")}` : "",
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
