const ROLE_CODES = {
  'Editor-in-Chief': 'EIC',
  'Editorial Board Member': 'EB',
  'Youth Editorial Board Member': 'YEB',
  'Associate Editor': 'AE',
  'Guest Editor': 'GE',
  'Reviewer': 'REV',
};

function roleCodeFor(role) {
  const code = ROLE_CODES[role];
  if (!code) {
    throw new Error(`Unknown role "${role}". Add it to scripts/lib/roleCodes.js.`);
  }
  return code;
}

module.exports = { ROLE_CODES, roleCodeFor };
