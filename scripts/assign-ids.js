// Fills in missing certificate_id / token for rows in source/certificates.csv
// and writes the file back in place. Run this locally before committing new rows.
//
// certificate_id format: PSG-{JOURNAL_CODE}-{ROLE_CODE}-{YEAR}-{SEQ}
// SEQ is sequential per journal code per year (not global) -- the journal code
// is already in the id, so a global counter across journals would just be
// confusing ("why does AFS's first certificate say 000047?").
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Papa = require('papaparse');
const { roleCodeFor } = require('./lib/roleCodes');

const CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');
const JOURNALS_CSV_PATH = path.join(__dirname, '..', 'source', 'journals.csv');
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const ID_RE = /^PSG-([A-Z0-9]+)-([A-Z0-9]+)-(\d{4})-(\d{6})$/;

function randomToken(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[crypto.randomInt(TOKEN_ALPHABET.length)];
  }
  return out;
}

function loadJournalCodes() {
  const raw = fs.readFileSync(JOURNALS_CSV_PATH, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.error('journals.csv parse errors:', parsed.errors);
    process.exit(1);
  }
  const byJournal = new Map();
  for (const row of parsed.data) byJournal.set(row.journal.trim(), (row.code || '').trim());
  return byJournal;
}

function journalCodeFor(journalCodes, journal) {
  const code = journalCodes.get(journal);
  if (!code) {
    throw new Error(`"${journal}" has no "code" set in source/journals.csv.`);
  }
  return code;
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.error('CSV parse errors:', parsed.errors);
    process.exit(1);
  }
  const rows = parsed.data;
  const journalCodes = loadJournalCodes();

  const maxSeqByJournalYear = {};
  for (const row of rows) {
    const id = (row.certificate_id || '').trim();
    if (!id) continue;
    const m = id.match(ID_RE);
    if (!m) continue;
    const [, journalCode, , year, seq] = m;
    const key = `${journalCode}:${year}`;
    maxSeqByJournalYear[key] = Math.max(maxSeqByJournalYear[key] || 0, parseInt(seq, 10));
  }

  const usedTokens = new Set(rows.map((r) => (r.token || '').trim()).filter(Boolean));

  let assigned = 0;
  for (const row of rows) {
    const hasId = (row.certificate_id || '').trim();
    const hasToken = (row.token || '').trim();

    if (!hasId) {
      const year = (row.issue_date || '').slice(0, 4);
      if (!/^\d{4}$/.test(year)) {
        throw new Error(`Row for "${row.name}" has invalid issue_date "${row.issue_date}"`);
      }
      const journalCode = journalCodeFor(journalCodes, row.journal);
      const roleCode = roleCodeFor(row.role);
      const key = `${journalCode}:${year}`;
      const nextSeq = (maxSeqByJournalYear[key] || 0) + 1;
      maxSeqByJournalYear[key] = nextSeq;
      row.certificate_id = `PSG-${journalCode}-${roleCode}-${year}-${String(nextSeq).padStart(6, '0')}`;
      assigned++;
    }

    if (!hasToken) {
      let token;
      do {
        token = randomToken();
      } while (usedTokens.has(token));
      usedTokens.add(token);
      row.token = token;
      assigned++;
    }
  }

  if (assigned === 0) {
    console.log('Nothing to assign, CSV already complete.');
    return;
  }

  const fields = parsed.meta.fields;
  const out = Papa.unparse(rows, { columns: fields, newline: '\n' });
  fs.writeFileSync(CSV_PATH, out + '\n', 'utf8');
  console.log(`Assigned ${assigned} value(s). CSV updated: ${CSV_PATH}`);
}

main();
