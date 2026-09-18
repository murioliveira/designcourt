// bench/lib/adapters.mjs - Adapters for running detection tools in Lane A
// Hard rule: no em-dash or en-dash in this file or output.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

export const MAPPINGS = {
  judge: {
    // Identity mapping: judge findings use tell_id directly
    map(finding) {
      return finding.tell_id;
    }
  },

  gate_baseline: {
    // Map designkit anti-slop-check output to tell_ids
    // [PASS/FAIL] <check_name> <details>
    map(checkName) {
      const table = {
        'em-dash': 'em-dash',
        'hex': 'hardcoded-hex',
        'inter': 'inter-default',
        'eyebrows': 'eyebrow-density',
        'nomes': 'generic-names',
        'paleta': 'premium-consumer-palette',
        'scroll': 'scroll-cues'
      };
      return table[checkName] || null;
    }
  },

  impeccable: {
    // Map impeccable anti-patterns to designcourt tell_ids
    map(pattern) {
      const table = {
        'gray-on-color': 'contrast-aa',
        'low-contrast': 'contrast-aa',
        'dark-glow': 'neon-glow',
        'radial-halo': 'purple-gradient', // when on dark or purple
        'extreme-negative-tracking': null,
        'overused-font': 'inter-default',
        'skipped-heading': null,
        'marketing-buzzword': 'filler-verbs',
        'horizontal-scroll': null,
        'centered-body-text': null,
        'all-caps-body': null,
        'tiny-tap-target': null,
        'missing-alt': null,
        'empty-button': null
      };
      return table[pattern] !== undefined ? table[pattern] : null;
    }
  }
};

export async function runJudge(filePath) {
  const abs = resolve(REPO_ROOT, filePath);
  const { judgeHtml } = await import('../../src/judge/judge.mjs');
  const html = readFileSync(abs, 'utf8');
  const verdict = judgeHtml({ html });
  const tells = new Set();
  for (const f of verdict.findings) {
    if (f.tell_id) tells.add(f.tell_id);
  }
  return {
    adapter: 'judge',
    file: filePath,
    verdict: verdict.verdict,
    raw_findings_count: verdict.findings.length,
    detected_tells: Array.from(tells)
  };
}

export function runGateBaseline(filePath) {
  const abs = resolve(REPO_ROOT, filePath);
  const scriptPath = resolve(REPO_ROOT, '../designkit/scripts/anti-slop-check.py');
  try {
    const out = execFileSync('python', [scriptPath, abs], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const tells = new Set();
    const lines = out.split('\n');
    for (const line of lines) {
      const m = line.match(/\[(FAIL|AVISO)\]\s+([a-z-]+)/);
      if (m) {
        const mapped = MAPPINGS.gate_baseline.map(m[2]);
        if (mapped) tells.add(mapped);
      }
    }
    const isFail = /ANTI-SLOP: FAIL/.test(out);
    return {
      adapter: 'gate_baseline',
      file: filePath,
      verdict: isFail ? 'fail' : 'clean',
      detected_tells: Array.from(tells)
    };
  } catch (err) {
    const out = (err.stdout || '') + (err.stderr || '');
    const tells = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/\[(FAIL|AVISO)\]\s+([a-z-]+)/);
      if (m) {
        const mapped = MAPPINGS.gate_baseline.map(m[2]);
        if (mapped) tells.add(mapped);
      }
    }
    return {
      adapter: 'gate_baseline',
      file: filePath,
      verdict: 'fail',
      detected_tells: Array.from(tells)
    };
  }
}

export function runImpeccable(filePath) {
  const abs = resolve(REPO_ROOT, filePath);
  try {
    const out = execFileSync('npx', ['impeccable', 'detect', abs], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: 'C:/Users/muzph/AppData/Local/Temp/dkbench'
    });
    const tells = new Set();
    const lines = out.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*\[([a-z-]+)\]/);
      if (m) {
        const mapped = MAPPINGS.impeccable.map(m[1]);
        if (mapped) tells.add(mapped);
      }
    }
    const hasFindings = /anti-patterns? found/.test(out);
    return {
      adapter: 'impeccable',
      file: filePath,
      verdict: hasFindings ? 'fail' : 'clean',
      detected_tells: Array.from(tells)
    };
  } catch (err) {
    const out = (err.stdout || '') + (err.stderr || '');
    const tells = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*\[([a-z-]+)\]/);
      if (m) {
        const mapped = MAPPINGS.impeccable.map(m[1]);
        if (mapped) tells.add(mapped);
      }
    }
    return {
      adapter: 'impeccable',
      file: filePath,
      verdict: tells.size > 0 ? 'fail' : 'clean',
      detected_tells: Array.from(tells)
    };
  }
}
