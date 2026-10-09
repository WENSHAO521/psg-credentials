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
journal's editorial board at `journals.panorama-sg.com/<abbreviation>/editorial-board`
(the standard address for every journal; during the switch-over, a board
page the journal homepage links to is read as well -- the unused OJS
`about/editorialTeam` is never read on its own), and the Research
Institute's `/people/...` pages, then:

- **revokes** any active appointment certificate whose holder is no longer
  listed (`revoked_reason` = `roster`). It stays verifiable as "Revoked" for
  30 days, then the lifecycle workflow removes it;
- **restores** such a certificate automatically if the name reappears within
  those 30 days;
- **issues** a certificate to anyone listed without one for their role —
  journals 3 years; Research Institute: leadership (Director, Director of
  Research, coordinators, research-center directors) 10 years, Research
  Fellow 3 years, Visiting Scholar 6 months, other roles 1 year
  (`scripts/lib/terms.js`). A research-center director's certificate records
  the center in `detail`; the Director's own certificate is signed by the
  Secretariat;
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

## Publication sponsorships

The Research Institute sponsors (waives) the article processing charge of
selected articles. Each sponsored article gets one `publication_sponsorship`
certificate shared by its authors: `npm run add-certificate`, type `publication_sponsorship`, then
the article title (`detail`) and, optionally, the author's affiliation
(`affiliation`). The role is always `Publication Sponsorship`, the sponsor
always the Panorama Research Institute (signed by its Director, bronze seal).

For coauthored articles, use a combined display name (e.g. `Yanlin Feng and
Sebastian Lenz`) and separate the plain search names with semicolons
(`Yanlin Feng; Sebastian Lenz`). Each author's full name and the exact article
title find the same certificate and Sponsorship No.; do not duplicate its ID
across separate rows. With more than three authors, the display name lists the
first three followed by `et al.` (e.g. `Qilong Wang, Xixi Fan, Xin Qi et al.`)
and `affiliation` lists only those authors' institutions; `name` still holds
every author so each one can be found by search.

The certificate number (`PSG-PRI-SPN-<year>-<seq>`) doubles as the
Sponsorship No. authors cite when submitting, e.g. under Funding /
Supporting Agencies:

> Panorama Research Institute, Sponsorship No. PSG-PRI-SPN-2026-000014

Editors can confirm it on `/verify` or look it up on `/sponsorship` by author
name or exact article title. Sponsorships don't expire and the roster sync
never touches them; if an article is withdrawn, revoke with reason
`withdrawn`.

## Revocation reasons

`revoked_reason` in `source/certificates.csv` is shown publicly on the verify
page: `roster` (set by the sync only), `resigned`, `reassigned` (moved to a
new role, new certificate issued), `error`, or `withdrawn` (a sponsored
article withdrawn or retracted). `npm run revoke-certificate`
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
