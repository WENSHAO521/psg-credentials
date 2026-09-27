// Appointment terms for automatically issued certificates (sync-roster.js).
// Journals: 3 years. Panorama Research Institute, per its charter: Research
// Fellow 3 years, Visiting Scholar 6 months, every other role 1 year.
// A term ends the day before its anniversary (2026-08-15 -> 2029-08-14),
// matching add-certificate.js.
const INSTITUTE_TERM_MONTHS = {
  'Research Fellow': 36,
  'Visiting Scholar': 6,
};
const INSTITUTE_DEFAULT_MONTHS = 12;
const JOURNAL_TERM_MONTHS = 36;

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr, months) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp to the target month's length (Aug 31 + 6 months -> Feb 28/29).
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

function termMonths(journalType, role) {
  if (journalType === 'institute') return INSTITUTE_TERM_MONTHS[role] || INSTITUTE_DEFAULT_MONTHS;
  return JOURNAL_TERM_MONTHS;
}

function termEnd(validFrom, journalType, role) {
  return addDays(addMonths(validFrom, termMonths(journalType, role)), -1);
}

module.exports = { termEnd, termMonths, addDays, addMonths };
