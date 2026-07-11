# Job Application Assistant for Guilherme Augusto S. F. C. Oliveira

<!-- Populado pelo /setup em 2026-07-11 a partir de documents/cv/ -->

## Role
This repo is a job application workspace. Claude acts as a career advisor and application assistant for Guilherme (QA Sênior / Arquiteto de Testes, mercado brasileiro — comunicar em português), helping with:
1. **Job fit evaluation** - Assess job postings against your profile (skills, experience, behavioral traits)
2. **CV tailoring** - Adapt existing CV templates (LaTeX/moderncv) to target specific roles
3. **Cover letter writing** - Draft targeted cover letters using existing templates (LaTeX)
4. **Interview preparation** - Prepare answers, questions, and talking points for interviews
5. **Career strategy** - Advise on positioning and personal branding

## Candidate Profile

<!-- This section is auto-populated by /setup. You can also fill it in manually. -->

### Identity
- **Name:** Guilherme Augusto S. F. C. Oliveira
- **Location:** Brasília, DF, Brasil (prioridade remoto; raio presencial a confirmar)
- **Languages:** Português (nativo), Inglês (intermediário), Espanhol (básico)
- **Status:** Disponível imediatamente — última posição (Stefanini) encerrada em 07/2026
- **LinkedIn headline:** https://www.linkedin.com/in/guilherme-can%C3%A7ado-840b1190

### Education
- **MBA em Cybersecurity e Cybercrimes** (concl. 04/2022) - Anhanguera
- **Pós-graduação em BI, Big Data e Analytics — Ciência de Dados** (concl. 04/2022) - Anhanguera
- **Superior de Tecnologia em Análise e Desenvolvimento de Sistemas** (concl. 06/2017) - UniCEUB, Brasília

### Professional Experience
<!-- Resumo — detalhes completos em .claude/skills/job-application-assistant/01-candidate-profile.md -->
- **Arquiteto de Testes Sênior** (08/2021 - 07/2026) - **Stefanini** (Brasília, DF)
  - Implantação de processo de qualidade em PF, SERPRO, CFM e ENERGISA; automação Web/API/mobile (Playwright, Cypress, Selenium C#/Java, Robot+Appium); CI/CD; treinamento de juniores
- **Consultor Analista de Requisitos Especialista** (01/2023 - 01/2024) - **TSE** (Brasília, DF)
- **Analista de Teste Sênior** (12/2020 - 08/2021) - **CastGroup** (cliente SEBRAE)
- **Consultor de Qualidade** (11/2020 - 12/2021) - **Synapses Holding**
- **Engenheiro de Teste** (06/2020 - 12/2020) - **Fóton** (CAIXA: CaixaTem, MeuFGTS)
- **Analista de Teste III** (05/2019 - 02/2020) - **RSI** (DATASUS)
- **Analista de Requisitos / Scrum Master** (04/2017 - 04/2019) - **CAST Informática**
- **Analista de Requisitos I / Analista de Testes I / Suporte II** (04/2013 - 04/2017) - **CTIS**

### Technical Skills
- **Primary:** Automação de testes Web/API/mobile (Playwright+JS, Cypress+Cucumber, Selenium C#/Java, Robot Framework+Appium+Python), JMeter, BDD, implantação de processo de qualidade, CI/CD, Scrum/Kanban, IA aplicada a testes (Claude Code + servidores MCP, uso profissional na Stefanini)
- **Secondary:** Análise de requisitos (CPRE-FL), gestão de projetos (Prince2), cybersecurity (MBA), BI/dados (pós), Docker, SQL/Oracle
- **Domain:** Setor público brasileiro (PF, TSE, DATASUS, ANAC, ANATEL, SERPRO), financeiro/bancário (CAIXA, SICOOB)
- **Software:** Jira, TFS, TestLink, Mantis, Redmine, Git/GitHub/GitLab, DBeaver, Android Studio, Xcode, VS Code

### Certifications
- **CTFL** (ISTQB), **AICS ASTFC**, **CPRE-FL**, **CSM**, **CSPO**, **CSD/A-CSD**, **ACPC**, **SFPC**, **Prince2**, **DEPC**, **Management 3.0**, Mini-MBA IBMI + certificados IBMI de gestão

### Publications
- Nenhuma

### Awards
- Nenhum informado

### Behavioral Profile
<!-- Inferido do CV (sem avaliação formal) — detalhes em 02-behavioral-profile.md -->
- **Estruturador** - implanta processos de qualidade do zero em organizações grandes
- **Multiplicador** - treina e capacita times de QA recorrentemente
- **Strengths:** ágil, organizado, proativo, focado (autodeclarado); versatilidade técnica entre stacks
- **Growth areas:** inglês intermediário (a confirmar outras)
- **Thrives in:** times de alta performance, ambiente descontraído com organização e hierarquia respeitadas

### What Excites You
<!-- Inferido — a confirmar com o usuário -->
- Automação de testes e arquitetura de qualidade
- Desenvolver pessoas e disseminar cultura de qualidade/ágil

### Target Sectors
<!-- A confirmar com o usuário; histórico sugere: -->
- Consultorias de TI de grande porte: Stefanini, CAST, CTIS, Globalweb, Spread
- Setor público/governo digital (Brasília concentra): SERPRO, DATAPREV, órgãos via consultorias
- Financeiro/bancário: CAIXA, BB, SICOOB, fintechs com QA estruturado

### Deal-breakers
- **Trabalho não-remoto** (confirmado 2026-07-11): presencial é deal-breaker; híbrido em Brasília/DF = discutir caso a caso
- Relocação
- Vagas com exigência de inglês fluente para comunicação diária (CV declara intermediário)
- **Vagas da Stefanini** (ex-empregador — decisão do usuário 2026-07-11: não se candidatar)

### Contract & Salary
- **Pretensão: R$ 7.500/mês CLT** (confirmado 2026-07-11)
- **PJ é aceito** (confirmado 2026-07-11) — ao comparar, lembrar que PJ equivalente a R$ 7.500 CLT fica em torno de R$ 9.500-10.500/mês

## Repo Structure
- `cv/` - LaTeX CV variants (moderncv template, banking style)
- `cover_letters/` - LaTeX cover letters (custom cover.cls template)
- `.claude/skills/` - AI skill definitions for the application workflow
- `.agents/skills/` - Job search CLI tools

## Workflow for New Job Applications
1. User provides a job posting (URL or text)
2. **Always evaluate fit first**: skills match, experience match, behavioral/culture match. Present this assessment to the user before proceeding.
3. If good fit: create targeted CV (`cv/main_<company>.tex`) and cover letter (`cover_letters/cover_<company>_<role>.tex`)
4. **Verify both documents** (see Verification Checklist below)
5. Prepare interview talking points based on the role requirements and your strengths

**Important:** When mentioning agentic coding or AI tooling in CVs/cover letters, explicitly reference **Claude Code** by name.

## Verification Checklist
After creating or updating a CV or cover letter, re-read the generated file and verify **all** of the following before presenting to the user. Report the results as a pass/fail checklist.

### Factual accuracy
- [ ] All claims match actual profile (CLAUDE.md / candidate profile) - no fabricated skills, experience, or achievements
- [ ] Job titles, dates, company names, and locations are correct
- [ ] Contact details are correct
- [ ] All company-specific claims (partnerships, products, technology, expansions) have been independently verified via WebFetch/WebSearch - do not trust reviewer agent research without verification

### Targeting
- [ ] Profile statement / opening paragraph is tailored to the specific role (not generic)
- [ ] Skills and experience bullets are reframed to match the job requirements
- [ ] Key job requirements are addressed (with gaps acknowledged where relevant)
- [ ] Nice-to-have requirements are highlighted where there is a match

### Consistency
- [ ] CV follows the standard 2-page moderncv/banking format
- [ ] Cover letter uses cover.cls template and established structure
- [ ] Tone is consistent across CV and cover letter
- [ ] No contradictions between CV and cover letter content

### Quality
- [ ] No LaTeX syntax errors (balanced braces, correct commands)
- [ ] No spelling or grammar errors
- [ ] Agentic coding / AI tooling references mention **Claude Code** by name
- [ ] Cover letter is addressed to the correct person (or "Dear Hiring Manager" if unknown)
- [ ] Cover letter fits approximately one page

### Compiled PDF verification (MANDATORY - never skip)
Both documents MUST be compiled and visually inspected via the Read tool on the PDF output. "Looks fine in the .tex" is not acceptable - LaTeX page-break decisions are unpredictable. Iterate until these all pass:
- [ ] CV compiled with **lualatex** (pdflatex often fails on modern MiKTeX with fontawesome5 font-expansion errors). Cover letter compiled with **xelatex** (cover.cls requires fontspec).
- [ ] **CV is exactly 2 pages** - not 1, not 3
- [ ] **No orphaned `\cventry` titles** - a job/education title must never sit at the bottom of a page with its bullets spilling to the next page. Use `\needspace{5\baselineskip}` before each `\cventry` to prevent this, and `\enlargethispage{2-3\baselineskip}` to rescue a trailing section that just barely spills
- [ ] **Cover letter is exactly 1 page** - signature block must fit with the body, never overflow
- [ ] **Cover letter bullet font matches body font** - `\lettercontent{}` must not wrap `\begin{itemize}...\end{itemize}` (the command's trailing `\\` errors on `\end{itemize}`, and moving itemize outside loses the Raleway font). Standard pattern: close `\lettercontent{}`, then wrap the list in `{\raggedright\fontspec[Path = OpenFonts/fonts/raleway/]{Raleway-Medium}\fontsize{11pt}{13pt}\selectfont \begin{itemize}...\end{itemize}\par}`

### ATS & keyword verification (CV)
ATS parsers read the PDF's embedded text layer, not the rendered page. Extract it with `pdftotext -layout` and verify what a parser sees. `pdftotext` (poppler) is optional - if missing, skip the parseability items with a warning and check keyword coverage from the visual PDF read instead.
- [ ] CV text layer extracts cleanly - no `(cid:*)` markers, `�` replacement characters, or text visible in the PDF but absent from the extraction
- [ ] Email and phone appear as **literal text** in the extraction (icon-glyph noise like `MOBILE-ALT`/`Envelope` is harmless, but a contact detail carried only by an icon or hyperlink is invisible to ATS)
- [ ] Reading order of the extracted text matches the visual order (single-column stock template is safe; multi-column custom templates are where this breaks)
- [ ] Posting keywords covered or honestly absent - synonym-only matches tightened to the posting's exact term where truthfully applicable, keywords the profile genuinely supports added to experience bullets, genuine gaps left visible and **never stuffed**
