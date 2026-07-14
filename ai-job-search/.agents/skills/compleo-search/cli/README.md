# compleo-cli

Zero-dependency `bun` CLI that searches public **Compleo ATS** career boards
(`jobs.compleo.app/<board>/joblist`) and fetches full job details.

- **Search** calls the same public JSON API the board's front-end uses:
  `POST https://api.compleo.app/job/careerjoblist/<BOARD>` (no auth).
- **Detail** parses the server-rendered `__NEXT_DATA__` of the job's own page
  (`pageProps.jobViewData`) — no API call.

Each board belongs to one company. Consultancy/staffing boards (e.g. `emphasys`)
list openings for many **client** companies, and each result's `company` field is
that client (`customer`). There is no global cross-board search; pass the board with
`-b`.

## Install

```bash
bun install   # dev types only; nothing at runtime
```

## Usage

```bash
bun run src/cli.ts search -q "desenvolvedor" --limit 5 --format table
bun run src/cli.ts search -q "analista" -b emphasys -l "São Paulo" --format table
bun run src/cli.ts detail JOB:PK05328B -b emphasys --format plain
bun run src/cli.ts detail https://jobs.compleo.app/emphasys/jobdetail/PK05328B --format plain
```

See `../SKILL.md` for the full flag reference and `../url-reference.md` for the
endpoint protocol and parsing anchors.

## Tests

```bash
bun run typecheck
bun run test        # includes a few live smoke tests against the emphasys board
```
