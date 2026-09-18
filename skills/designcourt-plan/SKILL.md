---
name: designcourt-plan
description: "Use when a brief needs a design decision before any code. Turns the brief into a ruling contract: one mode, four dials, layout families, token plan, bans, and the case where the ruling is wrong."
version: 0.1.0
---

# designcourt-plan

You produce the ruling. Input: a brief. Output: a `DesignContract` saved to `.designcourt/contract.json`, version 1.0, schema frozen in `spec/contract.schema.md`.

A ruling is not a mood board. Every line must be a decision someone could disobey, because the judge checks disobedience: `DC-401` undeclared token, `DC-402` family drift, `DC-403` ban violated, `DC-404` section missing.

## 0. The loop you are inside

This skill runs steps 1 to 3 of the designcourt loop. The order is fixed.

1. write the brief to `.designcourt/brief.md` from `templates/brief.md`
2. run the planner: `node src/contract/cli.mjs .designcourt/brief.md --out .designcourt/contract.json`
3. state the contract back in three lines using `templates/contract-review.md`, wait for a veto only if the user asked to approve
4. build against the contract
5. run the judge: `node src/judge/cli.mjs index.html --json --contract .designcourt/contract.json --tokens tokens.css --out .designcourt/verdict-1.json`
6. fix every blocker and major
7. re-run the judge until `clean`, or until 3 iterations, whichever comes first
8. if the third verdict is still not `clean`, STOP: do not ship, report the residual findings and hand the artifact over as unverified

Command status is tracked in `skills/designcourt/SKILL.md` section 4. If the planner CLI does not exist yet, hand author the contract against `spec/contract.schema.md` and say so in the report.

## 1. Invocation

```
node src/contract/cli.mjs .designcourt/brief.md --out .designcourt/contract.json
```

Fallbacks, in order:

```
npm run plan -- .designcourt/brief.md > .designcourt/contract.json
node src/contract/plan.mjs .designcourt/brief.md > .designcourt/contract.json
```

Both the `cli.mjs` path and `--out` are planned interfaces owned by W5 (see `package.json` scripts and `spec/BUILD-SPEC.md` gate A4). If neither exists, hand author `.designcourt/contract.json` against `spec/contract.schema.md` and say so in the final report. The contract is binding either way.

## 2. Write the brief first

Copy `templates/brief.md` to `.designcourt/brief.md`. Do not go to the planner with a one sentence request. The three fields the schema requires are `goal`, `audience`, `success_metric`, and each needs a real sentence:

- bad: `goal: "a landing page"`, `audience: "people"`, `success_metric: "conversions"`
- good: `goal: "get a technical buyer to book a 20 minute call"`, `audience: "platform engineers comparing three vendors on a Friday afternoon"`, `success_metric: "booked call from the pricing section without a scroll back up"`

One clarifying question maximum, and only when two readings of the brief would produce different modes. Otherwise infer and write the assumption into the brief.

## 3. Step 1, choose the mode

The mode comes from the surface, not from the industry. Four values only.

| mode | when the surface is | what the design is doing | typical dials (expressiveness, density, motion, ornament) |
|---|---|---|---|
| `persuade` | landing, pricing, signup, campaign | the design is the product, one action matters | 4, 2, 3, 3 |
| `operate` | dashboard, admin, settings, app shell | density and consistency beat expression | 2, 4, 2, 1 |
| `read` | docs, guides, changelog, editorial | structure that serves comprehension | 2, 2, 1, 2 |
| `experience` | portfolio, gallery, showcase | the artifact leads from the first viewport, the interface recedes | 5, 1, 4, 4 |

Wrong mode examples: a bank's developer docs are `read`, not `persuade`, even though the company sells. A portfolio site that is really a services pitch is `persuade`, not `experience`.

Dials run 1 to 5 (integers, schema enforced). Never leave them at the baseline silently: state each dial value and the brief line that justifies it in `rationale.trade_off` or in the why fields.

## 4. Step 2, fill every field

```
contract_version   "1.0"
brief.goal         from the brief, one sentence
brief.audience     from the brief, one sentence
brief.success_metric  from the brief, one sentence
mode               exactly one of persuade | operate | read | experience
rationale.problem  the user problem this page solves
rationale.user     who, in what situation, on what device
rationale.trade_off  what you deliberately give up and why
dials.expressiveness, dials.density, dials.motion, dials.ornament   1 to 5
layout_plan        one entry per section: section, family, why
token_plan.accent  the one accent, with its rationale
token_plan.neutrals  the neutral strategy, for example one cool grey ramp at three steps
token_plan.type_scale  the scale strategy, for example 1.25 ratio, four steps, no Inter default
bans               real tell ids from spec/CHECKS.md, 4 or more
not_for            the concrete case where this ruling is the wrong call
decisions_used     ids that exist in decisions/index.json, 1 or more
```

Forbidden values: `additionalProperties: false` means an extra key makes the contract invalid. No comments in the JSON, no trailing commas.

`bans` starts from the universal tells every page must respect, then adds the mode specific ones:

- universal: `em-dash`, `inter-default`, `hardcoded-hex`, `purple-gradient`, `neon-glow`, `three-equal-cards`, `fake-screenshot`, `eyebrow-density`
- `persuade` adds: `filler-verbs`, `duplicate-cta-intent`, `scroll-cues`, `hero-discipline`
- `operate` adds: `placeholder-as-label`, `mixed-icon-family`, `mixed-radii`, `contrast-aa`
- `read` adds: `subtext-length`, `fake-precise-numbers`, `split-header`, `text-logo-wall`
- `experience` adds: `motion-claimed-not-shown`, `reduced-motion-missing`, `decorative-chrome`, `multi-marquee`

All of those ids exist in `spec/CHECKS.md`. Do not invent tell ids: an unknown id makes the ban unenforceable and the judge cannot match it.

`not_for` must name a concrete situation. Schema minimum is 12 characters, but a disclaimer is a failure:

- bad: `not_for: "not suitable for every project"`
- good: `not_for: "a regulated claims flow where every figure needs a citation and no accent colour is allowed, this ruling uses one saturated accent and decorative imagery"`

## 5. Step 3, make layout_plan obey the two invariants

1. With 5 or more sections, at least 3 distinct `family` values must appear.
2. No `family` value may repeat in adjacent entries.

Use a family vocabulary, not a mood adjective. Working set, extend it when the plan needs it (the schema only requires `family` to be 3+ characters):

```
split-asymmetric        uneven two column, 7/5 or 8/4
stacked-editorial       full width text blocks, measure capped near 65ch
zigzag-pair             image plus text, alternates side, max 2 in a row
grid-equal-cards        only when the content is genuinely 3 peer items
bento-mixed             N cells for N contents, 2 or 3 cells visually distinct
feature-led-fullbleed   one oversized asset carries the section
two-column-tabular      label column plus value column, good for operate
scroll-pinned           sticky media with travelling copy
horizontal-rail         sideways sequence with a visible affordance
index-list              dense rows, no cards, hairline dividers
```

`grid-equal-cards` earns its place only when the content is genuinely three peer items with equal weight. Three equal cards as the page structure is `DC-201`, a blocker.

## 6. Worked examples, one per mode

### persuade, a scheduling tool landing page

```json
{
  "mode": "persuade",
  "dials": { "expressiveness": 4, "density": 2, "motion": 3, "ornament": 3 },
  "layout_plan": [
    { "section": "hero", "family": "split-asymmetric", "why": "headline needs a real product surface next to it, not a centered stack" },
    { "section": "problem", "family": "stacked-editorial", "why": "the complaint is text, give it width and measure" },
    { "section": "how-it-works", "family": "horizontal-rail", "why": "three steps read as a sequence, not as three peer cards" },
    { "section": "proof", "family": "two-column-tabular", "why": "numbers need labels in a fixed column to be scannable" },
    { "section": "pricing", "family": "bento-mixed", "why": "two plans and one guarantee, unequal weight is the truth here" },
    { "section": "close", "family": "feature-led-fullbleed", "why": "one action left, one surface behind it" }
  ],
  "bans": ["em-dash", "inter-default", "purple-gradient", "neon-glow", "filler-verbs", "duplicate-cta-intent", "scroll-cues", "hero-discipline", "three-equal-cards"],
  "not_for": "an enterprise procurement page where the buyer needs a feature matrix and an SOC2 link before any emotional beat, this ruling trades detail for momentum"
}
```

### operate, an incident console

```json
{
  "mode": "operate",
  "dials": { "expressiveness": 2, "density": 4, "motion": 2, "ornament": 1 },
  "layout_plan": [
    { "section": "status-bar", "family": "index-list", "why": "one line, always visible, no chrome" },
    { "section": "live-queue", "family": "two-column-tabular", "why": "operators scan a column, not cards" },
    { "section": "timeline", "family": "scroll-pinned", "why": "the timeline is the reference while detail changes" },
    { "section": "detail-panel", "family": "stacked-editorial", "why": "one record, full width, readable at 3am" },
    { "section": "runbooks", "family": "index-list", "why": "frequently used rows beat a card grid" }
  ],
  "bans": ["em-dash", "inter-default", "hardcoded-hex", "purple-gradient", "neon-glow", "placeholder-as-label", "mixed-icon-family", "mixed-radii", "contrast-aa"],
  "not_for": "a marketing launch of the same product, this density and this restraint read as cold on a page that needs to persuade"
}
```

### read, a self hosted product docs landing

```json
{
  "mode": "read",
  "dials": { "expressiveness": 2, "density": 2, "motion": 1, "ornament": 2 },
  "layout_plan": [
    { "section": "intro", "family": "stacked-editorial", "why": "one paragraph that says what this is" },
    { "section": "install", "family": "two-column-tabular", "why": "label plus command, copyable, scannable" },
    { "section": "concepts", "family": "index-list", "why": "concepts are a list, cards would fake hierarchy" },
    { "section": "example", "family": "feature-led-fullbleed", "why": "one real output deserves the full width" },
    { "section": "next", "family": "horizontal-rail", "why": "path through the docs is sequential" }
  ],
  "bans": ["em-dash", "inter-default", "purple-gradient", "hardcoded-hex", "subtext-length", "fake-precise-numbers", "split-header", "text-logo-wall"],
  "not_for": "a launch announcement, this ruling has no persuasive surface and no motion budget for one"
}
```

### experience, a photographer portfolio

```json
{
  "mode": "experience",
  "dials": { "expressiveness": 5, "density": 1, "motion": 4, "ornament": 4 },
  "layout_plan": [
    { "section": "lead", "family": "feature-led-fullbleed", "why": "one frame owns the first viewport" },
    { "section": "series", "family": "bento-mixed", "why": "three bodies of work of unequal size, cells match contents" },
    { "section": "series-detail", "family": "scroll-pinned", "why": "media stays while the caption travels" },
    { "section": "about", "family": "stacked-editorial", "why": "the interface recedes, the text is quiet" },
    { "section": "contact", "family": "split-asymmetric", "why": "one line plus one action, no form theatre" }
  ],
  "bans": ["em-dash", "inter-default", "purple-gradient", "neon-glow", "fake-screenshot", "motion-claimed-not-shown", "reduced-motion-missing", "decorative-chrome", "multi-marquee"],
  "not_for": "a commission pitch where the buyer needs pricing and process up front, this ruling makes them scroll the work first"
}
```

Note the pattern in all four: 5 to 6 sections, every family distinct or non adjacent, the reason column says why the content wants that shape, and `not_for` names a real alternative page.

## 7. Validate before you hand it over

Run these checks by hand if the planner does not print them, and fix, then re-run:

1. `contract_version` is `"1.0"` and there are no extra keys anywhere.
2. `mode` is one of the four.
3. All four dials are integers 1 to 5.
4. `layout_plan` has 3 or more entries, each with `section`, `family`, `why`, and `why` is 8+ characters.
5. Distinct families 3 or more when sections are 5 or more.
6. No family repeated in adjacent entries.
7. `bans` has 4 or more entries and every entry appears in `spec/CHECKS.md`.
8. `not_for` is 12+ characters and names a situation.
9. Every `decisions_used` id exists in `decisions/index.json` (planned, owned by W3). If the index does not exist, say so in the report rather than inventing ids.
10. `token_plan.accent` names exactly one accent, `token_plan.neutrals` names one strategy, `token_plan.type_scale` names one scale.

## 8. Then what

Save, after the human has seen the three line summary from `templates/contract-review.md`, hand the contract to the build step, and keep it open: `DC-401` through `DC-404` are checked against this exact file. Change the artifact to match the contract, or re-plan and re-state, never edit the contract to match a finished artifact.
