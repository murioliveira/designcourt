/**
 * designcourt judge: orchestrator.
 *
 * judgeHtml({ html, css, tokens, contract, file, extraCss }) returns the verdict
 * object from spec/BUILD-SPEC.md section 3.2. Pure function of its input: no
 * clock, no randomness, no network, no filesystem. The CLI owns file reading.
 */

import * as D from './dom.mjs';
import { CHECKS } from './checks.mjs';

export const JUDGE_VERSION = '1.0';

/** Layout family vocabulary. Shared with the contract check (DC-402). */
const FAMILY_HINTS = [
  'hero', 'split-asymmetric', 'zigzag', 'cards-row', 'asymmetric-grid', 'bento',
  'divide-list', 'text-only', 'full-bleed-media', 'scroll-pinned', 'horizontal',
  'sticky-media', 'timeline', 'two-column', 'pricing-table', 'faq', 'gallery',
];

function elementKey(el) {
  return el ? el.start + ':' + el.tag : 'none';
}

function parseInlineDeclarations(el) {
  const attr = (el.attrList || []).find((a) => a.name === 'style');
  if (!attr) return [];
  return D.parseDeclarations(attr.value, attr.valueStart).map((d) => Object.assign({}, d, { inline: true }));
}

function familyOf(el, ctx) {
  const hay = [el.attrs['data-layout'] || '', el.attrs.class || '', el.attrs.id || ''].join(' ').toLowerCase();
  const tokens = hay.split(/[\s,]+/).filter(Boolean);
  for (const family of FAMILY_HINTS) {
    if (tokens.indexOf(family) >= 0) return family;
  }
  const children = el.children.filter((c) => c.type === 'element');
  const has = (tags) => children.some((c) => tags.indexOf(c.tag) >= 0);
  if (ctx.elements.some((n) => n.tag === 'h1' && D.ancestorsOf(n).indexOf(el) >= 0)) return 'hero';
  if (ctx.computedProp(el, 'grid-template-areas')) return 'bento';
  const tracks = ctx.computedProp(el, 'grid-template-columns');
  if (tracks) {
    const value = D.resolveValue(tracks.value, ctx.tokens).value;
    const tokens = D.splitTopLevel(value, ' ').filter(Boolean);
    const equal = tokens.length >= 3 && tokens.every((t) => t === tokens[0] || t === '1fr');
    if (equal && children.length >= 3) return 'cards-row';
    if (tokens.length === 2) return 'asymmetric-grid';
  }
  const display = ctx.computedProp(el, 'display');
  if (display && display.value === 'flex' && children.length === 2) {
    return has(['img', 'picture', 'figure', 'video']) ? 'zigzag' : 'split-asymmetric';
  }
  const list = children.find((c) => c.type === 'element' && (c.tag === 'ul' || c.tag === 'ol'));
  if (list && ctx.elements.filter((n) => (n.tag === 'li') && D.ancestorsOf(n).indexOf(list) >= 0).length >= 4) return 'divide-list';
  if (has(['img', 'picture', 'video', 'figure'])) return 'full-bleed-media';
  return 'text-only';
}

function buildContext(options) {
  const html = options.html || '';
  const file = options.file || 'artifact.html';
  const extraCss = options.extraCss || [];
  const lineStarts = D.makeLineIndex(html);

  const root = D.parseHtml(html);
  const elements = D.elementsOf(root);
  const textNodes = D.visibleTextNodes(root);
  const scriptNodes = [];
  D.walk(root, (n) => {
    if (n.type === 'text' && n.rawText && n.parent && n.parent.tag === 'script') scriptNodes.push(n);
  });

  /* CSS sources: every <style> block in the document plus any external sheet the
   * CLI read for us. Offsets stay absolute per source so line numbers are real. */
  const rules = [];
  const lower = html.toLowerCase();
  let searchFrom = 0;
  for (;;) {
    const open = lower.indexOf('<style', searchFrom);
    if (open < 0) break;
    const openEnd = html.indexOf('>', open);
    if (openEnd < 0) break;
    const close = lower.indexOf('</style', openEnd);
    const bodyEnd = close < 0 ? html.length : close;
    const cssText = D.blankCssComments(html.slice(0, bodyEnd)).slice(openEnd + 1);
    rules.push(...D.parseCss(cssText, { file, lineStarts }));
    searchFrom = close < 0 ? html.length : close + 7;
  }
  for (const sheet of extraCss) {
    const text = D.blankCssComments(sheet.text || '');
    rules.push(...D.parseCss(text, { file: sheet.file, lineStarts: D.makeLineIndex(text) }));
  }

  const tokens = D.collectCustomProperties(rules, options.tokens || {});

  const ctx = {
    file,
    source: html,
    html,
    root,
    elements,
    textNodes,
    scriptNodes,
    rules,
    tokens,
    contract: options.contract || null,
    visibleText: textNodes.map((n) => n.text).join(' '),
    findings: [],
    lineOf: (offset) => D.lineOfIndex(lineStarts, offset),
    add(finding) {
      const evidence = Object.assign({ line: 1, selector: 'document', snippet: '' }, finding.evidence || {});
      if (!Number.isFinite(evidence.line) || evidence.line < 1) evidence.line = 1;
      ctx.findings.push({
        check_id: finding.check_id,
        tell_id: finding.tell_id,
        severity: finding.severity,
        title: finding.title,
        evidence,
        fix: finding.fix,
        why: finding.why,
      });
    },
  };

  ctx.computedProp = (el, prop) => {
    const chain = [el].concat(D.ancestorsOf(el).filter((n) => n.type === 'element'));
    for (const node of chain) {
      const inline = parseInlineDeclarations(node).filter((d) => d.prop === prop);
      if (inline.length) {
        const decl = inline[inline.length - 1];
        const resolved = D.resolveValue(decl.value, tokens);
        return {
          value: resolved.value.trim(),
          raw: resolved.value.trim(),
          unresolved: resolved.unresolved,
          rule: { selector: describeSelector(node) + ' (inline style)', file, lineStarts, line: D.lineOfIndex(lineStarts, decl.start), declarations: [] },
          decl,
          line: D.lineOfIndex(lineStarts, decl.start),
          selector: describeSelector(node) + ' (inline style)',
        };
      }
      let best = null;
      for (let ri = 0; ri < rules.length; ri += 1) {
        const rule = rules[ri];
        if (rule.isTokenBlock || rule.keyframes) continue;
        if (D.isInteractiveOnlySelector(rule.selector)) continue;
        if (rule.media && /(?:prefers-reduced-motion|print)/i.test(rule.media)) continue;
        for (const decl of rule.declarations) {
          if (decl.prop !== prop) continue;
          if (!D.selectorListMatches(rule.selector, node)) continue;
          const spec = D.specificityOf(rule.selector, node) || [0, 0, 0];
          const score = [decl.important ? 1 : 0, spec[0], spec[1], spec[2], ri];
          if (!best || compareScore(score, best.score) >= 0) best = { score, decl, rule };
        }
      }
      if (!best) continue;
      const resolved = D.resolveValue(best.decl.value, tokens);
      return {
        value: resolved.value.trim(),
        raw: resolved.value.trim(),
        unresolved: resolved.unresolved,
        rule: best.rule,
        decl: best.decl,
        line: D.lineOfIndex(best.rule.lineStarts, best.decl.start),
        selector: best.rule.selector,
        file: best.rule.file,
      };
    }
    return null;
  };

  ctx.resolveProp = ctx.computedProp;

  ctx.resolveBackground = (el) => {
    const chain = [el].concat(D.ancestorsOf(el).filter((n) => n.type === 'element'));
    for (const node of chain) {
      for (const prop of ['background-color', 'background']) {
        const found = ctx.computedProp(node, prop);
        if (!found) continue;
        if (prop === 'background' && D.isGradientValue(found.value)) {
          const withoutGradients = found.value.replace(/\b(?:repeating-)?(?:radial|linear|conic)-gradient\s*\(/gi, '(');
          const tokensFound = D.extractColorTokens(withoutGradients);
          if (!tokensFound.length) continue;
          const last = tokensFound[tokensFound.length - 1].raw;
          const color = D.parseColor(last);
          if (!color || color.a === 0) continue;
          return { raw: last, value: last, selector: found.selector, line: found.line, unresolved: found.unresolved };
        }
        const tokensFound = D.extractColorTokens(stripGradientArgsForBackground(found.value));
        if (!tokensFound.length) continue;
        const last = tokensFound[tokensFound.length - 1].raw;
        const color = D.parseColor(last);
        if (!color || color.a === 0) continue;
        return { raw: last, value: last, selector: found.selector, line: found.line, unresolved: found.unresolved };
      }
    }
    return null;
  };

  /* Sections: <section> elements, else class named sections, else body children
   * that carry a heading. Used by DC-206, DC-301, DC-402 and DC-404. */
  let sections = elements.filter((el) => el.tag === 'section');
  if (!sections.length) sections = elements.filter((el) => /(?:^|[-_])section(?:$|[-_])/i.test(el.attrs.class || ''));
  if (!sections.length) {
    const body = elements.find((el) => el.tag === 'body');
    const kids = body ? body.children.filter((c) => c.type === 'element') : elements;
    sections = kids.filter((c) => /<h[1-3][\s>]/.test(html.slice(c.start, c.end)));
  }
  ctx.sections = sections.map((el, index) => ({ el, index, family: familyOf(el, ctx) }));
  const families = [];
  for (const section of ctx.sections) if (families.indexOf(section.family) < 0) families.push(section.family);
  ctx.families = families;

  return ctx;
}

function compareScore(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function describeSelector(el) {
  if (!el || el.type !== 'element') return 'document';
  const id = el.attrs.id ? '#' + el.attrs.id : '';
  const cls = D.classListOf(el)[0] ? '.' + D.classListOf(el)[0] : '';
  return el.tag + id + cls;
}

function stripGradientArgsForBackground(value) {
  return String(value || '');
}

/**
 * Run every check against one artifact.
 *
 * options:
 *   html      raw HTML text (required, may be empty)
 *   css       extra CSS text, treated as an external sheet named "<file>.css"
 *   extraCss  [{ file, text }] sheets the caller read from disk
 *   tokens    { '--name': 'value' } from --tokens
 *   contract  DesignContract object, or null
 *   file      path shown in reports
 */
export function judgeHtml(options = {}) {
  const extraCss = [];
  if (Array.isArray(options.extraCss)) extraCss.push(...options.extraCss);
  if (options.css) extraCss.push({ file: (options.file || 'artifact.html') + '.css', text: options.css });

  const ctx = buildContext({
    html: options.html || '',
    file: options.file,
    tokens: options.tokens || {},
    contract: options.contract || null,
    extraCss,
  });

  for (const check of CHECKS) {
    try {
      check.run(ctx);
    } catch (error) {
      // A crashing check must never hide the rest of the report. It is reported
      // as a judge error, not as a finding about the artifact.
      ctx.add({
        check_id: check.check_id,
        tell_id: check.tell_id,
        severity: 'minor',
        title: 'Check failed to run: ' + check.check_id,
        evidence: { line: 1, selector: 'document', snippet: String(error && error.message ? error.message : error) },
        fix: 'Report this as a judge bug: the check did not complete, so its verdict is unknown.',
        why: 'The judge reports its own failure instead of silently returning clean.',
      });
    }
  }

  ctx.findings.sort((a, b) => (a.evidence.line - b.evidence.line) || (a.check_id < b.check_id ? -1 : a.check_id > b.check_id ? 1 : 0));

  const counts = { blocker: 0, major: 0, minor: 0 };
  for (const finding of ctx.findings) counts[finding.severity] = (counts[finding.severity] || 0) + 1;

  const weights = { blocker: 3, major: 1.5, minor: 0.5 };
  const raw = counts.blocker * weights.blocker + counts.major * weights.major + counts.minor * weights.minor;
  const slopIndex = Math.round(Math.min(10, raw) * 10) / 10;

  const verdict = counts.blocker > 0 ? 'fail' : counts.major > 0 ? 'pass_with_notes' : 'clean';

  return {
    judge_version: JUDGE_VERSION,
    files_scanned: 1 + extraCss.length,
    findings: ctx.findings,
    counts,
    score: {
      slop_index: slopIndex,
      layout_families: ctx.families.length,
      contrast_failures: ctx.findings.filter((f) => f.check_id === 'DC-106').length,
    },
    verdict,
  };
}

export default judgeHtml;
