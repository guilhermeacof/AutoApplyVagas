# Remotive — referência de endpoints

Fonte: feed JSON público. Sem autenticação. Base: `https://remotive.com`.

## Busca / listagem
`GET https://remotive.com/api/remote-jobs` (opcional `?search=<termo>`, hoje ignorado no servidor)

- Retorna um objeto: `{ "0-legal-notice": "...", "job-count": N, "jobs": [ ... ] }`.
- O `search` atualmente NÃO filtra no servidor (retorna o feed completo) → filtrar no cliente.
- Cabeçalhos: User-Agent de browser + `Accept: application/json`.

### Campos por vaga (item de `jobs[]`)
| Campo | Uso |
|-------|-----|
| `id` | id da vaga → `id` |
| `title` | título → `title` |
| `company_name` | empresa → `company` |
| `candidate_required_location` | localização/região (ex.: "Worldwide", "LATAM", "Brazil") → `location` |
| `publication_date` | data ISO → `date` |
| `url` | URL canônica → `url` |
| `category` | categoria → `category` |
| `job_type` | tipo (full_time, contract...) → `type` |
| `salary` | faixa salarial (texto) → `salary` |
| `tags` | array de tags/skills → `tags` |
| `description` | HTML da descrição → `description` (detail; convertido em texto) |

## Detalhe
Não há endpoint de vaga única. `detail <id|url>` busca o feed e localiza o `id` em `jobs[]`.

## robots.txt / termos
`/api/remote-jobs` é público. Uso pessoal, volume baixo.
