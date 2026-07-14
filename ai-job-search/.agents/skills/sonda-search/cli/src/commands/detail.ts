import {
  htmlFetch,
  parseJobDetail,
  normalizeId,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const resolved = normalizeId(opts.id)
  if (!resolved) {
    writeError(`Não foi possível extrair um id de vaga de "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await htmlFetch(resolved.url)
    if (!html) {
      writeError("Vaga não encontrada", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, resolved.id, resolved.url)

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
