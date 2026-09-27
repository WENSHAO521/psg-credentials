// Best-effort extraction of { role, name, affiliation } rows from a roster
// page (journal editorial board / institute people page).
//
// The pages are hand-written HTML, different for every journal, so this
// doesn't rely on any particular markup. It walks the page's text in order and
// uses two signals every page shares:
//   - role labels ("Editor-in-Chief", "Associate Editors", "Editorial Board /
//     编辑委员会", ...) -- any text matching a known role sets the role for
//     the names that follow it
//   - names are set in bold or as headings, look like a person's name, and are
//     followed by their affiliation
// A label directly after a name ("Sebastian Lenz / Editor-in-Chief",
// "Ziying Lin (Chair of the Editorial Board)") applies to that person only.
//
// The output feeds reports and source/editorial-boards.csv, never
// revocations -- those use the plain "is the name on the page" check in
// sync-roster.js, which doesn't depend on any of this being right.
const { ROLE_CODES } = require('./roleCodes');

// Page labels that aren't spelled like a ROLE_CODES key.
const ROLE_ALIASES = {
  'editorial board': 'Editorial Board Member',
  'deputy editor': 'Deputy Editor-in-Chief',
  'early-career editorial board member': 'Early Career Editorial Board',
  'early career editorial board member': 'Early Career Editorial Board',
  'early-career editorial board': 'Early Career Editorial Board',
  'youth editorial board': 'Youth Editorial Board Member',
  'youth member': 'Youth Editorial Board Member',
  'junior editorial board': 'Youth Editorial Board Member',
  'junior editorial board member': 'Youth Editorial Board Member',
  'academic advisory': 'Academic Advisory Board',
  'advisory board': 'Institute Advisory Board',
  'advisory board member': 'Institute Advisory Board',
  'international advisory board member': 'International Advisory Board',
};

// Words that never appear in a person's name but often in bold/heading text
// next to one (section titles, affiliations, field labels).
const NOT_NAME_WORDS = new Set([
  'university', 'school', 'college', 'department', 'faculty', 'institute', 'academy',
  'research', 'areas', 'interests', 'focus', 'scope', 'responsibility', 'editorial',
  'board', 'editor', 'editors', 'journal', 'review', 'office', 'member', 'members',
  'team', 'center', 'centre', 'program', 'panorama', 'group', 'studies', 'society',
  'science', 'sciences', 'of', 'and', 'the', 'for', 'in', 'on', 'to', 'at', 'with',
  'about', 'details', 'title', 'fellow', 'fellows', 'governance', 'china', 'usa',
  'korea', 'germany', 'publications', 'latest', 'contact', 'email', 'profile',
  'advisory', 'leadership', 'eligibility', 'roles', 'chair', 'assistant', 'associate',
  'support', 'guidance', 'oversight', 'authors', 'participants', 'responsibilities',
  'what', 'receive', 'scholars', 'publication', 'information', 'policy', 'overview',
  'appointment', 'expertise', 'show', 'more', 'less', 'join', 'apply',
]);

const TITLE_PREFIX = /^(dr|prof|professor|mr|mrs|ms|assoc|ven|venerable|rev)\.?\s+/i;
// Only after a comma -- a bare " Ma" is a surname, not a degree.
const DEGREE_SUFFIX = /,\s*(m\.?a|m\.?s|m\.?sc|ph\.?d|m\.?d|mba|m\.?phil|ed\.?d)\.?$/i;

function singularize(s) {
  return s
    .replace(/\beditors-in-chief\b/g, 'editor-in-chief')
    .replace(/\b(editor|member|fellow|scholar|assistant|contributor|intern)s\b/g, '$1');
}

const ROLE_LOOKUP = new Map();
for (const role of Object.keys(ROLE_CODES)) ROLE_LOOKUP.set(singularize(role.toLowerCase()), role);
for (const [alias, role] of Object.entries(ROLE_ALIASES)) ROLE_LOOKUP.set(alias, role);

// "Editor-in-Chief / 主编" -> "Editor-in-Chief"; "(Chair of the Editorial
// Board)" -> Chair...; "Associate Editors" -> "Associate Editor". Returns the
// ROLE_CODES key, or null if the text isn't a role label.
function roleFromLabel(text) {
  let t = text.split(/\s[/｜|]\s?|｜/)[0];
  t = t.replace(/[()（）:：]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t || t.length > 60) return null;
  return ROLE_LOOKUP.get(singularize(t)) || null;
}

function cleanName(text) {
  let t = text.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) t = t.replace(TITLE_PREFIX, '');
  t = t.replace(DEGREE_SUFFIX, '').replace(/[,;:]+$/, '').trim();
  return t;
}

function looksLikeName(text) {
  const raw = text.replace(/\s+/g, ' ').trim();
  const t = cleanName(raw);
  if (t.length < 3 || t.length > 50) return false;
  const words = t.split(' ');
  // Single-word names only with an honorific ("Ven. Juesen") -- on its own a
  // single capitalised word is far more often a heading than a person.
  const minWords = TITLE_PREFIX.test(raw) ? 1 : 2;
  if (words.length < minWords || words.length > 5) return false;
  return words.every(
    (w) =>
      /^\p{Lu}[\p{L}'’.-]*$/u.test(w) &&
      (w.length >= 2 || /^\p{Lu}\.$/u.test(w)) &&
      !NOT_NAME_WORDS.has(w.toLowerCase())
  );
}

const AFFILIATION_HINT = /universit|college|school|institut|academy|hospital|department|faculty|center|centre|group|corporation|company|\bltd\b|\binc\b|government|ministry|bank|,/i;
const FIELD_LABEL = /^(research (areas|interests)|focus|scope|research areas \/|研究方向)/i;

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

const VOID_TAGS = new Set(['br', 'img', 'hr', 'meta', 'link', 'input', 'source', 'wbr']);
const BOLD_STYLE = /font-weight:\s*(bold|[6-9]00)/i;

// Flattens the page's main content into [{ kind: 'h'|'b'|'t', text }] in
// document order: 'h' inside a heading, 'b' inside bold, 't' otherwise.
function tokenize(html) {
  const mainAt = html.search(/<main[\s>]/i);
  let h = mainAt >= 0 ? html.slice(mainAt) : html;
  h = h.replace(/<(script|style|svg|nav|footer)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

  const tokens = [];
  const stack = [];
  for (const m of h.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g)) {
    if (m[4] !== undefined) {
      const text = decodeEntities(m[4]).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const kind = stack.some((s) => s.heading) ? 'h' : stack.some((s) => s.bold) ? 'b' : 't';
      tokens.push({ kind, text });
      continue;
    }
    const tag = m[2].toLowerCase();
    if (VOID_TAGS.has(tag) || m[3].trim().endsWith('/')) continue;
    if (m[1]) {
      const at = stack.map((s) => s.tag).lastIndexOf(tag);
      if (at >= 0) stack.length = at;
    } else {
      stack.push({
        tag,
        heading: /^h[1-6]$/.test(tag),
        bold: tag === 'strong' || tag === 'b' || BOLD_STYLE.test(m[3]),
      });
    }
  }
  return tokens;
}

// defaultRole: the role for names not under any recognised label -- used for
// the institute's one-role-per-page People pages ("/people/research-assistants").
function parseRoster(html, { defaultRole = '' } = {}) {
  const tokens = tokenize(html);
  const people = [];
  // sectionRole: set by a heading that names a role ("Editorial Board Members").
  // currentRole: what the next name gets by default.
  // oneShot: a different label inside a role section ("Chair of the Editorial
  // Board" above one name in the Editorial Board section) -- applies to the
  // next name only, then the section's role resumes.
  let sectionRole = defaultRole;
  let currentRole = defaultRole;
  let oneShot = '';

  for (let i = 0; i < tokens.length; i++) {
    const { kind, text } = tokens[i];

    const role = roleFromLabel(text);
    if (role) {
      // A label right after a name (and not right before another name) is
      // that person's own label, not a new section.
      const prev = people[people.length - 1];
      const next = tokens[i + 1];
      const nextIsName = next && next.kind !== 't' && looksLikeName(next.text) && !roleFromLabel(next.text);
      if (prev && prev.tokenIndex === i - 1 && !nextIsName) {
        prev.role = role;
      } else if (kind === 'h') {
        sectionRole = role;
        currentRole = role;
        oneShot = '';
      } else if (sectionRole && sectionRole !== role) {
        oneShot = role;
      } else {
        currentRole = role;
      }
      continue;
    }

    if (kind !== 't' && looksLikeName(text)) {
      let affiliation = '';
      let fallback = '';
      for (let j = i + 1; j < Math.min(tokens.length, i + 6); j++) {
        const t = tokens[j];
        if (roleFromLabel(t.text) || (t.kind !== 't' && looksLikeName(t.text))) break;
        if (FIELD_LABEL.test(t.text)) break;
        if (!fallback && t.kind === 't') fallback = t.text;
        if (AFFILIATION_HINT.test(t.text)) {
          affiliation = t.text;
          break;
        }
      }
      people.push({ role: oneShot || currentRole, name: cleanName(text), affiliation: affiliation || fallback, tokenIndex: i });
      oneShot = '';
      continue;
    }

    // A heading that's neither a role nor a name ("Editorial Team", "Senior
    // Editorial Team") starts a section whose role we don't know -- don't
    // carry the previous section's role into it.
    if (kind === 'h') {
      sectionRole = defaultRole;
      currentRole = defaultRole;
      oneShot = '';
    }
  }

  // One row per (name, role); drop the token bookkeeping.
  const seen = new Set();
  return people
    .filter((p) => {
      const key = `${p.name.toLowerCase()}::${p.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ role, name, affiliation }) => ({ role, name, affiliation }));
}

module.exports = { parseRoster, roleFromLabel, looksLikeName, cleanName, tokenize };
