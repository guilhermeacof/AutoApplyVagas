# remotive-cli

CLI zero-dependência (só `bun`) para buscar vagas remotas no [Remotive](https://remotive.com)
via seu feed JSON público (`/api/remote-jobs`).

## Uso
```bash
bun install          # só tipos de dev (@types/bun, typescript)
bun run typecheck
bun run src/cli.ts search -q "qa" --limit 5 --format table
bun run src/cli.ts detail <id|url> --format plain
bun run test
```

Comandos, flags e formato de saída seguem o contrato compartilhado dos portais
(`search`/`detail`, saída `{ meta, results }`, erros em stderr). Veja `../SKILL.md`
e `../url-reference.md`.
