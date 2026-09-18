// bench/run-detector-bench.mjs - Runs Lane A detectors across the labeled corpus
// Hard rule: no em-dash or en-dash in this file or output.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJudge, runGateBaseline, runImpeccable } from './lib/adapters.mjs';
import { precision, recall, f1, escapeRate, round } from './lib/metrics.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const corpusLines = readFileSync(resolve(REPO_ROOT, 'bench/corpus/labeled.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map(line => JSON.parse(line));

console.log(`\n======================================================`);
console.log(`DESIGNCOURT LANE A DETECTOR BENCHMARK`);
console.log(`Corpus size: ${corpusLines.length} files`);
console.log(`======================================================\n`);

const ADAPTERS = [
  { name: 'gate_baseline (designkit)', runner: runGateBaseline, coverage: '7 tells' },
  { name: 'impeccable (61 rules)', runner: runImpeccable, coverage: '5 tell mappings' },
  { name: 'designcourt judge', runner: runJudge, coverage: '38 tells' }
];

const results = {};

for (const { name, runner, coverage } of ADAPTERS) {
  process.stdout.write(`Running ${name} (${coverage})... `);
  const start = Date.now();
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const detections = [];
  const escapeCandidates = [];

  for (const row of corpusLines) {
    let res;
    try {
      res = await runner(row.html);
    } catch (err) {
      res = { adapter: name, file: row.html, verdict: 'error', detected_tells: [] };
    }
    detections.push(res);

    const goldSet = new Set(row.labels);
    const predSet = new Set(res.detected_tells);

    for (const tell of goldSet) {
      if (predSet.has(tell)) tp += 1;
      else fn += 1;
    }
    for (const tell of predSet) {
      if (!goldSet.has(tell)) fp += 1;
    }

    // Escape rate: if row has blocker label, did the tool pass it?
    if (row.label_severity === 'blocker') {
      const escaped = res.verdict === 'clean' || res.verdict === 'pass_with_notes';
      escapeCandidates.push({ file: row.html, escaped, source: row.source });
    }
  }

  const p = precision(tp, fp);
  const r = recall(tp, fn);
  const scoreF1 = f1(p, r);
  const escCount = escapeCandidates.filter(c => c.escaped).length;
  const escRate = escapeCandidates.length > 0 ? escCount / escapeCandidates.length : 0;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  results[name] = {
    adapter: name,
    coverage,
    tp,
    fp,
    fn,
    precision: round(p, 3),
    recall: round(r, 3),
    f1: round(scoreF1, 3),
    blocker_count: escapeCandidates.length,
    escaped_blockers: escCount,
    escape_rate: round(escRate, 3),
    elapsed_seconds: Number(elapsed)
  };

  console.log(`done in ${elapsed}s (F1: ${round(scoreF1, 3)}, Escape: ${(escRate * 100).toFixed(1)}%)`);
}

console.log(`\n======================================================`);
console.log(`LANE A SUMMARY RESULTS`);
console.log(`======================================================`);
console.table(Object.values(results));

// Write JSON artifact
mkdirSync(resolve(REPO_ROOT, 'results'), { recursive: true });
writeFileSync(
  resolve(REPO_ROOT, 'results/lane-a-results.json'),
  JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
  'utf8'
);
console.log(`Results saved to results/lane-a-results.json\n`);
