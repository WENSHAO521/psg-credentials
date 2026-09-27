// Debug helper for the roster sync: fetches the given URLs and prints each
// page's main-content text (as the roster parser sees it: h = heading,
// b = bold, t = plain) and its same-site links. Read-only.
//
// Usage: node scripts/probe-site.js <url> [<url> ...]
// (Also runnable from the Actions tab: "Site probe" workflow.)
const { tokenize } = require('./lib/rosterParse');
const { sameSiteLinks, fetchHtml } = require('./sync-roster');

async function main() {
  for (const url of process.argv.slice(2)) {
    console.log(`\n===== ${url}`);
    let html;
    try {
      // Same request (User-Agent, pacing, retries) as the sync itself -- the
      // sites' bot protection answers bare requests with 403.
      html = await fetchHtml(url);
    } catch (err) {
      console.log(`  failed: ${err.message}`);
      continue;
    }
    for (const { kind, text } of tokenize(html)) console.log(`  ${kind} | ${text.slice(0, 200)}`);
    for (const link of sameSiteLinks(html, url)) {
      if (!/%7B|\$\{/.test(link)) console.log(`  link: ${link}`);
    }
    // Other *.panorama-sg.com hosts too (e.g. the group site's "Visit journal
    // website" links into journals.panorama-sg.com).
    const host = new URL(url).host;
    for (const m of html.matchAll(/href\s*=\s*["'](https?:\/\/[^"'#]*panorama-sg\.com[^"'#]*)/gi)) {
      if (new URL(m[1]).host !== host) console.log(`  xlink: ${m[1]}`);
    }
  }
}

main();
