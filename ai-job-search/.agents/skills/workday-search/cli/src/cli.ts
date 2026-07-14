#!/usr/bin/env bun
// Self-contained CLI for searching jobs across companies that run on Workday
// (*.myworkdayjobs.com). Workday is a PER-COMPANY ATS: this CLI walks a registry
// (src/companies.ts) and aggregates each company's public CXS JSON API. No auth,
// no framework, zero runtime dependencies — runs anywhere `bun` is available.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { COMPANIES } from "./companies.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = {
    q: "query",
    l: "location",
    c: "company",
    n: "limit",
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `workday-cli — busca de vagas em empresas que usam Workday (*.myworkdayjobs.com)

Workday é um ATS por-empresa: a busca percorre um REGISTRO de empresas
(src/companies.ts) e AGREGA os resultados. Empresas confirmadas: ${COMPANIES.map((c) => c.name).join(", ")}.

USAGE
  bun run src/cli.ts search [-q "<termo>"] [flags]
  bun run src/cli.ts company
  bun run src/cli.ts detail "<empresa>:/job/..." | "<url myworkdayjobs.com>" [--format json|plain]

SEARCH FLAGS
  --query, -q <texto>     Palavra-chave (cargo, skill, tecnologia).
  --location, -l <texto>  Filtra por localização (substring, client-side sobre locationsText),
                          ex.: "Brazil", "São Paulo", "Remote".
  --company, -c <nome>    Restringe a UMA empresa do registro (substring do nome/tenant).
  --jobage <dias>         Publicadas nos últimos N dias (sobre a data derivada de "postedOn").
  --page <n>              Página 1-indexada sobre o fluxo agregado. Default: 1.
  --limit, -n <n>         Resultados por página (default: 20).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "engineer" --limit 8 --format table
  bun run src/cli.ts search -q "qa" -l "Brazil" --format table
  bun run src/cli.ts search -q "developer" -c "Red Hat" --format table
  bun run src/cli.ts company
  bun run src/cli.ts detail "Red Hat:/job/Pune/Software-Engineer_R-056394-1" --format plain

Dados via a API pública CXS do Workday; mantenha o volume baixo.
`

function parseIntFlag(name: string, raw: string | boolean | string[]): number | null {
  const val = parseInt(raw as string, 10)
  if (isNaN(val)) {
    process.stderr.write(
      JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n",
    )
    return null
  }
  return val
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "company") {
    const fmt = (flags.format as string) || "json"
    if (fmt === "table" || fmt === "plain") {
      const rows = COMPANIES.map(
        (c) => `${c.name.padEnd(14)} ${c.tenant}.${c.dc}  site=${c.site}  lang=${c.lang || "(none)"}`,
      )
      process.stdout.write(rows.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify({ companies: COMPANIES }, null, 2) + "\n")
    }
    return 0
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      flags.jobage = String(v)
    }
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      flags.page = String(v)
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      flags.limit = String(v)
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      company: typeof flags.company === "string" ? flags.company : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const target = (flags._ as string[])[1]
    if (!target) {
      process.stderr.write(
        JSON.stringify({ error: "detail requires a <company:path> or url", code: "NO_TARGET" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      target,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
