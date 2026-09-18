#!/usr/bin/env node

/**
 * designcourt judge: command line interface.
 *
 * Usage:
 *   node src/judge/cli.mjs <file> [--tokens tokens.json] [--contract contract.json] [--json|--text]
 *
 * Exit code:
 *   1 when the verdict is "fail" (any blocker finding)
 *   0 when the verdict is "clean" or "pass_with_notes"
 *   2 on argument or file read errors
 *
 * Stdlib only, Node 18+, ESM. Completely deterministic.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeHtml } from './judge.mjs';
import * as D from './dom.mjs';

function printHelp() {
  const msg = [
    'designcourt judge: deterministic HTML/CSS slop auditor',
    '',
    'Usage:',
    '  node src/judge/cli.mjs <file.html> [options]',
    '',
    'Options:',
    '  --tokens <file>      Tokens JSON file, or CSS file containing :root tokens',
    '  --contract <file>    DesignContract JSON file (enables DC-4xx checks)',
    '  --json               Emit the frozen verdict object as JSON (default)',
    '  --text               Emit human readable verdict with evidence lines',
    '  --help, -h           Show this help',
    '',
    'Exit codes:',
    '  0  verdict clean or pass_with_notes',
    '  1  verdict fail (one or more blocker findings)',
    '  2  CLI or file reading error',
  ].join('\n');
  process.stdout.write(msg + '\n');
}

function parseArgs(argv) {
  const args = {
    file: null,
    tokensPath: null,
    contractPath: null,
    format: 'json',
    help: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; return args; }
    if (a === '--json') { args.format = 'json'; continue; }
    if (a === '--text') { args.format = 'text'; continue; }
    if (a === '--tokens') { i += 1; args.tokensPath = argv[i]; continue; }
    if (a.startsWith('--tokens=')) { args.tokensPath = a.slice(9); continue; }
    if (a === '--contract') { i += 1; args.contractPath = argv[i]; continue; }
    if (a.startsWith('--contract=')) { args.contractPath = a.slice(11); continue; }
    if (!args.file && !a.startsWith('-')) { args.file = a; continue; }
    process.stderr.write('Unknown argument: ' + a + '\n');
    return null;
  }
  return args;
}

function loadTokens(tokensPath) {
  if (!tokensPath) return {};
  const full = path.resolve(process.cwd(), tokensPath);
  const raw = fs.readFileSync(full, 'utf8');
  if (tokensPath.endsWith('.json')) {
    const parsed = JSON.parse(raw);
    const flat = {};
    const flatten = (obj, prefix = '') => {
      for (const k of Object.keys(obj)) {
        const val = obj[k];
        const name = prefix ? prefix + '-' + k : k;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          if (typeof val.value === 'string' || typeof val.value === 'number') {
            const varName = name.startsWith('--') ? name : '--' + name;
            flat[varName] = String(val.value);
          } else {
            flatten(val, name);
          }
        } else if (typeof val === 'string' || typeof val === 'number') {
          const varName = name.startsWith('--') ? name : '--' + name;
          flat[varName] = String(val);
        }
      }
    };
    flatten(parsed);
    return flat;
  }
  const rules = D.parseCss(raw, { file: tokensPath });
  return D.collectCustomProperties(rules);
}

function loadContract(contractPath) {
  if (!contractPath) return null;
  const full = path.resolve(process.cwd(), contractPath);
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}

function findLinkedStylesheets(html, htmlDir) {
  const sheets = [];
  const re = /<link\b([^>]*?)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const isRelStyle = /\brel\s*=\s*["']?stylesheet["']?/i.test(attrs);
    if (!isRelStyle) continue;
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (/^https?:\/\/|^\/\//i.test(href)) continue;
    if (href.startsWith('data:')) continue;
    const resolved = path.resolve(htmlDir, href);
    if (fs.existsSync(resolved)) {
      try {
        const text = fs.readFileSync(resolved, 'utf8');
        sheets.push({ file: href, text });
      } catch {
        // Unreadable local sheet: skip silently, don't crash
      }
    }
  }
  return sheets;
}

function renderTextReport(verdictObj, file) {
  const out = [];
  const symbol = verdictObj.verdict === 'clean' ? 'PASS' : verdictObj.verdict === 'fail' ? 'FAIL' : 'WARN';
  out.push('designcourt judge: ' + symbol + ' [' + verdictObj.verdict + ']');
  out.push('file: ' + file + ' (' + verdictObj.files_scanned + ' scanned)');
  out.push('counts: ' + verdictObj.counts.blocker + ' blocker, ' + verdictObj.counts.major + ' major, ' + verdictObj.counts.minor + ' minor');
  out.push('slop index: ' + verdictObj.score.slop_index.toFixed(1) + ' / 10.0 | layout families: ' + verdictObj.score.layout_families);
  out.push('');
  if (!verdictObj.findings.length) {
    out.push('Clean: zero tells detected.');
    return out.join('\n');
  }
  for (const f of verdictObj.findings) {
    const tag = f.severity.toUpperCase().padEnd(7);
    out.push('[' + tag + '] ' + f.check_id + ' (' + f.tell_id + '): ' + f.title);
    out.push('  line ' + f.evidence.line + ' ' + f.evidence.selector);
    if (f.evidence.snippet) out.push('  snippet: ' + f.evidence.snippet);
    if (f.why) out.push('  why: ' + f.why);
    if (f.fix) out.push('  fix: ' + f.fix);
    out.push('');
  }
  return out.join('\n');
}

export function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (!args) return 2;
  if (args.help) { printHelp(); return 0; }
  if (!args.file) {
    process.stderr.write('Error: no target file provided. Run with --help for usage.\n');
    return 2;
  }

  const targetPath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(targetPath)) {
    process.stderr.write('Error: file not found: ' + targetPath + '\n');
    return 2;
  }

  let html;
  try {
    html = fs.readFileSync(targetPath, 'utf8');
  } catch (err) {
    process.stderr.write('Error reading ' + targetPath + ': ' + (err.message || err) + '\n');
    return 2;
  }

  let tokens = {};
  if (args.tokensPath) {
    try {
      tokens = loadTokens(args.tokensPath);
    } catch (err) {
      process.stderr.write('Error reading tokens from ' + args.tokensPath + ': ' + (err.message || err) + '\n');
      return 2;
    }
  }

  let contract = null;
  if (args.contractPath) {
    try {
      contract = loadContract(args.contractPath);
    } catch (err) {
      process.stderr.write('Error reading contract from ' + args.contractPath + ': ' + (err.message || err) + '\n');
      return 2;
    }
  }

  const extraCss = findLinkedStylesheets(html, path.dirname(targetPath));

  const result = judgeHtml({
    html,
    file: args.file,
    tokens,
    contract,
    extraCss,
  });

  if (args.format === 'json') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(renderTextReport(result, args.file) + '\n');
  }

  return result.verdict === 'fail' ? 1 : 0;
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const code = main(process.argv);
  process.exit(code);
}
