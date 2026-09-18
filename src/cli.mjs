// src/cli.mjs - Single CLI entry point for designcourt
// Hard rule: no em-dash or en-dash in this file or output.

import { readFileSync, existsSync } from 'node:fs';
import { plan } from './contract/plan.mjs';
import { judgeHtml } from './judge/judge.mjs';

function help() {
  console.log(`
designcourt v0.1.0 - The decision layer and deterministic judge for AI design

Commands:
  designcourt plan <brief> [--mode persuade|operate|read|experience]
      Generate a binding DesignContract before building.

  designcourt judge <file.html> [--contract contract.json] [--json]
      Audit an HTML/CSS artifact against 38 AI design tells.
      Exit 0 = clean or pass_with_notes, Exit 1 = fail.

  designcourt mcp
      Start the Model Context Protocol stdio server for agent tools.

Options:
  --help, -h       Show this message
  --version, -v    Show version number
`);
  process.exit(0);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) help();

if (args.includes('-v') || args.includes('--version')) {
  console.log('designcourt v0.1.0');
  process.exit(0);
}

const command = args[0];

if (command === 'plan') {
  let goal = '';
  let mode = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--mode') mode = args[++i];
    else if (!args[i].startsWith('--') && !goal) goal = args[i];
  }
  if (!goal) {
    console.error('Error: brief text required. Example: designcourt plan "Incident postmortem tool"');
    process.exit(1);
  }
  const contract = plan({ goal, audience: 'Target users and operators', success_metric: 'Observed goal completion' }, { mode });
  console.log(JSON.stringify(contract, null, 2));
  process.exit(0);
}

if (command === 'judge') {
  const filePath = args[1];
  if (!filePath || filePath.startsWith('--')) {
    console.error('Error: file path required. Example: designcourt judge index.html');
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`Error: file not found: ${filePath}`);
    process.exit(1);
  }
  const isJson = args.includes('--json');
  let contract = null;
  const cIdx = args.indexOf('--contract');
  if (cIdx !== -1 && args[cIdx + 1]) {
    contract = JSON.parse(readFileSync(args[cIdx + 1], 'utf8'));
  }
  const html = readFileSync(filePath, 'utf8');
  const verdict = judgeHtml({ html, contract });

  if (isJson) {
    console.log(JSON.stringify(verdict, null, 2));
  } else {
    console.log(`\nVerdict: ${verdict.verdict.toUpperCase()}`);
    console.log(`Findings: ${verdict.findings.length} (${verdict.counts.blocker} blocker, ${verdict.counts.major} major, ${verdict.counts.minor} minor)`);
    console.log(`Slop score: ${verdict.score.slop_index}`);
    if (verdict.findings.length > 0) {
      console.log('\nTop findings:');
      for (const f of verdict.findings.slice(0, 5)) {
        console.log(`  [${f.severity.toUpperCase()}] ${f.check_id} (${f.tell_id}): ${f.title}`);
        console.log(`    Line ${f.evidence.line}: ${f.evidence.snippet}`);
        console.log(`    Fix: ${f.fix}`);
      }
    }
  }
  process.exit(verdict.verdict === 'fail' ? 1 : 0);
}

if (command === 'mcp') {
  import('../mcp/server.mjs');
} else {
  console.error(`Unknown command: ${command}`);
  help();
}
