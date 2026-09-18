// mcp/server.mjs - Model Context Protocol stdio server for designcourt
// Exposes designcourt as tools for Claude Code, Cursor, Windsurf, Hermes, etc.
// Hard rule: no em-dash or en-dash in this file or output.

import { createInterface } from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan } from '../src/contract/plan.mjs';
import { judgeHtml } from '../src/judge/judge.mjs';
import { validateContract } from '../src/contract/schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DECISIONS_DIR = resolve(__dirname, '../decisions');

const SERVER_INFO = {
  name: 'designcourt',
  version: '0.1.0'
};

const TOOLS = [
  {
    name: 'designcourt_plan',
    description: 'Generate an authoritative DesignContract from a brief. Establishes mode, rationale, dials, layout plan with non-repeating families, token rules, and explicit bans before any code is written.',
    inputSchema: {
      type: 'object',
      required: ['goal'],
      properties: {
        goal: { type: 'string', description: 'What user problem this page solves' },
        audience: { type: 'string', description: 'Who the target audience is' },
        success_metric: { type: 'string', description: 'Observable success metric' },
        mode: { type: 'string', enum: ['persuade', 'operate', 'read', 'experience'], description: 'Override auto-inferred mode' }
      }
    }
  },
  {
    name: 'designcourt_judge',
    description: 'Audit an HTML/CSS artifact against 38 AI design tells (lexical, color, layout, contrast, hierarchy). Returns pass/fail verdict, slop score, and concrete findings with line numbers and fixes.',
    inputSchema: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'HTML content to audit' },
        path: { type: 'string', description: 'Path to HTML file to read and audit' },
        contract: { type: 'object', description: 'Optional DesignContract to check adherence against (DC-4xx)' }
      }
    }
  },
  {
    name: 'designcourt_decide',
    description: 'Query the designcourt decision library for verified design choices, when to use them, when NOT to use them, and the failure modes they avoid.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Specific decision id (e.g. reject-three-equal-cards)' },
        mode: { type: 'string', enum: ['persuade', 'operate', 'read', 'experience'], description: 'Filter decisions by mode' }
      }
    }
  }
];

async function handleToolCall(name, args) {
  if (name === 'designcourt_plan') {
    const brief = {
      goal: args.goal,
      audience: args.audience || 'Target audience',
      success_metric: args.success_metric || 'Observed task completion'
    };
    const contract = plan(brief, { mode: args.mode });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(contract, null, 2)
        }
      ]
    };
  }

  if (name === 'designcourt_judge') {
    let html = args.html;
    if (!html && args.path) {
      if (!existsSync(args.path)) throw new Error(`File not found: ${args.path}`);
      html = readFileSync(args.path, 'utf8');
    }
    if (!html) throw new Error('Either html or path parameter is required');

    const verdict = judgeHtml({ html, contract: args.contract });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(verdict, null, 2)
        }
      ]
    };
  }

  if (name === 'designcourt_decide') {
    if (args.id) {
      const p = resolve(DECISIONS_DIR, `${args.id}.json`);
      if (!existsSync(p)) throw new Error(`Decision not found: ${args.id}`);
      const d = JSON.parse(readFileSync(p, 'utf8'));
      return {
        content: [{ type: 'text', text: JSON.stringify(d, null, 2) }]
      };
    }

    const idxPath = resolve(DECISIONS_DIR, 'index.json');
    const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
    let entries = idx.decisions || idx;
    if (args.mode) {
      entries = entries.filter(e => e.mode && (e.mode.includes(args.mode) || e.mode === args.mode));
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async line => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (err) {
    return;
  }

  const { id, method, params } = msg;

  if (method === 'initialize') {
    const response = {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: SERVER_INFO
      }
    };
    process.stdout.write(JSON.stringify(response) + '\n');
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'tools/list') {
    const response = {
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS
      }
    };
    process.stdout.write(JSON.stringify(response) + '\n');
    return;
  }

  if (method === 'tools/call') {
    try {
      const toolResult = await handleToolCall(params.name, params.arguments || {});
      const response = {
        jsonrpc: '2.0',
        id,
        result: toolResult
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const response = {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
    return;
  }

  if (id !== undefined) {
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    };
    process.stdout.write(JSON.stringify(response) + '\n');
  }
});
