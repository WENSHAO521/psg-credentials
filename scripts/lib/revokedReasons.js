// Allowed values for certificates.csv's revoked_reason column. Codes, not
// free text, because the verify page shows a public explanation for each (see
// REVOKED_REASON_TEXT in src/lib/data.js) -- keep the two lists in sync.
const REVOKED_REASONS = {
  roster: 'No longer listed on the live roster (set automatically by sync-roster)',
  resigned: 'Stepped down from the role',
  reassigned: 'Moved to a different role (a new certificate replaces this one)',
  error: 'Issued in error',
  withdrawn: 'Sponsored article withdrawn or retracted (publication sponsorship only)',
};

// Reasons that only make sense for one certificate type: a withdrawn article
// says nothing true about an appointment or an award.
const REASON_CERT_TYPES = {
  withdrawn: 'publication_sponsorship',
};

function reasonAllowedFor(reason, certType) {
  const only = REASON_CERT_TYPES[reason];
  return !only || only === (certType || 'appointment');
}

module.exports = { REVOKED_REASONS, reasonAllowedFor };
