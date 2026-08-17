let cache = null;
let journalsCache = null;

export async function loadCertificates() {
  if (cache) return cache;
  const res = await fetch("/data/certificates.json");
  if (!res.ok) throw new Error("Failed to load certificate registry");
  cache = await res.json();
  return cache;
}

export async function loadJournals() {
  if (journalsCache) return journalsCache;
  const res = await fetch("/data/journals.json");
  if (!res.ok) throw new Error("Failed to load journal directory");
  journalsCache = await res.json();
  return journalsCache;
}

// Exact match only (case-insensitive) on the `name` field, or on `detail`
// (the paper title, for paper_award records) -- not a substring search. A
// partial name like "Wang" would otherwise surface every certificate holder
// who happens to share that fragment, which leaks other people's records to
// anyone fishing with a common name piece. Author names collide a lot more
// than paper titles do, so letting the same exact-match search also key off
// the title gives a reliable way to find an award certificate without
// depending on which of several same-named authors it belongs to -- titles
// are high-entropy strings, so this doesn't reopen the fishing risk the
// name-only restriction exists to close.
//
// `scope`, if given, further restricts which records are eligible (e.g. only
// Panorama Research Institute credentials) -- applied after the exact-match
// filter, so it narrows results rather than loosening the match itself.
export async function searchByName(query, { scope } = {}) {
  const records = await loadCertificates();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = records.filter(
    (r) => r.name.trim().toLowerCase() === q || (r.detail && r.detail.trim().toLowerCase() === q)
  );
  return scope ? matches.filter(scope) : matches;
}

// Case-insensitive: certificate numbers are always printed/generated in
// uppercase, but typing one in by hand (especially on a phone keyboard,
// which likes to auto-lowercase) shouldn't require matching that exactly.
export async function findById(certificateId) {
  const records = await loadCertificates();
  const q = (certificateId || "").trim().toLowerCase();
  if (!q) return null;
  return records.find((r) => r.certificate_id.toLowerCase() === q) || null;
}

export function certificateStatus(record) {
  if (!record) return "not_found";
  if (record.status === "revoked") return "revoked";
  const today = new Date().toISOString().slice(0, 10);
  if (today > record.valid_until) return "expired";
  return "active";
}
