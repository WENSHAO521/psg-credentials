// Certificate lifecycle: removes registry rows once their post-term/post-revocation
// grace period has passed, and reports which rows are approaching removal so a human
// gets advance notice before anything is deleted.
//
// Policy (source/journals.csv holds no PII, and neither does this — we only ever
// notify PSG staff via a GitHub Issue, never the certificate holder, because
// certificates.csv intentionally has no contact info to notify them with):
//   - natural term expiry (status=active, valid_until passed): removed 90 days after valid_until
//   - early revocation (status=revoked): removed 30 days after revoked_at
//   - staff get a heads-up once a row is within 14 days of its removal date
//
// Run by .github/workflows/lifecycle.yml on a daily schedule. Writes the updated
// CSV in place and a prune-summary.json for the workflow to turn into an Issue.
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');
const SUMMARY_PATH = path.join(__dirname, '..', 'prune-summary.json');

const GRACE_DAYS_EXPIRED = 90;
const GRACE_DAYS_REVOKED = 30;
const NOTICE_DAYS = 14;

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.error('CSV parse errors:', parsed.errors);
    process.exit(1);
  }

  const now = today();
  const kept = [];
  const removed = [];
  const upcoming = [];

  for (const row of parsed.data) {
    let purgeDate = null;
    let reason = null;

    if (row.status === 'revoked' && row.revoked_at) {
      purgeDate = addDays(row.revoked_at, GRACE_DAYS_REVOKED);
      reason = 'revoked';
    } else if (row.status === 'active' && row.valid_until && now > row.valid_until) {
      purgeDate = addDays(row.valid_until, GRACE_DAYS_EXPIRED);
      reason = 'term expired';
    }

    if (!purgeDate) {
      kept.push(row);
      continue;
    }

    const summaryRow = {
      certificate_id: row.certificate_id,
      display_name: row.display_name,
      journal: row.journal,
      reason,
      purge_date: purgeDate,
    };

    if (now >= purgeDate) {
      removed.push(summaryRow);
    } else {
      kept.push(row);
      if (addDays(now, NOTICE_DAYS) >= purgeDate) {
        upcoming.push(summaryRow);
      }
    }
  }

  if (removed.length) {
    const fields = parsed.meta.fields;
    const out = Papa.unparse(kept, { columns: fields, newline: '\n' });
    fs.writeFileSync(CSV_PATH, out + '\n', 'utf8');
  }

  const summary = { removed, upcoming, checked_on: now };
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2) + '\n', 'utf8');

  console.log(`Removed ${removed.length} record(s). ${upcoming.length} approaching removal.`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `removed_count=${removed.length}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_summary=${removed.length || upcoming.length ? 'true' : 'false'}\n`);
  }
}

main();
