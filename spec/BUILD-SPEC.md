# BUILD SPEC: designcourt

> **Owner:** orchestrator. Workers may READ this. Nobody but the orchestrator edits it.
> **Status:** authoritative interface contract. If a worker believes a line here is wrong, it must stop and report, not silently deviate.

---

## 0. What we are building and why

An agentic project that makes AI agents produce professional UI/UX/design, and that **proves** it is better than the alternatives with numbers anyone can reproduce.

The evidence base (see `~/projetos/designkit/pesquisa/`, docs 01 to 09) established two facts that define this product:

1. **The bottleneck is missing decisions, not missing references.** Two censuses (2026) show 91% of designers use AI weekly and 76% already use a coding agent. The self-declared blockers are, in order: time to learn new tools 55.7%, **too many tools / unclear which to commit to 53.0%**, unreliable AI output quality 52.2%, budget 34.2% (**5th**). The public does not want a ninth tool. It wants the decision made.
2. **Nobody judges the rendered output, and nobody proves their judge works.** Google ships a free deterministic linter (`@google/design.md`, Apache-2.0) and Impeccable ships 61 deterministic rules (Apache-2.0, 68k stars). Both are free. Neither publishes precision, recall, or a test corpus. The market has verification without evidence of efficacy.

So the product has exactly two halves, and both must exist:

- **The Ruling** (`plan`): a brief in, an explicit inspectable design decision out, before a single line of UI is written.
- **The Judge** (`judge`): a deterministic audit of the rendered artifact, plus **published, reproducible accuracy of the audit itself**.

**Falsification stance:** we assume we are wrong until a reproducible benchmark says otherwise. Every claim in the README must be traceable to a script in `bench/` and a file in `results/`. A loss reported is worth more than a win asserted.

---

## 1. Hard rules for every file in this repo

1. **No em-dash and no en-dash in any file.** Not in docs, not in code comments, not in test fixtures, not in UI. The product bans them because they are the number one AI tell; the product will not ship them either. Use comma, colon, period, or hyphen.
2. **Zero runtime dependencies in the core** (`src/`). Node 18+, ESM, stdlib only. The core must run with no install step. The only place a dependency is allowed is `mcp/` (MCP SDK) and `bench/` (optional dev tooling), and both must degrade gracefully.
3. **Everything deterministic.** Same input, same output. No network in the core. No LLM calls in `src/`.
4. **Every finding carries evidence.** A finding must locate itself (line, selector, or snippet) and offer a concrete fix. A check that cannot point at the offense is not a check.
5. **No fabricated numbers anywhere.** If a result is not measured, it is not written. `results/` numbers must be regenerable by running `bench/` scripts.
6. **One writer per file.** Coordinate through this spec, never by editing another worker's file.

---

## 2. The Ruling: contract schema (frozen)

`plan(brief, options)` returns a **DesignContract**. This is the product's spine.

```json
{
  "contract_version": "1.0",
  "brief": {
    "goal": "string",
    "audience": "string",
    "success_metric": "string"
  },
  "mode": "persuade | operate | read | experience",
  "rationale": {
    "problem": "what user problem this page solves",
    "user": "who, in what situation",
    "trade_off": "what we deliberately give up and why"
  },
  "dials": {
    "expressiveness": 1,
    "density": 1,
    "motion": 1,
    "ornament": 1
  },
  "layout_plan": [
    { "section": "hero", "family": "split-asymmetric", "why": "one line of reason" }
  ],
  "token_plan": {
    "accent": "single accent rationale",
    "neutrals": "neutral strategy",
    "type_scale": "scale strategy"
  },
  "bans": ["tell-id", "tell-id"],
  "not_for": "the case where this ruling is the wrong call",
  "decisions_used": ["decision-id"]
}
```

Rules:
- `mode` is REQUIRED and drives the rest. Four modes only.
- `layout_plan` must use **at least 3 distinct families** for a page with 5 or more sections, and must never repeat the same family in adjacent sections.
- `bans` must include the universal tells plus the mode-specific ones.
- `not_for` is REQUIRED and non-empty. A ruling that cannot say when it is wrong is not a ruling.
- `decisions_used` must reference real ids from `decisions/`.

---

## 3. The Judge: check model (frozen)

### 3.1 Finding shape

```json
{
  "check_id": "DC-004",
  "tell_id": "purple-gradient",
  "severity": "blocker | major | minor",
  "title": "short human title",
  "evidence": { "line": 12, "selector": ".hero", "snippet": "..." },
  "fix": "concrete action",
  "why": "why this is a tell, one line"
}
```

### 3.2 Verdict shape

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

`verdict` = `fail` if any blocker, `pass_with_notes` if any major, else `clean`.

### 3.3 Check id scheme

- `DC-0xx` lexical and copy tells (em-dash, banned filler verbs, generic names, fake precise numbers)
- `DC-1xx` color and surface tells (AI purple gradient, glow, palette traps, contrast failures)
- `DC-2xx` layout tells (three equal cards, repeated zigzag, bento with empty cell, split-header, h-screen)
- `DC-3xx` structural and hygiene (eyebrow density, scroll cues, decorative dots, fake screenshots built from divs, icon family mixing)
- `DC-4xx` contract adherence (undeclared token value, family not in plan, ban violated)

### 3.4 The mandatory checks list

The Judge MUST implement every tell that `~/projetos/designkit/DESIGN.md` states in prose and that the existing gate misses. Verified gap: `DESIGN.md` bans the AI purple gradient, `styles/layout.css` contains one, and the existing gate returns PASS. **This regression is a required test case.** Full list in `spec/CHECKS.md`, which the orchestrator maintains.

---

## 4. Acceptance: how we know the product works

These are the gates. A product that fails any gate is not published.

| Gate | Test | Pass condition |
|---|---|---|
| A1 | `node src/judge/cli.mjs <fixture>` on 1 clean and 1 slop fixture | clean fixture = `clean`, slop fixture = `fail`, and every injected tell is caught |
| A2 | The regression fixture: an artifact with the purple gradient that the old gate passed | Judge reports a blocker. Non-negotiable |
| A3 | Detector accuracy on the labeled corpus | Judge macro-F1 published, and higher than Google lint and Impeccable on the same corpus. If it is not higher, we publish the loss |
| A4 | `node src/contract/plan.mjs <brief>` | Returns a schema-valid contract with `not_for` and 3+ distinct families |
| A5 | Contract adherence | An artifact that ignores the contract is flagged by `DC-4xx` |
| A6 | MCP server | Responds to `initialize`, `tools/list`, `tools/call` over stdio with the declared tool set |
| A7 | Bench reproducibility | `node bench/run-all.mjs` regenerates `results/` from scratch |
| A8 | Blind pairwise | N briefs, 2+ methods, judges blind, CI published. Losses reported |
| A9 | Hygiene | No em-dash anywhere, core has zero deps, all checks deterministic |

---

## 5. Metrics (frozen definitions)

- **Tell recall / precision / macro-F1** on the labeled corpus. A tell is "detected" if the judge emits a finding whose `tell_id` matches the label for that file.
- **Escape rate**: fraction of files in the real-slop set that receive `clean` or `pass_with_notes` while carrying at least one labeled blocker-level tell. Lower is better. This is the metric the existing gate fails.
- **Contract adherence rate**: fraction of generated artifacts with zero `DC-4xx` findings.
- **Blind win rate**: pairwise preference over generated artifacts, judges do not know which method produced which artifact, method order randomized per pair, Wilson or bootstrap CI reported.

---

## 6. Repo layout and file ownership

```
designcourt/
  README.md                        orchestrator
  package.json                     orchestrator
  spec/BUILD-SPEC.md               orchestrator (this file)
  spec/CHECKS.md                   orchestrator
  src/judge/checks.mjs             W2
  src/judge/judge.mjs              W2
  src/judge/cli.mjs                W2
  src/judge/dom.mjs                W2 (tiny HTML parser, no deps)
  src/contract/plan.mjs            W5
  src/contract/schema.mjs          W5
  src/contract/check-contract.mjs  W5
  decisions/*.json                 W3
  skills/*/SKILL.md                W4
  templates/*.md                   W4
  bench/build-corpus.mjs           W1
  bench/lib/metrics.mjs            W1
  bench/corpus/labeled.jsonl       W1
  bench/corpus/realslop/*.html     W1
  bench/run-detector-bench.mjs     W6
  bench/run-blind-bench.mjs        W6
  bench/run-all.mjs                W6
  bench/lib/adapters.mjs           W6 (wraps google lint + impeccable)
  mcp/server.mjs                   W6
  docs/*.md                        W7
  results/*                        W6 + orchestrator
```

---

## 7. Publication target (orchestrator only)

- GitHub: public repo under the authenticated account
- npm: package `designcourt` (verified free), core zero-dep
- MCP registry: `io.github.<user>/designcourt`
- README headline numbers must come from `results/`, never from prose
