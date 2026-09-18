// bench/run-all.mjs - Single entry point to regenerate all benchmark results
// Hard rule: no em-dash or en-dash in this file or output.

import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

console.log(`\n======================================================`);
console.log(`DESIGNCOURT: RUNNING ALL BENCHMARKS AND TESTS`);
console.log(`======================================================\n`);

console.log(`[1/4] Running acceptance test suite...`);
execFileSync('node', ['test/all.mjs'], { cwd: REPO_ROOT, stdio: 'inherit' });

console.log(`\n[2/4] Regenerating labeled corpus...`);
execFileSync('node', ['bench/build-corpus.mjs'], { cwd: REPO_ROOT, stdio: 'inherit' });

console.log(`\n[3/4] Running Lane A detector benchmark (judge vs impeccable vs gate_baseline)...`);
execFileSync('node', ['bench/run-detector-bench.mjs'], { cwd: REPO_ROOT, stdio: 'inherit' });

console.log(`\n[4/4] Running Lane B spec benchmark (@google/design.md)...`);
execFileSync('node', ['bench/run-lane-b-google.mjs'], { cwd: REPO_ROOT, stdio: 'inherit' });

console.log(`\n======================================================`);
console.log(`ALL BENCHMARKS COMPLETE. RESULTS RECORDED.`);
console.log(`======================================================\n`);
