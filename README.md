# PSG Credentials

Static credential lookup / QR verification / certificate download for
Panorama Scholarly Group. No database, no backend — GitHub holds the data,
Cloudflare Pages serves the static site.

## Adding a new certificate

1. Add a row to `source/certificates.csv` (leave `certificate_id` and `token` blank)
2. `npm run assign-ids` — fills in the id/token and rewrites the CSV
3. `npm run validate` — sanity-checks the CSV
4. Commit and open a PR (CI re-runs validation)

## Automatic roster sync (monthly)

`.github/workflows/roster-sync.yml` runs on the 1st of every month (and on demand
from the Actions tab, with an optional dry-run switch). It reads each journal's
live editorial team page (`<website_url>/about/editorialTeam`, from
`source/journals.csv`) and the Research Institute site
(`research.panorama-sg.com`), and **revokes any active appointment certificate
whose holder is no longer listed**. Revoked certificates stay verifiable as
"Revoked" for 30 days, then the lifecycle workflow removes them.

Results go to the "Certificate Registry: Roster Sync Report" issue. Safety
guards: an unreachable or empty page is skipped, and if more than half of a
journal's holders disappear at once nothing is revoked for that journal (it's
flagged for review instead). To undo a wrong revocation, set `status` back to
`active` and clear `revoked_at`.

Run locally: `DRY_RUN=1 npm run sync-roster`.

## Local dev

```
npm install
npm run dev
```

`npm run dev` regenerates `public/data/certificates.json` from the CSV, then starts Vite.

## Status

- [x] Data pipeline: CSV -> assign-ids -> validate -> build JSON
- [x] CI validation on PR
- [ ] Frontend (React/Vite): home search, certificate preview, verify page — pending brand assets (logo, certificate SVG templates, colors)
