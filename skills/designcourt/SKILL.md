---
name: designcourt
description: "Use when building UI screens, pages, components, or apps. Replaces generate then hope with decide, build, judge: a ruling contract before code, a deterministic audit before ship, and a verdict that is reported, never hidden."
version: 0.1.0
---

# designcourt

Read this whole file before writing UI. It changes one behaviour: you stop generating a page and hoping it looks professional, and start deciding, building, and judging.

The failure this exists to prevent: an agent ships a page with a purple gradient, three equal cards, an Inter default font and an em-dash in the headline, and calls it done. Every one of those is a mechanized ban in `spec/CHECKS.md`, and the judge catches them. Your job is to run the loop until the judge stops catching them.

## 1. When to use this

Use it whenever the deliverable contains visible interface:

- landing page, marketing page, pricing page
- dashboard, admin panel, settings screen, app shell
- docs page, editorial page, changelog
- portfolio, gallery, showcase page
- a component library or a single hero section
- a redesign of any of the above

Skip it for: backend or API work, CLI tools, slide decks, data analysis, or a one-line CSS change to a page that already carries a verdict file.

Recognize the trigger from user words: "build me a landing page", "make a dashboard", "redesign this", "make this look professional", "why does this look like AI slop", "audit this HTML", "review my UI".

If the user asks for a redesign of an existing page, capture the existing page as an input to the brief and keep current brand colours and type as overrides over any new accent.

## 2. Files you touch

Repo files (read only, frozen, do not edit):

| Path | What it is |
|---|---|
| `spec/contract.schema.md` | the DesignContract schema, version 1.0 |
| `spec/CHECKS.md` | the authoritative check list, ids DC-001 to DC-404 |
| `spec/BUILD-SPEC.md` | section 2 is the contract, section 3 is the verdict |
| `templates/brief.md` | the brief you fill in at step 1 |
| `templates/contract-review.md` | the 10 second human veto card, built at step 3 |
| `templates/report.md` | the final report, built at step 8 |

Working files, created in the user's project directory (not in this repo), all under `.designcourt/`:

```
.designcourt/brief.md            filled in at step 1
.designcourt/contract.json       emitted by plan at step 2
.designcourt/verdict-1.json      emitted by judge, iteration 1
.designcourt/verdict-2.json      iteration 2
.designcourt/verdict-3.json      iteration 3, the last allowed
.designcourt/waivers.md          checks knowingly left red because the human overruled them
```

## 3. The loop, in order

Do not reorder these. Do not skip step 2. Do not start step 4 before step 3 is written down.

### Step 1: write the brief

Copy `templates/brief.md` to `.designcourt/brief.md` and fill every field. Fields with no answer get an explicit "unknown, assumed X" line, never an empty line. A brief with an empty `success_metric` cannot produce a ruling.

`goal`, `audience` and `success_metric` each need 8 characters minimum, so write real sentences, not "users".

### Step 2: get the ruling contract

```
node src/contract/cli.mjs .designcourt/brief.md --out .designcourt/contract.json
```

Alternative if the script name above is not present:

```
npm run plan -- .designcourt/brief.md > .designcourt/contract.json
```

Then open `.designcourt/contract.json` and check it against the invariants in `spec/contract.schema.md` section "Invariants the schema cannot express": 3 or more distinct `family` values, no family repeated in adjacent entries, every `bans` entry a real tell id from `spec/CHECKS.md`, every `decisions_used` id present in `decisions/index.json`, and a `not_for` that names a concrete situation.

If the plan command does not exist yet, do not improvise silently: write the contract by hand against `spec/contract.schema.md`, save it to the same path, and tell the user in the report that the ruling was hand authored because the planner was unavailable. The contract is still binding on the build.

Load `designcourt-plan` (`skills/designcourt-plan/SKILL.md`) when you need the mode choice, the dial calibration, or worked examples.

### Step 3: state the contract back to the user

Write three lines, no more, into the chat:

1. mode, plus the one line trade_off from the contract
2. the section list with its layout families
3. the accent and neutral strategy, plus the two bans most likely to be hit on this build

Then attach the human card rendered from `templates/contract-review.md`.

Wait for a veto ONLY if the user asked to approve before the build ("show me the plan first", "wait for my ok", "run it past me"). If the user asked for an artifact, keep moving and treat the contract card as a heads up, not a gate. Say the words "building now, veto any line and I will re-plan" so the veto path stays open.

A veto means: amend `.designcourt/brief.md`, re-run step 2, restate. Never hand edit `contract.json` to match a veto, because then the artifact and the ruling no longer agree and DC-4xx will fire against you.

### Step 4: build against the contract

Build the artifact. The contract is the spec, not a mood board:

- every section in `layout_plan` exists in the artifact, in that order, using that `family`
- no section uses a family absent from `layout_plan` (that is DC-402)
- colours and sizes come from the declared token plan, not invented per section (that is DC-401)
- every entry in `bans` is respected literally

Design files go where the project keeps them. If the project has no convention, write single file prototypes to `index.html` plus a sibling `tokens.css` so the judge can resolve variables.

### Step 5: run the judge on the artifact

```
node src/judge/cli.mjs index.html --json --contract .designcourt/contract.json --tokens tokens.css --out .designcourt/verdict-1.json
```

If `--out` is rejected, redirect stdout instead:

```
node src/judge/cli.mjs index.html --json --contract .designcourt/contract.json --tokens tokens.css > .designcourt/verdict-1.json
```

Run the judge on every artifact file you produced, not just the entry point. A verdict for one file is not a verdict for the page.

### Step 6: fix every blocker and major

Read `.designcourt/verdict-1.json`. Fix all `blocker` findings first, then all `major` findings. Use `skills/designcourt-judge/SKILL.md` for the per family fix recipe. Minors do not change the verdict, but a clean verdict with five minors is a weak delivery: fix the cheap ones too.

### Step 7: re-run the judge until clean, or until 3 iterations

Each judge run is one iteration. The maximum is 3:

```
node src/judge/cli.mjs index.html --json --contract .designcourt/contract.json --tokens tokens.css --out .designcourt/verdict-2.json
node src/judge/cli.mjs index.html --json --contract .designcourt/contract.json --tokens tokens.css --out .designcourt/verdict-3.json
```

Stop as soon as `verdict` is `clean`. `pass_with_notes` means majors remain, so it is not a stop condition. `fail` means a blocker remains, so it is not a stop condition.

Never re-run the judge without changing the artifact in between. A repeated run with no edit is not an iteration, it is polling.

### Step 8: if still failing after 3 iterations, stop and report

If `verdict-3.json` is not `clean`, STOP. Do not ship. Do not keep editing in the hope that the fourth run looks better.

Do exactly this:

1. write `.designcourt/verdict-3.json` findings into `templates/report.md` under Residual findings, with the raw check ids, severities, evidence and the fix you attempted
2. state in one line which checks you could not close and why (missing capability, contract conflict, human veto, or a fix that would break the page)
3. hand the artifact over as unverified, with the exact residual list, and ask the human to choose: accept with the listed findings, change the brief, or abandon
4. never describe an artifact with a failing verdict as done, finished, shipped, or ready

## 4. Command reference and status

| Command | Status | Owner |
|---|---|---|
| `node src/contract/cli.mjs <brief> <flags>` | planned, file not in repo yet | W5 |
| `node src/contract/plan.mjs <brief>` | planned, named in `spec/BUILD-SPEC.md` gate A4 | W5 |
| `npm run plan` | planned, script declared in `package.json` | W5 |
| `node src/judge/cli.mjs <file> --json` | planned, invocation fixed by `spec/BENCH-PROTOCOL.md` lane A | W2 |
| `node src/judge/cli.mjs <file> --json --tokens <file>` | `--tokens` documented in `spec/CHECKS.md` note 2 | W2 |
| `node src/judge/cli.mjs <file> --contract <file>` | UNCONFIRMED flag, required for the DC-4xx family | W2 |
| `--out <path>` on either CLI | UNCONFIRMED convenience flag, use stdout redirect if rejected | W2, W5 |
| `node bench/run-all.mjs` | planned, regenerates `results/` | W6 |
| `node mcp/server.mjs` | planned, stdio MCP server | W6 |
| `decisions/index.json` | planned, decision ids used by `decisions_used` | W3 |

If designcourt is installed as an MCP server, call `tools/list` first and use the tool whose name covers plan or judge. The CLI above stays authoritative; if the MCP tool and the CLI disagree, say so and trust the CLI output file.

If the judge CLI is not present at all, the loop is blocked. Say so plainly and stop claiming the page is verified. Do not substitute the previous generation gate (`designkit/scripts/anti-slop-check.py`), a hand reading, or your own opinion for a verdict. That gate is the baseline this product exists to beat, and it passes the exact page that carries the banned purple gradient.

## 5. Hard rules

1. **The judge output is not negotiable by the agent.** You may not reword, summarize away, reorder by convenience, or downgrade a finding. You may not edit the judge, its checks, its fixtures, or `spec/CHECKS.md` to make a run come back clean. You may not pick a different severity. You may not run a narrower input file to avoid a finding on the file that has it.
2. **A failed verdict is reported, never hidden.** Every report shows the raw counts and the file the verdict came from. "Looks clean" without a `verdict.json` path is a lie. A missing judge is reported as missing, not as clean.
3. **Three iterations is a hard ceiling.** After the third non clean verdict you stop and report residuals. You do not ship and you do not keep tuning.
4. **A human beats a check, and the agent must say which check it left red.** If the user overrules a finding, the human wins: apply the change they want and record the check id in `.designcourt/waivers.md` and in the report. Silently dropping a finding is not allowed.
5. **No check with a failing verdict may be described as done.** Not in the chat, not in a commit message, not in the report headline.
6. **Do not claim what the judge cannot see.** The judge is static: it reads HTML and CSS, it does not render pixels. Geometry dependent checks stay at minor for that reason. Never claim you verified the rendered look, the interaction, or the accessibility tree unless something actually rendered and you actually inspected it.
7. **Do not invent numbers.** Metric claims about design quality come from `results/` produced by `node bench/run-all.mjs`, never from prose.

## 6. Exit conditions

| Verdict in the last run | Meaning | Action |
|---|---|---|
| `clean` | no blocker, no major | finish, write the report, minors listed as residual if any remain |
| `pass_with_notes` | at least one major | fix majors, re-run if an iteration remains, otherwise step 8 |
| `fail` | at least one blocker | fix blockers first, re-run if an iteration remains, otherwise step 8 |
| no verdict file | judge unavailable or not run | stop, report that the artifact is unverified |

## 7. Report

Finish with `templates/report.md`, filled in and saved next to the artifact. It carries what was decided, what was built, the verdict with raw counts, the residual findings, and the honest limits (static analysis only, no pixels, no human taste, no bench). If the report has an empty verdict section, the work is not finished.
