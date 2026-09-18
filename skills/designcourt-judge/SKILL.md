---
name: designcourt-judge
description: "Use when a verdict must be read and every finding closed. Triages by severity, applies the per family fix recipe for DC-0xx to DC-4xx, and records checks the human knowingly leaves red."
version: 0.1.0
---

# designcourt-judge

You run the audit and you close the findings. Input: an artifact plus `.designcourt/contract.json`. Output: a verdict file you did not hand edit, fixes applied, and a list of anything you knowingly left red.

Full check list: `spec/CHECKS.md`. Finding and verdict shapes: `spec/BUILD-SPEC.md` section 3.

## 0. The loop you are inside

This skill runs steps 5 to 8 of the designcourt loop. The order is fixed.

1. write the brief to `.designcourt/brief.md` from `templates/brief.md`
2. get the ruling: `node src/contract/cli.mjs .designcourt/brief.md --out .designcourt/contract.json`
3. state the contract back in three lines with `templates/contract-review.md`
4. build against the contract
5. run the judge: `node src/judge/cli.mjs index.html --json --contract .designcourt/contract.json --tokens tokens.css --out .designcourt/verdict-1.json`
6. fix every blocker and major, blockers first
7. re-run the judge with `verdict-2.json` then `verdict-3.json`, stopping as soon as the verdict is `clean`
8. after a third verdict that is still not `clean`, STOP: ship nothing, report the residual findings, hand the artifact over as unverified

Three judge runs is the ceiling for the whole task, not three runs per finding. Section 6 covers the stop.

## 1. Run it

```
node src/judge/cli.mjs index.html --json --contract .designcourt/contract.json --tokens tokens.css --out .designcourt/verdict-1.json
```

Run it once per artifact file. `--tokens` lets `DC-106` resolve `var(--x)` instead of emitting `unresolved-color` notes. `--contract` is required for the `DC-4xx` family; if the flag is not supported, run the contract checker when present (`node src/contract/check-contract.mjs .designcourt/contract.json --artifact index.html`, planned, owned by W5) and merge its findings into the verdict you reason about, noting in the report that adherence came from a separate tool.

The judge is static: HTML and CSS in, findings out, no browser, no network, no clock (`spec/CHECKS.md` implementation note 4). Determinism is a feature: the same artifact gives the same findings, so any change in the verdict means you changed the artifact.

## 2. Read the verdict

```json
{
  "judge_version": "1.0",
  "files_scanned": 1,
  "findings": [],
  "counts": { "blocker": 0, "major": 0, "minor": 0 },
  "score": { "slop_index": 0.0, "layout_families": 3, "contrast_failures": 0 },
  "verdict": "clean | pass_with_notes | fail"
}
```

Map verdict to action:

| verdict | condition | your action |
|---|---|---|
| `fail` | one or more blockers | fix blockers first, then majors; re-run |
| `pass_with_notes` | no blocker, one or more majors | fix majors; re-run |
| `clean` | no blocker, no major | stop; minors may remain, list them as residual |

Every finding carries `check_id`, `tell_id`, `severity`, `title`, `evidence` (line, selector, snippet), `fix` and `why`. If a finding has no `evidence` locating the offense, treat it as a judge bug: report it, do not guess where the offense is, and do not silently ignore the finding.

## 3. Triage order

1. Parse the verdict, sort findings: blockers, then majors, then minors.
2. Group by check family, so one edit closes a family instead of five edits chasing one symptom.
3. Fix in family order: `DC-0xx` copy, then `DC-1xx` colour and contrast, then `DC-2xx` layout, then `DC-3xx` hygiene, then `DC-4xx` contract adherence. Contract adherence last, because it is a diff against the contract and later edits can move values.
4. Re-run after the pass. Do not re-run after each single edit unless the fix could have broken another check.
5. Count the run. Three runs maximum, then stop and report residuals.

No edit may be justified by "the judge did not say that". The judge is a floor, not a ceiling.

## 4. Fix recipe by family

### DC-0xx, lexical and copy

| id | tell_id | fix |
|---|---|---|
| DC-001 | `em-dash` | replace every em-dash and en-dash with a comma, colon, period, or hyphen. Check headline, eyebrow, body, quote, button label, `alt`, `aria-label`, `title` |
| DC-002 | `filler-verbs` | replace elevate, seamless, unleash, revolutionize, next-gen, transform your, supercharge, game-changing with the concrete verb: "cut", "ship", "find", "pay" |
| DC-003 | `generic-names` | replace Jane Doe, Acme, Nexus, SmartFlow with a plausible local name, and Lorem ipsum with the real sentence or nothing |
| DC-004 | `fake-precise-numbers` | source the number from the brief, delete it, or mark it `<!-- mock -->` in the markup |
| DC-005 | `duplicate-cta-intent` | keep one primary CTA per intent, demote the others to a text link |
| DC-006 | `subtext-length` | cut the paragraph to 25 words or fewer, move the detail into the body below |
| DC-007 | `mixed-language` | set `lang` to the dominant copy language, or translate the stray block |
| DC-008 | `placeholder-as-label` | add a real `<label>` above the input, keep the placeholder as an example value |

### DC-1xx, colour, surface, contrast

| id | tell_id | fix |
|---|---|---|
| DC-101 | `purple-gradient` | replace the purple or violet gradient stops with a flat accent surface, or shift the hue out of the ban window |
| DC-102 | `neon-glow` | delete the coloured blur shadow or filter; if depth is needed use a neutral shadow at low opacity |
| DC-103 | `premium-consumer-palette` | move off beige plus brass plus oxblood; pick one alternative ramp from the brief's brand or a neutral plus one accent |
| DC-104 | `inter-default` | set the body stack to `system-ui, sans-serif` or a licensed face named in the brief |
| DC-105 | `hardcoded-hex` | move every literal colour into the token declaration block and reference it by variable |
| DC-106 | `contrast-aa` | darken or lighten until 4.5:1 for body, 3:1 for large text. Re-run with `--tokens` so the value resolves |
| DC-107 | `multi-accent` | pick the one accent, recolour everything else from the neutral ramp |
| DC-108 | `mixed-radii` | choose one radius scale and apply it to buttons, cards and inputs consistently |

### DC-2xx, layout

| id | tell_id | fix |
|---|---|---|
| DC-201 | `three-equal-cards` | break the row: make one item dominant, or switch the section to `index-list`, `horizontal-rail`, or `split-asymmetric` if the contract allows |
| DC-202 | `repeated-zigzag` | change the third consecutive section's family, per the contract layout plan |
| DC-203 | `bento-empty-cell` | match cell count to content count, and give 2 or 3 cells real visual variation |
| DC-204 | `split-header` | stack headline over paragraph, or drop the loose paragraph into the body |
| DC-205 | `h-screen` | use `min-height: 100dvh` |
| DC-206 | `low-layout-diversity` | a page with 8+ sections needs 4+ families; change the repeated sections to families already declared in the contract |

### DC-3xx, structure and hygiene

| id | tell_id | fix |
|---|---|---|
| DC-301 | `eyebrow-density` | keep at most ceil(sections / 3) eyebrows, hero counts as one. Delete the rest |
| DC-302 | `scroll-cues` | delete "Scroll", the down arrow, and any equivalent instruction |
| DC-303 | `decorative-chrome` | delete status dots, brand strips and decorative labels over images |
| DC-304 | `fake-screenshot` | replace the div built screenshot with a real component, a real image, or a marked empty slot |
| DC-305 | `fake-credits` | delete the photo credit or use a real photograph |
| DC-306 | `version-footer` | remove version and build numbers from a marketing footer |
| DC-307 | `numbered-eyebrow` | remove the numbers, keep the word or remove the eyebrow |
| DC-308 | `emoji-as-icon` | replace emoji with one SVG icon family |
| DC-309 | `mixed-icon-family` | pick one family, one stroke width, one size grid |
| DC-310 | `scroll-listener-animation` | move to IntersectionObserver, scroll-driven CSS, or a real animation library |
| DC-311 | `property-animation` | animate only `transform` and `opacity`; for reveal on width use `clip-path` or `scaleX` |
| DC-312 | `reduced-motion-missing` | add a `prefers-reduced-motion: reduce` block that collapses motion to instant |
| DC-313 | `multi-marquee` | keep one marquee, delete the rest |
| DC-314 | `text-logo-wall` | use real logo marks, SVG or monogram, not text wordmarks |
| DC-315 | `nav-too-tall` | bring nav height to 80px or less and keep it to one line on desktop |
| DC-316 | `hero-discipline` | headline to 2 lines or fewer, subtext to 20 words or fewer, top padding to 6rem or less, 4 or fewer text elements, CTA above the fold |
| DC-317 | `motion-claimed-not-shown` | either add the motion the contract declares, or lower the motion dial to 3 and re-state the contract |

### DC-4xx, contract adherence

| id | tell_id | fix |
|---|---|---|
| DC-401 | `undeclared-token` | replace the value with a declared token, or amend the contract token plan and re-state it to the human. Never leave a value that is in neither place |
| DC-402 | `contract-family-drift` | render the section with the family the contract declares, or re-plan and re-state |
| DC-403 | `contract-ban-violated` | the contract bans it, so it goes. If the ban is genuinely wrong, change the contract by re-planning, not by editing the contract file |
| DC-404 | `contract-section-missing` | build the missing section, or re-plan without it. An artifact that skips a declared section is not the artifact that was approved |

## 5. When a check disagrees with the human

The human wins. This is not optional policy, it is the point: the agent is the design department, the human is the director.

The procedure:

1. Apply the change the human asked for, exactly.
2. Record the check id in `.designcourt/waivers.md` and in `templates/report.md` under Waivers, with one line of reason and the human's own words if they gave any.
3. Say the check id out loud in the chat: "leaving DC-104 red on your call, you asked for Inter".
4. Re-run the judge so the verdict file reflects the shipped state, and report the verdict as it is, including the waived finding.

What you may not do: drop the finding from the list, mark it resolved when it is not, change its severity, or stop mentioning it after the first message. A waiver is a permanent, visible, named exception, not a cleanup.

If a waiver conflicts with an explicit ban in the contract, the loop re-opens: put the conflict to the human, because `DC-403` will keep firing on every run and there is no way to satisfy both. Options are re-plan with the ban removed, or obey the human and report a knowing `fail`.

## 6. Stuck after three iterations

Three judge runs is the ceiling. If the third verdict is not `clean`:

1. Stop editing.
2. Write the residual findings into the report with check id, severity, evidence, the fix you tried, and why it did not close.
3. Name the cause honestly: missing capability in the judge, a contract that contradicts itself, a human waiver that keeps a check red, or a fix that would break the page.
4. Hand over the artifact as unverified and let the human decide: accept with findings, change the brief, or abandon.

Do not ship, do not relabel, do not quietly run a fourth time. A residual list is an acceptable delivery. A hidden blocker is not.
