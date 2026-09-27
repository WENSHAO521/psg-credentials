// Compares a roster (rows of { journal, role, name }) against issued
// certificates and reports where they've drifted apart. Shared by
// scripts/audit-roster.js (against source/editorial-boards.csv) and
// scripts/sync-roster.js (against what it just read off the live sites).
const { ROLE_CODES } = require('./roleCodes');

// Names are compared without honorifics or punctuation: the roster may say
// "Dr. Jiale Li" where the certificate's name field says "Jiale Li".
function personKey(journal, name) {
  const n = (name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^((dr|prof|professor|ven|venerable|rev)\.?\s+)+/, '')
    .replace(/,\s*(m\.?a|m\.?s|m\.?sc|ph\.?d|m\.?d|mba|m\.?phil|ed\.?d)\.?$/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return `${(journal || '').trim().toLowerCase()}::${n}`;
}

// Role spellings that share a code ("Chair of the Editorial Board" /
// "Editorial Board Member (Chair)") are the same role. A blank roster role
// means the page didn't say, which matches anything.
function sameRole(rosterRole, certRole) {
  if (!rosterRole) return true;
  const a = ROLE_CODES[rosterRole] || rosterRole.trim().toLowerCase();
  const b = ROLE_CODES[certRole] || (certRole || '').trim().toLowerCase();
  return a === b;
}

function isActiveAppointment(c, today) {
  return (
    c.status === 'active' &&
    (!c.cert_type || c.cert_type === 'appointment') &&
    (!today || !c.valid_until || c.valid_until >= today)
  );
}

// Returns { missing, roleMismatches, orphaned }:
//   missing        roster rows with no active certificate for that person
//   roleMismatches { roster, cert } pairs: same person, different role
//   orphaned       active certificates with no roster entry (only for
//                  journals the roster covers)
function compareRoster(roster, certs) {
  // Group by (journal, name) rather than one cert per person -- people can
  // hold more than one role at the same journal (e.g. Deputy Editor-in-Chief
  // *and* Chair of the Editorial Board).
  const certsByPerson = new Map();
  for (const c of certs) {
    // Reachable by both name and display_name; one shared entry, so claiming
    // it through either key claims it for both.
    const entry = { cert: c, claimed: false };
    for (const key of new Set([personKey(c.journal, c.name), personKey(c.journal, c.display_name)])) {
      if (!certsByPerson.has(key)) certsByPerson.set(key, []);
      certsByPerson.get(key).push(entry);
    }
  }

  // Pass 1: exact (journal, name, role) match.
  const unmatched = [];
  for (const r of roster) {
    const bucket = certsByPerson.get(personKey(r.journal, r.name)) || [];
    const exact = bucket.find((e) => !e.claimed && r.role && sameRole(r.role, e.cert.role));
    if (exact) exact.claimed = true;
    else unmatched.push(r);
  }

  // Pass 2: an unclaimed cert for the same person -- a role change rather
  // than a new or departed person. Roles the page didn't state match here.
  const missing = [];
  const roleMismatches = [];
  for (const r of unmatched) {
    const bucket = certsByPerson.get(personKey(r.journal, r.name)) || [];
    const loose = bucket.find((e) => !e.claimed);
    if (loose) {
      loose.claimed = true;
      if (!sameRole(r.role, loose.cert.role)) roleMismatches.push({ roster: r, cert: loose.cert });
    } else if (!bucket.length) {
      missing.push(r);
    }
    // else: every cert this person holds is already matched to another of
    // their roster rows -- a second listing of the same person, not a gap
    // worth flagging on its own unless its role has no certificate at all.
    else if (r.role && !bucket.some((e) => sameRole(r.role, e.cert.role))) {
      missing.push(r);
    }
  }

  const rosterJournals = new Set(roster.map((r) => (r.journal || '').trim().toLowerCase()));
  const seen = new Set();
  const orphaned = [];
  for (const e of [...certsByPerson.values()].flat()) {
    if (e.claimed || seen.has(e.cert) || !rosterJournals.has((e.cert.journal || '').trim().toLowerCase())) continue;
    seen.add(e.cert);
    orphaned.push(e.cert);
  }

  return { missing, roleMismatches, orphaned };
}

module.exports = { compareRoster, personKey, sameRole, isActiveAppointment };
