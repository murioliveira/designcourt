/**
 * designcourt judge: the check set.
 *
 * Every check in spec/CHECKS.md lives here as one object with the same shape:
 *
 *   { check_id, tell_id, severity, title, why, run(ctx) }
 *
 * `run` pushes findings through ctx.add and each finding carries evidence that
 * points at a real line in a real file plus a concrete fix. No check runs a
 * browser, so a check that would need layout geometry says so in `why` and
 * stays conservative instead of inventing a blocker.
 *
 * Banned characters are written as escapes (\u2014, \u2013) so this file itself
 * contains none of them.
 */

import * as D from './dom.mjs';

/* -------------------------------------------------------------------------- */
/* Exported constants: the benchmark cites these, so they live in one place     */
/* -------------------------------------------------------------------------- */

/**
 * DC-101 hue and saturation ban for gradients.
 *
 * Hue is HSL degrees. 225 is the lower bound because the palette this check was
 * built against starts there: the designkit indigo ramp begins at #eef2ff
 * (hue 225.9, which is what --color-primary-soft resolves to through
 * --c-primary-50) and the adjacent blue ramp ends at #2563eb (hue 222.2). The
 * upper bound 300 stops before magenta.
 *
 * Saturation is HSL saturation, and that choice is load bearing: the washed
 * lilac tints that ship in real pages keep roughly 100% HSL saturation
 * (#eef2ff is s=1.0, l=0.97), so a threshold that demanded a mid dark color
 * would miss the exact regression this check exists to close.
 */
export const PURPLE_GRADIENT_BAN = {
  hueMin: 225,
  hueMax: 300,
  satMin: 0.35,
  alphaMin: 0.02,
  note: 'HSL hue 225 to 300 with saturation above 0.35',
};

/**
 * DC-102: a colored blur counts as neon when the shadow color is this
 * saturated and the shadow actually has a blur radius above zero.
 */
export const NEON_GLOW_BAN = {
  satMin: 0.6,
  lightMin: 0.2,
  lightMax: 0.9,
  alphaMin: 0.15,
  minBlurPx: 1,
  note: 'shadow color saturated above 0.6 with a blur radius above 0',
};

/**
 * DC-103: the beige plus brass plus oxblood "premium consumer" palette. Bands
 * are declared here rather than hardcoded per site, and the check only fires
 * when all three bands are present, which is what the ban describes.
 */
export const PREMIUM_CONSUMER_PALETTE = {
  beige: { hueMin: 15, hueMax: 60, satMin: 0.03, satMax: 0.45, lightMin: 0.85, lightMax: 0.99 },
  brass: { hueMin: 28, hueMax: 52, satMin: 0.35, satMax: 0.85, lightMin: 0.28, lightMax: 0.62 },
  oxblood: { hueMin: 340, hueMax: 375, satMin: 0.25, satMax: 0.85, lightMin: 0.12, lightMax: 0.38 },
  note: 'warm paper, brass and oxblood together',
};

/** DC-107 hue families. Hue ranges are half open, and 360 wraps to 0. */
export const HUE_FAMILIES = [
  { name: 'red', min: 345, max: 375 },
  { name: 'orange', min: 15, max: 45 },
  { name: 'yellow', min: 45, max: 70 },
  { name: 'green', min: 70, max: 160 },
  { name: 'teal', min: 160, max: 195 },
  { name: 'blue', min: 195, max: 235 },
  { name: 'indigo', min: 235, max: 260 },
  { name: 'purple', min: 260, max: 300 },
  { name: 'magenta', min: 300, max: 345 },
];

export const FILLER_VERBS = [
  'elevate', 'seamless', 'unleash', 'revolutionize', 'next-gen',
  'transform your', 'supercharge', 'game-changing',
];

export const GENERIC_NAMES = ['Jane Doe', 'John Doe', 'Acme', 'Nexus', 'SmartFlow', 'Lorem ipsum'];

/** DC-108 radius bins. Three tiers are the documented design system pattern. */
export const RADIUS_BINS = [
  { name: 'none', test: (v) => v === 0 },
  { name: 'sm', test: (v) => v > 0 && v <= 8 },
  { name: 'md', test: (v) => v > 8 && v <= 20 },
  { name: 'lg', test: (v) => v > 20 && v <= 48 },
  { name: 'xl', test: (v) => v > 48 && v < 999 },
  { name: 'pill', test: (v, raw) => v >= 999 || /%/.test(raw) },
];

/** DC-108 fires above this many bins: sm + md + pill is a legitimate system. */
export const RADIUS_BIN_LIMIT = 3;

/** DC-312: motion declarations needed before reduced motion is required. */
export const MOTION_RULE_THRESHOLD = 3;

export const LAYOUT_FAMILIES = [
  'hero', 'split-asymmetric', 'zigzag', 'cards-row', 'asymmetric-grid',
  'bento', 'divide-list', 'text-only', 'full-bleed-media', 'scroll-pinned',
  'horizontal', 'sticky-media', 'timeline', 'two-column', 'pricing-table',
  'faq', 'gallery',
];

export const ICON_FAMILIES = [
  'lucide', 'heroicon', 'feather', 'tabler', 'material', 'bootstrap-icons',
  'phosphor', 'radix', 'iconoir', 'octicon', 'ionicons', 'fontawesome', 'fas', 'far', 'fab',
];

export const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}]/u;

/** DC-304: a fake screenshot is a div structure that calls itself a screenshot. */
export const FAKE_SCREENSHOT_HINT = /screenshot|mockup|mock-?ui|fake-?ui|app-?window|browser-?frame|terminal|task-?list|dashboard-?mock|ui-?mock/i;

/* -------------------------------------------------------------------------- */
/* Small local helpers                                                         */
/* -------------------------------------------------------------------------- */

function snippet(text, max = 140) {
  const clean = String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '\u2026' : clean;
}

function describe(el) {
  if (!el || el.type !== 'element') return 'document';
  const id = el.attrs.id ? '#' + el.attrs.id : '';
  const cls = D.classListOf(el)[0] ? '.' + D.classListOf(el)[0] : '';
  return el.tag + id + cls;
}

function pathOf(el) {
  const parts = [];
  let cur = el;
  while (cur && cur.type === 'element' && parts.length < 3) {
    parts.unshift(describe(cur));
    cur = cur.parent;
  }
  return parts.join(' > ');
}

function evidenceFromRule(ctx, rule, decl, extra) {
  const line = decl && rule.lineStarts ? D.lineOfIndex(rule.lineStarts, decl.start) : rule.line;
  const ev = {
    line,
    selector: rule.selector || '(stylesheet)',
    snippet: snippet((decl ? decl.text : rule.selector) + (extra ? ' | ' + extra : '')),
  };
  if (rule.file && rule.file !== ctx.file) ev.file = rule.file;
  return ev;
}

function evidenceFromEl(ctx, el, extra) {
  return {
    line: ctx.lineOf(el.start),
    selector: pathOf(el),
    snippet: snippet((ctx.source.slice(el.start, Math.min(el.end, el.start + 160))) + (extra ? ' | ' + extra : '')),
  };
}

function isColorProp(prop) {
  if (prop === 'color' || prop === 'fill' || prop === 'stroke' || prop === 'caret-color'
    || prop === 'accent-color' || prop === 'text-decoration-color' || prop === 'column-rule-color'
    || prop === 'outline-color' || prop === 'text-emphasis-color' || prop === 'flood-color'
    || prop === 'lighting-color' || prop === 'stop-color') return true;
  return /^(?:background|border|outline|box-shadow|text-shadow|column-rule|text-decoration)/.test(prop);
}

function stripUrls(text) {
  return String(text || '').replace(/url\([^)]*\)/gi, 'url()');
}

/** Every color declaration in the artifact, resolved through the token map. */
function colorFacts(ctx) {
  const facts = [];
  for (const rule of ctx.rules) {
    if (rule.isTokenBlock) continue;
    if (rule.keyframes) continue;
    for (const decl of rule.declarations) {
      if (decl.prop.startsWith('--')) continue;
      if (!isColorProp(decl.prop)) continue;
      const resolved = D.resolveValue(stripUrls(decl.value), ctx.tokens);
      for (const token of D.extractColorTokens(resolved.value)) {
        const color = D.parseColor(token.raw);
        if (!color) continue;
        facts.push({ rule, decl, raw: token.raw, color, hsl: D.rgbToHsl(color), prop: decl.prop });
      }
    }
  }
  return facts;
}

function hueFamily(hue) {
  const h = ((hue % 360) + 360) % 360;
  for (const family of HUE_FAMILIES) {
    if (family.min <= family.max) {
      if (h >= family.min && h < family.max) return family.name;
    } else if (h >= family.min || h < family.max - 360) return family.name;
  }
  if (h >= 345 || h < 15) return 'red';
  return null;
}

function inBand(hsl, band) {
  const hue = ((hsl.h % 360) + 360) % 360;
  const hueOk = hue >= band.hueMin && hue <= band.hueMax;
  return hueOk && hsl.s >= band.satMin && hsl.s <= band.satMax
    && hsl.l >= band.lightMin && hsl.l <= band.lightMax;
}

function lengthToPx(value) {
  const text = String(value || '').trim().toLowerCase();
  const m = /^(-?[\d.]+)(px|rem|em|pt|ch|ex|vh|dvh|vw|%)?$/.exec(text);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] || 'px';
  if (unit === 'rem' || unit === 'em' || unit === 'ch' || unit === 'ex') return n * 16;
  if (unit === 'pt') return n * 1.3333;
  if (unit === '%)' || unit === '%' || unit === 'vh' || unit === 'dvh' || unit === 'vw') return null;
  return n;
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeText(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function sectionElements(ctx) {
  return ctx.sections.map((s) => s.el);
}

function motionEvidence(ctx) {
  const out = [];
  for (const rule of ctx.rules) {
    if (rule.keyframes) continue;
    for (const decl of rule.declarations) {
      if (decl.prop === 'transition' || decl.prop === 'transition-property'
        || decl.prop === 'transition-duration' || decl.prop === 'animation'
        || decl.prop === 'animation-name' || decl.prop === 'animation-duration') {
        out.push({ rule, decl });
      }
    }
  }
  for (const rule of ctx.rules) {
    if (rule.keyframes && rule.keyframes.toLowerCase().indexOf('none') < 0) out.push({ rule, decl: null });
  }
  return out;
}

function hasReducedMotion(ctx) {
  return ctx.rules.some((rule) => rule.media && /prefers-reduced-motion/i.test(rule.media)
    && !/no-preference/i.test(rule.media));
}

function keyframesMap(ctx) {
  const map = {};
  for (const rule of ctx.rules) {
    if (!rule.keyframes) continue;
    const name = rule.keyframes.replace(/^@(?:-webkit-)?keyframes\s*/i, '').trim();
    if (!map[name]) map[name] = [];
    map[name].push(rule);
  }
  return map;
}

function makeCheck(def) {
  return {
    check_id: def.id,
    tell_id: def.tell,
    severity: def.severity,
    title: def.title,
    why: def.why,
    run(ctx) {
      const push = (evidence, fix, why) => ctx.add({
        check_id: def.id,
        tell_id: def.tell,
        severity: def.severity,
        title: def.title,
        evidence,
        fix,
        why: why || def.why,
      });
      def.run(ctx, push);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Checks                                                                      */
/* -------------------------------------------------------------------------- */

const LEXICAL = [
  makeCheck({
    id: 'DC-001',
    tell: 'em-dash',
    severity: 'blocker',
    title: 'Em-dash or en-dash in visible text',
    why: 'The number one AI tell in production tests: a dash where a comma, colon or hyphen belongs.',
    run(ctx, push) {
      const re = /[\u2014\u2013]/;
      const ATTRS = ['alt', 'aria-label', 'title', 'placeholder', 'aria-description'];
      for (const node of ctx.textNodes) {
        if (!re.test(node.text)) continue;
        const at = node.text.search(re);
        push(
          {
            line: ctx.lineOf(node.start + Math.max(0, at)),
            selector: pathOf(node.parent),
            snippet: snippet(node.text.slice(Math.max(0, at - 40), at + 40)),
          },
          'Replace the dash with a comma, colon or plain hyphen: "A, B" or "A: B".',
        );
      }
      for (const el of ctx.elements) {
        for (const name of ATTRS) {
          const value = el.attrs[name];
          if (!value || !re.test(D.decodeHtmlEntities(value))) continue;
          push(
            {
              line: ctx.lineOf(el.start),
              selector: pathOf(el),
              snippet: snippet(name + '="' + value + '"'),
            },
            'Rewrite the attribute text without the dash.',
          );
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-002',
    tell: 'filler-verbs',
    severity: 'major',
    title: 'Filler verb in shipped copy',
    why: 'These verbs promise nothing and are the strongest lexical signal of generated copy.',
    run(ctx, push) {
      const patterns = FILLER_VERBS.map((verb) => ({
        verb,
        re: new RegExp('\\b' + verb.replace(/[-\s]/g, '[-\\s]?').replace(/e$/, '(?:e|es|ed|ing)') + '\\b', 'i'),
      }));
      for (const node of ctx.textNodes) {
        for (const pattern of patterns) {
          const m = pattern.re.exec(node.text);
          if (!m) continue;
          push(
            {
              line: ctx.lineOf(node.start + m.index),
              selector: pathOf(node.parent),
              snippet: snippet(m[0] + ' in "' + node.text.trim().slice(0, 80) + '"'),
            },
            'Replace "' + m[0] + '" with the concrete verb of what the product does.',
          );
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-003',
    tell: 'generic-names',
    severity: 'major',
    title: 'Placeholder name in shipped copy',
    why: 'Jane Doe, Acme and Lorem ipsum mean the copy was never written for a real reader.',
    run(ctx, push) {
      for (const node of ctx.textNodes) {
        for (const name of GENERIC_NAMES) {
          const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i');
          const m = re.exec(node.text);
          if (!m) continue;
          push(
            {
              line: ctx.lineOf(node.start + m.index),
              selector: pathOf(node.parent),
              snippet: snippet(m[0] + ' in "' + node.text.trim().slice(0, 80) + '"'),
            },
            'Use a real, contextual name, or a clearly marked placeholder.',
          );
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-004',
    tell: 'fake-precise-numbers',
    severity: 'major',
    title: 'Fake precise number without a source',
    why: 'A precise figure with no origin reads as invented data, which is the fastest way to lose trust.',
    run(ctx, push) {
      const patterns = [
        /\b\d{1,3}\.\d{1,2}\s?%/g,
        /\b\d+(?:\.\d+)?\s?[x\u00d7]\b/g,
        /\b\d+(?:\.\d+)?k\b/gi,
        /\b\d{1,3}\.\d{1,2}k\b/gi,
      ];
      const blockOf = (el) => {
        let cur = el;
        while (cur && cur.type === 'element' && ['p', 'li', 'span', 'div', 'section', 'td', 'figcaption', 'h1', 'h2', 'h3', 'h4'].indexOf(cur.tag) < 0) cur = cur.parent;
        return cur && cur.type === 'element' ? cur : el;
      };
      for (const node of ctx.textNodes) {
        for (const re of patterns) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(node.text)) !== null) {
            const block = blockOf(node.parent);
            const windowStart = Math.max(0, block.start - 400);
            const window = ctx.source.slice(windowStart, block.end);
            if (/<!--\s*mock\s*-->/i.test(window) || /data-mock\b/i.test(window)) continue;
            if (/<cite\b/i.test(window)) continue;
            if (/(?:\(?\s*(?:source|fonte|origem)\s*:)/i.test(window)) continue;
            push(
              {
                line: ctx.lineOf(node.start + m.index),
                selector: pathOf(node.parent),
                snippet: snippet(m[0] + ' in "' + node.text.trim().slice(0, 90) + '"'),
              },
              'Cite the source inline, mark the block with a mock comment, or drop the precision.',
            );
          }
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-005',
    tell: 'duplicate-cta-intent',
    severity: 'minor',
    title: 'Two primary CTAs ask for the same thing',
    why: 'One intent, one call to action: duplicate primaries split the decision instead of making it.',
    run(ctx, push) {
      const INTENTS = [
        { key: 'contact', words: ['contact', 'contact us', 'contato', 'fale conosco', 'talk to us', 'get in touch'] },
        { key: 'signup', words: ['sign up', 'signup', 'get started', 'start free', 'try free', 'create account', 'comece agora', 'comecar'] },
        { key: 'demo', words: ['book a demo', 'request demo', 'book demo', 'schedule a call', 'talk to sales', 'agende'] },
        { key: 'pricing', words: ['pricing', 'see pricing', 'precos', 'planos'] },
        { key: 'download', words: ['download', 'install', 'baixar'] },
        { key: 'learn', words: ['learn more', 'read more', 'saiba mais', 'see how it works'] },
      ];
      const groups = {};
      for (const el of ctx.elements) {
        if (el.tag !== 'a' && el.tag !== 'button') continue;
        const isPrimary = D.hasClassHint(el, /primary|cta/i)
          || D.ancestorsOf(el).some((a) => a.attrs && /hero/i.test(a.attrs.class || ''));
        if (!isPrimary) continue;
        const label = normalizeText(D.elementText(el));
        if (!label) continue;
        let key = null;
        for (const intent of INTENTS) if (intent.words.indexOf(label) >= 0) { key = intent.key; break; }
        if (!key) key = 'exact:' + label;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ el, label });
      }
      for (const key of Object.keys(groups).sort()) {
        const list = groups[key];
        if (list.length < 2) continue;
        const second = list[1];
        push(
          {
            line: ctx.lineOf(second.el.start),
            selector: pathOf(second.el),
            snippet: snippet(list.map((x) => '"' + D.elementText(x.el) + '"').join(' + ') + ' (intent ' + key + ')'),
          },
          'Keep one primary CTA per intent and demote the rest to a secondary style.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-006',
    tell: 'subtext-length',
    severity: 'minor',
    title: 'Subtext paragraph over 25 words',
    why: 'A section subtext is a caption, not a paragraph: past 25 words nobody reads it.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        if (el.tag !== 'p') continue;
        const isSub = D.hasClassHint(el, /subtext|subtitle|lead|tagline|section-sub|hero-sub|description/i);
        if (!isSub) continue;
        const text = D.elementText(el);
        const count = wordCount(text);
        if (count <= 25) continue;
        push(
          {
            line: ctx.lineOf(el.start),
            selector: pathOf(el),
            snippet: String(count) + ' words: ' + snippet(text, 90),
          },
          'Cut the subtext to one sentence under 25 words and move the rest into the body.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-007',
    tell: 'mixed-language',
    severity: 'minor',
    title: 'Declared lang disagrees with the copy',
    why: 'A page that declares one language and writes another breaks screen readers and translation.',
    run(ctx, push) {
      const html = ctx.elements.find((el) => el.tag === 'html');
      const declared = normalizeText(html ? html.attrs.lang : '').slice(0, 2);
      if (!declared) return;
      const PT = ['de', 'da', 'do', 'que', 'para', 'com', 'uma', 'um', 'os', 'as', 'no', 'na', 'seu', 'sua', 'nao', 'sao', 'mais', 'como', 'por', 'sobre', 'voce', 'entre', 'sem', 'isso', 'pela', 'dos', 'das', 'ao'];
      const EN = ['the', 'and', 'of', 'to', 'in', 'for', 'with', 'you', 'your', 'that', 'is', 'are', 'it', 'on', 'as', 'be', 'this', 'we', 'our', 'not', 'from', 'or', 'at', 'by', 'an', 'will'];
      const counts = (words) => {
        let n = 0;
        for (const w of words) {
          const re = new RegExp('\\b' + w + '\\b', 'gi');
          const m = ctx.visibleText.match(re);
          if (m) n += m.length;
        }
        return n;
      };
      const pt = counts(PT);
      const en = counts(EN);
      const mismatch = (declared === 'pt' && en >= 3 && en > pt * 2)
        || (declared === 'en' && pt >= 3 && pt > en * 2);
      if (!mismatch) return;
      push(
        {
          line: html ? ctx.lineOf(html.start) : 1,
          selector: 'html[lang]',
          snippet: 'lang="' + declared + '", copy scores pt=' + pt + ' en=' + en,
        },
        'Either write the copy in the declared language or fix the lang attribute.',
      );
    },
  }),
  makeCheck({
    id: 'DC-008',
    tell: 'placeholder-as-label',
    severity: 'major',
    title: 'Input has a placeholder instead of a label',
    why: 'Placeholder text disappears on focus and is not a label: the field becomes unlabelled the moment it is used.',
    run(ctx, push) {
      const labelled = new Set();
      for (const el of ctx.elements) {
        if (el.tag === 'label' && el.attrs.for) labelled.add(el.attrs.for);
      }
      for (const el of ctx.elements) {
        if (el.tag !== 'input' && el.tag !== 'textarea' && el.tag !== 'select') continue;
        const type = (el.attrs.type || 'text').toLowerCase();
        if (['hidden', 'submit', 'button', 'reset', 'image'].indexOf(type) >= 0) continue;
        if (!el.attrs.placeholder) continue;
        if (el.attrs['aria-label'] || el.attrs['aria-labelledby']) continue;
        if (el.attrs.id && labelled.has(el.attrs.id)) continue;
        if (D.ancestorsOf(el).some((a) => a.tag === 'label')) continue;
        push(
          evidenceFromEl(ctx, el, 'placeholder="' + el.attrs.placeholder + '" with no label'),
          'Add a visible <label for="..."> above the input and keep the placeholder as an example value.',
        );
      }
    },
  }),
];

const COLOR_AND_SURFACE = [
  makeCheck({
    id: 'DC-101',
    tell: 'purple-gradient',
    severity: 'blocker',
    title: 'Purple, violet or indigo gradient',
    why: 'The named number one AI design tell: a saturated purple wash over a section.',
    run(ctx, push) {
      const seenUnresolved = new Set();
      const inspect = (value, makeEvidence) => {
        for (const gradient of D.extractGradients(value)) {
          const stops = D.gradientColorStops(gradient.args, ctx.tokens);
          let fired = false;
          for (const stop of stops) {
            if (stop.unresolved.length) {
              const key = stop.unresolved.join(',');
              if (!seenUnresolved.has(key)) {
                seenUnresolved.add(key);
                push(
                  makeEvidence(gradient, stop),
                  'Declare ' + stop.unresolved.join(', ') + ' so the judge (and the reader of the CSS) can resolve this color.',
                  'A gradient stop uses ' + stop.unresolved.join(', ') + ' which is declared nowhere in this file or in the tokens file, so no color verdict is possible here.',
                );
              }
              continue;
            }
            const color = D.parseColor(stop.raw);
            if (!color) continue;
            if (color.a <= PURPLE_GRADIENT_BAN.alphaMin) continue;
            const hsl = D.rgbToHsl(color);
            const hue = ((hsl.h % 360) + 360) % 360;
            const banned = hue >= PURPLE_GRADIENT_BAN.hueMin && hue <= PURPLE_GRADIENT_BAN.hueMax
              && hsl.s >= PURPLE_GRADIENT_BAN.satMin;
            if (!banned || fired) continue;
            fired = true;
            push(
              makeEvidence(gradient, stop),
              'Replace the purple stop with a neutral surface or the single declared accent.',
              null,
            );
          }
        }
      };

      for (const rule of ctx.rules) {
        for (const decl of rule.declarations) {
          if (!/gradient/i.test(decl.value)) continue;
          const resolved = D.resolveValue(decl.value, ctx.tokens);
          inspect(resolved.value, (gradient, stop) => {
            const ev = evidenceFromRule(ctx, rule, decl,
              gradient.kind + ' stop ' + stop.raw + ' (hue ' + D.rgbToHsl(D.parseColor(stop.raw) || { r: 0, g: 0, b: 0 }).h.toFixed(0)
              + ', hsl from ' + stop.stop + ')');
            ev.snippet = snippet(decl.text, 220) + ' | stop ' + stop.raw;
            return ev;
          });
        }
      }

      for (const el of ctx.elements) {
        const styleAttr = el.attrs.style;
        if (styleAttr && /gradient/i.test(styleAttr)) {
          const resolved = D.resolveValue(styleAttr, ctx.tokens);
          inspect(resolved.value, () => evidenceFromEl(ctx, el, 'inline style gradient'));
        }
        if (/^(?:linear|radial|conic)Gradient$/i.test(el.tag)) {
          for (const child of el.children) {
            if (child.type !== 'element' || child.tag !== 'stop') continue;
            const raw = child.attrs['stop-color'];
            if (!raw) continue;
            const color = D.parseColor(raw);
            if (!color) continue;
            const hsl = D.rgbToHsl(color);
            const hue = ((hsl.h % 360) + 360) % 360;
            if (hue < PURPLE_GRADIENT_BAN.hueMin || hue > PURPLE_GRADIENT_BAN.hueMax) continue;
            if (hsl.s < PURPLE_GRADIENT_BAN.satMin) continue;
            push(
              evidenceFromEl(ctx, child, 'stop-color="' + raw + '" inside <' + el.tag + '>'),
              'Use a neutral or the single declared accent in the SVG gradient.',
            );
          }
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-102',
    tell: 'neon-glow',
    severity: 'blocker',
    title: 'Neon glow on a saturated color',
    why: 'A saturated colored blur is the second half of the AI purple button look and reads as decoration, not hierarchy.',
    run(ctx, push) {
      const inspect = (rule, decl) => {
        const resolved = D.resolveValue(decl.value, ctx.tokens);
        const numbers = (resolved.value.match(/-?[\d.]+(?=px)/g) || []).map(Number);
        const isFilter = /drop-shadow|blur/i.test(decl.prop);
        const blur = numbers.length >= 3 ? numbers[2] : (isFilter && numbers.length >= 3 ? numbers[2] : null);
        const radius = blur === null && numbers.length >= 3 ? numbers[2] : blur;
        if (radius !== null && radius > 0 && radius < NEON_GLOW_BAN.minBlurPx) return;
        const colors = D.extractColorTokens(resolved.value).map((t) => D.parseColor(t.raw)).filter(Boolean);
        for (const color of colors) {
          if (color.a < NEON_GLOW_BAN.alphaMin) continue;
          const hsl = D.rgbToHsl(color);
          if (hsl.s < NEON_GLOW_BAN.satMin) continue;
          if (hsl.l < NEON_GLOW_BAN.lightMin || hsl.l > NEON_GLOW_BAN.lightMax) continue;
          push(
            evidenceFromRule(ctx, rule, decl, 'saturated blur color hsl(' + hsl.h.toFixed(0) + ', ' + hsl.s.toFixed(2) + ', ' + hsl.l.toFixed(2) + ')'),
            'Drop the colored blur, or replace it with a neutral shadow at low alpha.',
          );
          return;
        }
      };
      for (const rule of ctx.rules) {
        for (const decl of rule.declarations) {
          const prop = decl.prop;
          if (prop === 'box-shadow' || prop === 'text-shadow') inspect(rule, decl);
          else if ((prop === 'filter' || prop === 'backdrop-filter' || prop === '-webkit-backdrop-filter')
            && /drop-shadow/i.test(decl.value)) inspect(rule, decl);
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-103',
    tell: 'premium-consumer-palette',
    severity: 'major',
    title: 'Beige, brass and oxblood as the page palette',
    why: 'The "premium consumer" stack is the second most common AI palette: warm paper, brass and oxblood.',
    run(ctx, push) {
      const facts = colorFacts(ctx).filter((f) => f.color.a > 0.5);
      const found = { beige: null, brass: null, oxblood: null };
      for (const fact of facts) {
        for (const band of ['beige', 'brass', 'oxblood']) {
          if (found[band]) continue;
          if (inBand(fact.hsl, PREMIUM_CONSUMER_PALETTE[band])) found[band] = fact;
        }
      }
      if (!found.beige || !found.brass || !found.oxblood) return;
      const picked = [found.beige, found.brass, found.oxblood];
      const first = picked.slice().sort((a, b) => a.rule.line - b.rule.line)[0];
      push(
        {
          line: first.rule.line,
          selector: first.rule.selector,
          snippet: snippet('beige ' + found.beige.raw + ' (' + found.beige.rule.selector + '), brass '
            + found.brass.raw + ' (' + found.brass.rule.selector + '), oxblood ' + found.oxblood.raw
            + ' (' + found.oxblood.rule.selector + ')', 200),
        },
        'Pick one of the three and rebuild the neutrals around it: cool luxury, forest, black plus tan, cobalt plus cream.',
      );
    },
  }),
  makeCheck({
    id: 'DC-104',
    tell: 'inter-default',
    severity: 'blocker',
    title: 'Inter as the default font',
    why: 'Inter as the first family is the default face of generated UI and flattens every page into the same voice.',
    run(ctx, push) {
      for (const rule of ctx.rules) {
        for (const decl of rule.declarations) {
          if (decl.prop !== 'font-family' && !/^--.*font/.test(decl.prop)) continue;
          const resolved = D.resolveValue(decl.value, ctx.tokens);
          const first = resolved.value.split(',')[0].trim().replace(/^["']|["']$/g, '');
          if (!/^inter$/i.test(first)) continue;
          push(
            evidenceFromRule(ctx, rule, decl, 'first family is Inter'),
            'Use the system stack (system-ui, then the platform faces) or the brand face, not Inter.',
          );
        }
      }
      for (const el of ctx.elements) {
        if (el.tag !== 'link') continue;
        const href = el.attrs.href || '';
        if (href.indexOf('fonts.googleapis') < 0 || href.indexOf('Inter') < 0) continue;
        const families = (href.match(/family=([^&"']+)/) || ['', ''])[1];
        const firstFamily = decodeURIComponent(families.split('|')[0]).split(':')[0];
        if (!/^inter$/i.test(firstFamily)) continue;
        push(
          evidenceFromEl(ctx, el, 'Google Fonts request for Inter'),
          'Remove the Inter request and use the system stack.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-105',
    tell: 'hardcoded-hex',
    severity: 'major',
    title: 'Color literal outside the token block',
    why: 'A raw hex or rgb value in a component bypasses the token system, so the palette drifts one patch at a time.',
    run(ctx, push) {
      const HEX_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/;
      for (const rule of ctx.rules) {
        if (rule.isTokenBlock || rule.keyframes) continue;
        for (const decl of rule.declarations) {
          if (decl.prop.startsWith('--') || !isColorProp(decl.prop)) continue;
          const scrubbed = stripUrls(decl.value);
          if (!HEX_RE.test(scrubbed)) continue;
          const literals = (scrubbed.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g) || []).slice(0, 3);
          push(
            evidenceFromRule(ctx, rule, decl, 'literals: ' + literals.join(', ')),
            'Declare these as custom properties in the token block and reference them with var().',
          );
        }
      }
      for (const el of ctx.elements) {
        if (el.tag === 'meta' && (el.attrs.name || '').toLowerCase() === 'theme-color') continue;
        if (el.tag === 'link' && /icon/i.test(el.attrs.rel || '')) continue;
        const styleAttr = el.attrs.style || '';
        const scrubbed = stripUrls(styleAttr);
        const m = HEX_RE.exec(scrubbed);
        if (m) {
          push(
            evidenceFromEl(ctx, el, 'inline style literal ' + m[0]),
            'Move the color into the token block and reference the token.',
          );
        }
        for (const attr of ['fill', 'stroke', 'bgcolor', 'color', 'stop-color']) {
          const value = el.attrs[attr];
          if (!value || !HEX_RE.test(value)) continue;
          if (/^(?:none|currentColor|inherit)$/i.test(value.trim())) continue;
          push(
            evidenceFromEl(ctx, el, attr + '="' + value + '"'),
            'Use currentColor or a token reference instead of a literal on the SVG attribute.',
          );
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-106',
    tell: 'contrast-aa',
    severity: 'blocker',
    title: 'Text below WCAG AA contrast',
    why: 'Body text under 4.5:1 (or 3:1 for large text) is unreadable for a large share of users.',
    run(ctx, push) {
      const unresolvedNotes = new Set();
      const ASSUMED_CANVAS = D.parseColor('#ffffff');

      const textOwners = [];
      for (const node of ctx.textNodes) {
        if (!node.text.trim()) continue;
        const el = node.parent;
        if (!el || el.type !== 'element') continue;
        if (textOwners.indexOf(el) < 0) textOwners.push(el);
      }

      const seenPairs = new Set();
      for (const el of textOwners) {
        const fg = ctx.resolveProp(el, 'color');
        const bg = ctx.resolveBackground(el);
        if (fg && fg.unresolved && fg.unresolved.length) {
          const key = 'fg:' + fg.unresolved.join(',');
          if (!unresolvedNotes.has(key)) {
            unresolvedNotes.add(key);
            push(
              {
                line: fg.line,
                selector: fg.selector,
                snippet: snippet('color resolves to ' + fg.value + ', ' + fg.unresolved.join(', ') + ' is declared nowhere'),
              },
              'Declare the token so the contrast can be computed.',
              'The text color uses ' + fg.unresolved.join(', ') + ', which no file here declares: the judge will not guess a color it cannot read.',
            );
          }
          continue;
        }
        if (!fg) continue;
        const fgColor = D.parseColor(fg.raw);
        if (!fgColor) continue;
        const bgColor = bg && bg.raw ? D.parseColor(bg.raw) : ASSUMED_CANVAS;
        if (!bgColor || bgColor.a === 0) continue;
        const bgFlat = bgColor.a >= 1 ? bgColor : D.compositeOver(bgColor, ASSUMED_CANVAS);
        const fgFlat = D.compositeOver(fgColor, bgFlat);
        const ratio = D.contrastRatio(fgFlat, bgFlat);

        const sizeProp = ctx.computedProp(el, 'font-size');
        const weightProp = ctx.computedProp(el, 'font-weight');
        const sizePx = sizeProp ? lengthToPx(sizeProp.value) : null;
        const weight = weightProp ? parseInt(weightProp.value, 10) : NaN;
        const isLarge = sizePx !== null && (sizePx >= 24 || (sizePx >= 18.66 && Number.isFinite(weight) && weight >= 700));
        const threshold = isLarge ? 3 : 4.5;
        if (ratio >= threshold) continue;

        const pairKey = fg.raw + '|' + (bg ? bg.raw : 'assumed-white') + '|' + String(threshold);
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        const bgNote = bg && bg.raw ? ('background ' + bg.raw + ' from ' + bg.selector) : 'background assumed as the white canvas (no background declared)';
        const sizeNote = sizeProp && sizePx !== null
          ? ('font-size ' + sizeProp.value)
          : 'font-size could not be resolved, so the 4.5:1 body threshold is applied';
        push(
          {
            line: fg.line,
            selector: fg.selector,
            snippet: snippet(fg.raw + ' on ' + (bg && bg.raw ? bg.raw : '#ffffff') + ' = ' + ratio.toFixed(2) + ':1, needs '
              + threshold + ':1 (' + bgNote + '; ' + sizeNote + ')', 220),
          },
          'Darken the text token or lighten the surface until the pair clears ' + threshold + ':1.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-107',
    tell: 'multi-accent',
    severity: 'major',
    title: 'More than one accent hue family',
    why: 'One accent per page is the lock: a second saturated hue family breaks the color hierarchy.',
    run(ctx, push) {
      const counts = {};
      const firstFact = {};
      for (const rule of ctx.rules) {
        if (rule.isTokenBlock || rule.keyframes) continue;
        for (const decl of rule.declarations) {
          if (decl.prop.startsWith('--') || !isColorProp(decl.prop)) continue;
          const resolved = D.resolveValue(stripUrls(decl.value), ctx.tokens);
          for (const token of D.extractColorTokens(resolved.value)) {
            const color = D.parseColor(token.raw);
            if (!color) continue;
            if (color.a < 0.9) continue;
            const hsl = D.rgbToHsl(color);
            if (hsl.s < 0.5 || hsl.l < 0.2 || hsl.l > 0.8) continue;
            const family = hueFamily(hsl.h);
            if (!family) continue;
            counts[family] = (counts[family] || 0) + 1;
            if (!firstFact[family]) firstFact[family] = { rule, decl, raw: token.raw, hsl };
          }
        }
      }
      const families = Object.keys(counts).filter((name) => counts[name] >= 2).sort();
      if (families.length < 2) return;
      const first = firstFact[families[0]];
      push(
        {
          line: first.rule.line,
          selector: first.rule.selector,
          snippet: snippet(families.map((name) => name + ' (' + counts[name] + ' uses, e.g. ' + firstFact[name].raw + ' at line ' + firstFact[name].rule.line + ')').join('; '), 220),
        },
        'Keep the accent you use most, and rebuild the second hue as a neutral or a tint of the first.',
      );
    },
  }),
  makeCheck({
    id: 'DC-108',
    tell: 'mixed-radii',
    severity: 'minor',
    title: 'More than one radius scale in use',
    why: 'A shape lock means one radius language: mixing scales is visible even when nobody can name it.',
    run(ctx, push) {
      const binsSeen = {};
      const binFacts = {};
      for (const rule of ctx.rules) {
        if (rule.isTokenBlock || rule.keyframes) continue;
        for (const decl of rule.declarations) {
          if (decl.prop !== 'border-radius' && !/^border-(?:top|bottom|left|right)?-?radius/.test(decl.prop)) continue;
          const resolved = D.resolveValue(decl.value, ctx.tokens);
          const values = D.splitTopLevel(resolved.value, '/')[0].trim().split(/\s+/).filter(Boolean);
          for (const value of values) {
            if (/^(?:0|none)$/.test(value)) { binsSeen.none = true; binFacts.none = binFacts.none || { rule, decl, raw: value }; continue; }
            const bin = RADIUS_BINS.find((b) => {
              const px = lengthToPx(value);
              if (px === null) return b.name === 'pill' && /%/.test(value);
              return b.test(px, value);
            });
            if (!bin) continue;
            binsSeen[bin.name] = true;
            if (!binFacts[bin.name]) binFacts[bin.name] = { rule, decl, raw: value };
          }
        }
      }
      const names = RADIUS_BINS.map((b) => b.name).filter((n) => binsSeen[n]);
      if (names.length <= RADIUS_BIN_LIMIT) return;
      const offender = binFacts[names[names.length - 1]];
      push(
        evidenceFromRule(ctx, offender.rule, offender.decl, 'radius bins in use: ' + names.join(', ')),
        'Pick one radius scale (for example sm inputs, md cards, pill buttons) and delete the rest.',
      );
    },
  }),
];

const LAYOUT = [
  makeCheck({
    id: 'DC-201',
    tell: 'three-equal-cards',
    severity: 'blocker',
    title: 'Three or more equal cards in one row',
    why: 'The named banned layout: three identical cards in a line is a grid standing in for a decision.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        if (el.tag === 'ul' || el.tag === 'ol' || el.tag === 'select' || el.tag === 'nav' || el.tag === 'tr') continue;
        const children = el.children.filter((c) => c.type === 'element');
        if (children.length < 3) continue;
        const shapeOf = (child) => {
          const tags = [];
          D.walk(child, (n) => { if (n.type === 'element' && tags.length < 6) tags.push(n.tag); });
          const head = tags.find((t) => /^h[1-6]$/.test(t));
          const para = tags.indexOf('p') >= 0;
          const media = tags.some((t) => /^(?:img|picture|svg|video|figure)$/.test(t));
          return head ? 'card:' + (para ? 'text' : 'plain') + (media ? '+media' : '') : null;
        };
        const shapes = children.map(shapeOf);
        if (shapes.some((s) => s === null)) continue;
        const counts = {};
        for (const s of shapes) counts[s] = (counts[s] || 0) + 1;
        const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
        if (counts[dominant] < 3) continue;
        const classes = children.map((c) => D.classSignatureOf(c));
        const sameClass = classes[0] !== '' && classes.every((c) => c === classes[0]);

        const trackInfo = ctx.computedProp(el, 'grid-template-columns');
        let equalTracks = false;
        let trackText = '';
        if (trackInfo) {
          const resolved = D.resolveValue(trackInfo.value, ctx.tokens).value;
          const tracks = D.splitTopLevel(resolved, '/')[0].trim();
          trackText = tracks;
          const repeatMatch = /repeat\(\s*(\d+)\s*,/.exec(tracks);
          const tokens = tracks.split(/\s+/).filter(Boolean);
          if (repeatMatch) equalTracks = true;
          else if (tokens.length >= 3 && tokens.every((t) => t === tokens[0] || /^1fr$/.test(t))) equalTracks = true;
          else if (/^1fr$/.test(tokens[0] || '') && tokens.length >= 3) equalTracks = true;
        }
        const flexInfo = ctx.computedProp(el, 'flex') || ctx.computedProp(el, 'flex-basis');
        if (!equalTracks && !sameClass && !flexInfo) continue;
        if (!equalTracks && sameClass && counts[dominant] < children.length) continue;

        push(
          evidenceFromEl(ctx, el, children.length + ' children of shape ' + dominant
            + (equalTracks ? (', equal grid tracks "' + trackText + '"') : sameClass ? ', identical classes "' + classes[0] + '"' : ', equal flex basis')),
          'Rebuild the row as an asymmetric grid or a zigzag, or make one card genuinely dominant.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-202',
    tell: 'repeated-zigzag',
    severity: 'major',
    title: 'Repeated image plus text zigzag',
    why: 'Past two sections the alternation stops reading as rhythm and starts reading as a template.',
    run(ctx, push) {
      const oriented = [];
      for (const el of ctx.elements) {
        if (el.tag !== 'section' && !D.hasClassHint(el, /section/i)) continue;
        const media = el.children.map((c) => c).find((c) => c.type === 'element' && /^(?:img|picture|svg|video|figure|div)$/.test(c.tag)
          && (/^(?:img|picture|video|figure)$/.test(c.tag) || D.hasClassHint(c, /media|image|visual|shot/i)));
        const hasText = /<h[1-4][\s>]/.test(ctx.source.slice(el.start, el.end));
        if (!media || !hasText) continue;
        const reversed = D.hasClassHint(el, /reverse|flip|swap|alternat|even/i)
          || (ctx.computedProp(el, 'flex-direction') || {}).value === 'row-reverse'
          || !!ctx.computedProp(el, 'direction')
          || D.hasClassHint(media, /order|reverse/i);
        oriented.push({ el, side: reversed ? 'left' : 'right' });
      }
      let run = 1;
      for (let i = 1; i < oriented.length; i += 1) {
        const alternates = oriented[i].side !== oriented[i - 1].side;
        run = alternates ? run + 1 : 1;
        if (run < 3) continue;
        if (run > 3) continue;
        const group = oriented.slice(i - 2, i + 1);
        push(
          evidenceFromEl(ctx, oriented[i].el, 'sections ' + group.map((g) => describe(g.el) + '(' + g.side + ')').join(' then ')),
          'Break the run: make the third section a different family (full bleed, asymmetric grid, list).',
          'Three consecutive media plus text sections with alternating sides is the repeated zigzag. Only DOM order and declared reversal were read, so the visual side is inferred from structure.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-203',
    tell: 'bento-empty-cell',
    severity: 'major',
    title: 'Bento grid with an empty or identical cell',
    why: 'A bento needs exactly as many cells as contents: a filler cell is a visible hole in the composition.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        const isBento = D.hasClassHint(el, /bento/i) || !!ctx.computedProp(el, 'grid-template-areas');
        if (!isBento) continue;
        const cells = el.children.filter((c) => c.type === 'element');
        if (cells.length < 2) continue;
        const empty = cells.filter((cell) => {
          const text = D.elementText(cell);
          const hasMedia = cell.children.some((c) => c.type === 'element' && /^(?:img|picture|svg|video|canvas)$/.test(c.tag));
          return text === '' && !hasMedia;
        });
        const classes = cells.map((c) => D.classSignatureOf(c));
        const identical = cells.length >= 3 && classes[0] !== '' && classes.every((c) => c === classes[0]);
        if (!empty.length && !identical) continue;
        push(
          evidenceFromEl(ctx, el, cells.length + ' cells, ' + empty.length + ' empty'
            + (identical ? ', all cells share the class "' + classes[0] + '"' : '')),
          empty.length
            ? 'Give the empty cell real content or drop it and let the grid reflow to N cells for N contents.'
            : 'Give two or three cells a real visual variation (media, brand tint, pattern) instead of identical styling.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-204',
    tell: 'split-header',
    severity: 'major',
    title: 'Split header: headline left, loose paragraph right',
    why: 'A two column section header splits a single thought across the page and reads as machine layout.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        const children = el.children.filter((c) => c.type === 'element');
        if (children.length !== 2) continue;
        const heading = children.find((c) => /^h[1-3]$/.test(c.tag));
        const para = children.find((c) => c.tag === 'p');
        if (!heading || !para) continue;
        if (/<(?:a|button)\b/i.test(ctx.source.slice(para.start, para.end))) continue;
        const displayInfo = ctx.computedProp(el, 'display');
        const gridInfo = ctx.computedProp(el, 'grid-template-columns');
        const twoCol = (displayInfo && /^(?:flex|grid)$/.test(displayInfo.value))
          || D.hasClassHint(el, /split|two-col|cols-2|header-row|head-row/i)
          || (gridInfo && (D.splitTopLevel(D.resolveValue(gridInfo.value, ctx.tokens).value, ' ').filter(Boolean).length >= 2));
        if (!twoCol) continue;
        const isHeader = el.tag === 'header'
          || D.hasClassHint(el, /header|head|intro|section-top/i)
          || (el.parent && (el.parent.tag === 'section' || D.hasClassHint(el.parent, /section/i)));
        if (!isHeader) continue;
        push(
          evidenceFromEl(ctx, el, 'headline "' + snippet(D.elementText(heading), 50) + '" beside a paragraph with no CTA'),
          'Stack the headline and the paragraph vertically, or move the paragraph into the section body.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-205',
    tell: 'h-screen',
    severity: 'minor',
    title: 'Height in vh instead of dvh',
    why: 'vh does not follow the mobile browser chrome, so the section is clipped or leaves a gap on phones.',
    run(ctx, push) {
      for (const rule of ctx.rules) {
        for (const decl of rule.declarations) {
          if (!/^(?:height|min-height|max-height)$/.test(decl.prop)) continue;
          if (!/[\d.]+v[hwd]\b/.test(decl.value)) continue;
          if (!/\d+(?:\.\d+)?vh\b/.test(decl.value)) continue;
          push(
            evidenceFromRule(ctx, rule, decl, 'vh unit in a height'),
            'Use dvh (min-height: 100dvh) or auto height for that section.',
          );
        }
      }
      for (const el of ctx.elements) {
        const hit = D.classListOf(el).find((c) => /^(?:min-)?h-screen$/.test(c) || /\[100vh\]/.test(c));
        if (!hit) continue;
        push(
          evidenceFromEl(ctx, el, 'class "' + hit + '"'),
          'Swap the class for the dvh equivalent (min-h-100dvh).',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-206',
    tell: 'low-layout-diversity',
    severity: 'major',
    title: 'Fewer than four layout families in a long page',
    why: 'Eight or more sections need at least four different layout families, otherwise the page is one block repeated.',
    run(ctx, push) {
      if (ctx.sections.length < 8) return;
      const families = ctx.families;
      if (families.length >= 4) return;
      push(
        {
          line: ctx.lineOf(ctx.sections[0].el.start),
          selector: pathOf(ctx.sections[0].el),
          snippet: ctx.sections.length + ' sections, families: ' + families.join(', '),
        },
        'Give at least four sections a different family: full bleed, asymmetric grid, zigzag, list, horizontal.',
      );
    },
  }),
];

const STRUCTURE = [
  makeCheck({
    id: 'DC-301',
    tell: 'eyebrow-density',
    severity: 'minor',
    title: 'Too many eyebrows',
    why: 'One eyebrow per three sections maximum (the hero counts as one), otherwise every section shouts the same way.',
    run(ctx, push) {
      const eyebrows = [];
      for (const el of ctx.elements) {
        if (D.hasClassHint(el, /eyebrow|kicker|overline|section-label/i)) { eyebrows.push(el); continue; }
        const styleAttr = el.attrs.style || '';
        if (/text-transform\s*:\s*uppercase/i.test(styleAttr) && /letter-spacing/i.test(styleAttr)) eyebrows.push(el);
      }
      const sections = Math.max(1, ctx.sections.length || ctx.elements.filter((e) => e.tag === 'section').length);
      const limit = Math.ceil(sections / 3);
      if (eyebrows.length <= limit) return;
      push(
        evidenceFromEl(ctx, eyebrows[limit], eyebrows.length + ' eyebrows in ' + sections + ' sections, limit ' + limit),
        'Delete the eyebrows past the limit and let the headline carry the section.',
      );
    },
  }),
  makeCheck({
    id: 'DC-302',
    tell: 'scroll-cues',
    severity: 'major',
    title: 'Scroll cue',
    why: 'Telling the reader to scroll means the layout did not make it obvious: the hero owes the cue, not a label.',
    run(ctx, push) {
      const arrow = /[\u2193\u25bc]/;
      for (const node of ctx.textNodes) {
        const wordMatch = /\bscroll\b/i.exec(node.text);
        const arrowMatch = arrow.exec(node.text);
        if (!wordMatch && !arrowMatch) continue;
        const at = wordMatch ? wordMatch.index : arrowMatch.index;
        push(
          {
            line: ctx.lineOf(node.start + at),
            selector: pathOf(node.parent),
            snippet: snippet(node.text.trim().slice(0, 90)),
          },
          'Remove the instruction and let the next section peek into the first viewport.',
        );
      }
      for (const el of ctx.elements) {
        for (const name of ['aria-label', 'title', 'data-cue']) {
          const value = el.attrs[name];
          if (!value || !/\bscroll\b/i.test(value)) continue;
          push(
            evidenceFromEl(ctx, el, name + '="' + value + '"'),
            'Rename the control for its action instead of the scrolling.',
          );
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-303',
    tell: 'decorative-chrome',
    severity: 'minor',
    title: 'Decorative chrome',
    why: 'Status dots, caps strips in the hero footer and labels over images are decoration pretending to be information.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        if (D.hasClassHint(el, /(?:^|[-_])(?:status-)?dot(?:$|[-_])|pulse-dot|indicator-dot/i)) {
          if (D.elementText(el) === '') {
            push(evidenceFromEl(ctx, el, 'empty decorative dot'), 'Remove the dot or give it a real state to communicate.');
          }
        }
        const text = D.elementText(el);
        if (text && /(?:[A-Z][A-Z0-9]{1,}\s*[.\u00b7|]\s*){2,}[A-Z][A-Z0-9]{1,}/.test(text) && D.hasClassHint(el, /strip|band|caps|meta-row|footer-note/i)) {
          push(evidenceFromEl(ctx, el, 'caps strip: ' + snippet(text, 60)), 'Cut the caps strip; the brand belongs in the logo and the copy.');
        }
        if (D.hasClassHint(el, /overlay|over-image|media-label|image-label/i) && D.hasClassHint(el, /pill|badge|label|chip|tag/i)) {
          push(evidenceFromEl(ctx, el, 'label over media'), 'Put the label in the layout flow, not on top of the image.');
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-304',
    tell: 'fake-screenshot',
    severity: 'blocker',
    title: 'Fake screenshot built from divs',
    why: 'A UI made of rectangles is a lie about the product: use the real component, a real image or nothing.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        const label = [el.attrs.class || '', el.attrs.id || '', el.attrs['aria-label'] || '', el.attrs['data-testid'] || ''].join(' ');
        if (FAKE_SCREENSHOT_HINT.test(label)) {
          push(
            evidenceFromEl(ctx, el, 'element names itself "' + snippet(label, 40) + '"'),
            'Render the real component, or use a real screenshot, or remove the mock.',
          );
          continue;
        }
        const children = el.children.filter((c) => c.type === 'element');
        if (children.length < 6) continue;
        const rectangles = children.filter((c) => {
          const empty = D.elementText(c) === '';
          const noMedia = !c.children.some((n) => n.type === 'element' && /^(?:img|picture|svg|video)$/.test(n.tag));
          const looksRect = D.hasClassHint(c, /bar|row|line|rect|block|cell|placeholder|skeleton|box|chart/i)
            || /\b(?:width|height)\b/.test(c.attrs.style || '');
          return empty && noMedia && looksRect;
        });
        if (rectangles.length < 6) continue;
        push(
          evidenceFromEl(ctx, el, rectangles.length + ' text free rectangles in one container'),
          'Replace the rectangle mock with a real component or a real image.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-305',
    tell: 'fake-credits',
    severity: 'minor',
    title: 'Photo credit with no photograph',
    why: 'A credit line implies a photograph exists: crediting a person next to a div built mock is a false attribution.',
    run(ctx, push) {
      const creditRe = /(?:photo|photograph|image|picture)\s*(?:by|:)|cr[e\u00e9]ditos?\s*(?:de|:)/i;
      const hit = ctx.textNodes.find((node) => creditRe.test(node.text));
      if (!hit) return;
      const realImages = ctx.elements.filter((el) => el.tag === 'img'
        && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(el.attrs.src || ''));
      if (realImages.length) return;
      push(
        {
          line: ctx.lineOf(hit.start),
          selector: pathOf(hit.parent),
          snippet: snippet(hit.text.trim(), 90),
        },
        'Remove the credit line or add the real photograph it refers to.',
      );
    },
  }),
  makeCheck({
    id: 'DC-306',
    tell: 'version-footer',
    severity: 'major',
    title: 'Version or build number in a marketing footer',
    why: 'A marketing page is not a changelog: shipping "v0.6" in the footer reads as an internal build.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        const isFooter = el.tag === 'footer' || D.hasClassHint(el, /footer/i);
        if (!isFooter) continue;
        const text = D.elementText(el);
        const m = /(?:\bv\s?\d+(?:\.\d+)+|\bbuild\s*\d+|\bversion\s*\d+(?:\.\d+)*|\bbeta\s*\d+)/i.exec(text);
        if (!m) continue;
        push(
          evidenceFromEl(ctx, el, 'footer text: ' + snippet(text, 70)),
          'Move the build number into the repository or an internal status page.',
        );
        break;
      }
    },
  }),
  makeCheck({
    id: 'DC-307',
    tell: 'numbered-eyebrow',
    severity: 'major',
    title: 'Numbered eyebrow',
    why: 'Numbers over sections (00, INDEX, 001.Capabilities) are the AI slide deck applied to a web page.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        if (!D.hasClassHint(el, /eyebrow|kicker|overline|section-label/i)) continue;
        const text = (D.elementText(el) || '').trim();
        if (!text) continue;
        const numbered = /^\s*\(?\d{2,3}\b/.test(text)
          || /^\s*\(?\d{1,3}\)?[.)\u00b7:/\s]/.test(text) && /^\s*\d/.test(text)
          || /^index\b/i.test(text)
          || /\d{2,3}\s*[\u00b7|/]\s*[A-Za-z]/.test(text);
        if (!numbered) continue;
        push(evidenceFromEl(ctx, el, 'eyebrow text "' + snippet(text, 40) + '"'), 'Drop the number; the eyebrow word is enough.');
      }
    },
  }),
  makeCheck({
    id: 'DC-308',
    tell: 'emoji-as-icon',
    severity: 'minor',
    title: 'Emoji used as a UI icon',
    why: 'Emoji render differently on every platform and read as filler where an icon was needed.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        const text = D.elementText(el);
        if (!text || !EMOJI_RE.test(text)) continue;
        const isIconSlot = el.tag === 'button' || el.tag === 'a'
          || D.hasClassHint(el, /icon|badge|chip|feature-icon|stat|benefit/i);
        if (!isIconSlot) continue;
        if (el.tag !== 'button' && el.tag !== 'a' && !!D.elementText(el).replace(EMOJI_RE, '').trim() === false) continue;
        push(
          evidenceFromEl(ctx, el, 'emoji in an icon slot: ' + snippet(text, 30)),
          'Use one icon family in SVG, or drop the symbol.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-309',
    tell: 'mixed-icon-family',
    severity: 'minor',
    title: 'Mixed icon families or stroke widths',
    why: 'Two icon families or two stroke widths in one page is the most visible sign that components came from different places.',
    run(ctx, push) {
      const families = [];
      const widths = [];
      const facts = [];
      for (const el of ctx.elements) {
        const hay = [el.attrs.class || '', el.attrs['data-icon'] || '', el.attrs['data-lucide'] || ''].join(' ');
        for (const family of ICON_FAMILIES) {
          if (new RegExp('(?:^|[\\s-])' + family + '(?:[\\s-]|$)', 'i').test(hay)) {
            if (families.indexOf(family) < 0) families.push(family);
            facts.push({ el, family });
            break;
          }
        }
        const width = el.attrs['stroke-width']
          || (ctx.computedProp(el, 'stroke-width') || {}).value
          || null;
        if (width && el.tag === 'svg') {
          const clean = String(width).trim();
          if (widths.indexOf(clean) < 0) widths.push(clean);
          if (facts.every((f) => f.el !== el)) facts.push({ el, stroke: clean });
        }
      }
      const namedFamilies = families.filter((f) => /^inline$/.test(f) === false);
      if (namedFamilies.length >= 2) {
        const target = facts.find((f) => f.family === namedFamilies[1]);
        push(
          evidenceFromEl(ctx, target ? target.el : ctx.elements[0], 'families: ' + namedFamilies.join(', ')),
          'Pick one icon family for the whole page and delete the other imports.',
        );
        return;
      }
      if (widths.length >= 2) {
        const target = facts.find((f) => f.stroke);
        push(
          evidenceFromEl(ctx, target ? target.el : ctx.elements[0], 'stroke widths: ' + widths.join(', ')),
          'Normalize every icon on one stroke width (1.5 is a safe default).',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-310',
    tell: 'scroll-listener-animation',
    severity: 'major',
    title: 'Scroll listener driving an animation',
    why: 'A scroll listener in the animation path is the classic jank source: use IntersectionObserver or scroll driven CSS.',
    run(ctx, push) {
      for (const node of ctx.scriptNodes) {
        const re = /(?:window|document|self)\s*\.\s*addEventListener\s*\(\s*['"]scroll['"]|(?:window|document)\.onscroll\s*=|\bon\s*=\s*['"]scroll/i;
        const m = re.exec(node.text);
        if (!m) continue;
        const around = node.text.slice(Math.max(0, m.index - 200), m.index + 600);
        const drivesAnimation = /style\s*\.|classList|transform|translate|opacity|scrollY|scrollTop|requestAnimationFrame|animate\(|\.animate\b/.test(around);
        if (!drivesAnimation) continue;
        push(
          {
            line: ctx.lineOf(node.start + m.index),
            selector: 'script',
            snippet: snippet(m[0] + ' ... ' + around.slice(m.index === 0 ? 0 : 200, 260)),
          },
          'Replace the scroll listener with an IntersectionObserver or a scroll driven CSS animation.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-311',
    tell: 'property-animation',
    severity: 'minor',
    title: 'Transition or animation on a layout property',
    why: 'Animating width, height, top or left forces layout on every frame: animate transform and opacity instead.',
    run(ctx, push) {
      const keyframes = keyframesMap(ctx);
      const PROPS = ['width', 'height', 'top', 'left'];
      for (const rule of ctx.rules) {
        if (rule.keyframes) continue;
        for (const decl of rule.declarations) {
          if (decl.prop === 'transition' || decl.prop === 'transition-property') {
            const hits = PROPS.filter((p) => new RegExp('\\b' + p + '\\b').test(decl.value));
            const all = /\ball\b/.test(decl.value);
            if (!hits.length && !all) continue;
            push(
              evidenceFromRule(ctx, rule, decl, hits.length ? 'animating ' + hits.join(', ') : 'transition: all covers layout properties'),
              hits.length
                ? 'Animate transform and opacity; move the layout change out of the transition.'
                : 'List the animated properties explicitly instead of "all".',
            );
            continue;
          }
          if (decl.prop === 'animation' || decl.prop === 'animation-name') {
            const name = decl.value.split(/\s+/).filter((t) => !/^[\d.]+m?s$/.test(t) && !/^(?:linear|ease|ease-in|ease-out|ease-in-out|infinite|alternate|forwards|backwards|both|running|paused|normal|reverse)$/.test(t))[0];
            if (!name || !keyframes[name]) continue;
            const bad = [].concat(...keyframes[name].map((k) => k.declarations.filter((d) => PROPS.indexOf(d.prop) >= 0).map((d) => d.prop)));
            if (!bad.length) continue;
            push(
              evidenceFromRule(ctx, rule, decl, 'keyframes ' + name + ' animates ' + bad.join(', ')),
              'Rewrite the keyframes on transform and opacity only.',
            );
          }
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-312',
    tell: 'reduced-motion-missing',
    severity: 'major',
    title: 'Motion without prefers-reduced-motion handling',
    why: 'Any real motion needs a reduced motion branch that collapses it to static; without it the page is unusable for some readers.',
    run(ctx, push) {
      const motion = motionEvidence(ctx);
      if (motion.length < MOTION_RULE_THRESHOLD) return;
      if (hasReducedMotion(ctx)) return;
      const first = motion[0];
      push(
        first.decl
          ? evidenceFromRule(ctx, first.rule, first.decl, motion.length + ' motion declarations, no prefers-reduced-motion block')
          : evidenceFromEl(ctx, ctx.elements[0], motion.length + ' motion declarations, no prefers-reduced-motion block'),
        'Add @media (prefers-reduced-motion: reduce) that removes the transitions and animations.',
      );
    },
  }),
  makeCheck({
    id: 'DC-313',
    tell: 'multi-marquee',
    severity: 'minor',
    title: 'More than one marquee',
    why: 'One marquee is a device, two are a tic: the eye has nowhere to land.',
    run(ctx, push) {
      const elements = ctx.elements.filter((el) => D.hasClassHint(el, /marquee|ticker/i));
      const keyframes = keyframesMap(ctx);
      const marqueeKeyframes = Object.keys(keyframes).filter((name) => /marquee|ticker/i.test(name));
      if (elements.length < 2 && !(marqueeKeyframes.length && elements.length >= 2)) {
        if (elements.length + marqueeKeyframes.length < 2) return;
      }
      if (elements.length < 2) return;
      push(
        evidenceFromEl(ctx, elements[1], elements.length + ' marquee or ticker elements'),
        'Keep the one marquee that carries content and delete the rest.',
      );
    },
  }),
  makeCheck({
    id: 'DC-314',
    tell: 'text-logo-wall',
    severity: 'minor',
    title: 'Logo wall built from text wordmarks',
    why: 'Wordmarks in text are not a logo wall: the row reads as a list of words pretending to be trust.',
    run(ctx, push) {
      for (const el of ctx.elements) {
        if (!D.hasClassHint(el, /logo|clients|trusted|brands|parceiros/i)) continue;
        const children = el.children.filter((c) => c.type === 'element');
        if (children.length < 3) continue;
        const textOnly = children.filter((c) => D.elementText(c) !== ''
          && !c.children.some((n) => n.type === 'element' && /^(?:svg|img|picture)$/.test(n.tag)));
        if (textOnly.length < 3) continue;
        push(
          evidenceFromEl(ctx, el, children.length + ' children, ' + textOnly.length + ' with text and no mark'),
          'Use real SVG logo marks, or drop the wall and say who the clients are in copy.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-315',
    tell: 'nav-too-tall',
    severity: 'minor',
    title: 'Navigation too tall or wrapping',
    why: 'A navigation above 80px or on two lines at desktop eats the first viewport.',
    run(ctx, push) {
      const navRules = ctx.rules.filter((rule) => /(?:^|[\s,>])(?:nav|header|navbar|site-header|main-nav)\b/i.test(rule.selector));
      for (const rule of navRules) {
        let vertical = 0;
        let sawHeight = false;
        let heightDecl = null;
        for (const decl of rule.declarations) {
          if (/^(?:height|min-height)$/.test(decl.prop)) {
            const px = lengthToPx(D.resolveValue(decl.value, ctx.tokens).value);
            if (px !== null) { vertical = Math.max(vertical, px); sawHeight = true; heightDecl = decl; }
          }
          if (/^padding(?:-top|-bottom)?$/.test(decl.prop)) {
            const parts = D.resolveValue(decl.value, ctx.tokens).value.split(/\s+/).filter(Boolean);
            const first = lengthToPx(parts[0]);
            const second = parts.length > 2 ? lengthToPx(parts[2]) : first;
            if (first !== null && second !== null) {
              const sum = first + second;
              if (sum > vertical) { vertical = sum; heightDecl = decl; }
            }
          }
        }
        if (!sawHeight && !heightDecl) continue;
        if (vertical <= 80) continue;
        push(
          evidenceFromRule(ctx, rule, heightDecl, 'nav vertical size about ' + Math.round(vertical) + 'px'),
          'Bring the navigation to 64 to 72px on desktop and keep it on one line.',
        );
        break;
      }
      const nav = ctx.elements.find((el) => el.tag === 'nav' || D.hasClassHint(el, /navbar|site-header/i));
      if (!nav) return;
      const links = ctx.elements.filter((el) => el.tag === 'a' && D.ancestorsOf(el).indexOf(nav) >= 0);
      if (links.length <= 8) return;
      push(
        evidenceFromEl(ctx, nav, links.length + ' links in the navigation'),
        'Cut the navigation to the primary paths and move the rest to the footer.',
        'Link count is a wrap risk estimate: the judge cannot measure rendered line count without a browser.',
      );
    },
  }),
  makeCheck({
    id: 'DC-316',
    tell: 'hero-discipline',
    severity: 'major',
    title: 'Hero breaks its discipline',
    why: 'The hero must fit the first viewport: two headline lines, a subtext under 20 words, at most four text elements, padding under 6rem.',
    run(ctx, push) {
      const hero = ctx.elements.find((el) => D.hasClassHint(el, /hero/i));
      if (!hero) return;
      const violations = [];
      let estimated = true;
      const h1 = ctx.elements.find((el) => el.tag === 'h1' && D.ancestorsOf(el).indexOf(hero) >= 0);
      if (h1) {
        const inner = ctx.source.slice(h1.start, h1.end);
        const brs = (inner.match(/<br\b/gi) || []).length;
        const text = D.elementText(h1);
        if (brs) {
          estimated = false;
          if (brs + 1 > 2) violations.push('headline is ' + (brs + 1) + ' lines (explicit breaks)');
        } else if (text.length > 60) {
          violations.push('headline is about ' + Math.ceil(text.length / 60) + ' lines at 60 characters per line (estimated)');
        }
      }
      const subtext = hero.children.find((c) => c.type === 'element' && (c.tag === 'p' || D.hasClassHint(c, /sub|lead|tagline/i)));
      if (subtext) {
        const words = wordCount(D.elementText(subtext));
        if (words > 20) { estimated = false; violations.push('subtext is ' + words + ' words (limit 20)'); }
      }
      const paddingRule = ctx.rules.find((rule) => /hero/i.test(rule.selector)
        && rule.declarations.some((d) => /^padding(?:-top)?$/.test(d.prop)));
      if (paddingRule) {
        const decl = paddingRule.declarations.find((d) => /^padding(?:-top)?$/.test(d.prop));
        const parts = D.resolveValue(decl.value, ctx.tokens).value.split(/\s+/).filter(Boolean);
        const px = lengthToPx(parts[0]);
        if (px !== null && px > 96) { estimated = false; violations.push('top padding ' + decl.value + ' (limit 6rem)'); }
      }
      const textElements = [];
      for (const node of ctx.textNodes) {
        if (!node.text.trim()) continue;
        let cur = node.parent;
        let owner = null;
        while (cur && cur !== hero.parent) {
          if (D.ancestorsOf(cur).indexOf(hero) >= 0 || cur === hero) { owner = cur; }
          cur = cur.parent;
        }
        const direct = D.ancestorsOf(node.parent).find((a) => a.parent === hero) || (node.parent.parent === hero ? node.parent : null);
        if (direct && textElements.indexOf(direct) < 0 && D.elementText(direct).trim()) textElements.push(direct);
        if (owner === null) continue;
      }
      const filtered = textElements.filter((el) => !/^(?:span|strong|em|b|i|small|u)$/.test(el.tag));
      const unique = [];
      for (const el of filtered) if (!unique.some((u) => u !== el && D.ancestorsOf(el).indexOf(u) >= 0)) unique.push(el);
      if (unique.length > 4) { estimated = false; violations.push(unique.length + ' text elements (limit 4)'); }
      if (!violations.length) return;
      const evidence = evidenceFromEl(ctx, hero, violations.join('; '));
      const why = estimated
        ? 'The hero is over its budget on a criterion that static analysis can only estimate (headline line count), so this is a note, not a verdict.'
        : undefined;
      push(evidence, 'Cut the hero to a headline under two lines, a subtext under 20 words, four text elements and 6rem of top padding.', why);
    },
  }),
  makeCheck({
    id: 'DC-317',
    tell: 'motion-claimed-not-shown',
    severity: 'minor',
    title: 'Contract claims high motion, the page shows none',
    why: 'Motion claimed must be motion shown: a high motion dial over a static page is a pre-flight failure.',
    run(ctx, push) {
      if (!ctx.contract || !ctx.contract.dials) return;
      const motion = Number(ctx.contract.dials.motion);
      if (!Number.isFinite(motion) || motion <= 4) return;
      const evidence = motionEvidence(ctx);
      if (evidence.length) return;
      push(
        {
          line: 1,
          selector: 'document',
          snippet: 'contract dials.motion = ' + motion + ', no transition or animation declaration found',
        },
        'Either lower the motion dial to 3 and ship the static page, or add the motion the contract promised.',
      );
    },
  }),
];

/* -------------------------------------------------------------------------- */
/* DC-4xx: contract adherence. These run only when a contract is supplied.      */
/* -------------------------------------------------------------------------- */

const CONTRACT = [
  makeCheck({
    id: 'DC-401',
    tell: 'undeclared-token',
    severity: 'major',
    title: 'Value not declared in the contract token plan',
    why: 'A color the contract never declared means the artifact invented part of its own palette.',
    run(ctx, push) {
      if (!ctx.contract) return;
      const declared = declaredTokenValues(ctx.contract);
      if (!declared.colors.length) {
        // The frozen contract schema carries token_plan as prose. When that prose
        // contains no readable value, the judge has nothing to compare against and
        // says nothing rather than inventing a mismatch.
        return;
      }
      const seen = new Set();
      for (const rule of ctx.rules) {
        if (rule.isTokenBlock || rule.keyframes) continue;
        for (const decl of rule.declarations) {
          if (!isColorProp(decl.prop) || decl.prop.startsWith('--')) continue;
          const resolved = D.resolveValue(stripUrls(decl.value), ctx.tokens);
          for (const token of D.extractColorTokens(resolved.value)) {
            const color = D.parseColor(token.raw);
            if (!color || color.a === 0) continue;
            const key = token.raw.toLowerCase();
            if (seen.has(key)) continue;
            if (declared.matches(color, token.raw)) continue;
            seen.add(key);
            push(
              evidenceFromRule(ctx, rule, decl, token.raw + ' is not among the declared values ' + declared.list.slice(0, 4).join(', ')),
              'Either use a declared token or add the value to the contract token plan.',
            );
          }
        }
      }
    },
  }),
  makeCheck({
    id: 'DC-402',
    tell: 'contract-family-drift',
    severity: 'minor',
    title: 'Section family not in the contract layout plan',
    why: 'The contract fixed the layout families: a section outside the plan means the build drifted from the ruling.',
    run(ctx, push) {
      if (!ctx.contract || !Array.isArray(ctx.contract.layout_plan)) return;
      const planned = ctx.contract.layout_plan
        .map((entry) => normalizeText(entry && entry.family))
        .filter(Boolean);
      if (!planned.length) return;
      let pushed = 0;
      for (const section of ctx.sections) {
        if (pushed >= 5) return;
        const family = normalizeText(section.family);
        if (!family || planned.indexOf(family) >= 0) continue;
        pushed += 1;
        push(
          {
            line: ctx.lineOf(section.el.start),
            selector: pathOf(section.el),
            snippet: 'family ' + section.family + ' is not in the plan (' + planned.join(', ') + ')',
          },
          'Rebuild the section with a family from the plan, or amend the contract.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-403',
    tell: 'contract-ban-violated',
    severity: 'blocker',
    title: 'Artifact violates a ban from the contract',
    why: 'The contract listed this tell as banned: shipping it means the build ignored the ruling it was given.',
    run(ctx, push) {
      if (!ctx.contract || !Array.isArray(ctx.contract.bans)) return;
      const bans = ctx.contract.bans.map((b) => String(b).trim()).filter(Boolean);
      for (const ban of bans) {
        const hit = ctx.findings.find((f) => f.tell_id === ban && f.check_id !== 'DC-403');
        if (!hit) continue;
        push(
          {
            line: hit.evidence.line,
            selector: hit.evidence.selector,
            snippet: 'banned tell "' + ban + '" detected: ' + hit.evidence.snippet,
          },
          'Remove the banned tell, or remove it from contract.bans with a written reason.',
        );
      }
    },
  }),
  makeCheck({
    id: 'DC-404',
    tell: 'contract-section-missing',
    severity: 'major',
    title: 'Section from the contract is missing',
    why: 'A declare-then-build contract is only a ruling if every declared section exists in the artifact.',
    run(ctx, push) {
      if (!ctx.contract || !Array.isArray(ctx.contract.layout_plan)) return;
      const haystack = ctx.sections.map((section) => {
        const identity = [
          section.el.attrs.id || '',
          section.el.attrs.class || '',
          (ctx.elements.find((el) => /^h[1-3]$/.test(el.tag) && D.ancestorsOf(el).indexOf(section.el) >= 0) || { attrs: {} }).attrs.class || '',
          D.elementText(section.el).slice(0, 120),
        ].join(' ');
        return normalizeText(identity);
      }).join(' | ');
      const hay = normalizeText(D.elementText(ctx.root)) + ' ' + haystack;
      for (const entry of ctx.contract.layout_plan) {
        const name = normalizeText(entry && entry.section);
        if (!name) continue;
        if (hay.indexOf(name) >= 0) continue;
        push(
          {
            line: 1,
            selector: 'document',
            snippet: 'contract section "' + entry.section + '" has no matching id, class, heading or copy in the artifact',
          },
          'Build the missing section, or remove it from the contract layout plan.',
        );
      }
    },
  }),
];

/* -------------------------------------------------------------------------- */

function declaredTokenValues(contract) {
  const list = [];
  const push = (raw) => {
    if (raw && list.indexOf(raw) < 0) list.push(raw);
  };
  const plan = contract.token_plan || {};
  for (const key of Object.keys(plan).sort()) {
    const text = String(plan[key] || '');
    for (const token of D.extractColorTokens(stripUrls(text))) {
      if (token.kind === 'named' && !/^(?:black|white|transparent)$/i.test(token.raw)) continue;
      if (D.parseColor(token.raw)) push(token.raw);
    }
  }
  const extra = contract.tokens || contract.token_values || {};
  for (const key of Object.keys(extra).sort()) {
    const raw = String(extra[key]);
    if (D.parseColor(raw)) push(raw);
  }
  const colors = list.map((raw) => D.parseColor(raw)).filter(Boolean);
  return {
    list,
    colors,
    matches(color, raw) {
      if (list.some((entry) => entry.toLowerCase() === String(raw).toLowerCase())) return true;
      return colors.some((c) => Math.abs(c.r - color.r) < 1.5 && Math.abs(c.g - color.g) < 1.5 && Math.abs(c.b - color.b) < 1.5
        && Math.abs(c.a - color.a) < 0.05);
    },
  };
}

export const CHECKS = LEXICAL.concat(COLOR_AND_SURFACE, LAYOUT, STRUCTURE, CONTRACT);

export default CHECKS;
