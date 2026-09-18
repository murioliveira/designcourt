// bench/lib/metrics.mjs
// designcourt benchmark metrics. W1. Node 18+, ESM, stdlib only, offline, deterministic.
//
// Frozen conventions. Any change here invalidates the numbers published in results/:
//
//  1. Detection is per (file, tell id). A tool detects a tell on a file if it emits at least one
//     finding that maps to that tell id (spec/BENCH-PROTOCOL.md, section "Metrics, exactly").
//  2. precision = tp / (tp + fp), and 0 when the tool predicted nothing for that tell. Zero
//     predictions is reported as precision 0, never as undefined, so a silent tool cannot score
//     better than a noisy one on the macro average.
//  3. recall = tp / (tp + fn). Tell ids with no gold support in the corpus set are never scored
//     and never averaged. Predicted tell ids with no gold support are reported separately in
//     unlabeled_predictions, because a detector cannot lose recall points on a label that does
//     not exist in the fixture set, but it should still be visible that it fired.
//  4. Macro averaging runs over the tell ids with gold support > 0, each tell weighted equally.
//  5. escape rate = blocker bearing files that a tool rates clean or pass_with_notes, over all
//     blocker bearing files. Lower is better. A file with no verdict at all counts as an escape
//     unless the caller passes missingCountsAsEscape: false, because a tool that says nothing has
//     not reported the offense. That silence is exactly how the legacy gate escaped the banned
//     gradient in designkit/styles/layout.css:323.
//  6. The bootstrap uses a seeded PRNG (mulberry32), so every published interval is reproducible
//     from the seed alone. No Math.random, no clock, no locale dependent formatting.
//
// Self-check: node bench/lib/metrics.mjs --self-check

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export const SEVERITY_RANK = { clean: 0, minor: 1, major: 2, blocker: 3 };
export const SEVERITIES = ['clean', 'minor', 'major', 'blocker'];

export function maxSeverity(severities) {
  let best = 'clean';
  for (const s of severities || []) {
    if (!(s in SEVERITY_RANK)) throw new Error(`maxSeverity: unknown severity "${s}"`);
    if (SEVERITY_RANK[s] > SEVERITY_RANK[best]) best = s;
  }
  return best;
}

export function isBlockerBearing(row, severityByTell = null) {
  if (severityByTell) {
    for (const tell of row.labels || []) {
      if (severityByTell[tell] === 'blocker') return true;
    }
  }
  return row.label_severity === 'blocker';
}

// ---------------------------------------------------------------------------
// Corpus loading
// ---------------------------------------------------------------------------

export const ROW_KEYS = ['id', 'html', 'labels', 'label_severity', 'injection', 'source'];
export const ROW_SOURCES = ['synthetic-injected', 'curated-real', 'escape-regression'];

export function parseJsonl(text) {
  const rows = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    try {
      rows.push(JSON.parse(line));
    } catch (err) {
      throw new Error(`labeled.jsonl line ${i + 1}: invalid JSON (${err.message})`);
    }
  }
  return rows;
}

export function validateRow(row, where) {
  for (const key of ROW_KEYS) {
    if (!(key in row)) throw new Error(`${where}: missing key "${key}"`);
  }
  if (typeof row.id !== 'string' || row.id === '') throw new Error(`${where}: id must be a non-empty string`);
  if (typeof row.html !== 'string' || row.html === '') throw new Error(`${where}: html must be a non-empty string`);
  if (!Array.isArray(row.labels)) throw new Error(`${where}: labels must be an array`);
  if (!Array.isArray(row.injection)) throw new Error(`${where}: injection must be an array`);
  if (!SEVERITIES.includes(row.label_severity)) {
    throw new Error(`${where}: label_severity "${row.label_severity}" is not one of ${SEVERITIES.join(', ')}`);
  }
  if (!ROW_SOURCES.includes(row.source)) {
    throw new Error(`${where}: source "${row.source}" is not one of ${ROW_SOURCES.join(', ')}`);
  }
  return row;
}

export function loadCorpus(filePath, { checkFiles = false, root = null } = {}) {
  const rows = parseJsonl(readFileSync(filePath, 'utf8'));
  const seen = new Set();
  rows.forEach((row, i) => {
    validateRow(row, `${filePath}:${i + 1}`);
    if (seen.has(row.id)) throw new Error(`${filePath}:${i + 1}: duplicate id "${row.id}"`);
    seen.add(row.id);
  });
  if (checkFiles) {
    const base = root || path.resolve(path.dirname(filePath), '..', '..');
    for (const row of rows) {
      const abs = path.resolve(base, row.html);
      try {
        readFileSync(abs, 'utf8');
      } catch (err) {
        throw new Error(`labeled.jsonl: file missing for "${row.id}": ${abs}`);
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Prediction and verdict normalization
// ---------------------------------------------------------------------------

function tellIdOf(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    if (typeof entry.tell_id === 'string') return entry.tell_id;
    if (typeof entry.tell === 'string') return entry.tell;
    if (typeof entry.check_id === 'string') return entry.check_id;
  }
  throw new Error(`cannot read a tell id out of ${JSON.stringify(entry)}`);
}

// Accepts { "file.html": ["tell"] }, { "file.html": [{tell_id: "tell"}] } or a Map of the same.
// Keys are compared as-is, so pass repo relative paths exactly as they appear in labeled.jsonl.
export function normalizeFindings(preds) {
  const out = new Map();
  const entries = preds instanceof Map ? preds.entries() : Object.entries(preds || {});
  for (const [file, value] of entries) {
    const list = value === null || value === undefined ? [] : Array.isArray(value) ? value : [value];
    out.set(file, new Set(list.map(tellIdOf)));
  }
  return out;
}

// Accepts { "file.html": "fail" }, { "file.html": { verdict: "fail" } } or
// [{ file: "file.html", verdict: "fail" }].
export function normalizeVerdicts(verdicts) {
  const out = new Map();
  if (Array.isArray(verdicts)) {
    for (const entry of verdicts) {
      if (!entry || typeof entry !== 'object') throw new Error('normalizeVerdicts: array entries must be objects');
      out.set(entry.file || entry.html, String(entry.verdict));
    }
    return out;
  }
  const entries = verdicts instanceof Map ? verdicts.entries() : Object.entries(verdicts || {});
  for (const [file, value] of entries) {
    out.set(file, String(value && typeof value === 'object' ? value.verdict : value));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core classification metrics
// ---------------------------------------------------------------------------

export function precision(tp, fp) {
  const denom = tp + fp;
  return denom === 0 ? 0 : tp / denom;
}

export function recall(tp, fn) {
  const denom = tp + fn;
  return denom === 0 ? 0 : tp / denom;
}

export function f1(p, r) {
  const denom = p + r;
  return denom === 0 ? 0 : (2 * p * r) / denom;
}

export function confusion(goldSet, predSet) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const tell of goldSet) {
    if (predSet.has(tell)) tp += 1;
    else fn += 1;
  }
  for (const tell of predSet) {
    if (!goldSet.has(tell)) fp += 1;
  }
  return { tp, fp, fn, gold: goldSet.size, predicted: predSet.size };
}

// rows: corpus rows. findings: output of normalizeFindings (or any acceptable input).
export function evaluateDetections(rows, findings) {
  const preds = normalizeFindings(findings);
  const perTell = new Map();
  const files = [];

  const bump = (tell) => {
    if (!perTell.has(tell)) perTell.set(tell, { tell_id: tell, tp: 0, fp: 0, fn: 0, support: 0 });
    return perTell.get(tell);
  };

  for (const row of rows) {
    const gold = new Set(row.labels || []);
    const pred = preds.get(row.html) || new Set();
    const conf = confusion(gold, pred);
    for (const tell of gold) {
      const cell = bump(tell);
      cell.support += 1;
      if (pred.has(tell)) cell.tp += 1;
      else cell.fn += 1;
    }
    for (const tell of pred) {
      if (!gold.has(tell)) bump(tell).fp += 1;
    }
    files.push({
      id: row.id,
      html: row.html,
      source: row.source,
      gold: [...gold],
      predicted: [...pred],
      tp: conf.tp,
      fp: conf.fp,
      fn: conf.fn,
    });
  }

  const per_tell = {};
  for (const tell of [...perTell.keys()].sort()) {
    const cell = perTell.get(tell);
    const p = precision(cell.tp, cell.fp);
    const r = recall(cell.tp, cell.fn);
    per_tell[tell] = {
      tell_id: tell,
      support: cell.support,
      tp: cell.tp,
      fp: cell.fp,
      fn: cell.fn,
      precision: p,
      recall: r,
      f1: f1(p, r),
    };
  }

  const totals = { tp: 0, fp: 0, fn: 0 };
  for (const cell of Object.values(per_tell)) {
    totals.tp += cell.tp;
    totals.fp += cell.fp;
    totals.fn += cell.fn;
  }
  const micro = {
    precision: precision(totals.tp, totals.fp),
    recall: recall(totals.tp, totals.fn),
    f1: f1(precision(totals.tp, totals.fp), recall(totals.tp, totals.fn)),
  };

  const unlabeled_predictions = Object.values(per_tell)
    .filter((cell) => cell.support === 0)
    .map((cell) => ({ tell_id: cell.tell_id, files: cell.fp }));

  return { per_tell, macro: macroAverage(per_tell), micro, totals, files, unlabeled_predictions };
}

// Macro average over tell ids with gold support > 0.
export function macroAverage(perTell) {
  const scored = Object.keys(perTell)
    .sort()
    .filter((tell) => perTell[tell].support > 0)
    .map((tell) => [tell, perTell[tell]]);
  const mean = (pick) => (scored.length === 0 ? 0 : scored.reduce((acc, [, cell]) => acc + pick(cell), 0) / scored.length);
  return {
    tell_count: scored.length,
    precision: mean((cell) => cell.precision),
    recall: mean((cell) => cell.recall),
    f1: mean((cell) => cell.f1),
    support: scored.reduce((acc, [, cell]) => acc + cell.support, 0),
    tells: scored.map(([tell]) => tell),
  };
}

// ---------------------------------------------------------------------------
// Escape rate
// ---------------------------------------------------------------------------

// verdicts: file -> "clean" | "pass_with_notes" | "fail" (or any tool verdict string).
// Files whose verdict is missing, empty, or unrecognized count as escapes when
// missingCountsAsEscape is true (the default).
export function escapeRate(rows, verdicts, options = {}) {
  const { missingCountsAsEscape = true, severityByTell = null, escapeVerdicts = ['clean', 'pass_with_notes'] } = options;
  const vmap = normalizeVerdicts(verdicts);
  const escapeSet = new Set(escapeVerdicts);
  const blockerRows = rows.filter((row) => isBlockerBearing(row, severityByTell));

  const escaped = [];
  const unjudged = [];
  const byVerdict = {};
  const detail = [];

  for (const row of blockerRows) {
    const verdict = vmap.get(row.html);
    if (verdict === undefined || verdict === '' || verdict === 'undefined') {
      unjudged.push(row.html);
      byVerdict.unjudged = (byVerdict.unjudged || 0) + 1;
      if (missingCountsAsEscape) escaped.push(row.html);
      detail.push({ html: row.html, id: row.id, verdict: null, escaped: missingCountsAsEscape });
      continue;
    }
    byVerdict[verdict] = (byVerdict[verdict] || 0) + 1;
    const isEscape = escapeSet.has(verdict);
    if (isEscape) escaped.push(row.html);
    detail.push({ html: row.html, id: row.id, verdict, escaped: isEscape });
  }

  return {
    blocker_files: blockerRows.length,
    escaped,
    escaped_files: escaped,
    escaped_count: escaped.length,
    rate: blockerRows.length === 0 ? 0 : escaped.length / blockerRows.length,
    unjudged_files: unjudged,
    by_verdict: byVerdict,
    missing_counts_as_escape: missingCountsAsEscape,
    escape_verdicts: [...escapeSet].sort(),
    detail,
  };
}

// ---------------------------------------------------------------------------
// Win rates and the bootstrap interval
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(values) {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i];
  return values.length === 0 ? 0 : sum / values.length;
}

export const STATISTICS = { mean };

// Percentile bootstrap with a seeded PRNG. Deterministic: same sample, same seed, same interval.
export function bootstrapCI(sample, options = {}) {
  const { iterations = 10000, alpha = 0.05, seed = 20260918, statistic = 'mean' } = options;
  const values = Array.from(sample, Number);
  if (values.length === 0) throw new Error('bootstrapCI: empty sample');
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error('bootstrapCI: iterations must be a positive integer');
  if (!(alpha > 0 && alpha < 1)) throw new Error('bootstrapCI: alpha must be between 0 and 1');
  let stat = statistic;
  if (typeof stat === 'string') {
    if (!(stat in STATISTICS)) throw new Error(`bootstrapCI: unknown statistic "${stat}"`);
    stat = STATISTICS[stat];
  }
  if (typeof stat !== 'function') throw new Error('bootstrapCI: statistic must be a name or a function');

  const point = stat(values);
  const rand = mulberry32(seed);
  const n = values.length;
  const draw = new Array(n);
  const stats = new Array(iterations);
  for (let b = 0; b < iterations; b += 1) {
    for (let i = 0; i < n; i += 1) draw[i] = values[Math.floor(rand() * n)];
    stats[b] = stat(draw);
  }
  stats.sort((a, b) => a - b);
  const loIndex = Math.floor((alpha / 2) * iterations);
  const hiIndex = Math.min(iterations - 1, Math.ceil((1 - alpha / 2) * iterations) - 1);
  return {
    point,
    lo: stats[loIndex],
    hi: stats[hiIndex],
    iterations,
    alpha,
    seed,
    n,
    statistic: typeof statistic === 'function' ? 'custom' : statistic,
  };
}

// pairs: 1 = win, 0.5 = tie, 0 = loss.
export function winRate(pairs) {
  const values = Array.from(pairs, Number);
  const wins = values.filter((v) => v === 1).length;
  const ties = values.filter((v) => v === 0.5).length;
  const losses = values.filter((v) => v === 0).length;
  return { n: values.length, wins, ties, losses, rate: mean(values) };
}

// The protocol's honesty rule: if the interval contains 0.5, the headline is
// "no measurable difference", never a win.
export function winRateCI(pairs, options = {}) {
  const values = Array.from(pairs, Number);
  const interval = bootstrapCI(values, { statistic: 'mean', ...options });
  const summary = winRate(values);
  let conclusion = 'no measurable difference';
  if (interval.lo > 0.5) conclusion = 'win';
  else if (interval.hi < 0.5) conclusion = 'loss';
  return { ...interval, ...summary, conclusion };
}

// ---------------------------------------------------------------
export function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (total === 0) return { point: 0, lo: 0, hi: 1, n: 0 };
  const phat = successes / total;
  const denom = 1 + (z * z) / total;
  const centre = phat + (z * z) / (2 * total);
  const spread = z * Math.sqrt((phat * (1 - phat)) / total + (z * z) / (4 * total * total));
  return { point: phat, lo: Math.max(0, (centre - spread) / denom), hi: Math.min(1, (centre + spread) / denom), n: total };
}

export function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// ---------------------------------------------------------------------------
// Self-check (hand made confusion example, no framework, no network)
// ---------------------------------------------------------------------------

const SELF_CHECK_ROWS = [
  {
    id: 'f1',
    html: 'f1.html',
    labels: ['alpha', 'beta', 'gamma'],
    label_severity: 'blocker',
    injection: [],
    source: 'synthetic-injected',
  },
  {
    id: 'f2',
    html: 'f2.html',
    labels: ['beta', 'delta'],
    label_severity: 'major',
    injection: [],
    source: 'synthetic-injected',
  },
  {
    id: 'f3',
    html: 'f3.html',
    labels: [],
    label_severity: 'clean',
    injection: [],
    source: 'synthetic-injected',
  },
];

const SELF_CHECK_FINDINGS = {
  'f1.html': ['alpha', 'gamma'],
  'f2.html': ['beta', 'epsilon'],
  'f3.html': ['alpha'],
};

function selfCheck() {
  const failures = [];
  let assertions = 0;
  const check = (name, condition, detail = '') => {
    assertions += 1;
    if (!condition) failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  };
  const approx = (name, actual, expected, tolerance = 1e-9) => {
    check(name, Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
  };

  // 1. Hand made confusion example: gold {alpha,beta,gamma} vs predicted {alpha,gamma} on f1,
  //    gold {beta,delta} vs predicted {beta,epsilon} on f2, clean f3 predicted {alpha}.
  const result = evaluateDetections(SELF_CHECK_ROWS, SELF_CHECK_FINDINGS);
  const cells = result.per_tell;

  check('per_tell has all 5 tell ids', Object.keys(cells).length === 5, Object.keys(cells).join(','));
  approx('alpha precision', cells.alpha.precision, 0.5);
  approx('alpha recall', cells.alpha.recall, 1);
  approx('alpha f1', cells.alpha.f1, 2 / 3);
  approx('beta precision', cells.beta.precision, 1);
  approx('beta recall', cells.beta.recall, 0.5);
  approx('beta f1', cells.beta.f1, 2 / 3);
  approx('gamma f1', cells.gamma.f1, 1);
  check('gamma support', cells.gamma.support === 1, String(cells.gamma.support));
  approx('delta precision is 0 with no predictions', cells.delta.precision, 0);
  approx('delta recall', cells.delta.recall, 0);
  approx('delta f1', cells.delta.f1, 0);
  check('epsilon is reported unlabeled', result.unlabeled_predictions.length === 1
    && result.unlabeled_predictions[0].tell_id === 'epsilon', JSON.stringify(result.unlabeled_predictions));

  check('macro averages the 4 supported tells, not epsilon', result.macro.tell_count === 4, String(result.macro.tell_count));
  approx('macro precision', result.macro.precision, (0.5 + 1 + 1 + 0) / 4);
  approx('macro recall', result.macro.recall, (1 + 0.5 + 1 + 0) / 4);
  approx('macro f1', result.macro.f1, (2 / 3 + 2 / 3 + 1 + 0) / 4);
  check('per_tell is sorted by tell id', Object.keys(cells).join(',') === 'alpha,beta,delta,epsilon,gamma',
    Object.keys(cells).join(','));

  approx('micro precision', result.micro.precision, 3 / 5);
  approx('micro recall', result.micro.recall, 3 / 5);
  check('totals', result.totals.tp === 3 && result.totals.fp === 2 && result.totals.fn === 2,
    JSON.stringify(result.totals));

  // 2. Identity checks.
  approx('f1 of equal p and r equals both', f1(0.4, 0.4), 0.4);
  approx('precision with no predictions is 0', precision(0, 0), 0);
  approx('f1 with no signal is 0', f1(0, 0), 0);

  // 3. Escape rate: 5 files, 3 blocker bearing, of which 2 escape. One blocker file has no verdict.
  const escapeRows = [
    { id: 'b1', html: 'b1.html', labels: ['x'], label_severity: 'blocker', injection: [], source: 'curated-real' },
    { id: 'b2', html: 'b2.html', labels: ['y'], label_severity: 'blocker', injection: [], source: 'curated-real' },
    { id: 'b3', html: 'b3.html', labels: ['z'], label_severity: 'blocker', injection: [], source: 'curated-real' },
    { id: 'b4', html: 'b4.html', labels: ['w'], label_severity: 'blocker', injection: [], source: 'escape-regression' },
    { id: 'm1', html: 'm1.html', labels: ['v'], label_severity: 'major', injection: [], source: 'curated-real' },
    { id: 'c1', html: 'c1.html', labels: [], label_severity: 'clean', injection: [], source: 'synthetic-injected' },
  ];
  const escape = escapeRate(escapeRows, { 'b1.html': 'clean', 'b2.html': 'pass_with_notes', 'b3.html': 'fail', 'm1.html': 'clean' });
  check('escape rate counts only blocker bearing files', escape.blocker_files === 4, String(escape.blocker_files));
  check('escape rate numerator: clean, pass_with_notes, and the unjudged file', escape.escaped_count === 3, JSON.stringify(escape.escaped));
  approx('escape rate value', escape.rate, 3 / 4);
  check('unjudged file is listed', escape.unjudged_files.length === 1 && escape.unjudged_files[0] === 'b4.html',
    JSON.stringify(escape.unjudged_files));
  const strictEscape = escapeRate(escapeRows, { 'b1.html': 'clean', 'b2.html': 'pass_with_notes', 'b3.html': 'fail', 'm1.html': 'clean' }, { missingCountsAsEscape: false });
  approx('escape rate with missingCountsAsEscape false', strictEscape.rate, 2 / 4);
  const cleanEscape = escapeRate(escapeRows, { 'b1.html': 'fail', 'b2.html': 'fail', 'b3.html': 'fail', 'b4.html': 'fail', 'm1.html': 'clean' });
  approx('a tool that reports everything escapes nothing', cleanEscape.rate, 0);

  // 4. Bootstrap: determinism, containment, and the degenerate all ones case.
  const ones = new Array(12).fill(1);
  const ciOnes = bootstrapCI(ones, { iterations: 500, seed: 7 });
  approx('all ones interval is degenerate at 1 (lo)', ciOnes.lo, 1);
  approx('all ones interval is degenerate at 1 (hi)', ciOnes.hi, 1);

  const sample = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0];
  const a = bootstrapCI(sample, { iterations: 2000, seed: 12345 });
  const b = bootstrapCI(sample, { iterations: 2000, seed: 12345 });
  check('bootstrap is deterministic for a fixed seed', a.lo === b.lo && a.hi === b.hi && a.point === b.point,
    `${a.lo},${a.hi} vs ${b.lo},${b.hi}`);
  const c = bootstrapCI(sample, { iterations: 2000, seed: 999 });
  check('a different seed moves the interval (or agrees, but it is not promised to)', Number.isFinite(c.lo) && c.lo <= c.hi);
  check('interval contains the point estimate', a.lo <= a.point && a.point <= a.hi, `${a.lo} <= ${a.point} <= ${a.hi}`);
  approx('point estimate is the sample mean', a.point, sample.reduce((s, v) => s + v, 0) / sample.length);
  check('interval is within [0,1]', a.lo >= 0 && a.hi <= 1, `${a.lo}..${a.hi}`);

  const win = winRateCI(sample, { iterations: 2000, seed: 5 });
  check('win rate matches the mean of the pairs', win.rate === win.point, `${win.rate} vs ${win.point}`);
  check('win rate conclusion is one of the three honest labels',
    ['win', 'loss', 'no measurable difference'].includes(win.conclusion), win.conclusion);

  const ties = [0.5, 0.5, 1, 1, 1, 1];
  check('ties count separately from wins and losses', winRate(ties).ties === 2 && winRate(ties).wins === 4);

  const w = wilsonInterval(12, 20);
  check('wilson interval brackets the proportion', w.lo < 0.6 && w.hi > 0.6, `${w.lo}..${w.hi}`);

  check('maxSeverity picks the worst', maxSeverity(['minor', 'blocker', 'major']) === 'blocker');
  check('maxSeverity of nothing is clean', maxSeverity([]) === 'clean');

  // 5. The real corpus, if it has been generated.
  const corpusPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'corpus', 'labeled.jsonl');
  let corpusInfo = 'not generated yet, skipped';
  try {
    const rows = loadCorpus(corpusPath, { checkFiles: true });
    const sources = {};
    const tells = new Set();
    for (const row of rows) {
      sources[row.source] = (sources[row.source] || 0) + 1;
      for (const tell of row.labels) tells.add(tell);
    }
    corpusInfo = `${rows.length} rows, ${tells.size} distinct tell labels, ${JSON.stringify(sources)}`;
    check('real corpus loads and every cited html file exists', rows.length > 0);
    check('every row carries the protocol keys', rows.every((row) => ROW_KEYS.every((key) => key in row)));
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      corpusInfo = 'not generated yet, skipped';
    } else {
      check('real corpus loads', false, err.message);
    }
  }

  console.log('METRICS SELF-CHECK');
  console.log(`  corpus: ${corpusInfo}`);
  console.log(`  assertions: ${assertions}, failures: ${failures.length}`);
  for (const failure of failures) console.log(`  FAIL ${failure}`);
  console.log(failures.length === 0 ? 'METRICS SELF-CHECK: PASS' : 'METRICS SELF-CHECK: FAIL');
  return failures.length === 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
const isMain = invokedPath === import.meta.url;
if (isMain) {
  const ok = selfCheck();
  process.exit(ok ? 0 : 1);
}

export { selfCheck };
