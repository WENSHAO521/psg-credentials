# PSG Credentials

Static credential lookup / QR verification / certificate download for
Panorama Scholarly Group. No database, no backend — GitHub holds the data,
Cloudflare Pages serves the static site.

## Adding a new certificate

1. Add a row to `source/certificates.csv` (leave `certificate_id` and `token` blank)
2. `npm run assign-ids` — fills in the id/token and rewrites the CSV
3. `npm run validate` — sanity-checks the CSV
4. Commit and open a PR (CI re-runs validation)

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
