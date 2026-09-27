// Debug helper for the roster sync: fetches the given URLs and prints each
// page's main-content text (as the roster parser sees it: h = heading,
// b = bold, t = plain) and its same-site links. Read-only.
//
// Usage: node scripts/probe-site.js <url> [<url> ...]
// (Also runnable from the Actions tab: "Site probe" workflow.)
const { tokenize } = require('./lib/rosterParse');
const { sameSiteLinks } = require('./sync-roster');

async function main() {
  for (const url of process.argv.slice(2)) {
    console.log(`\n===== ${url}`);
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    } catch (err) {
      console.log(`  fetch failed: ${err.message}`);
      continue;
    }
    console.log(`  HTTP ${res.status} ${res.url !== url ? `(redirected to ${res.url})` : ''}`);
    if (!res.ok) continue;
    const html = await res.text();
    for (const { kind, text } of tokenize(html)) console.log(`  ${kind} | ${text.slice(0, 200)}`);
    for (const link of sameSiteLinks(html, res.url)) {
      if (!/%7B|\$\{/.test(link)) console.log(`  link: ${link}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main();
