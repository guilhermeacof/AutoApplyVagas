import {
  JOBS_BASE,
  extractNextData,
  mapDetail,
  pageProps,
  parseDetailInput,
  textFetch,
  writeError,
  type RawJob,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  board: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const parsed = parseDetailInput(opts.id, opts.board)
  if (!parsed) {
    writeError(`Não foi possível extrair um código de vaga de "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    // The detail page is server-rendered: the full record lives in
    // __NEXT_DATA__ at pageProps.jobViewData — no API call needed.
    const html = await textFetch(`${JOBS_BASE}/${parsed.board}/jobdetail/${parsed.code}`)
    if (!html) {
      writeError("Vaga não encontrada", "NOT_FOUND")
      return 1
    }
    const jv = pageProps(extractNextData(html)).jobViewData as RawJob | undefined
    if (!jv || !jv.pk) {
      writeError("Vaga não encontrada ou sem dados", "NOT_FOUND")
      return 1
    }
    const job = mapDetail(jv, parsed.board)

    if (opts.format === "plain") {
      const lines = [
        job.title || "(sem título)",
        `${job.company || "—"} · ${job.location || "—"}`,
        job.workingModel ? `Modelo: ${job.workingModel}` : "",
        job.experienceLevel ? `Nível: ${job.experienceLevel}` : "",
        job.employmentType ? `Contrato: ${job.employmentType}` : "",
        "",
        job.description || "(sem descrição)",
        job.responsibilities ? `\nResponsabilidades:\n${job.responsibilities}` : "",
        job.requirements ? `\nRequisitos:\n${job.requirements}` : "",
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
