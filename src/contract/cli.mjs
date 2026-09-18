// src/contract/cli.mjs - CLI entry point for plan/ruling generation
import { readFileSync } from 'node:fs';
import { plan } from './plan.mjs';

function usage() {
  console.log(`designcourt plan: generate a DesignContract from a brief

Usage:
  node src/contract/cli.mjs "Your brief goal" [--mode persuade|operate|read|experience]
  node src/contract/cli.mjs --file brief.json
  node src/contract/cli.mjs --file brief.md
`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) usage();

let brief = { goal: '', audience: 'Target users', success_metric: 'Observed goal completion' };
let mode = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file') {
    const f = args[++i];
    const raw = readFileSync(f, 'utf8');
    if (f.endsWith('.json')) {
      brief = JSON.parse(raw);
    } else {
      brief.goal = raw.slice(0, 200).replace(/\n+/g, ' ').trim();
    }
  } else if (args[i] === '--mode') {
    mode = args[++i];
  } else if (!args[i].startsWith('--') && !brief.goal) {
    brief.goal = args[i];
  }
}

try {
  const contract = plan(brief, { mode });
  console.log(JSON.stringify(contract, null, 2));
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
