// Validates source/certificates.csv. Does not write anything.
// Run in CI on every PR that touches the CSV.
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { ROLE_CODES } = require('./lib/roleCodes');

const CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');
const REQUIRED_FIELDS = [
  'name', 'display_name', 'journal', 'role',
  'issue_date', 'valid_from', 'valid_until', 'status',
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_VALUES = new Set(['active', 'revoked']);

function fail(errors) {
  console.error(`Found ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    fail(parsed.errors.map((e) => `CSV parse error: ${e.message} (row ${e.row})`));
  }

  const rows = parsed.data;
  const errors = [];
  const seenIds = new Map();
  const seenTokens = new Map();

  rows.forEach((row, i) => {
    const line = `row ${i + 2} (${row.name || 'unnamed'})`;

    for (const field of REQUIRED_FIELDS) {
      if (!row[field] || !String(row[field]).trim()) {
        errors.push(`${line}: missing required field "${field}"`);
      }
    }

    if (row.role && !ROLE_CODES[row.role]) {
      errors.push(`${line}: unknown role "${row.role}"`);
    }

    for (const dateField of ['issue_date', 'valid_from', 'valid_until']) {
      if (row[dateField] && !DATE_RE.test(row[dateField])) {
        errors.push(`${line}: ${dateField} "${row[dateField]}" is not YYYY-MM-DD`);
      }
    }

    if (row.valid_from && row.valid_until && DATE_RE.test(row.valid_from) && DATE_RE.test(row.valid_until)) {
      if (row.valid_from > row.valid_until) {
        errors.push(`${line}: valid_from is after valid_until`);
      }
    }

    if (row.status && !STATUS_VALUES.has(row.status)) {
      errors.push(`${line}: status "${row.status}" must be one of active/revoked`);
    }

    const revokedAt = (row.revoked_at || '').trim();
    if (row.status === 'revoked') {
      if (!revokedAt) {
        errors.push(`${line}: status is "revoked" but revoked_at is missing (needed to compute the removal grace period)`);
      } else if (!DATE_RE.test(revokedAt)) {
        errors.push(`${line}: revoked_at "${revokedAt}" is not YYYY-MM-DD`);
      } else if (row.issue_date && revokedAt < row.issue_date) {
        errors.push(`${line}: revoked_at is before issue_date`);
      } else if (revokedAt > new Date().toISOString().slice(0, 10)) {
        errors.push(`${line}: revoked_at is in the future`);
      }
    } else if (revokedAt) {
      errors.push(`${line}: revoked_at is set but status is not "revoked"`);
    }

    const id = (row.certificate_id || '').trim();
    if (id) {
      if (seenIds.has(id)) {
        errors.push(`${line}: duplicate certificate_id "${id}" (also at ${seenIds.get(id)})`);
      } else {
        seenIds.set(id, line);
      }
    }

    const token = (row.token || '').trim();
    if (token) {
      if (seenTokens.has(token)) {
        errors.push(`${line}: duplicate token "${token}" (also at ${seenTokens.get(token)})`);
      } else {
        seenTokens.set(token, line);
      }
    }
  });

  if (errors.length) fail(errors);
  console.log(`OK: ${rows.length} row(s) validated, no errors.`);
}

main();
