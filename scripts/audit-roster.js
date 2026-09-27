// Diffs source/editorial-boards.csv (the reference roster, refreshed weekly
// from the live sites by scripts/sync-roster.js) against
// source/certificates.csv (the actually-issued credentials), and reports
// where they've drifted apart. Read-only -- fixes are still made by hand
// with add-certificate.js / revoke-certificate.js, this just tells you
// where to look.
//
// Usage: npm run audit-roster
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { compareRoster, isActiveAppointment } = require('./lib/rosterCompare');

const ROSTER_CSV_PATH = path.join(__dirname, '..', 'source', 'editorial-boards.csv');
const CERTS_CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');

function loadCsv(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.error(`${csvPath} parse errors:`, parsed.errors);
    process.exit(1);
  }
  return parsed.data;
}

function main() {
  const roster = loadCsv(ROSTER_CSV_PATH);
  const certs = loadCsv(CERTS_CSV_PATH).filter((c) => isActiveAppointment(c));
  const { missing, roleMismatches, orphaned } = compareRoster(roster, certs);

  console.log(`Roster: ${roster.length} row(s). Active appointment certificates: ${certs.length}.\n`);

  if (missing.length) {
    console.log(`MISSING certificates (on the live roster, no active certificate found):`);
    for (const r of missing) {
      console.log(`  - ${r.name} — ${r.role} — ${r.journal}`);
    }
    console.log('');
  }

  if (roleMismatches.length) {
    console.log(`ROLE MISMATCHES (roster says one thing, issued certificate says another):`);
    for (const { roster: r, cert } of roleMismatches) {
      console.log(`  - ${r.name} (${r.journal}): roster says "${r.role}", certificate ${cert.certificate_id} says "${cert.role}"`);
    }
    console.log('');
  }

  if (orphaned.length) {
    console.log(`ORPHANED certificates (active, but no matching entry on the reference roster -- departed member?):`);
    for (const c of orphaned) {
      console.log(`  - ${c.display_name} — ${c.role} — ${c.journal} (${c.certificate_id})`);
    }
    console.log('');
  }

  if (!missing.length && !roleMismatches.length && !orphaned.length) {
    console.log('No drift found -- roster and certificates agree.');
  }
}

main();
