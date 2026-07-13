---
name: remotive-search
version: 1.0.0
description: >-
  Busca vagas 100% remotas no Remotive (remotive.com), board curado de vagas remotas
  de tecnologia (em inglês; muitas aceitam LatAm/Brasil e PJ). Use quando o usuário
  quiser vagas remotas, remote jobs, home office internacional, trabalho remoto em
  tech/QA/dev. Trigger phrases: "vagas remotas", "remote jobs", "home office",
  "trabalho remoto", "Remotive", "vaga internacional remota", "remote QA".
context: fork
allowed-tools: Bash(bun run skills/remotive-search/cli/src/cli.ts *)
---

# remotive-search

Busca vagas no **Remotive** — board **curado** de vagas **100% remotas** de tecnologia.
As vagas são em **inglês** e muitas aceitam candidatos da América Latina / Brasil
(inclusive PJ). Por ser curado, os títulos e tags são limpos (menos ruído que
agregadores abertos).

**Fonte de dados:** o feed JSON público `https://remotive.com/api/remote-jobs`. Sem
login, sem scraping de HTML.

> ⚠️ **Uso pessoal.** Dados do feed público do Remotive. Mantenha o volume de
> requisições baixo; não use para coleta em massa ou fins comerciais.

## Comandos

```
bun run skills/remotive-search/cli/src/cli.ts search [-q "<termo>"] [flags]
bun run skills/remotive-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

### Flags do `search`
| Flag | Descrição |
|------|-----------|
| `--query`, `-q` | Palavras-chave; filtra sobre título, empresa e tags. |
| `--jobage <dias>` | Publicadas nos últimos N dias (client-side). Default: todas. |
| `--page <n>` | Página 1-indexada. Default 1. |
| `--limit`, `-n <n>` | Resultados por página (client-side). Default 25. |
| `--format <fmt>` | `json` (default), `table` ou `plain`. |

O parâmetro `search` do Remotive não filtra no servidor (retorna o feed completo),
então a filtragem e a paginação são feitas no cliente.

## Exemplos (termos em inglês funcionam melhor)

```
bun run skills/remotive-search/cli/src/cli.ts search -q "qa" --limit 5 --format table
bun run skills/remotive-search/cli/src/cli.ts search -q "test" --jobage 30 --format table
bun run skills/remotive-search/cli/src/cli.ts search -q "sdet" --format json
bun run skills/remotive-search/cli/src/cli.ts detail 1234567 --format plain
```

## Saída (JSON)
`{ "meta": { "count", "page", "total", "total_pages", "per_page" }, "results": [ { "id", "title", "company", "location", "date", "url", "salary", "category", "type", "tags" } ] }`
Valores ausentes vêm como `null`. Erros vão para stderr como `{ "error", "code" }`, exit 1.

## Notas
- Vagas em inglês: use `qa`, `test`, `sdet`, `quality`, `automation`, `engineer`.
- `location` costuma ser "Worldwide"/região (ex.: "LATAM", "Brazil") → preenchido como "Remoto" quando vazio.
- `detail` busca o feed e localiza o id (o Remotive não tem endpoint de vaga única).
