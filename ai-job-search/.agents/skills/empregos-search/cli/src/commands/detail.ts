import { BASE_URL, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw job ID or a full /vaga/<id>/<slug> URL. */
function normalizeId(input: string): string | null {
  const url = input.match(/\/vaga\/(\d+)/)
  if (url) return url[1]
  const bare = input.match(/^\d{4,}$/)
  if (bare) return input
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await htmlFetch(`${BASE_URL}/vaga/${id}`)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.workplace ? `Modelo: ${job.workplace}` : "",
        job.contractType ? `Contratação: ${job.contractType}` : "",
        job.salary ? `Salário: ${job.salary}` : "",
        job.vacancies ? `Vagas: ${job.vacancies}` : "",
        job.posted ? `Publicada: ${job.posted}` : "",
        "",
        job.description || "(sem descrição)",
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
