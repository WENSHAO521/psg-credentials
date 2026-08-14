let cache = null;

export async function loadCertificates() {
  if (cache) return cache;
  const res = await fetch("/data/certificates.json");
  if (!res.ok) throw new Error("Failed to load certificate registry");
  cache = await res.json();
  return cache;
}

export async function searchByName(query) {
  const records = await loadCertificates();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return records.filter((r) => r.name.toLowerCase().includes(q));
}

export async function findById(certificateId) {
  const records = await loadCertificates();
  return records.find((r) => r.certificate_id === certificateId) || null;
}

export function certificateStatus(record) {
  if (!record) return "not_found";
  if (record.status === "revoked") return "revoked";
  const today = new Date().toISOString().slice(0, 10);
  if (today > record.valid_until) return "expired";
  return "active";
}
