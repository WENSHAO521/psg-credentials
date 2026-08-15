const ROLE_CODES = {
  'Editor-in-Chief': 'EIC',
  'Co-Editor-in-Chief': 'CEIC',
  'Deputy Editor-in-Chief': 'DEIC',
  'Associate Editor': 'AE',
  'Assistant Editor': 'ASE',
  'Section Editor': 'SE',
  'Editorial Board Member': 'EB',
  'Editorial Board Member (Chair)': 'EBC',
  'Chair of the Editorial Board': 'EBC',
  'Youth Editorial Board Member': 'YEB',
  'Early Career Editorial Board': 'ECB',
  'Guest Editor': 'GE',
  'International Advisory Board': 'IAB',
  'Academic Advisory Board': 'AAB',
  'Reviewer': 'REV',
  // Panorama Research Institute
  'Research Fellow': 'RF',
  'Associate Research Fellow': 'ARF',
  'Visiting Scholar': 'VS',
  'Research Assistant': 'RA',
  'Institute Advisory Board': 'IABI',
  'Project Contributor': 'PC',
};

function roleCodeFor(role) {
  const code = ROLE_CODES[role];
  if (!code) {
    throw new Error(`Unknown role "${role}". Add it to scripts/lib/roleCodes.js.`);
  }
  return code;
}

module.exports = { ROLE_CODES, roleCodeFor };
