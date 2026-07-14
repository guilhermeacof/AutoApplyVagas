#!/usr/bin/env bun
// Self-contained CLI for searching jobs across companies that use the Lever ATS
// on their own careers site. Lever is per-company (each has a "token"), so this
// CLI walks a registry of Brazilian companies (src/companies.ts) and AGGREGATES
// their postings into one result set. No external CLI framework and zero runtime
// dependencies — it runs anywhere `bun` is available with nothing but the clone.
//
// Data source: Lever's public postings API (https://api.lever.co/v0/postings/<token>),
// the same JSON the hosted board (jobs.lever.co/<token>) calls. No auth, no key.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { runCompany, type CompanyOpts } from "./commands/company.js"

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

const HELP = `lever-cli — busca de vagas via Lever ATS (empresas BR no site próprio)

Percorre um registro de empresas que usam o Lever e agrega as vagas de todas.

USAGE
  bun run src/cli.ts search [-q "<termo>"] [flags]
  bun run src/cli.ts detail <token:id | url> [--format json|plain]
  bun run src/cli.ts company [--format json|table|plain]

SEARCH FLAGS
  --query, -q <texto>     Palavras-chave sobre o título (por palavra, AND). Ex.: "engineer".
  --location, -l <texto>  Filtra por localização (categories.location), ex.: "Remoto", "São Paulo".
  --company, -c <token>   Restringe a UMA empresa do registro (ex.: "neon", "cloudwalk").
  --jobage <dias>         Publicadas nos últimos N dias (filtro client-side por createdAt). Default: todas.
  --page <n>              Página 1-indexada (usa --limit como tamanho da página). Default 1.
  --limit, -n <n>         Tamanho da página / total exibido (client-side). Default: sem limite.
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "engineer" --limit 8 --format table
  bun run src/cli.ts search -q "desenvolvedor" -l "Remoto" --format table
  bun run src/cli.ts search -q "qa" --format table
  bun run src/cli.ts search -c neon --format table
  bun run src/cli.ts detail neon:a053e021-e712-453c-9f8b-2e3194f5e7e9 --format plain
  bun run src/cli.ts company --format table

Uso pessoal — dados via API pública do Lever; mantenha o volume baixo (1 request/empresa).
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

function pickFormat(fmt: string): "json" | "table" | "plain" {
  return (["json", "table", "plain"].includes(fmt) ? fmt : "json") as "json" | "table" | "plain"
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
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
      format: pickFormat((flags.format as string) || "json"),
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const ref = (flags._ as string[])[1]
    if (!ref) {
      process.stderr.write(
        JSON.stringify({ error: "detail requires <token:id | url>", code: "NO_ID" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { ref, format: fmt === "plain" ? "plain" : "json" }
    return runDetail(opts)
  }

  if (cmd === "company") {
    const opts: CompanyOpts = { format: pickFormat((flags.format as string) || "json") }
    return runCompany(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
