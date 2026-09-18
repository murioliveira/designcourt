// bench/run-lane-b-google.mjs - Runs Lane B (spec validation) using @google/design.md
// Hard rule: no em-dash or en-dash in this file or output.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

console.log(`\n======================================================`);
console.log(`DESIGNCOURT LANE B: SPEC VALIDATION (@google/design.md)`);
console.log(`Comparing Google spec linter against DESIGN.md specs`);
console.log(`======================================================\n`);

const FIXTURES = [
  {
    name: 'designkit DESIGN.md (founder spec)',
    path: resolve(REPO_ROOT, '../designkit/DESIGN.md')
  }
];

const results = [];

for (const fix of FIXTURES) {
  process.stdout.write(`Running designmd lint on ${fix.name}... `);
  const start = Date.now();
  try {
    const out = execFileSync('npx', ['@google/design.md', 'lint', fix.path], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: 'C:/Users/muzph/AppData/Local/Temp/dkbench'
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`PASS (${elapsed}s)`);
    results.push({ fixture: fix.name, status: 'pass', output: out.trim(), elapsed });
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const out = (err.stdout || '') + (err.stderr || '');
    console.log(`FINDINGS (${elapsed}s)`);
    results.push({ fixture: fix.name, status: 'findings', output: out.trim(), elapsed });
  }
}

mkdirSync(resolve(REPO_ROOT, 'results'), { recursive: true });
writeFileSync(
  resolve(REPO_ROOT, 'results/lane-b-results.json'),
  JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
  'utf8'
);
console.log(`Results saved to results/lane-b-results.json\n`);
