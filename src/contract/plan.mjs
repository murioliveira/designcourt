// src/contract/plan.mjs - The Ruling generator: turns a brief into a DesignContract
// Hard rule: no em-dash or en-dash in this file or its outputs. Zero runtime dependencies.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateContract } from './schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DECISIONS_DIR = join(__dirname, '..', '..', 'decisions');

export const UNIVERSAL_BANS = [
  'em-dash',
  'purple-gradient',
  'neon-glow',
  'inter-default',
  'three-equal-cards',
  'repeated-zigzag',
  'fake-screenshot',
  'filler-verbs',
  'generic-names',
  'fake-precise-numbers'
];

export const MODE_CONFIG = {
  persuade: {
    dials: { expressiveness: 4, density: 2, motion: 2, ornament: 2 },
    token_plan: {
      accent: 'Single warm or saturated accent, maximum one hue family. Neutral background with high contrast type.',
      neutrals: 'Off-black text on off-white or dark neutral background, zero pure hex black or white in large fields.',
      type_scale: 'Major third (1.25) scale with high contrast between display heading and body text.'
    },
    default_families: ['split-asymmetric', 'statement-stat', 'proof-grid', 'side-by-side-comparison', 'close-action'],
    extra_bans: ['duplicate-cta-intent', 'scroll-cues', 'version-footer', 'text-logo-wall'],
    not_for: 'Not for internal tools, high-frequency operational surfaces, or long-form reading.'
  },
  operate: {
    dials: { expressiveness: 1, density: 5, motion: 1, ornament: 1 },
    token_plan: {
      accent: 'Functional status palette: amber warning, red error, emerald success, neutral blue focus. Zero decorative color.',
      neutrals: 'Muted slate borders and alternating row backgrounds for scanability. Monospace numerals for all data columns.',
      type_scale: 'Minor second (1.067) compact scale: 11px, 12px, 13px, 14px, 16px. Nothing larger than 20px.'
    },
    default_families: ['metric-strip', 'dense-data-table', 'split-detail-pane', 'status-queue', 'command-palette'],
    extra_bans: ['purple-gradient', 'neon-glow', 'scroll-cues', 'bento-empty-cell', 'decorative-chrome'],
    not_for: 'Not for landing pages, marketing collateral, or consumer editorial content.'
  },
  read: {
    dials: { expressiveness: 2, density: 2, motion: 1, ornament: 1 },
    token_plan: {
      accent: 'Understated editorial ink: deep navy or forest green used strictly for links and section markers.',
      neutrals: 'Warm parchment or cool paper background; warm dark gray for body type to soften contrast for long reading.',
      type_scale: 'Perfect fourth (1.333) classic book scale: 18px body with 1.6 line height and 65 character line length.'
    },
    default_families: ['title-byline-strip', 'key-findings-deck', 'longform-text-spine', 'data-exhibit', 'citation-register'],
    extra_bans: ['three-equal-cards', 'fake-screenshot', 'scroll-cues', 'multi-marquee', 'neon-glow'],
    not_for: 'Not for transactional dashboards, checkout flows, or rapid visual marketing.'
  },
  experience: {
    dials: { expressiveness: 5, density: 1, motion: 4, ornament: 3 },
    token_plan: {
      accent: 'Atmospheric palette derived from the subject metaphor: deep sea, cosmic, or historical palette.',
      neutrals: 'Subtle tonal gradation across vertical scroll. Text always readable above ambient background.',
      type_scale: 'Golden ratio (1.618) display scale with dramatic size shifts between stations.'
    },
    default_families: ['narrative-spine', 'full-bleed-station', 'interactive-threshold', 'data-artifact', 'coda-register'],
    extra_bans: ['three-equal-cards', 'filler-verbs', 'version-footer', 'numbered-eyebrow'],
    not_for: 'Not for data entry, forms, settings, documentation, or recurring daily workflows.'
  }
};

export function plan(briefInput, options = {}) {
  const brief = typeof briefInput === 'string' ? { goal: briefInput, audience: 'General user', success_metric: 'Task completion' } : briefInput;

  if (!brief.goal || brief.goal.length < 8) {
    throw new Error('Brief goal must be a string of at least 8 characters');
  }

  const mode = options.mode || inferMode(brief.goal + ' ' + (brief.audience || ''));
  const cfg = MODE_CONFIG[mode];
  if (!cfg) throw new Error(`Unknown mode: ${mode}`);

  const rationale = {
    problem: options.problem || `User needs to achieve: ${brief.goal}`,
    user: options.user || (brief.audience || 'Target user in standard operating environment'),
    trade_off: options.trade_off || `Deliberately prioritizing ${mode === 'operate' ? 'density and scan speed over visual ornament' : mode === 'persuade' ? 'hierarchy and clear single action over comprehensive feature lists' : mode === 'read' ? 'typographic rhythm and sustained legibility over interactive gadgetry' : 'immersion and emotional impact over quick scanability'}`
  };

  const layoutPlan = [];
  const requestedSections = options.sections || (brief.content && brief.content.sections) || cfg.default_families.map(f => f.replace(/-/g, ' '));

  for (let i = 0; i < requestedSections.length; i++) {
    const s = requestedSections[i];
    const secName = typeof s === 'string' ? s : s.name || `Section ${i + 1}`;
    let fam = cfg.default_families[i % cfg.default_families.length];
    if (i > 0 && fam === layoutPlan[i - 1].family) {
      fam = cfg.default_families[(i + 1) % cfg.default_families.length];
    }
    layoutPlan.push({
      section: secName.slice(0, 60),
      family: fam,
      why: `Chosen for mode ${mode} section ${i + 1} to avoid adjacent family repetition.`
    });
  }

  while (layoutPlan.length < 3) {
    const i = layoutPlan.length;
    layoutPlan.push({
      section: `Additional section ${i + 1}`,
      family: cfg.default_families[i % cfg.default_families.length],
      why: `Required minimum section count for valid ruling.`
    });
  }

  const distinctFamilies = new Set(layoutPlan.map(x => x.family));
  if (layoutPlan.length >= 5 && distinctFamilies.size < 3) {
    layoutPlan[1].family = cfg.default_families[(layoutPlan.length - 1) % cfg.default_families.length];
  }

  const bans = Array.from(new Set([...UNIVERSAL_BANS, ...cfg.extra_bans]));

  const decisionsUsed = [];
  const indexPath = join(DECISIONS_DIR, 'index.json');
  if (existsSync(indexPath)) {
    try {
      const idx = JSON.parse(readFileSync(indexPath, 'utf8'));
      for (const entry of (idx.decisions || idx || [])) {
        if (entry.mode && (entry.mode.includes(mode) || entry.mode === mode)) {
          decisionsUsed.push(entry.id);
          if (decisionsUsed.length >= 4) break;
        }
      }
    } catch {
      // index not readable yet
    }
  }
  if (decisionsUsed.length === 0) {
    decisionsUsed.push(`ruling-${mode}-default-v1`);
  }

  const contract = {
    contract_version: '1.0',
    brief: {
      goal: brief.goal,
      audience: brief.audience || 'Target audience for this surface',
      success_metric: brief.success_metric || 'Observed completion of the primary goal'
    },
    mode,
    rationale,
    dials: { ...cfg.dials },
    layout_plan: layoutPlan,
    token_plan: { ...cfg.token_plan },
    bans,
    not_for: cfg.not_for,
    decisions_used: decisionsUsed
  };

  const validation = validateContract(contract);
  if (!validation.valid) {
    throw new Error(`Generated invalid contract: ${validation.errors.join('; ')}`);
  }

  return contract;
}

function inferMode(text) {
  const t = text.toLowerCase();
  if (/dashboard|fleet|admin|setting|table|filter|dispatcher|metric|queue|inventory|billing|crud/.test(t)) return 'operate';
  if (/research|paper|note|article|essay|longform|report|findings|study|book/.test(t)) return 'read';
  if (/exhibition|museum|story|narrative|depth|ambient|journey|art|portfolio/.test(t)) return 'experience';
  return 'persuade';
}
