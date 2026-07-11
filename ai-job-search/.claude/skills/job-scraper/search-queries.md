# Search Queries for Job Scraper

Profile: **Guilherme — Analista de Qualidade Sênior / Arquiteto de Testes** — Brasília/DF, mercado brasileiro.

## Search Sites

Primary (installed CLI skills in `.agents/skills/`):
- **Gupy** (`gupy-search`) — Brazil's largest ATS; most big-company postings. JSON API with `--location <cidade>` and `--remote remote|hybrid|onsite`.
- **Vagas.com.br** (`vagas-search`) — traditional Brazilian job board. City goes inside `--query`; results carry a seniority `level` field — prefer `Sênior`.
- **LinkedIn** (`linkedin-search`) — use `--location "Brazil"` (or a city like `"São Paulo, Brazil"`, or `"Remote"`).

Secondary (WebSearch only — no CLI):
- **InfoJobs Brasil** — `site:infojobs.com.br`
- **Catho** — `site:catho.com.br/vagas` (Catho's own pages are bot-protected; Google-indexed results still work)

Disabled: the Danish portal CLIs live in `.agents/skills-disabled/` and are not searched.

## Title variants (combine across all queries)

The same role is written many ways in Brazilian postings. Treat all of these as
equivalent matches for the target role:

- Analista de Testes Sênior · Analista de Teste Sr · Analista de Testes III
- Analista de QA · Analista QA Sênior · QA Sr · QA Sênior
- Quality Assurance Analyst · QA Engineer · Test Analyst · Software Tester
- Analista de Qualidade de Software · Engenheiro de Qualidade
- SDET · Test Automation Engineer · Analista de Automação de Testes

Seniority markers: `Sênior`, `Senior`, `Sr`, `SR`, `III`, `especialista`, `lead`.
When a portal has no seniority filter, search the base term and filter by title/level
in the fit assessment.

## Query Categories

### Priority 1: QA / Analista de Testes (core)

CLI terms (run each against gupy-search and vagas-search; pick the top variants, not all at once):
```
analista de testes
analista de qualidade
qa
quality assurance
```
LinkedIn:
```
-q "QA senior" -l "Brazil"
-q "analista de testes" -l "Brazil"
```
WebSearch fallback:
```
site:infojobs.com.br "analista de testes" OR "analista de qa"
site:catho.com.br/vagas "analista de testes sênior"
```

### Priority 2: Automação de testes

Strongest differentiator for senior QA roles.
```
automação de testes
qa automation
test automation
sdet
```
LinkedIn:
```
-q "test automation engineer" -l "Brazil"
-q "QA automation" -l "Remote"
```
WebSearch fallback:
```
site:infojobs.com.br "automação de testes"
```

### Priority 3: Adjacentes (qualidade / liderança)

Roles a senior test analyst can step into.
```
engenheiro de qualidade
quality engineer
coordenador de testes
tech lead qa
```

### Priority 4: Rede ampla

```
tester
software testing
qualidade de software
```
LinkedIn:
```
-q "software quality" -l "Brazil" --remote remote
```

## Location Filter

- Default scope: **Brasil**, prioritizing **remote** postings (`--remote remote` on
  gupy-search and linkedin-search; on vagas-search prefer results whose location says
  "100% Home Office").
- **Remoto é requisito** (confirmado 2026-07-11): buscar com `--remote remote` por padrão.
- Híbrido em Brasília/DF (`--location "Brasília"`): incluir só como FLAG para o usuário decidir.
- Presencial (qualquer cidade) e híbrido fora do DF: descartar.

## Date Filter

Only include jobs posted within the last 14 days (`--jobage 14`), or with an
application deadline that has not yet passed (Gupy results carry a `deadline` field).
If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also
generate 2-3 custom queries for that focus. For example:
- "/scrape automação" → Priority 2 queries + custom automation-tool queries (Cypress, Selenium, Playwright, Robot Framework)
- "/scrape líder" → Priority 3 queries + "gerente de qualidade", "qa lead"
