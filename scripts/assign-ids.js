// Fills in missing certificate_id / token for rows in source/certificates.csv
// and writes the file back in place. Run this locally before committing new rows.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Papa = require('papaparse');
const { roleCodeFor } = require('./lib/roleCodes');

const CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

function randomToken(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[crypto.randomInt(TOKEN_ALPHABET.length)];
  }
  return out;
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.error('CSV parse errors:', parsed.errors);
    process.exit(1);
  }
  const rows = parsed.data;

  const maxSeqByYear = {};
  for (const row of rows) {
    const id = (row.certificate_id || '').trim();
    if (!id) continue;
    const m = id.match(/^PSG-[A-Z]+-(\d{4})-(\d{6})$/);
    if (!m) continue;
    const [, year, seq] = m;
    maxSeqByYear[year] = Math.max(maxSeqByYear[year] || 0, parseInt(seq, 10));
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
      const code = roleCodeFor(row.role);
      const nextSeq = (maxSeqByYear[year] || 0) + 1;
      maxSeqByYear[year] = nextSeq;
      row.certificate_id = `PSG-${code}-${year}-${String(nextSeq).padStart(6, '0')}`;
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
