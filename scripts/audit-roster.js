// Diffs source/editorial-boards.csv (the reference roster, kept in sync by
// hand against each journal's live editorialTeam page) against
// source/certificates.csv (the actually-issued credentials), and reports
// where they've drifted apart. Read-only -- fixes are still made by hand
// with add-certificate.js / revoke-certificate.js, this just tells you
// where to look.
//
// Usage: npm run audit-roster
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const ROSTER_CSV_PATH = path.join(__dirname, '..', 'source', 'editorial-boards.csv');
const CERTS_CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');

function normalize(s) {
  return (s || '').trim().toLowerCase();
}

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
  const certs = loadCsv(CERTS_CSV_PATH).filter(
    (r) => r.status === 'active' && (!r.cert_type || r.cert_type === 'appointment')
  );

  // Group by (journal, name) rather than deduping to one cert per person --
  // people can hold more than one role at the same journal (e.g. Deputy
  // Editor-in-Chief *and* Chair of the Editorial Board), and a naive
  // last-write-wins map would silently drop one of their certificates from
  // the comparison.
  const personKey = (journal, name) => `${normalize(journal)}::${normalize(name)}`;
  const certsByPerson = new Map();
  for (const c of certs) {
    const key = personKey(c.journal, c.display_name);
    if (!certsByPerson.has(key)) certsByPerson.set(key, []);
    certsByPerson.get(key).push({ cert: c, claimed: false });
  }

  const missing = [];
  const roleMismatches = [];

  // Pass 1: exact (journal, name, role) match.
  const unmatchedRoster = [];
  for (const r of roster) {
    const bucket = certsByPerson.get(personKey(r.journal, r.name)) || [];
    const exact = bucket.find((entry) => !entry.claimed && normalize(entry.cert.role) === normalize(r.role));
    if (exact) {
      exact.claimed = true;
    } else {
      unmatchedRoster.push(r);
    }
  }

  // Pass 2: for roster rows with no exact-role match, pair against any
  // remaining unclaimed cert for that same person -- a likely role rename
  // rather than a wholly new/departed person. Whatever's left after this is
  // reported as genuinely missing or orphaned below.
  for (const r of unmatchedRoster) {
    const bucket = certsByPerson.get(personKey(r.journal, r.name)) || [];
    const loose = bucket.find((entry) => !entry.claimed);
    if (loose) {
      loose.claimed = true;
      roleMismatches.push({ roster: r, cert: loose.cert });
    } else {
      missing.push(r);
    }
  }

  // Only flag orphans within journals the roster file actually tracks --
  // e.g. Panorama Research Institute appointments are charter-driven, not
  // scraped from a journal editorialTeam page, so they're never in
  // editorial-boards.csv and shouldn't be flagged as "departed members".
  const rosterJournals = new Set(roster.map((r) => normalize(r.journal)));
  const orphaned = [...certsByPerson.values()]
    .flat()
    .filter((entry) => !entry.claimed && rosterJournals.has(normalize(entry.cert.journal)))
    .map((entry) => entry.cert);

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
