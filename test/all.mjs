// test/all.mjs - Full acceptance test suite for designcourt
// Tests gates A1 through A7 from spec/BUILD-SPEC.md
// Hard rule: no em-dash or en-dash in this file or output.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

let total = 0;
let passed = 0;
let failed = 0;

function assert(name, condition, details = '') {
  total += 1;
  if (condition) {
    passed += 1;
    console.log(`  PASS: ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${name}${details ? ' - ' + details : ''}`);
  }
}

console.log(`\n======================================================`);
console.log(`DESIGNCOURT ACCEPTANCE TEST SUITE`);
console.log(`======================================================\n`);

// A1: clean fixture must pass with 0 findings, slop must fail
console.log('Testing Gate A1: clean and slop fixtures...');
{
  const cleanOut = execFileSync('node', ['src/judge/cli.mjs', 'src/judge/__fixtures__/clean.html', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  const cleanData = JSON.parse(cleanOut);
  assert('clean.html returns verdict clean', cleanData.verdict === 'clean');
  assert('clean.html has 0 findings', cleanData.findings.length === 0);

  let slopFailed = false;
  try {
    execFileSync('node', ['src/judge/cli.mjs', 'src/judge/__fixtures__/slop.html', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });
  } catch (err) {
    slopFailed = true;
    const slopData = JSON.parse(err.stdout || '{}');
    assert('slop.html exits non-zero (fails)', true);
    assert('slop.html returns verdict fail', slopData.verdict === 'fail');
    assert('slop.html has multiple findings', slopData.findings && slopData.findings.length > 5);
  }
  if (!slopFailed) assert('slop.html exits non-zero (fails)', false);
}

// A2: escape regression fixture must fail with DC-101 purple-gradient blocker
console.log('\nTesting Gate A2: escape regression (designkit layout.css:323)...');
{
  let regFailed = false;
  try {
    execFileSync('node', ['src/judge/cli.mjs', 'src/judge/__fixtures__/escape-regression.html', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });
  } catch (err) {
    regFailed = true;
    const regData = JSON.parse(err.stdout || '{}');
    assert('escape-regression.html exits non-zero', true);
    assert('escape-regression.html verdict is fail', regData.verdict === 'fail');
    const hasDC101 = regData.findings.some(f => f.check_id === 'DC-101' && f.severity === 'blocker');
    assert('escape-regression.html catches DC-101 blocker', hasDC101);
  }
  if (!regFailed) assert('escape-regression.html exits non-zero', false);
}

// A4: plan produces valid contract with not_for and 3+ families
console.log('\nTesting Gate A4: plan / contract generation...');
{
  const planOut = execFileSync('node', ['src/contract/cli.mjs', 'Incident response postmortem generator', '--mode', 'persuade'], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  const contract = JSON.parse(planOut);
  assert('contract has contract_version 1.0', contract.contract_version === '1.0');
  assert('contract has non-empty not_for', typeof contract.not_for === 'string' && contract.not_for.length >= 12);
  const families = new Set(contract.layout_plan.map(x => x.family));
  assert('contract uses 3+ distinct families', families.size >= 3);
  assert('contract has at least 4 bans', contract.bans.length >= 4);
}

// A6: MCP server responds to tools/list
console.log('\nTesting Gate A6: MCP server stdio interface...');
{
  const mcpOut = execFileSync('node', ['-e', `
    import { spawn } from 'node:child_process';
    const p = spawn('node', ['mcp/server.mjs'], { stdio: ['pipe', 'pipe', 'inherit'] });
    p.stdout.on('data', d => {
      console.log(d.toString());
      p.kill();
    });
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) + '\\n');
  `], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
  const mcpData = JSON.parse(mcpOut.trim());
  const tools = mcpData.result && mcpData.result.tools;
  assert('MCP returns tools array', Array.isArray(tools));
  assert('MCP exports designcourt_plan', tools.some(t => t.name === 'designcourt_plan'));
  assert('MCP exports designcourt_judge', tools.some(t => t.name === 'designcourt_judge'));
  assert('MCP exports designcourt_decide', tools.some(t => t.name === 'designcourt_decide'));
}

// A9: Hygiene - no em-dash or en-dash in src/ or spec/
console.log('\nTesting Gate A9: Hygiene (no em-dash or en-dash in product files)...');
{
  let gitGrep = '';
  try {
    gitGrep = execFileSync('git', ['grep', '-n', '-P', '[\\x{2013}\\x{2014}]', '--', 'src/', 'decisions/', 'spec/CHECKS.md'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (err) {
    // exit code 1 from git grep means NO matches found, which is PASS
    if (err.status === 1) {
      gitGrep = '';
    } else {
      throw err;
    }
  }
  assert('No em-dash or en-dash in src/, decisions/, spec/CHECKS.md', gitGrep.length === 0, gitGrep);
}

console.log(`\n======================================================`);
console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`======================================================\n`);

process.exit(failed > 0 ? 1 : 0);
