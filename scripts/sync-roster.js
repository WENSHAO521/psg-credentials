// Monthly roster check against the live websites: for every journal in
// source/journals.csv (its editorial board / team pages, found by following
// the journal homepage's links) and for the Panorama Research Institute
// (research.panorama-sg.com, its People pages), fetches the public member
// pages and checks that each active appointment certificate holder is still
// listed there. Anyone no longer listed has their certificate revoked
// automatically (status=revoked, revoked_at=today), which starts the usual
// 30-day grace period in scripts/prune-expired.js -- during that window the
// certificate still verifies as "Revoked", and staff can undo a mistake by
// setting it back to active.
//
// Deliberately conservative, because a wrong revocation is worse than a late
// one:
//   - only appointment certificates are checked (paper awards / conference
//     invitations aren't tied to board membership)
//   - matching is "does this person's name appear anywhere on the page", not
//     a parse of the page layout, so a theme change doesn't look like the
//     whole board left
//   - a source where no roster page can be found or read is
//     skipped (never treated as "everyone left")
//   - if more than MAX_MISSING_RATIO of a source's holders vanish at once,
//     nothing is revoked for that source -- it's reported for a human to look
//     at instead (more likely a broken/moved page than a mass resignation)
//
// Usage:
//   npm run sync-roster              # check and revoke
//   DRY_RUN=1 npm run sync-roster    # check and report only, write nothing
//
// Run by .github/workflows/roster-sync.yml on a monthly schedule. Writes the
// updated CSV in place and a roster-sync-summary.json for the workflow to turn
// into an Issue.
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const CERTS_CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');
const JOURNALS_CSV_PATH = path.join(__dirname, '..', 'source', 'journals.csv');
const SUMMARY_PATH = path.join(__dirname, '..', 'roster-sync-summary.json');

// Every source is read the same way: fetch its start page(s), follow the
// same-site links whose URL looks like a roster page, and check names against
// the combined text of those roster pages. The sites use custom themes, so the
// board lives at a different path per journal (/csgs/Editorial-Board,
// /jlpcs/EditorialBoard, /tts/junior-editorial-board, /afs/editorialTeam, ...);
// following the journal's own navigation finds it wherever it is.
const JOURNAL_ROSTER_LINK = /editorial[-_]?(team|board)|junior[-_]?editorial|masthead/i;
const INSTITUTE_ROSTER_LINK = /people|fellow|leadership|director|assistant|intern|visiting|scholar|advisory|contributor|member|staff|team/i;
const EXTRA_SOURCES = {
  'Panorama Research Institute': {
    start: ['https://research.panorama-sg.com/'],
    also: [],
    follow: INSTITUTE_ROSTER_LINK,
  },
};

const MAX_MISSING_RATIO = 0.5;
const MIN_MISSING_FOR_RATIO_GUARD = 3;
const MIN_PAGE_TEXT_LENGTH = 200;
const MAX_CRAWL_PAGES = 25;
const FETCH_TIMEOUT_MS = 30000;
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

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
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

// Returns { text, urls, links } for a source, or throws if no roster page could
// be read -- the start page alone (mostly navigation) never counts as a roster.
async function loadSourceText({ start, also, follow }) {
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
  for (const url of [...candidates].slice(0, MAX_CRAWL_PAGES)) {
    try {
      const text = htmlToText(await fetchHtml(url));
      if (text.replace(/\s+/g, ' ').trim().length < MIN_PAGE_TEXT_LENGTH) {
        errors.push(`${url}: page is nearly empty`);
        continue;
      }
      texts.push(text);
      okUrls.push(url);
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  if (!okUrls.length) {
    throw new Error(`no roster page found${errors.length ? ` (${errors.join('; ')})` : ''}`);
  }
  return { text: texts.join('\n'), urls: okUrls, links: [...new Set(allLinks)] };
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

async function main() {
  const dryRun = Boolean(process.env.DRY_RUN && process.env.DRY_RUN !== '0' && process.env.DRY_RUN !== 'false');
  const now = today();

  const journals = loadCsv(JOURNALS_CSV_PATH).data;
  const certsParsed = loadCsv(CERTS_CSV_PATH);
  const certs = certsParsed.data;

  const sources = new Map();
  for (const j of journals) {
    if (EXTRA_SOURCES[j.journal]) {
      sources.set(j.journal, EXTRA_SOURCES[j.journal]);
    } else if ((j.website_url || '').trim()) {
      sources.set(j.journal, journalSource(j.website_url.trim()));
    }
  }

  const active = certs.filter(
    (c) => c.status === 'active' && (!c.cert_type || c.cert_type === 'appointment') && (!c.valid_until || c.valid_until >= now)
  );
  const byJournal = new Map();
  for (const c of active) {
    if (!byJournal.has(c.journal)) byJournal.set(c.journal, []);
    byJournal.get(c.journal).push(c);
  }

  const summary = {
    checked_on: now,
    dry_run: dryRun,
    revoked: [],
    held_back: [],
    unreachable: [],
    no_source: [],
    checked_sources: [],
  };

  for (const [journal, holders] of [...byJournal.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const source = sources.get(journal);
    if (!source) {
      summary.no_source.push({ journal, holders: holders.length });
      console.log(`- ${journal}: no website_url in journals.csv, skipped (${holders.length} holder(s))`);
      continue;
    }

    let loaded;
    try {
      loaded = await loadSourceText(source);
    } catch (err) {
      summary.unreachable.push({ journal, holders: holders.length, error: err.message });
      console.log(`- ${journal}: could not read roster, skipped -- ${err.message}`);
      continue;
    }

    if (process.env.DEBUG_DUMP) {
      console.log(`  [debug] ${journal}: pages read: ${loaded.urls.join(', ')}`);
      console.log(`  [debug] text: ${loaded.text.replace(/\s+/g, ' ').trim().slice(0, 2500)}`);
      for (const l of loaded.links || []) console.log(`  [debug] link: ${l}`);
    }

    const normalizedText = normalize(loaded.text);
    const compactText = normalizedText.replace(/ /g, '');
    const missing = holders.filter((c) => !isListed(c, normalizedText, compactText));
    summary.checked_sources.push({ journal, url: loaded.urls.join(' '), pages: loaded.urls.length, holders: holders.length, missing: missing.length });

    const toRow = (c) => ({
      certificate_id: c.certificate_id,
      display_name: c.display_name,
      role: c.role,
      journal: c.journal,
      source: loaded.urls.join(' '),
    });

    if (
      missing.length >= MIN_MISSING_FOR_RATIO_GUARD &&
      missing.length / holders.length > MAX_MISSING_RATIO
    ) {
      summary.held_back.push(...missing.map(toRow));
      console.log(
        `- ${journal}: ${missing.length}/${holders.length} holder(s) not found -- too many at once, NOT revoking (check the page)`
      );
      continue;
    }

    console.log(`- ${journal}: ${holders.length - missing.length}/${holders.length} holder(s) still listed`);
    for (const c of missing) {
      console.log(`    not listed: ${c.display_name} — ${c.role} (${c.certificate_id})`);
      summary.revoked.push(toRow(c));
      if (!dryRun) {
        c.status = 'revoked';
        c.revoked_at = now;
      }
    }
  }

  if (!dryRun && summary.revoked.length) {
    const out = Papa.unparse(certs, { columns: certsParsed.meta.fields, newline: '\n' });
    fs.writeFileSync(CERTS_CSV_PATH, out + '\n', 'utf8');
  }

  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2) + '\n', 'utf8');

  console.log(
    `\n${dryRun ? '[dry run] Would revoke' : 'Revoked'} ${summary.revoked.length} certificate(s). ` +
      `${summary.held_back.length} held back for review, ${summary.unreachable.length} source(s) unreachable.`
  );

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `revoked_count=${dryRun ? 0 : summary.revoked.length}\n`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\nFailed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { normalize, htmlToText, sameSiteLinks, journalSource, rosterLinks, isListed };
