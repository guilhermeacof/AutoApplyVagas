#!/usr/bin/env bun
// Self-contained CLI for searching jobs on public Compleo ATS career boards
// (jobs.compleo.app/<board>/joblist). No external CLI framework and zero runtime
// dependencies, so it runs anywhere `bun` is available with nothing but the repo clone.
//
// Search hits the same public JSON API the board's front-end calls
// (POST api.compleo.app/job/careerjoblist/<BOARD>); detail parses the server-rendered
// __NEXT_DATA__ of the job's page. See url-reference.md for the full protocol.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { DEFAULT_BOARD } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = {
    q: "query",
    l: "location",
    b: "board",
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

const HELP = `compleo-cli — busca de vagas em boards públicos do ATS Compleo (Brasil)

USAGE
  bun run src/cli.ts search [-q "<termo>"] [-b <board>] [flags]
  bun run src/cli.ts detail <id|url> [-b <board>] [--format json|plain]

SEARCH FLAGS
  --query, -q <texto>     Palavras-chave (cargo, skill, tecnologia). Busca em título/descrição.
  --board, -b <link>      Board (uniqueLink da empresa Compleo). Default: "${DEFAULT_BOARD}".
  --location, -l <texto>  Filtra por localização (cidade/UF, filtro client-side por substring).
  --jobage <dias>         Publicadas nos últimos N dias (filtro client-side por data). Default: todas.
  --page <n>              Página 1-indexada. Default 1.
  --limit, -n <n>         Limita o total de resultados exibidos (também define o pageSize da API).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "desenvolvedor" --limit 5 --format table
  bun run src/cli.ts search -q "analista" --format table
  bun run src/cli.ts search -q "oracle" -b emphasys -l "São Paulo" --format table
  bun run src/cli.ts detail JOB:PK05328B -b emphasys --format plain
  bun run src/cli.ts detail https://jobs.compleo.app/emphasys/jobdetail/PK05328B --format plain

Uso pessoal — dados públicos dos boards Compleo; mantenha o volume baixo.
Cada board é de UMA empresa/consultoria; boards de consultoria (ex.: emphasys) listam
vagas de várias empresas-cliente (campo "company" = cliente). Não há busca global entre
boards — informe o board com -b.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const board =
    typeof flags.board === "string" && flags.board.trim()
      ? flags.board.trim()
      : DEFAULT_BOARD

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n",
        )
        return null
      }
      return val
    }

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
      board,
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(
        JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      board,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
