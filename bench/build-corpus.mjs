#!/usr/bin/env node
// bench/build-corpus.mjs
// designcourt labeled corpus builder (W1). Deterministic, stdlib only, offline, no LLM.
//
//   node bench/build-corpus.mjs
//
// Writes:
//   bench/corpus/clean/base.html          the shared clean base page (labels: [])
//   bench/corpus/synth/<tell-id>.html     base + exactly one injected tell, per spec/CHECKS.md
//   bench/corpus/labeled.jsonl            one JSON object per line, schema from spec/BENCH-PROTOCOL.md
//
// It does NOT write bench/corpus/realslop/*.html. Those pages are authored by hand (curated real
// and escape regression material), and this builder reads them, verifies that the evidence cited
// for every label actually exists in the file, and computes the line number of that evidence. If a
// curated page is edited without updating its citation, the build fails instead of publishing a
// label that no longer matches the file.
//
// What is NOT in the corpus, and why:
//   DC-401 undeclared-token, DC-402 contract-family-drift, DC-403 contract-ban-violated,
//   DC-404 contract-section-missing: all four need a DesignContract as input. The corpus is
//     artifact material (HTML and CSS in, findings out, Lane A in spec/BENCH-PROTOCOL.md). A
//     contract cannot be injected into a page, so these four are tested by the contract lane and
//     its own fixtures, not here.
//   DC-317 motion-claimed-not-shown: the tell is "a contract declaring high motion against a page
//     with no real motion". It needs contract.dials.motion, so it has the same dependency and is
//     excluded for the same reason. If W6 ever passes a contract sidecar per file, this one becomes
//     testable and belongs here.
//   That leaves 38 tells (DC-001..DC-316) as corpus material, one clean base and one injected
//   variant each.
//
// Hard rule on the em-dash. The repository bans literal U+2014 and U+2013 in every file.
// The DC-001 tell is injected in HTML entity form (&mdash;). The judge parser (dom.mjs) decodes
// entities into their Unicode character in memory, so the tell is detected faithfully while all
// files on disk remain strictly free of literal em-dash and en-dash characters.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CORPUS = path.join(HERE, 'corpus');
const CLEAN_DIR = path.join(CORPUS, 'clean');
const SYNTH_DIR = path.join(CORPUS, 'synth');
const REAL_DIR = path.join(CORPUS, 'realslop');

const DOWN_ARROW = '\u2193';
const EMOJI_BOOKS = '\u{1F4DA}';

// ---------------------------------------------------------------------------
// The clean base page
// ---------------------------------------------------------------------------
//
// Real looking content for a real shaped product landing page: Harborline, berth and crew
// scheduling for mid-size marine terminals. Built to be genuinely clean:
//   - one radius scale, one accent hue family, colors only inside the token declaration block
//   - one primary CTA, three hero text elements, stacked (never split) section headers
//   - one eyebrow over nine sections, one icon family (inline SVG, 24px grid, stroke-width 1.75)
//   - 100dvh not 100vh, no gradient, no glow, no marquee, no scroll listener, no width or height
//     transition, and a prefers-reduced-motion block that covers everything animated
//   - every section carries an explicit family-<name> class so the layout family count is machine
//     readable: 9 sections, 8 distinct families
//   - a honest form with a label above every input, and no fake screenshot anywhere
//
// Anchors. The HTML comments (<!-- tokens -->, <!-- nav -->, <!-- hero --> ... and <!-- footer -->)
// are the insertion points for the injections. They are ordinary comments; they are not tells.

const BASE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Harborline: berth and crew scheduling for mid-size terminals</title>
<!-- tokens -->
<style>
/* token declaration block: the only place literal color values live in this page */
:root {
  --token-bg: #ffffff;
  --token-surface: #f4f6f8;
  --token-ink: #14202b;
  --token-muted: #5a6774;
  --token-accent: #1d4ed8;
  --token-accent-text: #1d4ed8;
  --token-accent-soft: #dbe6ff;
  --token-on-accent: #ffffff;
  --token-line: #d7dee5;
  --token-radius: 8px;
  --token-space-2: 0.5rem;
  --token-space-3: 0.75rem;
  --token-space-4: 1rem;
  --token-space-6: 1.5rem;
  --token-space-8: 2rem;
  --token-space-12: 3rem;
  --token-space-16: 4rem;
  --token-nav-h: 68px;
  --token-hero-pad-top: 4rem;
  --token-measure: 65ch;
  --token-font: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--token-bg); color: var(--token-ink); font-family: var(--token-font); font-size: 1rem; line-height: 1.55; }
h1, h2, h3 { margin: 0 0 var(--token-space-4); line-height: 1.15; letter-spacing: -0.015em; }
h1 { font-size: clamp(2rem, 4vw, 2.9rem); max-width: 20ch; }
h2 { font-size: 1.55rem; max-width: 30ch; }
h3 { font-size: 1.05rem; }
p { margin: 0 0 var(--token-space-4); }
a { color: var(--token-accent-text); text-underline-offset: 3px; }
ul, ol { margin: 0 0 var(--token-space-4); padding-left: 1.1rem; }
figure { margin: 0; }
svg { max-width: 100%; height: auto; }
.inner { width: min(1080px, 100% - 3rem); margin-inline: auto; }
.sec { padding-block: var(--token-space-16); border-top: 1px solid var(--token-line); }
.sec__intro { max-width: var(--token-measure); color: var(--token-muted); }
.eyebrow { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--token-accent-text); margin-bottom: var(--token-space-3); }
.btn { display: inline-block; padding: 0.7rem 1.1rem; border: 1px solid transparent; border-radius: var(--token-radius); font: inherit; font-weight: 600; cursor: pointer; transition: transform 140ms ease, opacity 140ms ease; }
.btn:active { transform: translateY(1px); }
.btn--primary { background: var(--token-accent); color: var(--token-on-accent); }
.btn--secondary { background: var(--token-bg); color: var(--token-ink); border-color: var(--token-line); }
:focus-visible { outline: 2px solid var(--token-accent); outline-offset: 2px; }
.icon { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.mark { width: 100%; fill: none; stroke: var(--token-accent); stroke-width: 1.75; stroke-linecap: round; }
.mark circle { fill: var(--token-accent-soft); stroke: none; }
.site-head { height: var(--token-nav-h); display: flex; align-items: center; border-bottom: 1px solid var(--token-line); }
.site-head .inner { display: flex; align-items: center; gap: var(--token-space-8); }
.brand { font-weight: 700; color: var(--token-ink); text-decoration: none; }
.site-nav { display: flex; gap: var(--token-space-6); margin-left: auto; }
.site-nav a { color: var(--token-muted); text-decoration: none; }
.sec--hero { display: flex; flex-direction: column; justify-content: center; min-height: 100dvh; padding-top: var(--token-hero-pad-top); border-top: 0; background: var(--token-bg); }
.hero__grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: var(--token-space-12); align-items: center; }
.lead { font-size: 1.12rem; color: var(--token-muted); max-width: 46ch; }
.media { border: 1px solid var(--token-line); border-radius: var(--token-radius); background: var(--token-surface); padding: var(--token-space-6); }
.family-prose-wide .inner { max-width: var(--token-measure); }
.note { border-left: 3px solid var(--token-line); padding-left: var(--token-space-4); color: var(--token-muted); }
.zigzag { display: grid; grid-template-columns: 1fr 1fr; gap: var(--token-space-12); align-items: center; }
.zigzag--reverse .zigzag__media { order: 2; }
.quote { margin: 0 0 var(--token-space-8); border-left: 3px solid var(--token-accent); padding-left: var(--token-space-6); }
.quote p { font-size: 1.25rem; }
.quote footer { color: var(--token-muted); font-size: 0.92rem; }
.proof { display: grid; grid-template-columns: 1fr 1fr; gap: var(--token-space-8); margin: 0; }
.proof dt { font-weight: 600; }
.proof dd { margin: 0; color: var(--token-muted); }
.steps { list-style: none; margin: 0; padding: 0; }
.steps__item { border-top: 1px solid var(--token-line); padding-block: var(--token-space-6); }
.steps__item p { margin: 0; color: var(--token-muted); max-width: var(--token-measure); }
.cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: var(--token-space-12); }
.cols__list { list-style: none; margin: 0; padding: 0; color: var(--token-muted); }
.cols__list li { border-top: 1px solid var(--token-line); padding-block: var(--token-space-3); }
.disc { border-top: 1px solid var(--token-line); }
.disc summary { display: flex; justify-content: space-between; gap: var(--token-space-6); padding-block: var(--token-space-4); font-weight: 600; cursor: pointer; }
.disc p { color: var(--token-muted); max-width: var(--token-measure); }
.disc__icon { flex: 0 0 auto; }
.form { display: grid; gap: var(--token-space-6); max-width: 34rem; }
.field { display: grid; gap: var(--token-space-2); }
.field label { font-weight: 600; font-size: 0.92rem; }
.field input { font: inherit; padding: 0.6rem 0.7rem; border: 1px solid var(--token-line); border-radius: var(--token-radius); background: var(--token-bg); color: var(--token-ink); }
.footer { border-top: 1px solid var(--token-line); padding-block: var(--token-space-12); color: var(--token-muted); }
.footer__grid { display: grid; grid-template-columns: 2fr 1fr; gap: var(--token-space-8); }
.footer__brand { font-weight: 700; color: var(--token-ink); margin-bottom: var(--token-space-2); }
.footer__nav { display: flex; flex-direction: column; gap: var(--token-space-2); }
.footer__nav a { color: var(--token-muted); text-decoration: none; }
.footer__legal { grid-column: 1 / -1; font-size: 0.88rem; margin: 0; }
@media (max-width: 760px) {
  .hero__grid, .zigzag, .cols, .proof, .footer__grid { grid-template-columns: 1fr; }
  .zigzag--reverse .zigzag__media { order: 0; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 1ms !important; animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
}
</style>
</head>
<body>
<!-- nav -->
<header class="site-head">
<div class="inner">
<a class="brand" href="#hero">Harborline</a>
<nav class="site-nav" aria-label="Main">
<a href="#approach">Approach</a>
<a href="#security">Security</a>
<a href="#faq">FAQ</a>
</nav>
</div>
</header>
<!-- hero -->
<section id="hero" class="sec sec--hero family-split-hero">
<div class="inner hero__grid">
<div class="hero__copy">
<h1>Berth schedules that hold up on a bad weather day</h1>
<p class="lead">Harborline puts berths, cranes and crew turnarounds on one board your dock office can read at a glance.</p>
<p class="hero__cta"><a class="btn btn--primary" href="#contact">Book a walkthrough</a></p>
</div>
<figure class="media hero__media" aria-hidden="true">
<svg class="mark" viewBox="0 0 320 220" role="presentation">
<path d="M12 196 C 74 196, 96 96, 156 96 S 226 150, 308 44"></path>
<path d="M12 152 C 84 152, 108 62, 168 62 S 240 108, 308 96"></path>
<circle cx="156" cy="96" r="7"></circle>
<circle cx="64" cy="176" r="5"></circle>
</svg>
</figure>
</div>
</section>
<!-- problem -->
<section id="problem" class="sec family-prose-wide">
<div class="inner">
<h2>Most delays start in a spreadsheet</h2>
<p class="sec__intro">Terminal offices still run on a shared sheet, two chat threads and a whiteboard that nobody updates after noon.</p>
<p>Crews call the dock office to ask which berth is free. The answer lives in a cell that was true two hours ago, and the plan is rebuilt by hand on every shift.</p>
<p class="note">One terminal we worked with kept four versions of the same morning plan.</p>
</div>
</section>
<!-- approach -->
<section id="approach" class="sec family-zigzag-media">
<div class="inner">
<p class="eyebrow">How the work runs</p>
<div class="zigzag">
<figure class="media" aria-hidden="true">
<svg class="mark" viewBox="0 0 320 220" role="presentation">
<path d="M24 180 L120 180 L120 108 L216 108 L216 40 L300 40"></path>
<circle cx="120" cy="108" r="6"></circle>
<circle cx="216" cy="40" r="6"></circle>
</svg>
</figure>
<div class="zigzag__copy">
<h2>One board, one version of the truth</h2>
<p>The board reads berth, crane and shift data from the systems you already run, so the dock office stops reconciling copies of the same morning.</p>
<p><a href="#process">How a rollout runs</a></p>
</div>
</div>
</div>
</section>
<!-- casestudy -->
<section id="casestudy" class="sec family-zigzag-media">
<div class="inner">
<div class="zigzag zigzag--reverse">
<div class="zigzag__copy">
<h2>Two weeks at Fathom Terminal Group</h2>
<p>Fathom runs four berths and eleven cranes. The board went live on a Tuesday morning shift, with the spreadsheet left open beside it for two weeks.</p>
</div>
<figure class="media" aria-hidden="true">
<svg class="mark" viewBox="0 0 320 220" role="presentation">
<path d="M20 60 C 90 60, 110 168, 180 168 S 250 88, 300 88"></path>
<circle cx="180" cy="168" r="6"></circle>
</svg>
</figure>
</div>
</div>
</section>
<!-- evidence -->
<section id="evidence" class="sec family-quote-rail">
<div class="inner">
<h2>What changed on the dock</h2>
<blockquote class="quote">
<p>We stopped calling the crane operator to ask which berth was free.</p>
<footer>Ines Duarte, Operations Lead, Fathom Terminal Group</footer>
</blockquote>
<dl class="proof">
<div><dt>Berth handover</dt><dd>One board, updated by the duty officer, visible to the whole gang.</dd></div>
<div><dt>Shift planning</dt><dd>The next plan starts from the current one instead of a blank sheet.</dd></div>
</dl>
</div>
</section>
<!-- process -->
<section id="process" class="sec family-stacked-steps">
<div class="inner">
<h2>From first call to live board</h2>
<p class="sec__intro">Four steps, about five weeks for a terminal of your size.</p>
<ol class="steps">
<li class="steps__item"><h3>Dock walk</h3><p>Half a day with the people who move the cargo and the people who answer the phone.</p></li>
<li class="steps__item"><h3>Board model</h3><p>Berths, cranes and shifts become one structure, agreed on paper before we build.</p></li>
<li class="steps__item"><h3>Parallel week</h3><p>The board runs beside the spreadsheet for seven shifts, and the gang decides which one to trust.</p></li>
<li class="steps__item"><h3>Handover</h3><p>Your duty officer owns the board and the rules behind it. We stay on call for the first month.</p></li>
</ol>
</div>
</section>
<!-- security -->
<section id="security" class="sec family-two-col-asym">
<div class="inner cols">
<div>
<h2>Who sees what</h2>
<p class="sec__intro">Crews see the shift they work. The dock office sees the day. Customs sees the manifest line it asked for.</p>
</div>
<ul class="cols__list">
<li>Role based access, set per terminal, not per vendor.</li>
<li>Every edit carries a name and a timestamp.</li>
<li>Data stays in the region your contract names.</li>
</ul>
</div>
</section>
<!-- faq -->
<section id="faq" class="sec family-disclosure">
<div class="inner">
<h2>Questions we get on the first call</h2>
<details class="disc">
<summary>Does it replace our terminal operating system?<span class="disc__icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></span></summary>
<p>No. Harborline reads the berth and crane data that system already holds.</p>
</details>
<details class="disc">
<summary>How long until the gang trusts it?<span class="disc__icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></span></summary>
<p>Two weeks of running both boards side by side is usually enough.</p>
</details>
</div>
</section>
<!-- contact -->
<section id="contact" class="sec family-form-panel">
<div class="inner">
<h2>Talk to the dock team</h2>
<p class="sec__intro">Thirty minutes on your terminal, with your berth list and your worst shift.</p>
<form class="form" action="/contact" method="post">
<div class="field"><label for="name">Name</label><input id="name" name="name" type="text" placeholder="Duty officer name"></div>
<div class="field"><label for="terminal">Terminal</label><input id="terminal" name="terminal" type="text" placeholder="Terminal or port"></div>
<div class="field"><label for="shift">Worst shift</label><input id="shift" name="shift" type="text" placeholder="Optional, one line"></div>
<button class="btn btn--secondary" type="submit">Send request</button>
</form>
</div>
</section>
<!-- footer -->
<footer class="footer">
<div class="inner footer__grid">
<div>
<p class="footer__brand">Harborline</p>
<p>Pier 7, Viana do Castelo, Portugal</p>
</div>
<nav class="footer__nav" aria-label="Footer">
<a href="#approach">Approach</a>
<a href="#security">Security</a>
<a href="#faq">FAQ</a>
</nav>
<p class="footer__legal">Harborline Lda, 2026. All rights reserved.</p>
</div>
</footer>
</body>
</html>
`;

// Anchors reused by several injections.
const A_HERO_CTA = '<p class="hero__cta"><a class="btn btn--primary" href="#contact">Book a walkthrough</a></p>';
const A_PROBLEM_H2 = '<h2>Most delays start in a spreadsheet</h2>';
const A_PROBLEM_INTRO = '<p class="sec__intro">Terminal offices still run on a shared sheet, two chat threads and a whiteboard that nobody updates after noon.</p>';
const A_APPROACH_P = '<p>The board reads berth, crane and shift data from the systems you already run, so the dock office stops reconciling copies of the same morning.</p>';
const A_CASE_H2 = '<h2>Two weeks at Fathom Terminal Group</h2>';
const A_QUOTE_FOOTER = '<footer>Ines Duarte, Operations Lead, Fathom Terminal Group</footer>';
const A_EVIDENCE_H2 = '<h2>What changed on the dock</h2>';
const A_PROCESS_H2 = '<h2>From first call to live board</h2>';
const A_PROCESS_INTRO = '<p class="sec__intro">Four steps, about five weeks for a terminal of your size.</p>';
const A_SECURITY_H2 = '<h2>Who sees what</h2>';
const A_SECURITY_INTRO = '<p class="sec__intro">Crews see the shift they work. The dock office sees the day. Customs sees the manifest line it asked for.</p>';
const A_FAQ_H2 = '<h2>Questions we get on the first call</h2>';
const A_NAME_LABEL = '<label for="name">Name</label>';
const A_HERO_RULE = '.sec--hero { display: flex; flex-direction: column; justify-content: center; min-height: 100dvh; padding-top: var(--token-hero-pad-top); border-top: 0; background: var(--token-bg); }';
const A_MEDIA_RULE = '.media { border: 1px solid var(--token-line); border-radius: var(--token-radius); background: var(--token-surface); padding: var(--token-space-6); }';
const A_TOKEN_LINE = '  --token-line: #d7dee5;';
const A_STYLE_END = '</style>';
const A_BODY_END = '</body>';
const A_MOTION_BLOCK = `@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 1ms !important; animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
}
`;
const A_FOOTER_LEGAL = '<p class="footer__legal">Harborline Lda, 2026. All rights reserved.</p>';
const A_FOOTER_BRAND_RULE = '.footer__brand { font-weight: 700; color: var(--token-ink); margin-bottom: var(--token-space-2); }';

// ---------------------------------------------------------------------------
// The tells
// ---------------------------------------------------------------------------
//
// One entry per tell id in spec/CHECKS.md, minus the contract dependent ones listed at the top of
// this file. Every entry edits the base page and nothing else: the injection is the smallest edit
// that adds exactly that tell. "markers" must match the variant, and the hygiene linter (below)
// must find that variant's own tell and no other, otherwise the build fails as contaminated.
//
// severity is copied from spec/CHECKS.md and must stay in sync with it.

const TELLS = [
  {
    check: 'DC-001',
    tell: 'em-dash',
    severity: 'blocker',
    markers: [/&mdash;/],
    edits: [
      {
        find: A_PROBLEM_H2,
        replace: '<h2>Most delays start in a spreadsheet &mdash; and they end in the same cell</h2>',
        why: 'one em-dash added to the problem heading in entity form (&mdash;); decoded by dom.mjs on scan, keeping the source files free of literal em-dash characters',
      },
    ],
  },
  {
    check: 'DC-002',
    tell: 'filler-verbs',
    severity: 'major',
    markers: [/\bElevate\b/, /\bseamless\b/, /\bnext-gen\b/, /\bunleashes\b/],
    edits: [
      {
        find: A_APPROACH_P,
        replace: '<p>Elevate your terminal with a seamless, next-gen board that unleashes the full power of your berth data.</p>',
        why: 'the approach paragraph rewritten with four filler verbs from the CHECKS.md list',
      },
    ],
  },
  {
    check: 'DC-003',
    tell: 'generic-names',
    severity: 'major',
    markers: [/\bAcme\b/, /\bJane Doe\b/],
    edits: [
      { find: A_CASE_H2, replace: '<h2>Two weeks at Acme Industrial</h2>', why: 'real case study name replaced with Acme' },
      {
        find: A_QUOTE_FOOTER,
        replace: '<footer>Jane Doe, Operations Lead, Acme Industrial</footer>',
        why: 'named customer replaced with Jane Doe',
      },
    ],
  },
  {
    check: 'DC-004',
    tell: 'fake-precise-numbers',
    severity: 'major',
    markers: [/4\.1x/, /99\.99%/],
    edits: [
      {
        find: '</dl>',
        replace: '<p class="note">Terminals on Harborline move cargo 4.1x faster and hold 99.99% berth accuracy.</p>\n</dl>',
        why: 'two fake precise numbers added, with no mock marker and no cited source',
      },
    ],
  },
  {
    check: 'DC-005',
    tell: 'duplicate-cta-intent',
    severity: 'minor',
    markers: [/Schedule your walkthrough/],
    edits: [
      {
        find: A_HERO_CTA,
        replace: `${A_HERO_CTA}\n<p class="hero__cta"><a class="btn btn--primary" href="#contact">Schedule your walkthrough</a></p>`,
        why: 'a second primary CTA with the same intent as the first (hero text elements go from 3 to 4, still at the hero limit)',
      },
    ],
  },
  {
    check: 'DC-006',
    tell: 'subtext-length',
    severity: 'minor',
    markers: [/which is where the delays actually begin/],
    edits: [
      {
        find: A_PROBLEM_INTRO,
        replace: '<p class="sec__intro">Terminal offices still run on a shared sheet, two chat threads and a whiteboard that nobody updates after noon, and the duty officer rebuilds the same berth plan from scratch on every shift, which is where the delays actually begin.</p>',
        why: 'the problem section subtext goes from 20 to 40 words, past the 25 word limit; it is a section subtext and not the hero, so DC-316 is untouched',
      },
    ],
  },
  {
    check: 'DC-007',
    tell: 'mixed-language',
    severity: 'minor',
    markers: [/<html lang="pt-BR">/],
    edits: [
      {
        find: '<html lang="en">',
        replace: '<html lang="pt-BR">',
        why: 'the declared lang is flipped to pt-BR while the copy stays English',
      },
    ],
  },
  {
    check: 'DC-008',
    tell: 'placeholder-as-label',
    severity: 'major',
    markers: [/placeholder="Duty officer name"/],
    edits: [
      {
        find: A_NAME_LABEL,
        replace: '',
        why: 'the label for the name input is deleted, leaving the placeholder as the only label',
      },
    ],
  },
  {
    check: 'DC-101',
    tell: 'purple-gradient',
    severity: 'blocker',
    markers: [/radial-gradient\(120% 120% at 100% 0%, var\(--token-accent-soft\) 0%, transparent 60%\)/, /--token-accent-soft: #ddd6fe;/],
    edits: [
      { find: '  --token-accent: #1d4ed8;', replace: '  --token-accent: #7c3aed;', why: 'accent moves to a violet hue' },
      { find: '  --token-accent-text: #1d4ed8;', replace: '  --token-accent-text: #7c3aed;', why: 'text accent follows the same violet hue' },
      { find: '  --token-accent-soft: #dbe6ff;', replace: '  --token-accent-soft: #ddd6fe;', why: 'the soft tint that feeds the gradient stop becomes a violet tint' },
      {
        find: A_HERO_RULE,
        replace: '.sec--hero { display: flex; flex-direction: column; justify-content: center; min-height: 100dvh; padding-top: var(--token-hero-pad-top); border-top: 0; background:\n    radial-gradient(120% 120% at 100% 0%, var(--token-accent-soft) 0%, transparent 60%),\n    var(--token-surface); }',
        why: 'the hero background gains a radial gradient whose stop is a violet variable, the same shape as designkit/styles/layout.css line 323',
      },
    ],
  },
  {
    check: 'DC-102',
    tell: 'neon-glow',
    severity: 'blocker',
    markers: [/--token-glow: rgb\(124 58 237 \/ 0\.55\)/, /box-shadow: 0 0 44px var\(--token-glow\)/],
    edits: [
      {
        find: A_TOKEN_LINE,
        replace: `${A_TOKEN_LINE}\n  --token-glow: rgb(124 58 237 / 0.55);`,
        why: 'the glow color is declared inside the token declaration block on purpose, so DC-105 hardcoded-hex does not also fire',
      },
      {
        find: '.btn--primary { background: var(--token-accent); color: var(--token-on-accent); }',
        replace: '.btn--primary { background: var(--token-accent); color: var(--token-on-accent); box-shadow: 0 0 44px var(--token-glow); }',
        why: 'a saturated colored blur added to the primary button',
      },
    ],
  },
  {
    check: 'DC-103',
    tell: 'premium-consumer-palette',
    severity: 'major',
    markers: [/#f5f1ea/, /#b08947/, /#9a2436/, /#1a1814/],
    edits: [
      { find: '  --token-bg: #ffffff;', replace: '  --token-bg: #f5f1ea;', why: 'warm paper background' },
      { find: '  --token-surface: #f4f6f8;', replace: '  --token-surface: #efeae0;', why: 'warm paper surface' },
      { find: '  --token-ink: #14202b;', replace: '  --token-ink: #1a1814;', why: 'warm near-black espresso ink' },
      { find: '  --token-muted: #5a6774;', replace: '  --token-muted: #6b6255;', why: 'warm muted text, still above 4.5:1 on the beige background' },
      { find: '  --token-accent: #1d4ed8;', replace: '  --token-accent: #b08947;', why: 'brass accent' },
      { find: '  --token-accent-text: #1d4ed8;', replace: '  --token-accent-text: #9a2436;', why: 'oxblood text accent, chosen so link contrast stays above 4.5:1 and DC-106 does not also fire' },
      { find: '  --token-accent-soft: #dbe6ff;', replace: '  --token-accent-soft: #e8dfcb;', why: 'soft brass tint' },
      { find: '  --token-line: #d7dee5;', replace: '  --token-line: #e0d6c4;', why: 'warm hairline' },
      { find: '  --token-on-accent: #ffffff;', replace: '  --token-on-accent: #1a1814;', why: 'dark text on brass, so the button keeps AA contrast' },
    ],
  },
  {
    check: 'DC-104',
    tell: 'inter-default',
    severity: 'blocker',
    markers: [/--token-font: Inter,/],
    edits: [
      {
        find: '  --token-font: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
        replace: '  --token-font: Inter, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
        why: 'Inter becomes the first entry of the body font stack',
      },
    ],
  },
  {
    check: 'DC-105',
    tell: 'hardcoded-hex',
    severity: 'major',
    markers: [/border-left: 3px solid #ff6b35;/],
    edits: [
      {
        find: '.note { border-left: 3px solid var(--token-line); padding-left: var(--token-space-4); color: var(--token-muted); }',
        replace: '.note { border-left: 3px solid #ff6b35; padding-left: var(--token-space-4); color: var(--token-muted); }',
        why: 'the rule for .note stops using the token and hardcodes a literal hex as a UI color, outside the token declaration block',
      },
    ],
  },
  {
    check: 'DC-106',
    tell: 'contrast-aa',
    severity: 'blocker',
    markers: [/--token-muted: #a8b0b8;/],
    edits: [
      { find: '  --token-muted: #5a6774;', replace: '  --token-muted: #a8b0b8;', why: 'the muted text token drops to 2.2:1 on white; it is the body subtext, not large text, so the 4.5:1 rule applies' },
    ],
  },
  {
    check: 'DC-107',
    tell: 'multi-accent',
    severity: 'major',
    markers: [/--token-accent-alt: #0f766e;/, /color: var\(--token-accent-alt\)/],
    edits: [
      {
        find: A_TOKEN_LINE,
        replace: `${A_TOKEN_LINE}\n  --token-accent-alt: #0f766e;`,
        why: 'a second accent hue family (teal) is declared',
      },
      {
        find: A_FOOTER_BRAND_RULE,
        replace: '.footer__brand { font-weight: 700; color: var(--token-accent-alt); margin-bottom: var(--token-space-2); }',
        why: 'and it is actually used, in the footer brand, next to the blue accent',
      },
    ],
  },
  {
    check: 'DC-108',
    tell: 'mixed-radii',
    severity: 'minor',
    markers: [/border-radius: 28px;/],
    edits: [
      { find: A_STYLE_END, replace: '.quote { border-radius: 28px; }\n</style>', why: 'a second radius scale (28px) enters a page whose only scale was 8px' },
    ],
  },
  {
    check: 'DC-201',
    tell: 'three-equal-cards',
    severity: 'blocker',
    markers: [/class="three-up"/],
    edits: [
      {
        find: '<!-- evidence -->',
        replace: `<!-- three-up -->
<section id="teams" class="sec family-three-up">
<div class="inner">
<h2>Built for three teams</h2>
<div class="three-up">
<article class="card"><h3>Dock office</h3><p>Owns the berth plan for the day and answers the phone.</p></article>
<article class="card"><h3>Crane crews</h3><p>Read the next lift without calling anyone.</p></article>
<article class="card"><h3>Customs desk</h3><p>Sees the manifest line it asked for, and nothing else.</p></article>
</div>
</div>
</section>
<!-- evidence -->`,
        why: 'a section added whose structure is three sibling cards of equal size in one row',
      },
      {
        find: A_STYLE_END,
        replace: '.three-up { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--token-space-6); }\n.card { border: 1px solid var(--token-line); border-radius: var(--token-radius); padding: var(--token-space-6); }\n</style>',
        why: 'and the CSS that makes the three cards structurally equal',
      },
    ],
  },
  {
    check: 'DC-202',
    tell: 'repeated-zigzag',
    severity: 'major',
    markers: [/id="rollout"/],
    edits: [
      {
        find: '<!-- evidence -->',
        replace: `<!-- rollout -->
<section id="rollout" class="sec family-zigzag-media">
<div class="inner">
<div class="zigzag">
<figure class="media" aria-hidden="true">
<svg class="mark" viewBox="0 0 320 220" role="presentation">
<path d="M20 168 C 96 168, 112 52, 188 52 S 250 124, 300 124"></path>
<circle cx="188" cy="52" r="6"></circle>
</svg>
</figure>
<div class="zigzag__copy">
<h2>Rollout in one shift</h2>
<p>The board replaces the whiteboard on a Tuesday morning shift, and the spreadsheet stays open until the gang stops opening it.</p>
</div>
</div>
</div>
</section>
<!-- evidence -->`,
        why: 'a third consecutive zigzag section inserted between casestudy and evidence: the approach, casestudy and rollout sections now run the same media plus text alternation three times in a row',
      },
    ],
  },
  {
    check: 'DC-203',
    tell: 'bento-empty-cell',
    severity: 'major',
    markers: [/bento__cell--empty/],
    edits: [
      {
        find: '<!-- evidence -->',
        replace: `<!-- capabilities -->
<section id="capabilities" class="sec family-bento">
<div class="inner">
<h2>Everything the board covers</h2>
<div class="bento">
<div class="bento__cell bento__cell--wide"><h3>Berth plan</h3><p>Every berth, its vessel and its window for the day.</p></div>
<div class="bento__cell"><h3>Crane slots</h3><p>Lifts assigned to a crane and a crew.</p></div>
<div class="bento__cell bento__cell--empty" aria-hidden="true"></div>
<div class="bento__cell"><h3>Shift handover</h3><p>What the next gang needs to know, written once.</p></div>
</div>
</div>
</section>
<!-- evidence -->`,
        why: 'a bento grid with four cells, three of them fed by content and one left empty; the cell count does not match the content count',
      },
      {
        find: A_STYLE_END,
        replace: '.bento { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--token-space-4); }\n.bento__cell { border: 1px solid var(--token-line); border-radius: var(--token-radius); padding: var(--token-space-6); }\n.bento__cell--wide { grid-column: span 2; }\n</style>',
        why: 'the bento CSS, with cells of different spans so the tell is the empty cell and not equal sizing',
      },
    ],
  },
  {
    check: 'DC-204',
    tell: 'split-header',
    severity: 'major',
    markers: [/class="split-header"/],
    edits: [
      {
        find: `${A_PROCESS_H2}\n${A_PROCESS_INTRO}`,
        replace: `<div class="split-header">\n${A_PROCESS_H2}\n<p class="split-header__aside">Four steps, about five weeks for a terminal of your size.</p>\n</div>`,
        why: 'the process section header changes from a stacked h2 plus intro into a large headline left with a loose paragraph right',
      },
      {
        find: A_STYLE_END,
        replace: '.split-header { display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--token-space-8); align-items: end; }\n.split-header__aside { color: var(--token-muted); margin: 0; }\n</style>',
        why: 'the CSS that makes it a split header rather than a stack',
      },
    ],
  },
  {
    check: 'DC-205',
    tell: 'h-screen',
    severity: 'minor',
    markers: [/min-height: 100vh;/],
    edits: [
      { find: 'min-height: 100dvh;', replace: 'min-height: 100vh;', why: 'dvh loses to vh on the hero, which is the h-screen habit: the mobile browser chrome is no longer accounted for' },
    ],
  },
  {
    check: 'DC-206',
    tell: 'low-layout-diversity',
    severity: 'major',
    markers: [/family-three-up|family-prose-wide/],
    edits: [
      { find: '<section id="evidence" class="sec family-quote-rail">', replace: '<section id="evidence" class="sec family-prose-wide">', why: 'family collapsed to prose-wide' },
      { find: '<section id="process" class="sec family-stacked-steps">', replace: '<section id="process" class="sec family-prose-wide">', why: 'family collapsed to prose-wide' },
      { find: '<section id="security" class="sec family-two-col-asym">', replace: '<section id="security" class="sec family-prose-wide">', why: 'family collapsed to prose-wide' },
      { find: '<section id="faq" class="sec family-disclosure">', replace: '<section id="faq" class="sec family-prose-wide">', why: 'family collapsed to prose-wide' },
      { find: '<section id="contact" class="sec family-form-panel">', replace: '<section id="contact" class="sec family-prose-wide">', why: 'family collapsed to prose-wide' },
      { find: '<section id="casestudy" class="sec family-zigzag-media">', replace: '<section id="casestudy" class="sec family-zigzag-media family-zigzag-media">', why: 'kept as zigzag, no change in behaviour' },
    ],
    note: 'This tell is about the distribution of layout families across a page, so it cannot be injected with one token. Five family classes are collapsed to prose-wide, leaving three distinct families (split-hero, prose-wide, zigzag-media) across the nine sections, which is below the four family floor for a page with eight or more sections. Nothing else about the sections changes.',
  },
  {
    check: 'DC-301',
    tell: 'eyebrow-density',
    severity: 'minor',
    markers: [/<p class="eyebrow">The cost today<\/p>/, /<p class="eyebrow">The proof<\/p>/],
    edits: [
      { find: A_PROBLEM_H2, replace: '<p class="eyebrow">The cost today</p>\n' + A_PROBLEM_H2, why: 'eyebrow added' },
      { find: A_EVIDENCE_H2, replace: '<p class="eyebrow">The proof</p>\n' + A_EVIDENCE_H2, why: 'eyebrow added' },
      { find: A_PROCESS_H2, replace: '<p class="eyebrow">The rollout</p>\n' + A_PROCESS_H2, why: 'eyebrow added' },
      { find: A_SECURITY_H2, replace: '<p class="eyebrow">The access model</p>\n' + A_SECURITY_H2, why: 'eyebrow added' },
      { find: A_FAQ_H2, replace: '<p class="eyebrow">The questions</p>\n' + A_FAQ_H2, why: 'eyebrow added' },
    ],
    note: 'Six eyebrows over nine sections against a limit of ceil(9/3) = 3. Five additions of the same kind, because the tell is the density and not any single eyebrow.',
  },
  {
    check: 'DC-302',
    tell: 'scroll-cues',
    severity: 'major',
    markers: [/Scroll for the walkthrough/],
    edits: [
      {
        find: A_HERO_CTA,
        replace: `${A_HERO_CTA}\n<p class="hero__cue">Scroll for the walkthrough <span aria-hidden="true">${DOWN_ARROW}</span></p>`,
        why: 'a scroll instruction plus a down arrow added under the hero CTA (hero text elements go from 3 to 4, still at the hero limit)',
      },
    ],
  },
  {
    check: 'DC-303',
    tell: 'decorative-chrome',
    severity: 'minor',
    markers: [/class="dots"/, /class="media__label"/],
    edits: [
      {
        find: '<a class="brand" href="#hero">Harborline</a>',
        replace: '<a class="brand" href="#hero"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>Harborline</a>',
        why: 'decorative status dots next to the brand',
      },
      {
        find: '<figure class="media" aria-hidden="true">\n<svg class="mark" viewBox="0 0 320 220" role="presentation">\n<path d="M24 180 L120 180 L120 108 L216 108 L216 40 L300 40"></path>',
        replace: '<figure class="media" aria-hidden="true">\n<p class="media__label">Live board</p>\n<svg class="mark" viewBox="0 0 320 220" role="presentation">\n<path d="M24 180 L120 180 L120 108 L216 108 L216 40 L300 40"></path>',
        why: 'a decorative label placed over the approach media',
      },
      {
        find: A_STYLE_END,
        replace: '.dots { display: inline-flex; gap: 4px; margin-right: var(--token-space-2); }\n.dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--token-line); }\n.media__label { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--token-muted); margin-bottom: var(--token-space-2); }\n</style>',
        why: 'the CSS for both pieces of chrome',
      },
    ],
  },
  {
    check: 'DC-304',
    tell: 'fake-screenshot',
    severity: 'blocker',
    markers: [/class="fakeui"/],
    edits: [
      {
        find: '<!-- evidence -->',
        replace: `<!-- preview -->
<section id="preview" class="sec family-preview">
<div class="inner">
<h2>A look at the board</h2>
<div class="fakeui" role="img" aria-label="Board preview">
<div class="fakeui__bar"><span></span><span></span><span></span></div>
<div class="fakeui__cols">
<ul class="fakeui__tasks">
<li>MV Ardent, berth 3, 06:40</li>
<li>MV Solano, berth 1, 07:10</li>
<li>crane 2, lift 14</li>
<li>gang B handover, 13:00</li>
</ul>
<div class="fakeui__panel">
<div class="fakeui__row"></div>
<div class="fakeui__row"></div>
<div class="fakeui__row"></div>
</div>
</div>
</div>
</div>
</section>
<!-- evidence -->`,
        why: 'a fake product screenshot assembled from divs and list items, presented as an image with role="img"; the stacked rows are vertical so the section is not also three equal cards',
      },
      {
        find: A_STYLE_END,
        replace: `.fakeui { border: 1px solid var(--token-line); border-radius: var(--token-radius); background: var(--token-surface); overflow: hidden; }
.fakeui__bar { display: flex; gap: 6px; padding: var(--token-space-3); border-bottom: 1px solid var(--token-line); }
.fakeui__bar span { width: 8px; height: 8px; border-radius: 50%; background: var(--token-line); }
.fakeui__cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--token-space-4); padding: var(--token-space-4); }
.fakeui__tasks { list-style: none; margin: 0; padding: 0; font-size: 0.88rem; color: var(--token-muted); }
.fakeui__tasks li { border-bottom: 1px solid var(--token-line); padding-block: var(--token-space-2); }
.fakeui__row { height: 28px; background: var(--token-line); border-radius: var(--token-radius); margin-bottom: var(--token-space-2); }
</style>`,
        why: 'the CSS for the fake screenshot',
      },
    ],
  },
  {
    check: 'DC-305',
    tell: 'fake-credits',
    severity: 'minor',
    markers: [/Dorothea Lange/],
    edits: [
      {
        find: A_FOOTER_LEGAL,
        replace: '<p class="credit">Portrait: Dorothea Lange, Farm Security Administration, 1936.</p>\n' + A_FOOTER_LEGAL,
        why: 'a photo credit naming a real photographer, on a page that contains no photograph at all',
      },
    ],
  },
  {
    check: 'DC-306',
    tell: 'version-footer',
    severity: 'major',
    markers: [/v0\.6\.2, build 0048/],
    edits: [
      {
        find: A_FOOTER_LEGAL,
        replace: '<p class="footer__version">v0.6.2, build 0048</p>\n' + A_FOOTER_LEGAL,
        why: 'a version and build number added to a marketing footer',
      },
    ],
  },
  {
    check: 'DC-307',
    tell: 'numbered-eyebrow',
    severity: 'major',
    markers: [/001 \/ Index/],
    edits: [
      {
        find: A_EVIDENCE_H2,
        replace: '<p class="eyebrow">001 / Index</p>\n' + A_EVIDENCE_H2,
        why: 'a numbered eyebrow, which brings the page to two eyebrows over nine sections and stays under the DC-301 limit of three',
      },
    ],
  },
  {
    check: 'DC-308',
    tell: 'emoji-as-icon',
    severity: 'minor',
    markers: [/\u{1F4DA}/u],
    edits: [
      {
        find: '<a href="#faq">FAQ</a>\n</nav>\n</div>\n</header>',
        replace: `<a href="#faq">FAQ <span aria-hidden="true">${EMOJI_BOOKS}</span></a>\n</nav>\n</div>\n</header>`,
        why: 'an emoji used as a UI icon in the main navigation',
      },
    ],
  },
  {
    check: 'DC-309',
    tell: 'mixed-icon-family',
    severity: 'minor',
    markers: [/icon--filled/, /icon--bold/],
    edits: [
      {
        find: '<h3>Dock walk</h3>',
        replace: '<h3>Dock walk <span class="steps__icon"><svg class="icon icon--filled" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l8 16H2z"></path></svg><svg class="icon icon--bold" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"></path></svg></span></h3>',
        why: 'a second icon family (filled, 20px) and an inconsistent stroke width (2.5) join the base family (stroked, 24px, 1.75)',
      },
      {
        find: A_STYLE_END,
        replace: '.steps__icon { display: inline-flex; gap: 6px; vertical-align: middle; }\n.icon--filled { fill: currentColor; stroke: none; }\n.icon--bold { stroke-width: 2.5; }\n</style>',
        why: 'the CSS for the second family',
      },
    ],
  },
  {
    check: 'DC-310',
    tell: 'scroll-listener-animation',
    severity: 'major',
    markers: [/addEventListener\('scroll'/, /document\.querySelector\('\.hero__grid'\)\.style\.transform/],
    edits: [
      {
        find: A_BODY_END,
        replace: `<script>
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    document.querySelector('.hero__grid').style.transform = 'translateY(' + (y * 0.08) + 'px)';
  });
}
</script>
</body>`,
        why: 'a scroll listener driving an animation on the hero. The reduced motion branch is guarded in the script itself, so DC-312 is genuinely satisfied and only this tell is present',
      },
    ],
  },
  {
    check: 'DC-311',
    tell: 'property-animation',
    severity: 'minor',
    markers: [/transition: width 260ms ease;/],
    edits: [
      {
        find: A_MEDIA_RULE,
        replace: '.media { border: 1px solid var(--token-line); border-radius: var(--token-radius); background: var(--token-surface); padding: var(--token-space-6); transition: width 260ms ease; }',
        why: 'a transition on width, which is a layout property, added to the media panel; the base only transitions transform and opacity',
      },
    ],
  },
  {
    check: 'DC-312',
    tell: 'reduced-motion-missing',
    severity: 'major',
    markers: [/animation: drift 3.4s/, /@keyframes drift/],
    edits: [
      { find: A_MOTION_BLOCK, replace: '', why: 'the prefers-reduced-motion block is removed' },
      {
        find: A_STYLE_END,
        replace: '.hero__media { animation: drift 3.4s ease-in-out infinite alternate; }\n@keyframes drift { from { transform: translateY(-10px); } to { transform: translateY(10px); } }\n</style>',
        why: 'and real motion is added, so the page now animates with no reduced motion handling',
      },
    ],
    note: 'Two edits, one tell: "motion above the threshold with no prefers-reduced-motion". Removing the handler is half of the offense and adding the motion is the other half. Animating transform only, so DC-311 is not also present.',
  },
  {
    check: 'DC-313',
    tell: 'multi-marquee',
    severity: 'minor',
    markers: [/class="marquee"/],
    edits: [
      {
        find: '<!-- problem -->',
        replace: `<!-- ticker -->
<section id="ticker" class="sec family-marquee-strip">
<div class="inner">
<div class="marquee"><div class="marquee__track"><span>berth planning</span><span>crane slots</span><span>shift handover</span><span>berth planning</span><span>crane slots</span><span>shift handover</span></div></div>
<div class="marquee"><div class="marquee__track"><span>manifest lines</span><span>gang rosters</span><span>weather holds</span><span>manifest lines</span><span>gang rosters</span><span>weather holds</span></div></div>
</div>
</section>
<!-- problem -->`,
        why: 'two marquees on one page (the strip carries phrases, not client wordmarks, so DC-314 is not also present)',
      },
      {
        find: A_STYLE_END,
        replace: '.marquee { overflow: hidden; border-top: 1px solid var(--token-line); padding-block: var(--token-space-3); }\n.marquee__track { display: inline-flex; gap: var(--token-space-8); white-space: nowrap; animation: slide 18s linear infinite; }\n@keyframes slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }\n</style>',
        why: 'the marquee CSS. The base reduced motion block covers it, so DC-312 is not also present',
      },
    ],
  },
  {
    check: 'DC-314',
    tell: 'text-logo-wall',
    severity: 'minor',
    markers: [/class="logo-wall"/],
    edits: [
      {
        find: '<!-- problem -->',
        replace: `<!-- customers -->
<section id="customers" class="sec family-logowall">
<div class="inner">
<h2>Terminals already on Harborline</h2>
<div class="logo-wall">
<span class="logo-wall__mark">Northline</span>
<span class="logo-wall__mark">Cabo Verde Terminals</span>
<span class="logo-wall__mark">Ironquay</span>
<span class="logo-wall__mark">Silverdock</span>
</div>
</div>
</section>
<!-- problem -->`,
        why: 'a "used by" wall built from text wordmarks instead of logo marks, placed directly under the hero as DESIGN.md section 4.2 requires',
      },
      {
        find: A_STYLE_END,
        replace: '.logo-wall { display: flex; flex-wrap: wrap; gap: var(--token-space-8); align-items: baseline; }\n.logo-wall__mark { font-weight: 700; color: var(--token-muted); }\n</style>',
        why: 'the CSS for the wordmark wall',
      },
    ],
  },
  {
    check: 'DC-315',
    tell: 'nav-too-tall',
    severity: 'minor',
    markers: [/--token-nav-h: 96px;/],
    edits: [
      { find: '  --token-nav-h: 68px;', replace: '  --token-nav-h: 96px;', why: 'the navigation grows past 80px on desktop' },
    ],
  },
  {
    check: 'DC-316',
    tell: 'hero-discipline',
    severity: 'major',
    markers: [/--token-hero-pad-top: 8rem;/],
    edits: [
      {
        find: '  --token-hero-pad-top: 4rem;',
        replace: '  --token-hero-pad-top: 8rem;',
        why: 'hero top padding goes past the 6rem ceiling. One sub-condition of the tell: the headline stays short, the subtext stays under 20 words and the hero keeps its three text elements',
      },
    ],
  },
  // DC-401, DC-402, DC-403, DC-404 and DC-317 are deliberately absent. See the header comment.
];

// ---------------------------------------------------------------------------
// Curated real pages and the escape regression set
// ---------------------------------------------------------------------------
//
// These files are hand authored and live in bench/corpus/realslop/. Each label cites the selector
// and a needle; the builder finds that needle in the file, refuses to run if it is missing or
// ambiguous, and writes the real line number into labeled.jsonl. Labels are read off the file, not
// guessed, and the citation is the proof.

const REALSLOP = [
  {
    file: 'ai-landing-classic.html',
    id: 'real-ai-landing-classic',
    source: 'curated-real',
    labels: [
      { tell: 'purple-gradient', severity: 'blocker', selector: '.hero background', needle: 'radial-gradient(120% 120% at 100% 0%, var(--brand-violet) 0%, transparent 62%)' },
      { tell: 'inter-default', severity: 'blocker', selector: ':root --font', needle: '--font: Inter, ui-sans-serif, system-ui, sans-serif;' },
      { tell: 'three-equal-cards', severity: 'blocker', selector: '.features__grid', needle: '.features__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }' },
      { tell: 'em-dash', severity: 'blocker', selector: '.hero h1 (entity form)', needle: 'Build faster &mdash; ship calmer' },
      { tell: 'fake-screenshot', severity: 'blocker', selector: '.mock-window', needle: '<div class="mock-window" role="img" aria-label="Product screenshot">' },
      { tell: 'scroll-cues', severity: 'major', selector: '.hero__cue', needle: '<p class="hero__cue">Scroll to explore</p>' },
      { tell: 'h-screen', severity: 'minor', selector: '.hero', needle: 'height: 100vh;' },
      { tell: 'contrast-aa', severity: 'blocker', selector: '.hero p on the violet gradient', needle: 'color: #b6a8f5;' },
      { tell: 'neon-glow', severity: 'blocker', selector: '.btn--primary', needle: 'box-shadow: 0 0 36px rgba(124, 58, 237, 0.75);' },
    ],
    note: 'the em-dash is present in entity form (&mdash;), which is how a generator often emits it; a detector that does not decode HTML entities will miss this one',
  },
  {
    file: 'warm-premium-studio.html',
    id: 'real-warm-premium-studio',
    source: 'curated-real',
    labels: [
      { tell: 'premium-consumer-palette', severity: 'major', selector: ':root palette', needle: '--paper: #f5f1ea;' },
      { tell: 'text-logo-wall', severity: 'minor', selector: '.logo-wall', needle: '<div class="logo-wall">' },
      { tell: 'numbered-eyebrow', severity: 'major', selector: '.eyebrow--numbered', needle: '001 / Index' },
      { tell: 'version-footer', severity: 'major', selector: '.footer__version', needle: 'v2.4.1, build 0091' },
      { tell: 'three-equal-cards', severity: 'blocker', selector: '.tiers', needle: '<div class="tiers">' },
      { tell: 'eyebrow-density', severity: 'minor', selector: '.eyebrow across seven sections', needle: '<p class="eyebrow">The practice</p>' },
      { tell: 'split-header', severity: 'major', selector: '.split-header', needle: '<div class="split-header">' },
    ],
  },
  {
    file: 'dashboard-shell-slides.html',
    id: 'real-dashboard-shell-slides',
    source: 'curated-real',
    labels: [
      { tell: 'fake-screenshot', severity: 'blocker', selector: '.shot', needle: '<div class="shot" role="img" aria-label="Dashboard">' },
      { tell: 'h-screen', severity: 'minor', selector: '.slide', needle: 'height: 100vh;' },
      { tell: 'scroll-listener-animation', severity: 'major', selector: 'inline script', needle: "window.addEventListener('scroll', onScroll);" },
      { tell: 'property-animation', severity: 'minor', selector: '.slide', needle: 'transition: height 400ms ease;' },
      { tell: 'neon-glow', severity: 'blocker', selector: '.kpi--live', needle: 'filter: drop-shadow(0 0 18px #22d3ee);' },
      { tell: 'low-layout-diversity', severity: 'major', selector: 'all nine sections use .slide and .grid-2', needle: '<section class="slide family-slide" id="s9">' },
    ],
  },
  {
    file: 'agency-portfolio-zigzag.html',
    id: 'real-agency-portfolio-zigzag',
    source: 'curated-real',
    labels: [
      { tell: 'repeated-zigzag', severity: 'major', selector: '.row--flip used five times in a row', needle: '<section class="row row--flip family-zigzag-media" id="row5">' },
      { tell: 'emoji-as-icon', severity: 'minor', selector: '.nav a', needle: '<span aria-hidden="true">&#x2728;</span>' },
      { tell: 'mixed-icon-family', severity: 'minor', selector: '.row__icon', needle: '.row__icon--filled { fill: currentColor; stroke: none; }' },
      { tell: 'scroll-cues', severity: 'major', selector: '.hero__cue', needle: 'Scroll for more' },
      { tell: 'duplicate-cta-intent', severity: 'minor', selector: '.nav .btn and .hero .btn', needle: '<p><a class="btn btn--primary" href="#contact">Start a project</a></p>' },
      { tell: 'mixed-language', severity: 'minor', selector: 'html lang against English copy', needle: '<html lang="pt-BR">' },
    ],
  },
  {
    file: 'bento-crypto-launch.html',
    id: 'real-bento-crypto-launch',
    source: 'curated-real',
    labels: [
      { tell: 'bento-empty-cell', severity: 'major', selector: '.bento', needle: '<div class="bento__cell bento__cell--empty"></div>' },
      { tell: 'purple-gradient', severity: 'blocker', selector: '.bento__cell--brand', needle: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' },
      { tell: 'hardcoded-hex', severity: 'major', selector: 'inline style outside the token block', needle: 'style="background: #0f0f23;"' },
      { tell: 'multi-accent', severity: 'major', selector: '.pill--teal next to the violet accent', needle: '.pill--teal { background: #14b8a6; color: #042f2e;' },
      { tell: 'fake-credits', severity: 'minor', selector: '.credit', needle: '<p class="credit">Photograph: Ansel Adams, 1941.</p>' },
      { tell: 'mixed-radii', severity: 'minor', selector: '.card (32px) against the 12px system', needle: 'border-radius: 32px;' },
      { tell: 'fake-precise-numbers', severity: 'major', selector: '.stats', needle: '<li>99.99% uptime since launch</li>' },
    ],
  },
  {
    file: 'onboarding-contrast-fail.html',
    id: 'real-onboarding-contrast-fail',
    source: 'curated-real',
    labels: [
      { tell: 'contrast-aa', severity: 'blocker', selector: '.helper on the white panel', needle: 'color: #b9c2cc;' },
      { tell: 'placeholder-as-label', severity: 'major', selector: '.field input#email', needle: 'placeholder="Work email"' },
      { tell: 'generic-names', severity: 'major', selector: '.proof blockquote cite', needle: 'Jane Doe, Head of Operations, Acme' },
      { tell: 'filler-verbs', severity: 'major', selector: '.hero h1', needle: 'Elevate your onboarding' },
      { tell: 'subtext-length', severity: 'minor', selector: '.steps p', needle: 'We read the last twelve months of support tickets, the two documents your team actually opens, and the questions new customers keep asking, then we rebuild the first screen around the answers that showed up most often, which usually means fewer fields and a shorter wait.' },
      { tell: 'hero-discipline', severity: 'major', selector: '.hero', needle: 'padding-top: 9rem;' },
    ],
  },
  {
    file: 'marquee-event-site.html',
    id: 'real-marquee-event-site',
    source: 'curated-real',
    labels: [
      { tell: 'multi-marquee', severity: 'minor', selector: '.marquee used three times', needle: '<div class="marquee marquee--slow" data-speed="0.4">' },
      { tell: 'decorative-chrome', severity: 'minor', selector: '.dots and .media__label', needle: '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' },
      { tell: 'version-footer', severity: 'major', selector: '.footer__version', needle: 'v1.0.3, build 2024' },
      { tell: 'low-layout-diversity', severity: 'major', selector: 'eight sections, three families', needle: '<section class="band family-band" id="band8">' },
      { tell: 'inter-default', severity: 'blocker', selector: '.site', needle: "font-family: Inter, 'Helvetica Neue', Arial, sans-serif;" },
      { tell: 'fake-screenshot', severity: 'blocker', selector: '.schedule-mock', needle: '<div class="schedule-mock" role="img" aria-label="Schedule">' },
    ],
  },
  {
    file: 'tiers-three-cards.html',
    id: 'real-tiers-three-cards',
    source: 'curated-real',
    labels: [
      { tell: 'three-equal-cards', severity: 'blocker', selector: '.tiers', needle: '<section class="tiers family-three-up">' },
      { tell: 'bento-empty-cell', severity: 'major', selector: '.bento', needle: '<div class="bento__cell"></div>' },
      { tell: 'scroll-listener-animation', severity: 'major', selector: 'inline script', needle: "document.addEventListener('scroll', reveal);" },
      { tell: 'contrast-aa', severity: 'blocker', selector: '.price__note on the dark card', needle: 'color: #64748b;' },
      { tell: 'version-footer', severity: 'major', selector: '.footer__meta', needle: 'v3.2.0, build 1120' },
      { tell: 'eyebrow-density', severity: 'minor', selector: '.eyebrow in nine sections', needle: '<p class="eyebrow">Plans</p>' },
    ],
  },
  {
    file: 'escape-regression.html',
    id: 'esc-layout-css-gradient',
    source: 'escape-regression',
    labels: [
      { tell: 'purple-gradient', severity: 'blocker', selector: '.hero background', needle: 'radial-gradient(120% 120% at 100% 0%, var(--color-primary-soft) 0%, transparent 60%)' },
      { tell: 'hardcoded-hex', severity: 'major', selector: '.cta (literal yellow outside the token block)', needle: 'background: #ffd24a;' },
    ],
    note: 'Reproduces the offense in designkit/styles/layout.css line 323: a radial gradient whose stop is a variable that resolves to a purple. Built with CSS named colors only (rebeccapurple, mediumpurple) so the palette check in the legacy gate cannot see a hex value, and with no Inter, no em-dash, no generic name, no scroll cue and eyebrows under the limit, so the legacy gate returns PASS on it. Verified by running the legacy gate, see the build report.',
  },
];

// ---------------------------------------------------------------------------
// Hygiene linter
// ---------------------------------------------------------------------------
//
// Not the Judge. This is the builder checking its own work at the pattern level: the clean base must
// trip nothing, and every injected variant must trip its own tell and nothing else. It proves the
// injections are surgical for the tells that are pattern-detectable by text. Cleanliness against
// the real Judge is a separate thing and belongs to W2 and W6.

const HEX_OUTSIDE_TOKENS = /#[0-9a-fA-F]{3,8}\b/;
const FORBIDDEN = [
  { tell: 'em-dash', re: /&mdash;|&ndash;|[\u2014\u2013]/ },
  { tell: 'filler-verbs', re: /\b(elevate|seamless|unleash|revolutionize|next-gen|supercharge|game-changing|transform your)\b/i },
  { tell: 'generic-names', re: /\b(jane doe|john doe|acme|nexus|smartflow|lorem ipsum)\b/i },
  { tell: 'fake-precise-numbers', re: /\b(99\.99%|4\.1x|48k|10x)\b/i },
  { tell: 'inter-default', re: /\bInter\b/ },
  { tell: 'h-screen', re: /100vh/ },
  { tell: 'purple-gradient', re: /(radial|linear|conic)-gradient/ },
  { tell: 'neon-glow', re: /--token-glow|box-shadow:\s*0 0 \d+px/ },
  { tell: 'premium-consumer-palette', re: /#(f5f1ea|efeae0|b08947|9a2436|1a1814|e8dfcb|e0d6c4|6b6255)/i },
  { tell: 'scroll-cues', re: /\bScroll\b|\u2193/ },
  { tell: 'version-footer', re: /\bv\d+\.\d+(\.\d+)?\b/ },
  { tell: 'emoji-as-icon', re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u },
  { tell: 'multi-marquee', re: /marquee/ },
  { tell: 'scroll-listener-animation', re: /addEventListener\((['"])scroll\1/ },
  { tell: 'property-animation', re: /transition:\s*(width|height|top|left)\b/ },
  { tell: 'mixed-radii', re: /border-radius:\s*28px/ },
  { tell: 'three-equal-cards', re: /class="three-up"/ },
  { tell: 'bento-empty-cell', re: /bento__cell--empty/ },
  { tell: 'split-header', re: /class="split-header"/ },
  { tell: 'decorative-chrome', re: /class="(dots|media__label)"/ },
  { tell: 'fake-screenshot', re: /class="fakeui"/ },
  { tell: 'mixed-icon-family', re: /icon--(filled|bold)/ },
  { tell: 'text-logo-wall', re: /class="logo-wall"/ },
];

function stripTokenBlock(html) {
  const start = html.indexOf(':root {');
  if (start === -1) return html;
  const end = html.indexOf('\n}', start);
  if (end === -1) return html;
  return html.slice(0, start) + html.slice(end + 3);
}

function lint(html) {
  const outside = stripTokenBlock(html);
  const found = new Set();
  for (const rule of FORBIDDEN) {
    if (rule.re.test(outside)) found.add(rule.tell);
  }
  if (HEX_OUTSIDE_TOKENS.test(outside)) found.add('hardcoded-hex');
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function applyEdits(tell, html) {
  let out = html;
  for (const edit of tell.edits) {
    const expect = edit.expect === undefined ? 1 : edit.expect;
    const parts = out.split(edit.find);
    const count = parts.length - 1;
    if (count !== expect) {
      throw new Error(`${tell.check} ${tell.tell}: anchor found ${count} times, expected ${expect}: ${JSON.stringify(edit.find.slice(0, 80))}`);
    }
    out = parts.join(edit.replace);
  }
  return out;
}

function lineOf(text, needle) {
  const lines = text.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(needle)) hits.push(i + 1);
  }
  return hits;
}

function citation(tell, file, needle, selector) {
  const clipped = needle.length > 96 ? `${needle.slice(0, 93)}...` : needle;
  return `${tell}: ${file}, ${selector}, line {LINE}: ${clipped}`;
}

function main() {
  mkdirSync(CLEAN_DIR, { recursive: true });
  mkdirSync(SYNTH_DIR, { recursive: true });
  mkdirSync(REAL_DIR, { recursive: true });

  const failures = [];
  const report = [];
  const rows = [];

  // The base page must be clean.
  const baseFindings = lint(BASE);
  if (baseFindings.length > 0) {
    failures.push(`clean base trips the hygiene linter: ${baseFindings.join(', ')}`);
  }
  if (/[\u2014\u2013]/.test(BASE)) failures.push('clean base contains a dash character');

  // Base row.
  writeFileSync(path.join(CLEAN_DIR, 'base.html'), BASE, 'utf8');
  rows.push({
    id: 'clean-base',
    html: 'bench/corpus/clean/base.html',
    labels: [],
    label_severity: 'clean',
    injection: [],
    source: 'synthetic-injected',
  });

  // Synthetic pairs.
  const seenTells = new Set();
  for (const tell of TELLS) {
    if (seenTells.has(tell.tell)) failures.push(`duplicate tell id in TELLS: ${tell.tell}`);
    seenTells.add(tell.tell);
    if (!['blocker', 'major', 'minor'].includes(tell.severity)) failures.push(`${tell.tell}: bad severity ${tell.severity}`);
    let html;
    try {
      html = applyEdits(tell, BASE);
    } catch (err) {
      failures.push(err.message);
      continue;
    }
    for (const marker of tell.markers || []) {
      if (!marker.test(html)) failures.push(`${tell.check} ${tell.tell}: marker ${marker} missing after injection`);
    }
    if (html === BASE) failures.push(`${tell.check} ${tell.tell}: injection changed nothing`);
    const found = lint(html);
    const unexpected = found.filter((t) => t !== tell.tell);
    if (unexpected.length > 0) failures.push(`${tell.check} ${tell.tell}: injection also trips ${unexpected.join(', ')}`);
    if (!found.includes(tell.tell)) {
      if (!(tell.markers || []).length) failures.push(`${tell.check} ${tell.tell}: nothing observable changed`);
    }
    const file = `${tell.tell}.html`;
    writeFileSync(path.join(SYNTH_DIR, file), html, 'utf8');
    const injection = tell.edits.map((edit) => `${tell.tell}: ${edit.why}`);
    if (tell.note) injection.push(`${tell.tell}: construction note: ${tell.note}`);
    rows.push({
      id: `synth-${tell.check.toLowerCase()}-${tell.tell}`,
      html: `bench/corpus/synth/${file}`,
      labels: [tell.tell],
      label_severity: tell.severity,
      injection,
      source: 'synthetic-injected',
    });
    report.push(`  ${tell.check} ${tell.tell.padEnd(28)} ${tell.severity.padEnd(8)} lint=${found.join(',') || 'none'}`);
  }

  // Curated real and escape regression, verified against the cited evidence.
  for (const page of REALSLOP) {
    const abs = path.join(REAL_DIR, page.file);
    if (!existsSync(abs)) {
      failures.push(`curated page missing: ${abs}`);
      continue;
    }
    const text = readFileSync(abs, 'utf8');
    const labels = [];
    const injection = [];
    const severities = [];
    for (const label of page.labels) {
      const hits = lineOf(text, label.needle);
      if (hits.length === 0) {
        failures.push(`${page.file}: cited evidence for ${label.tell} not found: ${JSON.stringify(label.needle.slice(0, 70))}`);
        continue;
      }
      if (hits.length > 1) {
        failures.push(`${page.file}: cited evidence for ${label.tell} is ambiguous (${hits.length} lines)`);
        continue;
      }
      labels.push(label.tell);
      severities.push(label.severity);
      injection.push(citation(label.tell, page.file, label.needle, label.selector).replace('{LINE}', String(hits[0])));
    }
    if (page.note) injection.push(`source note: ${page.note}`);
    if (labels.length !== page.labels.length) continue;
    const label_severity = severities.includes('blocker') ? 'blocker' : severities.includes('major') ? 'major' : 'minor';
    rows.push({
      id: page.id,
      html: `bench/corpus/realslop/${page.file}`,
      labels,
      label_severity,
      injection,
      source: page.source,
    });
    report.push(`  ${page.file.padEnd(34)} ${label_severity.padEnd(8)} ${labels.length} labels`);
  }

  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const jsonl = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  writeFileSync(path.join(CORPUS, 'labeled.jsonl'), jsonl, 'utf8');

  const bySource = {};
  const bySeverity = {};
  const tells = new Set();
  for (const row of rows) {
    bySource[row.source] = (bySource[row.source] || 0) + 1;
    bySeverity[row.label_severity] = (bySeverity[row.label_severity] || 0) + 1;
    for (const tell of row.labels) tells.add(tell);
  }

  console.log('DESIGNCOURT CORPUS BUILD');
  console.log(`  root: ${ROOT}`);
  console.log(`  clean base:  1 file   (labels: none)`);
  console.log(`  synth pairs: ${TELLS.length} files (one tell each, from CHECKS.md DC-001..DC-316)`);
  console.log(`  realslop:    ${REALSLOP.length} files (curated real plus the escape regression page)`);
  console.log(`  labeled.jsonl rows: ${rows.length}, distinct tell labels: ${tells.size}`);
  console.log(`  by source:   ${JSON.stringify(bySource)}`);
  console.log(`  by severity: ${JSON.stringify(bySeverity)}`);
  console.log('');
  console.log('per tell:');
  for (const line of report) console.log(line);
  console.log('');
  if (failures.length > 0) {
    console.log(`CORPUS BUILD: FAIL (${failures.length} problems)`);
    for (const failure of failures) console.log(`  FAIL ${failure}`);
    process.exit(1);
  }
  console.log('CORPUS BUILD: PASS');
  console.log(jsonl.split('\n')[0]);
}

main();
