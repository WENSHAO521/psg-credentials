// Allowed values for certificates.csv's revoked_reason column. Codes, not
// free text, because the verify page shows a public explanation for each (see
// REVOKED_REASON_TEXT in src/lib/data.js) -- keep the two lists in sync.
const REVOKED_REASONS = {
  roster: 'No longer listed on the live roster (set automatically by sync-roster)',
  resigned: 'Stepped down from the role',
  reassigned: 'Moved to a different role (a new certificate replaces this one)',
  error: 'Issued in error',
};

module.exports = { REVOKED_REASONS };
