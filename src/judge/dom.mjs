/**
 * designcourt judge: dependency free HTML and CSS reading.
 *
 * Everything in this file is a pure function of the text it is handed. No
 * network, no clock, no randomness, no locale dependent formatting. The one
 * trick that keeps evidence honest: comments are blanked with spaces (newlines
 * kept) instead of removed, so every byte offset in the blanked text still
 * points at the same line in the original file. That is why `lineOf(offset)`
 * works on the raw source even after comment stripping.
 */

/* -------------------------------------------------------------------------- */
/* Character classes and vocabulary                                            */
/* -------------------------------------------------------------------------- */

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00b7',
  bull: '\u2022', copy: '\u00a9', reg: '\u00ae', trade: '\u2122',
  times: '\u00d7', deg: '\u00b0', laquo: '\u00ab', raquo: '\u00bb',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  eacute: '\u00e9', ccedil: '\u00e7', atilde: '\u00e3', cacute: '\u0107',
};

/* CSS named colors: the common set. Anything outside this table is reported as
 * unresolvable rather than guessed, which keeps the judge from inventing a
 * verdict about a color it did not actually read. */
const NAMED_COLORS = {
  transparent: [0, 0, 0, 0], currentcolor: null, inherit: null, unset: null, initial: null, revert: null,
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], lime: [0, 255, 0],
  blue: [0, 0, 255], yellow: [255, 255, 0], cyan: [0, 255, 255], aqua: [0, 255, 255],
  magenta: [255, 0, 255], fuchsia: [255, 0, 255], silver: [192, 192, 192], gray: [128, 128, 128],
  grey: [128, 128, 128], maroon: [128, 0, 0], olive: [128, 128, 0], green: [0, 128, 0],
  purple: [128, 0, 128], teal: [0, 128, 128], navy: [0, 0, 128], orange: [255, 165, 0],
  pink: [255, 192, 203], brown: [165, 42, 42], gold: [255, 215, 0], beige: [245, 245, 220],
  ivory: [255, 255, 240], khaki: [240, 230, 140], indigo: [75, 0, 130], violet: [238, 130, 238],
  plum: [221, 160, 221], orchid: [218, 112, 214], lavender: [230, 230, 250], salmon: [250, 128, 114],
  coral: [255, 127, 80], crimson: [220, 20, 60], tomato: [255, 99, 71], turquoise: [64, 224, 208],
  steelblue: [70, 130, 180], skyblue: [135, 206, 235], slategray: [112, 128, 144],
  slategrey: [112, 128, 144], darkslategray: [47, 79, 79], whitesmoke: [245, 245, 245],
  gainsboro: [220, 220, 220], lightgray: [211, 211, 211], lightgrey: [211, 211, 211],
  darkgray: [169, 169, 169], darkgrey: [169, 169, 169], dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105], firebrick: [178, 34, 34], goldenrod: [218, 165, 32],
  seagreen: [46, 139, 87], forestgreen: [34, 139, 34], midnightblue: [25, 25, 112],
  royalblue: [65, 105, 225], dodgerblue: [30, 144, 255], cornflowerblue: [100, 149, 237],
  rebeccapurple: [102, 51, 153], sienna: [160, 82, 45], peru: [205, 133, 63],
  chocolate: [210, 105, 30], tan: [210, 180, 140], wheat: [245, 222, 179],
  papayawhip: [255, 239, 213], linen: [250, 240, 230], seashell: [255, 245, 238],
  oldlace: [253, 245, 230], snow: [255, 250, 250], azure: [240, 255, 255],
  aliceblue: [240, 248, 255], ghostwhite: [248, 248, 255],
};

/* -------------------------------------------------------------------------- */
/* Offsets and lines                                                           */
/* -------------------------------------------------------------------------- */

export function makeLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

/** 1 based line number of a character offset. Binary search, so it is cheap. */
export function lineOfIndex(lineStarts, offset) {
  if (!Number.isFinite(offset) || offset < 0) return 1;
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Replace [start, end) with spaces, keeping newlines so lines do not move. */
export function blankRange(text, start, end) {
  let out = text.slice(0, start);
  for (let i = start; i < end; i += 1) out += text[i] === '\n' ? '\n' : ' ';
  return out + text.slice(end);
}

/** Blank every HTML comment. Offsets and line numbers stay valid. */
export function blankHtmlComments(html) {
  let out = html;
  let search = 0;
  for (;;) {
    const start = out.indexOf('<!--', search);
    if (start < 0) break;
    let end = out.indexOf('-->', start + 4);
    end = end < 0 ? out.length : end + 3;
    out = blankRange(out, start, end);
    search = end;
  }
  return out;
}

/** Blank every CSS comment. Offsets and line numbers stay valid. */
export function blankCssComments(css) {
  let out = css;
  let search = 0;
  for (;;) {
    const start = out.indexOf('/*', search);
    if (start < 0) break;
    let end = out.indexOf('*/', start + 2);
    end = end < 0 ? out.length : end + 2;
    out = blankRange(out, start, end);
    search = end;
  }
  return out;
}

/** Blank comments, script bodies and style bodies: the shell a lexical scan wants. */
export function blankHtmlChrome(html) {
  const out = blankHtmlComments(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (m) => blankKeepNewlines(m))
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, (m) => blankKeepNewlines(m));
  return out;
}

function blankKeepNewlines(text) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) out += text[i] === '\n' ? '\n' : ' ';
  return out;
}

/* -------------------------------------------------------------------------- */
/* HTML parsing                                                                */
/* -------------------------------------------------------------------------- */

function decodeEntities(text) {
  if (text.indexOf('&') < 0) return text;
  return text.replace(/&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

/** Public alias: attribute values are decoded before any lexical check reads them. */
export function decodeHtmlEntities(text) {
  return decodeEntities(text);
}

/**
 * Selector specificity, best matching selector in a list. Approximated in the
 * standard (id, class, type) shape, which is all the cascade needs here.
 */
export function specificityOf(selectorList, el) {
  let best = null;
  for (const part of splitTopLevel(selectorList, ',')) {
    const sel = part.trim();
    if (!sel || !selectorMatches(sel, el)) continue;
    const withoutPseudos = sel.replace(/::[a-zA-Z-]+(\([^)]*\))?/g, '');
    const ids = (withoutPseudos.match(/#[\w-]+/g) || []).length;
    const classes = (withoutPseudos.match(/\.[\w-]+/g) || []).length
      + (sel.match(/\[[^\]]+\]/g) || []).length
      + (sel.match(/:[a-zA-Z-]+/g) || []).filter((p) => !/^::/.test(p)).length;
    const types = (withoutPseudos.replace(/[.#][\w-]+/g, ' ').match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
    const score = [ids, classes, types];
    if (best === null || cmpSpec(score, best) > 0) best = score;
  }
  return best;
}

function cmpSpec(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function findTagEnd(html, start) {
  let quote = null;
  for (let i = start + 1; i < html.length; i += 1) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '>') return i;
  }
  return html.length - 1;
}

function parseAttrs(attrText, absStart) {
  const attrs = {};
  const list = [];
  const re = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let m;
  while ((m = re.exec(attrText)) !== null) {
    const name = m[1].toLowerCase();
    let raw = m[2];
    let value = '';
    let valueStart = absStart + m.index + m[0].length;
    if (raw !== undefined) {
      if ((raw[0] === '"' && raw[raw.length - 1] === '"') || (raw[0] === "'" && raw[raw.length - 1] === "'")) {
        value = raw.slice(1, -1);
        valueStart = absStart + m.index + m[0].indexOf(raw) + 1;
      } else {
        value = raw;
        valueStart = absStart + m.index + m[0].indexOf(raw);
      }
    }
    attrs[name] = value;
    list.push({ name, value, valueStart });
  }
  return { attrs, list };
}

/**
 * Minimal HTML tree. Not a browser: it does not run scripts, does not apply a
 * CSS cascade to the layout, and does not repair arbitrary broken markup. It
 * reads tags, attributes, text and structure, which is what the checks need.
 */
export function parseHtml(html) {
  const lower = html.toLowerCase();
  const root = {
    type: 'root', tag: '#root', attrs: {}, attrList: [], children: [],
    parent: null, start: 0, end: html.length,
  };
  let cur = root;
  let i = 0;

  const pushText = (text, start) => {
    if (!text) return;
    cur.children.push({ type: 'text', text: decodeEntities(text), raw: text, start, end: start + text.length, parent: cur });
  };

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { pushText(html.slice(i), i); break; }
    if (lt > i) pushText(html.slice(i, lt), i);

    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4);
      const end = close < 0 ? html.length : close + 3;
      cur.children.push({ type: 'comment', text: html.slice(lt + 4, close < 0 ? html.length : close), start: lt, end, parent: cur });
      i = end;
      continue;
    }

    if (lower.startsWith('<!', lt) || lower.startsWith('<?', lt)) {
      const gt = html.indexOf('>', lt);
      const end = gt < 0 ? html.length : gt + 1;
      cur.children.push({ type: 'doctype', text: html.slice(lt, end), start: lt, end, parent: cur });
      i = end;
      continue;
    }

    if (lower.startsWith('</', lt)) {
      const gt = html.indexOf('>', lt);
      const end = gt < 0 ? html.length : gt + 1;
      const tag = html.slice(lt + 2, gt < 0 ? html.length : gt).trim().toLowerCase();
      let node = cur;
      while (node && node.type === 'element' && node.tag !== tag) node = node.parent;
      if (node && node.type === 'element') node.end = end;
      cur = node && node.parent ? node.parent : root;
      i = end;
      continue;
    }

    const tagMatch = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt, lt + 96));
    if (!tagMatch) { pushText('<', lt); i = lt + 1; continue; }

    const tag = tagMatch[1].toLowerCase();
    const gt = findTagEnd(html, lt);
    const attrAbsStart = lt + tagMatch[0].length;
    const attrText = html.slice(attrAbsStart, gt);
    const { attrs, list } = parseAttrs(attrText, attrAbsStart);
    const selfClosing = /\/\s*$/.test(attrText);
    const node = {
      type: 'element', tag, attrs, attrList: list, children: [], parent: cur,
      start: lt, end: gt + 1, openEnd: gt + 1, selfClosing,
    };
    cur.children.push(node);
    i = gt + 1;

    if (!selfClosing && !VOID_ELEMENTS.has(tag)) {
      cur = node;
      if (RAW_TEXT_ELEMENTS.has(tag)) {
        const close = lower.indexOf('</' + tag, i);
        const stop = close < 0 ? html.length : close;
        if (stop > i) {
          node.children.push({
            type: 'text', text: html.slice(i, stop), raw: html.slice(i, stop),
            start: i, end: stop, parent: node, rawText: true,
          });
        }
        i = stop;
      }
    }
  }
  return root;
}

export function walk(node, visit) {
  visit(node);
  if (!node.children) return;
  for (const child of node.children) walk(child, visit);
}

export function elementsOf(root) {
  const out = [];
  walk(root, (n) => { if (n.type === 'element') out.push(n); });
  return out;
}

export function ancestorsOf(node) {
  const out = [];
  let cur = node.parent;
  while (cur) { out.push(cur); cur = cur.parent; }
  return out;
}

export function classListOf(el) {
  const raw = el && el.attrs ? el.attrs.class : '';
  return typeof raw === 'string' ? raw.split(/\s+/).filter(Boolean) : [];
}

export function classSignatureOf(el) {
  return classListOf(el).slice().sort().join(' ');
}

export function hasClassHint(el, pattern) {
  if (!el || el.type !== 'element') return false;
  const hay = [el.attrs.class || '', el.attrs.id || '', el.attrs['data-testid'] || '', el.attrs.role || ''].join(' ');
  return pattern.test(hay);
}

export function textContentOf(node) {
  let out = '';
  walk(node, (n) => {
    if (n.type === 'text' && !inHead(n) && !insideRawNonVisible(n)) out += n.text;
    else if (n.type === 'element' && (n.tag === 'br' || n.tag === 'p' || n.tag === 'li' || n.tag === 'div' || n.tag === 'section')) out += ' ';
  });
  return out.replace(/[\u00a0\s]+/g, ' ').trim();
}

function inHead(node) {
  let cur = node;
  while (cur) { if (cur.tag === 'head') return true; cur = cur.parent; }
  return false;
}

function insideRawNonVisible(node) {
  let cur = node.parent;
  while (cur) {
    if (cur.tag === 'script' || cur.tag === 'style') return true;
    cur = cur.parent;
  }
  return false;
}

/** Visible text nodes: no script, no style, no head, no comments. */
export function visibleTextNodes(root) {
  const out = [];
  walk(root, (n) => {
    if (n.type !== 'text') return;
    if (n.rawText) return;
    if (inHead(n) || insideRawNonVisible(n)) return;
    out.push(n);
  });
  return out;
}

/** Text of the whole element subtree, used for per element content reasoning. */
export function elementText(el) {
  return textContentOf(el);
}

/* -------------------------------------------------------------------------- */
/* CSS parsing                                                                 */
/* -------------------------------------------------------------------------- */

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length - 1;
}

/** Split on a separator at paren and bracket depth zero, honoring strings. */
export function splitTopLevel(text, sep) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (depth === 0 && ch === sep) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
}

/**
 * Parse declarations out of a rule body. Returns absolute offsets so evidence
 * can point at a real line. Nested at-rule blocks inside the body are skipped.
 */
export function parseDeclarations(bodyText, bodyAbsStart) {
  const out = [];
  const chunks = splitTopLevel(bodyText, ';');
  let cursor = 0;
  for (const chunk of chunks) {
    const chunkStart = bodyAbsStart + cursor;
    cursor += chunk.length + 1;
    if (chunk.indexOf('{') >= 0) continue;
    const colon = topLevelColon(chunk);
    if (colon < 0) continue;
    const prop = chunk.slice(0, colon).trim();
    if (!prop) continue;
    let value = chunk.slice(colon + 1);
    const important = /!\s*important\s*$/i.test(value);
    value = value.replace(/!\s*important\s*$/i, '').trim();
    const propOffset = chunk.slice(0, colon).search(/\S/);
    const valueOffsetRaw = colon + 1 + chunk.slice(colon + 1).search(/\S/);
    out.push({
      prop: prop.toLowerCase(),
      rawProp: prop,
      value,
      important,
      start: chunkStart + (propOffset < 0 ? 0 : propOffset),
      valueStart: chunkStart + (valueOffsetRaw < 0 ? colon + 1 : valueOffsetRaw),
      text: chunk.trim(),
    });
  }
  return out;
}

function topLevelColon(chunk) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < chunk.length; i += 1) {
    const ch = chunk[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (depth === 0 && ch === ':') return i;
  }
  return -1;
}

/**
 * Parse a stylesheet (or a fragment of one) into flat rules.
 *
 * Each rule: { selector, declarations, media, keyframes, atRules, file, start,
 * line, isTokenBlock }. `media` is the innermost media condition, used for the
 * reduced motion check. `isTokenBlock` marks a block whose declarations are all
 * custom properties, which DC-105 treats as a legitimate token declaration.
 */
export function parseCss(css, opts = {}) {
  const file = opts.file || null;
  const lineStarts = opts.lineStarts || makeLineIndex(css);
  const rules = [];
  const stack = [];
  let i = 0;
  let preludeStart = 0;

  const currentMedia = () => {
    for (let k = stack.length - 1; k >= 0; k -= 1) {
      if (stack[k].kind === 'media' || stack[k].kind === 'supports' || stack[k].kind === 'container') return stack[k].prelude;
    }
    return null;
  };
  const currentKeyframes = () => {
    for (let k = stack.length - 1; k >= 0; k -= 1) if (stack[k].kind === 'keyframes') return stack[k].prelude;
    return null;
  };

  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const prelude = css.slice(preludeStart, i).trim();
      const close = findMatchingBrace(css, i);
      const body = css.slice(i + 1, close);
      const lower = prelude.toLowerCase();
      if (prelude.startsWith('@')) {
        const name = (lower.match(/^@([a-z-]+)/) || [, ''])[1];
        const kind = name === 'media' || name === 'supports' || name === 'container' ? name
          : name === 'keyframes' || name === '-webkit-keyframes' ? 'keyframes'
            : name === 'layer' || name === 'scope' ? name : 'other';
        stack.push({ kind, prelude });
        preludeStart = i + 1;
        i += 1;
        continue;
      }
      const declarations = parseDeclarations(body, i + 1);
      const isTokenBlock = declarations.length > 0 && declarations.every((d) => d.prop.startsWith('--'));
      const lead = css.slice(preludeStart, i).search(/\S/);
      const startAbs = preludeStart + (lead < 0 ? 0 : lead);
      rules.push({
        selector: prelude,
        declarations,
        media: currentMedia(),
        keyframes: currentKeyframes(),
        atRules: stack.map((f) => f.prelude),
        file,
        lineStarts,
        start: startAbs,
        line: lineOfIndex(lineStarts, startAbs),
        isTokenBlock,
      });
      i = close + 1;
      preludeStart = i;
      continue;
    }
    if (ch === '}') {
      if (stack.length) stack.pop();
      i += 1;
      preludeStart = i;
      continue;
    }
    if (ch === ';' && stack.length === 0) {
      preludeStart = i + 1;
      i += 1;
      continue;
    }
    i += 1;
  }
  return rules;
}

/* -------------------------------------------------------------------------- */
/* Values, var() resolution, colors                                            */
/* -------------------------------------------------------------------------- */

/** Custom property declarations, in document order, later wins. */
export function collectCustomProperties(rules, seed = {}) {
  const map = Object.assign({}, seed);
  for (const rule of rules) {
    for (const decl of rule.declarations) {
      if (decl.prop.startsWith('--')) map[decl.prop] = decl.value.trim();
    }
  }
  return map;
}

/**
 * Resolve var(--x) chains against a token map.
 * Returns { value, unresolved: ['--x', ...] }: unresolved is the honest list of
 * names the judge could not read, which is what stops a check from inventing a
 * verdict about a value it never saw.
 */
export function resolveValue(value, tokens, opts = {}) {
  const maxDepth = opts.maxDepth || 10;
  const seen = new Set();
  let current = String(value === undefined || value === null ? '' : value);
  const unresolved = [];
  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (current.indexOf('var(') < 0) break;
    let replaced = false;
    let out = '';
    let i = 0;
    while (i < current.length) {
      const idx = current.indexOf('var(', i);
      if (idx < 0) { out += current.slice(i); break; }
      out += current.slice(i, idx);
      const close = matchingParen(current, idx + 3);
      const inner = current.slice(idx + 4, close);
      const parts = splitTopLevel(inner, ',');
      const name = parts[0].trim();
      const fallback = parts.length > 1 ? parts.slice(1).join(',').trim() : null;
      const looked = tokens ? tokens[name] : undefined;
      if (looked !== undefined && looked !== null && String(looked).trim() !== '') {
        if (seen.has(name) && depth > 0) {
          unresolved.push(name);
          out += current.slice(idx, close + 1);
        } else {
          seen.add(name);
          out += String(looked);
          replaced = true;
        }
      } else if (fallback !== null && fallback !== '') {
        out += fallback;
        replaced = true;
      } else {
        unresolved.push(name);
        out += current.slice(idx, close + 1);
      }
      i = close + 1;
    }
    current = out;
    if (!replaced) break;
  }
  const unique = [];
  for (const name of unresolved) if (unique.indexOf(name) < 0) unique.push(name);
  return { value: current, unresolved: unique };
}

function matchingParen(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length - 1;
}

const COLOR_TOKEN_RE = new RegExp([
  '#[0-9a-fA-F]{3,8}\\b',
  '\\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color|hwb|color-mix)\\([^()]*(?:\\([^()]*\\)[^()]*)*\\)',
  '\\b[a-zA-Z][a-zA-Z0-9]*\\b',
].join('|'), 'g');

/** Every color looking token in a CSS value, in source order. */
export function extractColorTokens(value) {
  const text = String(value || '');
  const out = [];
  const re = new RegExp(COLOR_TOKEN_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (raw[0] === '#') { out.push({ raw, index: m.index, kind: 'hex' }); continue; }
    if (/^(?:rgba?|hsla?|oklch|oklab|lab|lch|color|hwb|color-mix)$/i.test(raw)) {
      // a bare function name only counts when its arguments follow
      const after = text.slice(m.index + raw.length);
      if (after[0] !== '(') continue;
      const close = matchingParen(text, m.index + raw.length);
      out.push({ raw: text.slice(m.index, close + 1), index: m.index, kind: raw.toLowerCase() });
      re.lastIndex = close + 1;
      continue;
    }
    const lower = raw.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, lower)) out.push({ raw, index: m.index, kind: 'named' });
  }
  return out;
}

function clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }

function parseNumberOrPercent(token, scalePercentTo) {
  const t = String(token).trim();
  if (t.endsWith('%')) {
    const n = parseFloat(t);
    if (!Number.isFinite(n)) return null;
    return (n / 100) * scalePercentTo;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function parseAlpha(token) {
  if (token === undefined) return 1;
  const t = String(token).trim();
  if (t.endsWith('%')) {
    const n = parseFloat(t);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n / 100)) : 1;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = clamp255(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: clamp255(conv(hue + 1 / 3) * 255),
    g: clamp255(conv(hue) * 255),
    b: clamp255(conv(hue - 1 / 3) * 255),
  };
}

function oklchToRgb(l, c, hDeg) {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const bb = c * Math.sin(hRad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * bb;
  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;
  const lr = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const lg = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const lb = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;
  const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055);
  return { r: clamp255(gamma(lr) * 255), g: clamp255(gamma(lg) * 255), b: clamp255(gamma(lb) * 255) };
}

/**
 * Parse a color to { r, g, b, a } (0 to 255, a 0 to 1), or null when this file
 * cannot honestly resolve it (an unknown keyword, a color space we do not
 * convert, a var() that stayed unresolved, or a color-mix).
 */
export function parseColor(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (lower.charCodeAt(0) === 35) {
    const hex = lower.slice(1);
    const expand = (s) => parseInt(s.length === 1 ? s + s : s, 16);
    if (hex.length === 3 || hex.length === 4) {
      return { r: expand(hex[0]), g: expand(hex[1]), b: expand(hex[2]), a: hex.length === 4 ? expand(hex[3]) / 255 : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
    return null;
  }
  const fn = /^([a-z-]+)\(([\s\S]*)\)$/i.exec(text);
  if (fn) {
    const name = fn[1].toLowerCase();
    const inner = fn[2];
    const slashParts = splitTopLevel(inner, '/');
    let alphaToken = null;
    let parts;
    if (slashParts.length > 1) {
      parts = splitTopLevel(slashParts[0], ',');
      alphaToken = slashParts[1].trim();
    } else {
      parts = splitTopLevel(inner, ',');
    }
    parts = parts.map((s) => s.trim()).filter((s) => s !== '');
    if (parts.length === 1) parts = parts[0].split(/\s+/).filter(Boolean);
    const alpha = alphaToken !== null ? parseAlpha(alphaToken) : (parts.length > 3 ? parseAlpha(parts[3]) : 1);
    if (name === 'rgb' || name === 'rgba') {
      if (parts.length < 3) return null;
      const r = parseNumberOrPercent(parts[0], 255);
      const g = parseNumberOrPercent(parts[1], 255);
      const b = parseNumberOrPercent(parts[2], 255);
      if (r === null || g === null || b === null) return null;
      return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: alpha };
    }
    if (name === 'hsl' || name === 'hsla') {
      if (parts.length < 3) return null;
      const hue = parseFloat(parts[0]);
      const sat = parseNumberOrPercent(parts[1], 1);
      const light = parseNumberOrPercent(parts[2], 1);
      if (!Number.isFinite(hue) || sat === null || light === null) return null;
      const rgb = hslToRgb(hue, Math.max(0, Math.min(1, sat)), Math.max(0, Math.min(1, light)));
      return { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha };
    }
    if (name === 'oklch') {
      if (parts.length < 3) return null;
      const l = parseNumberOrPercent(parts[0], 1);
      const c = parseFloat(parts[1]);
      const h = parseFloat(parts[2]);
      if (l === null || !Number.isFinite(c) || !Number.isFinite(h)) return null;
      const rgb = oklchToRgb(l, c, h);
      return { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha };
    }
    return null;
  }
  const named = NAMED_COLORS[lower];
  if (Array.isArray(named)) return { r: named[0], g: named[1], b: named[2], a: named.length > 3 ? named[3] : 1 };
  return null;
}

export function rgbToHsl(color) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

export function relativeLuminance(color) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha composite: what a translucent foreground looks like over a backdrop. */
export function compositeOver(fg, bg) {
  if (fg.a >= 1) return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
  const a = Math.max(0, Math.min(1, fg.a));
  return {
    r: clamp255(fg.r * a + bg.r * (1 - a)),
    g: clamp255(fg.g * a + bg.g * (1 - a)),
    b: clamp255(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

export function formatColor(color) {
  if (!color) return 'unresolved';
  const hex = (n) => n.toString(16).padStart(2, '0');
  const base = '#' + hex(color.r) + hex(color.g) + hex(color.b);
  return color.a >= 1 ? base : base + ' a=' + String(Math.round(color.a * 100) / 100);
}

/* -------------------------------------------------------------------------- */
/* Selector matching (small, honest subset)                                    */
/* -------------------------------------------------------------------------- */

const INTERACTIVE_PSEUDO = /:(?:hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|placeholder-shown)\b/;

export function isInteractiveOnlySelector(selector) {
  return INTERACTIVE_PSEUDO.test(selector || '');
}

function compoundMatches(compound, el) {
  const cleaned = compound.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '');
  if (!cleaned.trim()) return true;
  const parts = cleaned.trim().match(/[.#]?[\w-]+|\*|\[[^\]]+\]/g) || [];
  for (const part of parts) {
    if (part === '*') continue;
    if (part[0] === '.') {
      if (classListOf(el).indexOf(part.slice(1)) < 0) return false;
    } else if (part[0] === '#') {
      if ((el.attrs.id || '') !== part.slice(1)) return false;
    } else if (part[0] === '[') {
      const inner = part.slice(1, -1);
      const eq = inner.indexOf('=');
      if (eq < 0) {
        if (!(inner.replace(/[^a-zA-Z0-9-]/g, '') in el.attrs)) return false;
      } else {
        const name = inner.slice(0, eq).replace(/[^a-zA-Z0-9-]/g, '');
        const value = inner.slice(eq + 1).replace(/^["']|["']$/g, '');
        if ((el.attrs[name] || '') !== value) return false;
      }
    } else if (part.toLowerCase() !== el.tag) return false;
  }
  return true;
}

/** Match a single selector (no commas) against an element, approximating combinators. */
export function selectorMatches(selector, el) {
  const sel = selector.trim();
  if (!sel) return false;
  const tokens = sel.split(/\s*([>+~])\s*|\s+/).filter((t) => t !== undefined && t !== '');
  const parts = [];
  const combinators = [];
  for (const token of tokens) {
    if (token === '>' || token === '+' || token === '~') combinators.push(token);
    else parts.push(token);
  }
  if (!parts.length) return false;
  if (!compoundMatches(parts[parts.length - 1], el)) return false;
  let node = el.parent;
  for (let k = parts.length - 2; k >= 0; k -= 1) {
    const combinator = combinators[k] || ' ';
    if (combinator === '>' || combinator === '+') {
      if (combinator === '+') return false;
      if (!node || node.type !== 'element' || !compoundMatches(parts[k], node)) return false;
      node = node.parent;
      continue;
    }
    let found = false;
    let probe = node;
    while (probe && probe.type === 'element') {
      if (compoundMatches(parts[k], probe)) { found = true; break; }
      probe = probe.parent;
    }
    if (!found) return false;
    node = probe.parent;
  }
  return true;
}

export function selectorListMatches(selectorList, el) {
  return splitTopLevel(selectorList, ',').some((s) => selectorMatches(s, el));
}

/* -------------------------------------------------------------------------- */
/* Gradients                                                                   */
/* -------------------------------------------------------------------------- */

const GRADIENT_RE = /\b((?:repeating-)?(?:radial|linear|conic)-gradient)\s*\(/gi;

/** Locate every gradient function inside a CSS value. */
export function extractGradients(value) {
  const text = String(value || '');
  const out = [];
  const re = new RegExp(GRADIENT_RE.source, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) {
    const openIndex = m.index + m[0].length - 1;
    const close = matchingParen(text, openIndex);
    out.push({
      kind: m[1].toLowerCase(),
      raw: text.slice(m.index, close + 1),
      args: text.slice(openIndex + 1, close),
      index: m.index,
    });
    re.lastIndex = close + 1;
  }
  return out;
}

export function isGradientValue(value) {
  const text = String(value || '');
  return new RegExp(GRADIENT_RE.source, 'i').test(text);
}

/**
 * Color stops of a gradient. Each stop is resolved through the token map first,
 * because a real page writes `var(--color-primary-soft) 0%` and the color only
 * exists after resolution. A stop whose value stays unresolved is reported with
 * its `unresolved` names so the caller can say what it could not read instead of
 * guessing.
 */
export function gradientColorStops(args, tokens) {
  const stops = splitTopLevel(args, ',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const stop of stops) {
    if (/^(?:from|to|at)\b/i.test(stop)) continue;
    if (/^(?:circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|contain|cover)\b/i.test(stop)) continue;
    const resolved = tokens ? resolveValue(stop, tokens) : { value: stop, unresolved: [] };
    const found = extractColorTokens(resolved.value);
    const positional = splitTopLevel(resolved.value, ' ').filter(Boolean);
    if (!found.length) {
      // "in oklch" style interpolation hints carry no color
      continue;
    }
    const first = found[0];
    // A leading size or position ("120% 120%") is not a color stop.
    if (positional.length && /^-?[\d.]+(px|%|rem|em|deg|turn|v[a-z]*)$/i.test(positional[0])) continue;
    out.push({
      raw: first.raw,
      stop,
      resolved: resolved.value.trim(),
      kind: first.kind,
      index: first.index,
      unresolved: resolved.unresolved,
    });
  }
  return out;
}
