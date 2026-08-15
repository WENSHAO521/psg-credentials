// Converts source/certificates.csv into public/data/certificates.json.
// Runs as part of `npm run build` (Cloudflare Pages build step).
// Assumes certificate_id / token are already assigned (run `npm run assign-ids` locally first).
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');
const JOURNALS_CSV_PATH = path.join(__dirname, '..', 'source', 'journals.csv');
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'certificates.json');

// An Editor-in-Chief's own certificate can't be signed by "the journal's
// editor-in-chief" (from journals.csv) -- that would be them signing their
// own appointment. And some journals.csv rows simply have no confirmed
// signatory yet. Both cases are Secretariat-signed: no personal name is
// ever invented, the signature line stays blank, and the seal switches to
// the silver Secretariat version instead of the gold one sitting next to
// an empty line that looks unfinished.
const SECRETARIAT_ROLES = new Set(['Editor-in-Chief']);
const SECRETARIAT_TITLE = 'Secretariat, Panorama Scholarly Group';

// Only these fields are ever written to the public JSON. Anything else in the
// CSV (internal notes, contact info, etc.) is intentionally dropped here,
// because certificates.json is a publicly fetchable file once deployed.
const PUBLIC_FIELDS = [
  'name', 'display_name', 'certificate_id', 'journal', 'role',
  'issue_date', 'valid_from', 'valid_until', 'token', 'status',
];

function loadJournals() {
  const raw = fs.readFileSync(JOURNALS_CSV_PATH, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.error('journals.csv parse errors:', parsed.errors);
    process.exit(1);
  }
  const byJournal = new Map();
  for (const row of parsed.data) byJournal.set(row.journal.trim(), row);
  return byJournal;
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.error('CSV parse errors:', parsed.errors);
    process.exit(1);
  }

  const missing = parsed.data.filter((r) => !r.certificate_id || !r.token);
  if (missing.length) {
    console.error(
      `${missing.length} row(s) are missing certificate_id/token.\n` +
      `Run "npm run assign-ids" locally and commit the updated CSV before building.`
    );
    process.exit(1);
  }

  const journals = loadJournals();
  let missingSignatories = 0;

  const records = parsed.data.map((row) => {
    const out = {};
    for (const field of PUBLIC_FIELDS) out[field] = (row[field] || '').trim();

    const journalRow = journals.get(out.journal);
    if (!journalRow) {
      console.error(
        `"${out.journal}" (certificate ${out.certificate_id}) is not in source/journals.csv. ` +
        `Add it there before building.`
      );
      process.exit(1);
    }
    out.signatory_name = SECRETARIAT_ROLES.has(out.role)
      ? ''
      : (journalRow.editor_in_chief || '').trim();
    out.secretariat_signed = !out.signatory_name;
    out.signatory_title = out.signatory_name
      ? (journalRow.signatory_title || 'Editor-in-Chief').trim()
      : SECRETARIAT_TITLE;
    if (out.secretariat_signed && !SECRETARIAT_ROLES.has(out.role)) missingSignatories += 1;
    out.issn = (journalRow.issn || '').trim();
    // Seal colour: silver whenever nobody named is signing (regardless of
    // journal vs institute -- that's the central Secretariat stepping in);
    // otherwise gold for journals, bronze for the Research Institute, so the
    // seal itself signals which of PSG's platforms issued the certificate.
    out.seal = out.secretariat_signed
      ? 'silver'
      : journalRow.type === 'institute'
        ? 'bronze'
        : 'gold';

    return out;
  });

  if (missingSignatories) {
    console.warn(
      `Warning: ${missingSignatories} certificate(s) have no editor_in_chief set in ` +
      `source/journals.csv — their certificates will render without a signature.`
    );
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(records, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${records.length} record(s) to ${OUT_PATH}`);
}

main();
