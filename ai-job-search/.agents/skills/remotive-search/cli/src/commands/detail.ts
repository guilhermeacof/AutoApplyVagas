import { API_URL, jsonFetch, parseJobs, mapDetail, normalizeId, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

// Remotive has no single-job endpoint, so `detail` fetches the feed and finds the id.
export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Não foi possível extrair um id de vaga de "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const payload = await jsonFetch(API_URL)
    const raw = parseJobs(payload).find((o) => String(o.id) === id)
    if (!raw) {
      writeError("Vaga não encontrada", "NOT_FOUND")
      return 1
    }
    const job = mapDetail(raw)

    if (opts.format === "plain") {
      const lines = [
        job.title || "(sem título)",
        `${job.company || "—"} · ${job.location || "—"}`,
        job.salary ? `Salário: ${job.salary}` : "",
        job.type ? `Tipo: ${job.type}` : "",
        job.category ? `Categoria: ${job.category}` : "",
        job.tags.length ? `Tags: ${job.tags.join(", ")}` : "",
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
