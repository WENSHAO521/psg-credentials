// Interactive helper for revoking a certificate: sets status=revoked and
// revoked_at=today, which starts the 30-day removal grace period (see
// scripts/prune-expired.js). Run this instead of hand-editing the CSV so the
// two fields never get out of sync (the exact mistake that has bitten this
// project before).
//
// Usage: npm run revoke-certificate
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const Papa = require('papaparse');
const { REVOKED_REASONS, reasonAllowedFor } = require('./lib/revokedReasons');

const CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');

function today() {
  return new Date().toISOString().slice(0, 10);
}

// See scripts/add-certificate.js for why this doesn't use rl.question().
function createLineReader() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const iterator = rl[Symbol.asyncIterator]();
  return {
    async readLine(promptText) {
      process.stdout.write(promptText);
      const { value, done } = await iterator.next();
      return done ? '' : value;
    },
    close() {
      rl.close();
    },
  };
}

async function main() {
  const rl = createLineReader();

  try {
    const raw = fs.readFileSync(CSV_PATH, 'utf8');
    const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });

    const id = (await rl.readLine('Certificate ID to revoke: ')).trim();
    const row = parsed.data.find((r) => r.certificate_id === id);
    if (!row) {
      console.log(`No certificate with id "${id}" found.`);
      return;
    }
    if (row.status === 'revoked') {
      console.log(`${id} is already revoked (as of ${row.revoked_at}).`);
      return;
    }

    console.log('\n--- Certificate ---');
    console.log(`  Name    : ${row.display_name}`);
    console.log(`  Journal : ${row.journal}`);
    console.log(`  Role    : ${row.role}`);
    console.log(`  Term    : ${row.valid_from} to ${row.valid_until}`);

    // Manual revocations never use "roster" -- that one is reserved for
    // sync-roster, which also auto-restores it if the name reappears.
    const reasons = Object.keys(REVOKED_REASONS).filter(
      (r) => r !== 'roster' && reasonAllowedFor(r, row.cert_type)
    );
    console.log('\nReason (shown publicly on the verify page):');
    reasons.forEach((r, i) => console.log(`  ${i + 1}. ${r} -- ${REVOKED_REASONS[r]}`));
    const pick = (await rl.readLine(`Choose 1-${reasons.length} (blank for none): `)).trim();
    const reason = pick ? reasons[Number(pick) - 1] : '';
    if (pick && !reason) {
      console.log('Not a valid choice, nothing written.');
      return;
    }

    const confirm = (await rl.readLine('\nRevoke this certificate now? (y/n): ')).trim().toLowerCase();
    if (confirm !== 'y') {
      console.log('Cancelled, nothing written.');
      return;
    }

    row.status = 'revoked';
    row.revoked_at = today();
    row.revoked_reason = reason;

    const fields = parsed.meta.fields;
    fs.writeFileSync(CSV_PATH, Papa.unparse(parsed.data, { columns: fields, newline: '\n' }) + '\n', 'utf8');

    execFileSync('node', [path.join(__dirname, 'validate-data.js')], { stdio: 'inherit' });

    console.log(`\nRevoked ${id} as of ${row.revoked_at}.`);
    console.log('It stays verifiable (marked "Revoked") for 30 days, then the scheduled');
    console.log('lifecycle workflow removes it automatically. Commit and push when ready.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
