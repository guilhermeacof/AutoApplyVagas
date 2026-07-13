#!/usr/bin/env bun
// Self-contained CLI for searching developer / tech jobs on Programathor
// (https://programathor.com.br), a Brazilian job board (many remote roles).
// The listing pages are server-rendered HTML, so this CLI parses the job cards
// with regex — no external CLI framework and zero runtime dependencies, so it
// runs anywhere `bun` is available with nothing but the repo clone.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = {
    q: "query",
    l: "location",
    n: "limit",
    t: "tech",
    s: "seniority",
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
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

const HELP = `programathor-cli — busca de vagas dev/tech no Programathor (Brasil, muitas remotas)

USAGE
  bun run src/cli.ts search [-q "<termo>"] [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <texto>     Palavras-chave (cargo, skill, tecnologia). Recomendado.
  --tech, -t <slug>       Rota de tecnologia do Programathor, ex.: "python", "quality-assurance".
  --location, -l <texto>  Filtra por cidade (parâmetro "place"), ex.: "São Paulo".
  --remote                Somente vagas remotas.
  --contract <tipo>       Tipo de contrato: "CLT", "PJ" ou "Estágio".
  --seniority, -s <nível> Nível: "Júnior", "Pleno" ou "Sênior".
  --include-expired       Inclui vagas vencidas (por padrão são omitidas).
  --jobage <dias>         NÃO suportado na busca (os cards não trazem data); ignorado.
  --page <n>              Página 1-indexada (15 resultados/página). Default 1.
  --limit, -n <n>         Limita o total de resultados exibidos (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "desenvolvedor" --limit 5 --format table
  bun run src/cli.ts search -q "python" --remote --format table
  bun run src/cli.ts search -t "quality-assurance" --format table
  bun run src/cli.ts search -q "analista" -s "Sênior" --format table
  bun run src/cli.ts detail 33665 --format plain

Uso pessoal — dados públicos do Programathor; mantenha o volume baixo.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) +
            "\n",
        )
        return null
      }
      return val
    }

    for (const name of ["jobage", "page", "limit"] as const) {
      if (flags[name] !== undefined && flags[name] !== true) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      tech: typeof flags.tech === "string" ? flags.tech : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      remote: flags.remote === true || flags.remote === "true",
      contract: typeof flags.contract === "string" ? flags.contract : undefined,
      seniority: typeof flags.seniority === "string" ? flags.seniority : undefined,
      includeExpired: flags["include-expired"] === true || flags["include-expired"] === "true",
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
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
