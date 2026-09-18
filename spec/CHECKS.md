# CHECKS: the authoritative check list

> **Owner:** orchestrator. The Judge (W2) implements exactly this. No check may be added, removed, or renumbered by a worker.
> **Source of truth:** the prose bans in `~/projetos/designkit/DESIGN.md` sections 4.1 to 4.6, plus the verified gap below.

## The verified gap this list exists to close

`DESIGN.md:50` bans the "AI purple gradient". `designkit/styles/layout.css:323` contains `radial-gradient(..., var(--color-primary-soft), transparent)`. Running `designkit/scripts/anti-slop-check.py` on that page returns PASS (168 checks, 24 files, 0 failures). The gate is blind to the offense because the check set covers seven lexical tells and no surface or layout check at all.

That is the concrete reason this product exists: **the ban was written in prose and never mechanized.** Each check below is a mechanized ban.

## Severity policy

- **blocker**: the artifact must not ship. Ships broken trust or is the named number one tell.
- **major**: visible quality damage that a professional would never ship.
- **minor**: cheap to fix, separates good from excellent.

---

## DC-0xx: lexical and copy

| id | tell_id | severity | detects |
|---|---|---|---|
| DC-001 | `em-dash` | blocker | em-dash or en-dash in any visible text, alt, aria-label, or button |
| DC-002 | `filler-verbs` | major | elevate, seamless, unleash, revolutionize, next-gen, transform your, supercharge, game-changing |
| DC-003 | `generic-names` | major | Jane Doe, John Doe, Acme, Nexus, SmartFlow, Lorem ipsum in shipped copy |
| DC-004 | `fake-precise-numbers` | major | 99.99%, 4.1x, 48k, 10x without a `<!-- mock -->` marker or a cited source |
| DC-005 | `duplicate-cta-intent` | minor | more than one primary CTA expressing the same intent |
| DC-006 | `subtext-length` | minor | a paragraph over 25 words in a section subtext |
| DC-007 | `mixed-language` | minor | declared `lang` disagrees with the dominant language of the copy |
| DC-008 | `placeholder-as-label` | major | an input with a placeholder and no associated label |

## DC-1xx: color, surface, contrast

| id | tell_id | severity | detects |
|---|---|---|---|
| DC-101 | `purple-gradient` | blocker | a gradient whose stops are purple, violet, or indigo at saturation above the ban threshold |
| DC-102 | `neon-glow` | blocker | box-shadow or filter glow with a saturated colored blur |
| DC-103 | `premium-consumer-palette` | major | the beige plus brass plus oxblood combination as the page palette |
| DC-104 | `inter-default` | blocker | Inter as the default or first body font-family |
| DC-105 | `hardcoded-hex` | major | a hex or rgb literal used as a UI color outside the token declaration block |
| DC-106 | `contrast-aa` | blocker | computed contrast below 4.5:1 for body text or 3:1 for large text |
| DC-107 | `multi-accent` | major | more than one accent hue family in use |
| DC-108 | `mixed-radii` | minor | more than one border-radius scale in use |

## DC-2xx: layout

| id | tell_id | severity | detects |
|---|---|---|---|
| DC-201 | `three-equal-cards` | blocker | three or more sibling cards of equal size in one row as the page structure |
| DC-202 | `repeated-zigzag` | major | more than 2 consecutive sections with the same image plus text alternating pattern |
| DC-203 | `bento-empty-cell` | major | a bento grid where cell count does not match content count, or all cells are visually identical |
| DC-204 | `split-header` | major | a large headline left with a loose paragraph right, used as a section header |
| DC-205 | `h-screen` | minor | `height: 100vh` instead of `100dvh` |
| DC-206 | `low-layout-diversity` | major | fewer than 4 distinct layout families in a page with 8 or more sections |

## DC-3xx: structure and hygiene

| id | tell_id | severity | detects |
|---|---|---|---|
| DC-301 | `eyebrow-density` | minor | eyebrow count above ceil(sections / 3), counting the hero as one |
| DC-302 | `scroll-cues` | major | "Scroll", a down arrow, or an equivalent scroll instruction |
| DC-303 | `decorative-chrome` | minor | decorative status dots, brand strips in the hero footer, or decorative labels over images |
| DC-304 | `fake-screenshot` | blocker | a fake screenshot assembled from divs (task list, terminal, dashboard of rectangles) |
| DC-305 | `fake-credits` | minor | photo credits naming a real person with no real photograph |
| DC-306 | `version-footer` | major | a version or build number in a marketing footer |
| DC-307 | `numbered-eyebrow` | major | numbered eyebrows such as 00 / INDEX or 001.Capabilities |
| DC-308 | `emoji-as-icon` | minor | emoji used as a UI icon in a product surface |
| DC-309 | `mixed-icon-family` | minor | two or more icon families or inconsistent stroke widths |
| DC-310 | `scroll-listener-animation` | major | `window.addEventListener('scroll')` driving an animation |
| DC-311 | `property-animation` | minor | transition or animation on width, height, top, or left |
| DC-312 | `reduced-motion-missing` | major | motion above the threshold with no `prefers-reduced-motion` handling |
| DC-313 | `multi-marquee` | minor | more than one marquee on a page |
| DC-314 | `text-logo-wall` | minor | a logo wall built from text wordmarks rather than logo marks |
| DC-315 | `nav-too-tall` | minor | navigation above 80px or wrapping to two lines on desktop |
| DC-316 | `hero-discipline` | major | hero with a headline over 2 lines, subtext over 20 words, top padding over 6rem, more than 4 text elements, or a CTA below the fold |
| DC-317 | `motion-claimed-not-shown` | minor | a contract declaring high motion against a page with no real motion |

## DC-4xx: contract adherence

| id | tell_id | severity | detects |
|---|---|---|---|
| DC-401 | `undeclared-token` | major | a color or size value in the artifact matching no value declared in the contract token plan |
| DC-402 | `contract-family-drift` | minor | a section rendered with a layout family absent from `contract.layout_plan` |
| DC-403 | `contract-ban-violated` | blocker | the artifact violates a ban listed in `contract.bans` |
| DC-404 | `contract-section-missing` | major | a section declared in `contract.layout_plan` that does not exist in the artifact |

---

## Implementation notes for W2

1. **No browser.** Parse HTML and CSS with a small stdlib parser in `src/judge/dom.mjs`. Where a check needs layout geometry that static analysis cannot honestly know, the check must say so in `why` and stay at `minor`, never invent a blocker.
2. **Contrast (DC-106).** Resolve `var(--x)` from a tokens file passed with `--tokens`. When a value cannot be resolved, emit a `minor` `unresolved-color` note instead of a false blocker. Literal colors are always resolved.
3. **Purple gradient (DC-101).** Must fire on the exact pattern in `designkit/styles/layout.css:323`: a gradient whose stops resolve to a purple or violet hue. Hue window and saturation threshold go in one exported constant so the benchmark can cite it.
4. **Determinism.** No randomness, no clock, no network, no locale-dependent formatting.
5. **Required fixtures.** W2 ships `src/judge/__fixtures__/`: `clean.html`, `slop.html` (one injected instance of every blocker and major check), and `escape-regression.html` (a page carrying the purple gradient exactly as `layout.css` does, used to prove the regression is closed).
