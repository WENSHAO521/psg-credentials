// Weekly roster sync against the live websites: for every journal in
// source/journals.csv (its editorial board / team pages, found by following
// the journal homepage's links) and for the Panorama Research Institute
// (research.panorama-sg.com, its /people/... pages), reads the public roster
// pages and:
//   1. revokes appointment certificates whose holder is no longer listed
//      (status=revoked, revoked_at=today, revoked_reason=roster). That starts
//      the usual 30-day grace period in scripts/prune-expired.js, during which
//      the certificate still verifies as "Revoked";
//   2. restores certificates it revoked earlier (revoked_reason=roster) whose
//      holder is listed again, e.g. after a page edit briefly dropped them;
//   3. issues certificates to people listed without one for their role
//      (terms: scripts/lib/terms.js), unless staff revoked that role by hand;
//   4. on a role change, revokes the old certificate (revoked_reason=
//      reassigned) and issues one for the new role;
//   5. renews certificates expiring within a week whose holder is still
//      listed in the same role, the new term starting the day after;
//   6. refreshes source/editorial-boards.csv from the pages.
//
// Steps 3-6 only use journals whose page parse was trustworthy this run.
//
// Deliberately conservative, because a wrong revocation is worse than a late
// one:
//   - only appointment certificates are checked (paper awards / conference
//     invitations aren't tied to board membership)
//   - revocation uses "does this person's name appear anywhere on the page",
//     not a parse of the page layout, so a theme change doesn't look like the
//     whole board left. The parse (scripts/lib/rosterParse.js) only feeds the
//     roster file and the report, and a journal's roster rows are replaced
//     only if the parse found nearly every holder the plain check found
//   - a source where no roster page can be found or read is skipped (never
//     treated as "everyone left")
//   - if more than MAX_MISSING_RATIO of a source's holders vanish at once,
//     nothing is revoked for that source -- it's reported for a human to look
//     at instead (more likely a broken/moved page than a mass resignation)
//
// Usage:
//   npm run sync-roster              # check and apply everything above
//   DRY_RUN=1 npm run sync-roster    # check and report only, write nothing
//
// Run by .github/workflows/roster-sync.yml on a weekly schedule. Writes the
// updated CSVs in place and a roster-sync-summary.json for the workflow to
// turn into an Issue.
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { parseRoster, roleFromLabel } = require('./lib/rosterParse');
const { compareRoster, isActiveAppointment, personKey, sameRole } = require('./lib/rosterCompare');
const { termEnd, addDays } = require('./lib/terms');
const { fillIds } = require('./assign-ids');

const CERTS_CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');
const ROSTER_CSV_PATH = path.join(__dirname, '..', 'source', 'editorial-boards.csv');
const JOURNALS_CSV_PATH = path.join(__dirname, '..', 'source', 'journals.csv');
const SUMMARY_PATH = path.join(__dirname, '..', 'roster-sync-summary.json');

// Every source is read the same way: fetch its start page(s), follow the
// same-site links whose URL looks like a roster page, and check names against
// the combined text of those roster pages. The sites use custom themes, so the
// board lives at a different path per journal (/csgs/Editorial-Board,
// /jlpcs/EditorialBoard, /tts/junior-editorial-board, /afs/editorialTeam, ...);
// following the journal's own navigation finds it wherever it is.
const JOURNAL_ROSTER_LINK = /editorial[-_]?(team|board)|junior[-_]?editorial|masthead/i;
// The institute lists people under /people/<role-plural> (one role per page,
// taken from the URL); /people/join is the application page, not a roster.
const INSTITUTE_ROSTER_LINK = /^\/people\/(?!join\b)[^/]+\/?$/i;
const EXTRA_SOURCES = {
  'Panorama Research Institute': {
    start: ['https://research.panorama-sg.com/'],
    also: [],
    follow: INSTITUTE_ROSTER_LINK,
    roleFromPath: true,
  },
};

const MAX_MISSING_RATIO = 0.5;
// The parsed roster replaces a journal's rows in editorial-boards.csv only if
// the parser found at least this share of the holders the plain name check
// found -- otherwise the page's layout has outrun the parser and the old rows
// are kept (and the report says so).
const MIN_PARSE_COVERAGE = 0.9;
const MIN_MISSING_FOR_RATIO_GUARD = 3;
const MIN_PAGE_TEXT_LENGTH = 200;
const MAX_CRAWL_PAGES = 25;
const FETCH_TIMEOUT_MS = 30000;
// The sites sit behind bot protection that answers bursts with 403/429;
// pace requests and retry those (and 5xx / network errors) a couple of times.
const FETCH_RETRY_DELAYS_MS = [5000, 20000];
const FETCH_PACING_MS = Number(process.env.ROSTER_FETCH_PACING_MS ?? 750);
// Renew a certificate that expires within this many days (one run's gap)
// if its holder is still listed in the same role.
const RENEW_WINDOW_DAYS = 7;
const USER_AGENT = 'psg-credentials-roster-sync (+https://github.com/wenshao521/psg-credentials)';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadCsv(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    console.error(`${csvPath} parse errors:`, parsed.errors);
    process.exit(1);
  }
  return parsed;
}

// Lowercase, strip accents/titles-agnostic punctuation, collapse whitespace --
// applied identically to page text and to names so "Dr. José  Li-Wei" on the
// page matches "Jose Li Wei" in the CSV.
function normalize(s) {
  return ` ${(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function sameSiteLinks(html, pageUrl) {
  const base = new URL(pageUrl);
  const links = new Set();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)/gi)) {
    let u;
    try {
      u = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue;
    if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|css|js|ico|mp4)$/i.test(u.pathname)) continue;
    u.hash = '';
    links.add(u.toString());
  }
  return [...links];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtml(url) {
  for (let attempt = 0; ; attempt++) {
    await sleep(FETCH_PACING_MS);
    let res;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (attempt < FETCH_RETRY_DELAYS_MS.length) {
        await sleep(FETCH_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw err;
    }
    if (res.ok) return res.text();
    const retryable = res.status === 403 || res.status === 429 || res.status >= 500;
    if (retryable && attempt < FETCH_RETRY_DELAYS_MS.length) {
      await sleep(FETCH_RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

// journals.csv holds the journal's home URL (in one case its editorialTeam
// URL). Besides whatever the homepage links to, always try the stock OJS
// path too.
function journalSource(websiteUrl) {
  const home = websiteUrl.replace(/\/+$/, '').replace(/\/(about\/)?editorialTeam$/i, '');
  return { start: [home], also: [`${home}/about/editorialTeam`], follow: JOURNAL_ROSTER_LINK };
}

function rosterLinks(links, follow) {
  // Skip unrendered template placeholders (${...}) some themes leave in hrefs.
  return links.filter((l) => !/%7B|\$\{/i.test(l) && follow.test(new URL(l).pathname));
}

// Returns { text, urls, links, people } for a source, or throws if no roster
// page could be read -- the start page alone (mostly navigation) never counts
// as a roster.
async function loadSource({ start, also, follow, roleFromPath }) {
  const errors = [];
  const candidates = new Set(also);
  const allLinks = [];

  for (const url of start) {
    try {
      const html = await fetchHtml(url);
      const links = sameSiteLinks(html, url);
      allLinks.push(...links);
      for (const l of rosterLinks(links, follow)) candidates.add(l);
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  const texts = [];
  const okUrls = [];
  const people = [];
  for (const url of [...candidates].slice(0, MAX_CRAWL_PAGES)) {
    try {
      const html = await fetchHtml(url);
      const text = htmlToText(html);
      if (text.replace(/\s+/g, ' ').trim().length < MIN_PAGE_TEXT_LENGTH) {
        errors.push(`${url}: page is nearly empty`);
        continue;
      }
      texts.push(text);
      okUrls.push(url);
      const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
      const defaultRole = roleFromPath ? roleFromLabel(slug.replace(/[-_]+/g, ' ')) || '' : '';
      people.push(...parseRoster(html, { defaultRole }));
      if (process.env.DEBUG_HTML) {
        const body = html
          .replace(/<(script|style|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ')
          .replace(/<!--[\s\S]*?-->/g, ' ')
          .replace(/\s+/g, ' ');
        console.log(`  [html] ${url} ${body.slice(0, 40000)}`);
      }
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  if (!okUrls.length) {
    throw new Error(`no roster page found${errors.length ? ` (${errors.join('; ')})` : ''}`);
  }
  // The same person can appear on two candidate URLs for one page
  // (/index.php/x/about/editorialTeam and /x/about/editorialTeam).
  const seen = new Set();
  const uniquePeople = people.filter((p) => {
    const key = `${normalize(p.name)}::${p.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { text: texts.join('\n'), urls: okUrls, links: [...new Set(allLinks)], people: uniquePeople };
}

function nameVariants(cert) {
  const variants = new Set();
  for (const raw of [cert.name, cert.display_name]) {
    const n = normalize(raw).trim();
    if (!n) continue;
    variants.add(n);
    const parts = n.split(' ');
    // Chinese names are often written family-name-first ("Li Jiale").
    if (parts.length === 2) variants.add(`${parts[1]} ${parts[0]}`);
  }
  return [...variants];
}

function isListed(cert, normalizedText, compactText) {
  return nameVariants(cert).some(
    (v) => normalizedText.includes(` ${v} `) || compactText.includes(v.replace(/ /g, ''))
  );
}

function writeCsv(csvPath, rows, fields) {
  fs.writeFileSync(csvPath, Papa.unparse(rows, { columns: fields, newline: '\n' }) + '\n', 'utf8');
}

async function main() {
  const dryRun = Boolean(process.env.DRY_RUN && process.env.DRY_RUN !== '0' && process.env.DRY_RUN !== 'false');
  const now = today();

  const journals = loadCsv(JOURNALS_CSV_PATH).data;
  const certsParsed = loadCsv(CERTS_CSV_PATH);
  const certs = certsParsed.data;
  const rosterParsed = loadCsv(ROSTER_CSV_PATH);
  let rosterRows = rosterParsed.data;

  const sources = new Map();
  for (const j of journals) {
    if (EXTRA_SOURCES[j.journal]) {
      sources.set(j.journal, EXTRA_SOURCES[j.journal]);
    } else if ((j.website_url || '').trim()) {
      sources.set(j.journal, journalSource(j.website_url.trim()));
    }
  }

  const holdersByJournal = new Map();
  for (const c of certs.filter((c) => isActiveAppointment(c, now))) {
    if (!holdersByJournal.has(c.journal)) holdersByJournal.set(c.journal, []);
    holdersByJournal.get(c.journal).push(c);
  }
  // Auto-revoked certificates still inside their grace period: if the name is
  // back on the page (a page edit that briefly dropped someone), restore them.
  const autoRevoked = certs.filter((c) => c.status === 'revoked' && c.revoked_reason === 'roster');

  const summary = {
    checked_on: now,
    dry_run: dryRun,
    revoked: [],
    restored: [],
    held_back: [],
    issued: [],
    replaced: [],
    renewed: [],
    not_issued: [],
    roster_not_updated: [],
    unreachable: [],
    no_source: [],
    checked_sources: [],
  };
  const liveRoster = new Map(); // journal -> parsed rows, only where trusted

  const journalNames = new Set([...sources.keys(), ...holdersByJournal.keys()]);
  for (const journal of [...journalNames].sort((a, b) => a.localeCompare(b))) {
    const holders = holdersByJournal.get(journal) || [];
    const source = sources.get(journal);
    if (!source) {
      summary.no_source.push({ journal, holders: holders.length });
      console.log(`- ${journal}: no website_url in journals.csv, skipped (${holders.length} holder(s))`);
      continue;
    }

    let loaded;
    try {
      loaded = await loadSource(source);
    } catch (err) {
      summary.unreachable.push({ journal, holders: holders.length, error: err.message });
      console.log(`- ${journal}: could not read roster, skipped -- ${err.message}`);
      continue;
    }

    if (process.env.DEBUG_DUMP) {
      console.log(`  [debug] ${journal}: pages read: ${loaded.urls.join(', ')}`);
      console.log(`  [debug] text: ${loaded.text.replace(/\s+/g, ' ').trim().slice(0, 2500)}`);
      console.log(`  [debug] parsed: ${loaded.people.map((p) => `${p.name} [${p.role || '?'}]`).join('; ')}`);
      for (const l of loaded.links || []) console.log(`  [debug] link: ${l}`);
    }

    const normalizedText = normalize(loaded.text);
    const compactText = normalizedText.replace(/ /g, '');
    const missing = holders.filter((c) => !isListed(c, normalizedText, compactText));
    const sourceUrls = loaded.urls.join(' ');
    summary.checked_sources.push({
      journal,
      url: sourceUrls,
      pages: loaded.urls.length,
      holders: holders.length,
      missing: missing.length,
      parsed: loaded.people.length,
    });

    const toRow = (c) => ({
      certificate_id: c.certificate_id,
      display_name: c.display_name,
      role: c.role,
      journal: c.journal,
      source: sourceUrls,
    });

    // Restores first: a name that's back is back regardless of the guard below.
    for (const c of autoRevoked.filter((c) => c.journal === journal)) {
      if (!isListed(c, normalizedText, compactText) || (c.valid_until && c.valid_until < now)) continue;
      console.log(`    listed again, restoring: ${c.display_name} — ${c.role} (${c.certificate_id})`);
      summary.restored.push({ ...toRow(c), revoked_at: c.revoked_at });
      if (!dryRun) {
        c.status = 'active';
        c.revoked_at = '';
        c.revoked_reason = '';
      }
    }

    const massDisappearance =
      missing.length >= MIN_MISSING_FOR_RATIO_GUARD && missing.length / holders.length > MAX_MISSING_RATIO;
    if (massDisappearance) {
      summary.held_back.push(...missing.map(toRow));
      console.log(
        `- ${journal}: ${missing.length}/${holders.length} holder(s) not found -- too many at once, NOT revoking (check the page)`
      );
    } else {
      console.log(`- ${journal}: ${holders.length - missing.length}/${holders.length} holder(s) still listed, ${loaded.people.length} parsed`);
      for (const c of missing) {
        console.log(`    not listed: ${c.display_name} — ${c.role} (${c.certificate_id})`);
        summary.revoked.push(toRow(c));
        if (!dryRun) {
          c.status = 'revoked';
          c.revoked_at = now;
          c.revoked_reason = 'roster';
        }
      }
    }

    // Trust the parsed roster only if it found (nearly) everyone the plain
    // name check found; otherwise keep the journal's old roster rows.
    const listed = holders.filter((c) => !missing.includes(c));
    const parsedKeys = new Set(loaded.people.map((p) => normalize(p.name)));
    const covered = listed.filter((c) => parsedKeys.has(normalize(c.name)) || parsedKeys.has(normalize(c.display_name)));
    const coverage = listed.length ? covered.length / listed.length : loaded.people.length ? 1 : 0;
    if (!massDisappearance && coverage >= MIN_PARSE_COVERAGE) {
      liveRoster.set(
        journal,
        loaded.people.map((p) => ({ journal, role: p.role, name: p.name, displayName: p.displayName, affiliation: p.affiliation }))
      );
    } else {
      summary.roster_not_updated.push({
        journal,
        reason: massDisappearance
          ? 'held back (see above)'
          : !loaded.people.length && !listed.length
            ? 'no names on the board page yet'
            : `parser found ${covered.length}/${listed.length} listed holders`,
      });
      console.log(`    roster rows kept as-is (parser coverage ${covered.length}/${listed.length})`);
    }
  }

  // editorial-boards.csv: replace the rows of every journal read reliably
  // this run; everything else keeps its previous rows. Order: journals.csv
  // order, then the page's own order within a journal.
  const journalOrder = journals.map((j) => j.journal);
  const kept = rosterRows.filter((r) => !liveRoster.has(r.journal));
  const merged = [...kept, ...[...liveRoster.values()].flat()];
  const orderOf = (j) => {
    const i = journalOrder.indexOf(j);
    return i < 0 ? journalOrder.length : i;
  };
  merged.sort((a, b) => orderOf(a.journal) - orderOf(b.journal));
  const rosterChanged =
    Papa.unparse(merged, { columns: rosterParsed.meta.fields }) !== Papa.unparse(rosterRows, { columns: rosterParsed.meta.fields });
  rosterRows = merged;

  // Issuing: everyone on a reliably-read roster should hold an active
  // certificate for each role they're listed under.
  const journalType = new Map(journals.map((j) => [j.journal, (j.type || '').trim()]));
  const newCerts = [];
  const issue = (row, validFrom) => {
    const cert = {};
    for (const f of certsParsed.meta.fields) cert[f] = '';
    Object.assign(cert, {
      name: row.name,
      display_name: row.displayName || row.name,
      journal: row.journal,
      role: row.role,
      issue_date: now,
      valid_from: validFrom,
      valid_until: termEnd(validFrom, journalType.get(row.journal), row.role),
      status: 'active',
      cert_type: 'appointment',
    });
    certs.push(cert);
    newCerts.push(cert);
    return cert;
  };
  // A certificate staff revoked by hand (any reason but roster/reassigned)
  // blocks re-issuing that same role while the revoked row is still in the
  // registry (its 30-day grace period) -- otherwise a manual revocation of
  // someone still listed on the site would be undone the next week.
  const manuallyRevoked = (row) =>
    certs.some(
      (c) =>
        c.status === 'revoked' &&
        !['roster', 'reassigned'].includes(c.revoked_reason) &&
        personKey(c.journal, c.name) === personKey(row.journal, row.name) &&
        sameRole(row.role, c.role)
    );

  const liveRows = [...liveRoster.values()].flat();
  const activeNow = certs.filter((c) => isActiveAppointment(c, now) && liveRoster.has(c.journal));
  const { missing: noCert, roleMismatches } = compareRoster(liveRows, activeNow);
  const pending = []; // [row, kind, extra]

  // Role changed on the site: retire the old certificate, issue the new role.
  for (const { roster: row, cert } of roleMismatches) {
    if (manuallyRevoked(row)) {
      summary.not_issued.push({ name: row.name, role: row.role, journal: row.journal, reason: 'a certificate for this role was revoked by hand' });
      continue;
    }
    console.log(`    role changed: ${cert.display_name} ${cert.role} -> ${row.role} (${cert.certificate_id})`);
    cert.status = 'revoked';
    cert.revoked_at = now;
    cert.revoked_reason = 'reassigned';
    pending.push([row, 'replaced', { old_certificate_id: cert.certificate_id, old_role: cert.role }]);
  }

  // Listed without any certificate for that role: issue one.
  for (const row of noCert) {
    if (!row.role) {
      summary.not_issued.push({ name: row.name, role: '', journal: row.journal, reason: 'role not stated on the page' });
      continue;
    }
    if (manuallyRevoked(row)) {
      summary.not_issued.push({ name: row.name, role: row.role, journal: row.journal, reason: 'a certificate for this role was revoked by hand' });
      continue;
    }
    pending.push([row, 'issued', {}]);
  }

  // Expiring soon and still listed in the same role: renew seamlessly, the new
  // term starting the day after the old one ends.
  for (const c of activeNow) {
    if (!c.valid_until || c.valid_until > addDays(now, RENEW_WINDOW_DAYS)) continue;
    const row = liveRows.find((r) => personKey(r.journal, r.name) === personKey(c.journal, c.name) && r.role && sameRole(r.role, c.role));
    if (!row) continue;
    const newer = certs.some(
      (o) => o !== c && o.status === 'active' && personKey(o.journal, o.name) === personKey(c.journal, c.name) &&
        sameRole(o.role, c.role) && o.valid_until > c.valid_until
    );
    if (newer) continue;
    pending.push([{ ...row, role: c.role }, 'renewed', { old_certificate_id: c.certificate_id, validFrom: addDays(c.valid_until, 1) }]);
  }

  for (const [row, kind, extra] of pending) {
    const cert = issue(row, extra.validFrom || now);
    extra.cert = cert;
  }
  fillIds(certs);
  for (const [row, kind, extra] of pending) {
    const c = extra.cert;
    const out = { certificate_id: c.certificate_id, display_name: c.display_name, role: c.role, journal: c.journal, term: `${c.valid_from} to ${c.valid_until}` };
    if (kind === 'issued') summary.issued.push({ ...out, affiliation: row.affiliation });
    if (kind === 'replaced') summary.replaced.push({ ...out, old_certificate_id: extra.old_certificate_id, old_role: extra.old_role });
    if (kind === 'renewed') summary.renewed.push({ ...out, old_certificate_id: extra.old_certificate_id });
    console.log(`    ${kind}: ${c.display_name} — ${c.role} — ${c.journal} (${c.certificate_id}, ${out.term})`);
  }

  const certsChanged = summary.revoked.length + summary.restored.length + newCerts.length + summary.replaced.length > 0;
  if (!dryRun && certsChanged) writeCsv(CERTS_CSV_PATH, certs, certsParsed.meta.fields);
  if (!dryRun && rosterChanged) writeCsv(ROSTER_CSV_PATH, rosterRows, rosterParsed.meta.fields);

  summary.roster_file_updated = rosterChanged;
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2) + '\n', 'utf8');

  console.log(
    `\n${dryRun ? '[dry run] ' : ''}Revoked ${summary.revoked.length}, restored ${summary.restored.length}, ` +
      `issued ${summary.issued.length}, replaced ${summary.replaced.length}, renewed ${summary.renewed.length}. ` +
      `${summary.held_back.length} held back, ${summary.not_issued.length} not issued, ${summary.unreachable.length} source(s) unreachable. ` +
      `editorial-boards.csv ${rosterChanged ? 'updated' : 'unchanged'}.`
  );

  if (process.env.GITHUB_OUTPUT) {
    const changed = !dryRun && (certsChanged || rosterChanged);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `revoked_count=${dryRun ? 0 : summary.revoked.length}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `restored_count=${dryRun ? 0 : summary.restored.length}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `issued_count=${dryRun ? 0 : newCerts.length}\n`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\nFailed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { normalize, htmlToText, sameSiteLinks, journalSource, rosterLinks, isListed, loadSource, fetchHtml };
