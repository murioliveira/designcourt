# Report: `<artifact name>`

Save next to the artifact as `REPORT.md`. Replace every `<...>`. A report with an empty verdict section means the work is not finished. Keep the honest limits section even when the verdict is clean: it is the part the reader needs to calibrate trust.

Date `<YYYY-MM-DD>` | method `designcourt` contract `1.0` | iterations used `<1 to 3>`

## 1. What was decided

Ruling `<mode>`, `<section count>` sections, `<distinct family count>` distinct layout families.

`<three lines maximum: the trade_off, the accent strategy, and the two bans most at risk on this build>`

- brief: `<path to .designcourt/brief.md>`
- contract: `<path to .designcourt/contract.json>`
- human review: `<approved before build | shown, no veto | vetoed once and re-planned>`
- decision ids used: `<ids from the contract, or "none, decisions index not available">`

## 2. What was built

| file | what it is |
|---|---|
| `<path>` | `<entry point, styles, tokens>` |

Sections built, in order, and the family each uses:

| # | section | family | contract family | match |
|---|---|---|---|---|
| 1 | `<name>` | `<family built>` | `<family declared>` | `<yes | no>` |

## 3. Verdict

Raw, from the last run. Do not summarize away the numbers.

- verdict file: `<path to .designcourt/verdict-N.json>`
- judge version `<x>`, files scanned `<n>`
- verdict `<clean | pass_with_notes | fail>`
- counts blocker `<n>` major `<n>` minor `<n>`
- score slop_index `<n>`, layout_families `<n>`, contrast_failures `<n>`

Judged input: `<artifact file or directory>`, with contract `<path>` and tokens `<path or none>`.

## 4. Residual findings

Findings still open in the final verdict. List minors even when the verdict is clean, with the reason each was not fixed.

| check_id | severity | evidence (line / selector) | why it is still open | attempted fix |
|---|---|---|---|---|
| `<DC-xxx>` | `<blocker, major, or minor>` | `<line 12, .hero>` | `<reason>` | `<what you tried>` |

If nothing is open, write `none`. Do not delete the table.

## 5. Waivers

Checks knowingly left red because the human overruled them. The human wins, and it stays visible here forever.

| check_id | what the check wanted | what the human chose | reason |
|---|---|---|---|
| `<DC-xxx>` | `<judge's fix>` | `<shipped state>` | `<human's words>` |

If nothing is waived, write `none`. If a waiver keeps a `DC-403` contract ban violated, say so in section 6 as a knowing `fail`.

## 6. Honest limits

State these as facts, never as disclaimers buried at the bottom.

- The judge is static. It reads HTML and CSS and does not render, so it cannot see the actual rendered look, spacing harmony, real line breaks, or interaction behaviour. Geometry dependent checks stay at minor for that reason.
- No rendered pixel review happened unless a browser actually loaded the page and a human or vision step looked at it. Say which: `<rendered and inspected | static only>`.
- The judge catches mechanized tells, not taste. A `clean` verdict means no known tell was detected, not that the design is good.
- Contrast figures depend on the token file passed with `--tokens`. Unresolved values come back as notes, not blockers: `<n>` unresolved.
- No quality comparison against other methods was run unless `node bench/run-all.mjs` was executed. If it was not run, no claim about being better than any other tool appears anywhere.
- Any number in this report that is not in a verdict file or in `results/` is not a measurement.

## 7. Next action

`<ship | fix the residual list first | needs a human decision on the waived checks | needs a re-plan because the contract conflicts with the request>`

One paragraph, addressed to the human, saying exactly what you want them to do.

---

## Filled example

Date 2026-09-18 | method `designcourt` contract `1.0` | iterations used 2

**1. What was decided.** Ruling `read`, 5 sections, 5 distinct layout families. Gives up persuasion entirely: no motion budget, no hero claim, the page answers "what is this" before it asks for anything. Accent is one saturated teal against a three step cool grey ramp. Highest risk bans on this build: `fake-screenshot` and `eyebrow-density`.

**2. What was built.** `index.html`, `tokens.css`, `docs.css`. Sections: intro / stacked-editorial, install / two-column-tabular, concepts / index-list, example / feature-led-fullbleed, next / horizontal-rail. All five match the contract.

**3. Verdict.** `.designcourt/verdict-2.json`, judge 1.0, 1 file scanned, verdict `clean`, counts blocker 0 major 0 minor 2, slop_index 0.0, layout_families 5, contrast_failures 0.

**4. Residual findings.** `DC-006` minor, the intro paragraph is 29 words, left open because shortening it removed the prerequisite warning, attempt cut to 24 words lost the sentence. `DC-303` minor, a decorative dot in the install list, left open, attempt removed it and the list lost its state column.

**5. Waivers.** none.

**6. Honest limits.** Static only, no browser loaded the page. Two unresolved colour values were reported as notes because `--tokens` could not resolve the theme override. No bench run, so this report makes no claim about any other tool. Contrast figures come from the resolved literals in `tokens.css`.

**7. Next action.** Ship. Then decide on the two minors: if the prerequisite warning matters more than the word count, leave `DC-006` red on purpose and add it to Waivers.
