# PSG Credentials

Static credential lookup / QR verification / certificate download for
Panorama Scholarly Group. No database, no backend — GitHub holds the data,
Cloudflare Pages serves the static site.

## Adding a new certificate

1. Add a row to `source/certificates.csv` (leave `certificate_id` and `token` blank)
2. `npm run assign-ids` — fills in the id/token and rewrites the CSV
3. `npm run validate` — sanity-checks the CSV
4. Commit and open a PR (CI re-runs validation)

## Automatic issuing and revocation (weekly roster sync)

`.github/workflows/roster-sync.yml` runs every Monday (and on demand from the
Actions tab, with optional dry-run and debug switches). It reads each
journal's editorial board page(s), found through the journal homepage's own
links, and the Research Institute's `/people/...` pages, then:

- **revokes** any active appointment certificate whose holder is no longer
  listed (`revoked_reason` = `roster`). It stays verifiable as "Revoked" for
  30 days, then the lifecycle workflow removes it;
- **restores** such a certificate automatically if the name reappears within
  those 30 days;
- **issues** a certificate to anyone listed without one for their role —
  journals 3 years; Research Institute: Research Fellow 3 years, Visiting
  Scholar 6 months, other roles 1 year (`scripts/lib/terms.js`);
- **replaces** the certificate when someone's role on the site changes (old
  one revoked as `reassigned`, new one issued);
- **renews** certificates expiring within a week if the holder is still listed;
- **refreshes** `source/editorial-boards.csv` from the pages.

A certificate revoked by hand (`npm run revoke-certificate`) isn't re-issued
while its record is still in the registry (30 days); to stop it for good,
take the person off the website.

Results go to the "Certificate Registry: Roster Sync Report" issue. Safety
guards: an unreachable page is skipped, and if more than half of a journal's
holders disappear at once nothing is revoked for that journal (it's flagged
for review instead). To undo a wrong revocation, set `status` back to
`active` and clear `revoked_at` / `revoked_reason`.

Run locally: `DRY_RUN=1 npm run sync-roster`.

## Revocation reasons

`revoked_reason` in `source/certificates.csv` is shown publicly on the verify
page: `roster` (set by the sync only), `resigned`, `reassigned` (moved to a
new role, new certificate issued) or `error`. `npm run revoke-certificate`
asks for one.

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
