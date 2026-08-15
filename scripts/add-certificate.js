// Interactive helper for adding a new certificate to source/certificates.csv
// without hand-editing the file. Validates the journal and role against the
// existing lookup tables, appends the row, then runs assign-ids + validate.
//
// Usage: npm run add-certificate
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const Papa = require('papaparse');
const { ROLE_CODES } = require('./lib/roleCodes');

const CSV_PATH = path.join(__dirname, '..', 'source', 'certificates.csv');
const JOURNALS_CSV_PATH = path.join(__dirname, '..', 'source', 'journals.csv');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addYears(dateStr, years) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  d.setUTCDate(d.getUTCDate() - 1); // term ends the day before the anniversary
  return d.toISOString().slice(0, 10);
}

function loadJournals() {
  const raw = fs.readFileSync(JOURNALS_CSV_PATH, 'utf8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  return parsed.data;
}

// readline's own .question() hangs on the second call when stdin isn't a
// real TTY (piped/redirected input) in some environments. Pulling lines
// straight from the async iterator instead works for both TTY and non-TTY
// input, so that's what every prompt in this script goes through.
function createLineReader() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const iterator = rl[Symbol.asyncIterator]();
  return {
    async readLine(promptText) {
      process.stdout.write(promptText);
      const { value, done } = await iterator.next();
      return done ? '' : value;
    },
    close() {
      rl.close();
    },
  };
}

async function ask(lineReader, question, { required = true, defaultValue } = {}) {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  while (true) {
    const answer = (await lineReader.readLine(`${question}${suffix}: `)).trim();
    if (answer) return answer;
    if (defaultValue !== undefined) return defaultValue;
    if (!required) return '';
    console.log('  This field is required.');
  }
}

async function main() {
  const rl = createLineReader();
  const journals = loadJournals();
  const journalNames = journals.map((r) => r.journal.trim());

  console.log('=== Add a new certificate ===');
  console.log('(Ctrl+C to cancel any time; nothing is written until the end.)\n');

  try {
    const displayName = await ask(rl, 'Display name (as it should print on the certificate, e.g. "Dr. Jane Doe")');
    const defaultName = displayName.replace(/^(Dr\.|Prof\.|Ven\.)\s+/, '').replace(/,?\s*PhD$/i, '').trim();
    const name = await ask(rl, 'Plain name (used for exact-match search)', { defaultValue: defaultName });

    let journal;
    while (true) {
      journal = await ask(rl, 'Journal (must match source/journals.csv exactly)');
      if (journalNames.includes(journal)) break;
      console.log(`  "${journal}" is not in source/journals.csv. Known journals:`);
      journalNames.forEach((j) => console.log(`    - ${j}`));
      console.log('  Add it to journals.csv first, or pick one of the names above.\n');
    }

    let role;
    while (true) {
      role = await ask(rl, `Role (${Object.keys(ROLE_CODES).join(' / ')})`);
      if (ROLE_CODES[role]) break;
      console.log(`  "${role}" is not a known role. Valid roles:\n    - ${Object.keys(ROLE_CODES).join('\n    - ')}\n`);
    }

    const journalType = (journals.find((r) => r.journal.trim() === journal) || {}).type;
    if (journalType === 'institute') {
      console.log(
        '\n  Note: Panorama Research Institute appointment terms are role-specific, not a\n' +
        '  blanket 3 years like journal certificates -- per the Institute charter\n' +
        '  (research.panorama-sg.com/charter/): Research Fellow 1-3 years renewable,\n' +
        '  Associate Research Fellow ~1 year renewable, Visiting Scholar 3-12 months,\n' +
        '  Research Assistant project-specific (no fixed default). Check the real term\n' +
        '  for this appointment before answering below -- do not accept a guessed default.\n'
      );
    }

    const issueDate = await ask(rl, 'Issue date (YYYY-MM-DD)', { defaultValue: today() });
    const termYearsRaw = await ask(rl, 'Term length in years', {
      defaultValue: journalType === 'institute' ? undefined : '3',
    });
    const termYears = parseInt(termYearsRaw, 10);
    if (!Number.isInteger(termYears) || termYears <= 0) {
      throw new Error(`Invalid term length "${termYearsRaw}"`);
    }
    const validFrom = await ask(rl, 'Valid from (YYYY-MM-DD)', { defaultValue: issueDate });
    const validUntil = await ask(rl, 'Valid until (YYYY-MM-DD)', { defaultValue: addYears(validFrom, termYears) });

    console.log('\n--- Review ---');
    console.log(`  Display name : ${displayName}`);
    console.log(`  Search name  : ${name}`);
    console.log(`  Journal      : ${journal}`);
    console.log(`  Role         : ${role}`);
    console.log(`  Issue date   : ${issueDate}`);
    console.log(`  Term         : ${validFrom} to ${validUntil}`);
    const confirm = await ask(rl, '\nAdd this certificate? (y/n)', { defaultValue: 'y' });
    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled, nothing written.');
      return;
    }

    const raw = fs.readFileSync(CSV_PATH, 'utf8');
    const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
    parsed.data.push({
      name,
      display_name: displayName,
      certificate_id: '',
      journal,
      role,
      issue_date: issueDate,
      valid_from: validFrom,
      valid_until: validUntil,
      token: '',
      status: 'active',
      revoked_at: '',
    });
    const fields = parsed.meta.fields;
    fs.writeFileSync(CSV_PATH, Papa.unparse(parsed.data, { columns: fields, newline: '\n' }) + '\n', 'utf8');

    execFileSync('node', [path.join(__dirname, 'assign-ids.js')], { stdio: 'inherit' });
    execFileSync('node', [path.join(__dirname, 'validate-data.js')], { stdio: 'inherit' });

    const after = Papa.parse(fs.readFileSync(CSV_PATH, 'utf8'), { header: true, skipEmptyLines: true }).data;
    const created = after.find((r) => r.name === name && r.journal === journal && r.role === role && r.issue_date === issueDate);
    console.log(`\nDone. Certificate ID: ${created ? created.certificate_id : '(check certificates.csv)'}`);
    console.log('Review the diff, then commit and push source/certificates.csv when ready.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
