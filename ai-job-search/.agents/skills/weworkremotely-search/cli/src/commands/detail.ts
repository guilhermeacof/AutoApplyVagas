import {
  CATEGORIES,
  FEED_BASE,
  textFetch,
  parseItems,
  mapDetail,
  slugFromLink,
  normalizeId,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not extract a job id from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    // The full description lives inside each RSS <item>, so scan the same category
    // feeds and match the requested slug.
    for (const cat of CATEGORIES) {
      const xml = await textFetch(`${FEED_BASE}/${cat}.rss`)
      const item = parseItems(xml).find((it) => slugFromLink(it.link) === id)
      if (!item) continue

      const job = mapDetail(item)
      if (opts.format === "plain") {
        const lines = [
          job.title || "(no title)",
          `${job.company || "—"} · ${job.location || "—"}`,
          job.category ? `Category: ${job.category}` : "",
          job.date ? `Posted: ${job.date}` : "",
          "",
          job.description || "(no description)",
          "",
          `URL: ${job.url}`,
        ].filter((l) => l !== "")
        process.stdout.write(lines.join("\n") + "\n")
      } else {
        process.stdout.write(JSON.stringify(job, null, 2) + "\n")
      }
      return 0
    }

    writeError("Job not found (it may have expired off the RSS feeds)", "NOT_FOUND")
    return 1
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
