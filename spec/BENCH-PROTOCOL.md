# BENCH PROTOCOL: what counts as a fair comparison

> **Owner:** orchestrator. W1 and W6 implement it. It exists so that no one can accuse the benchmark of stacking the deck.

## Rule zero

We assume our judge is worse until the labeled corpus says otherwise. The benchmark is built to be able to say we lost, and if it does, `results/` and the README say so in the same size of type as a win.

## The lanes

Comparing a spec linter against an artifact scanner is not a comparison. So there are two lanes, and results from different lanes are never added together.

### Lane A: artifact tells (HTML and CSS in, findings out)

Directly comparable implementations, all run on the identical corpus files:

| adapter | what it is | invocation |
|---|---|---|
| `judge` | our judge | `node src/judge/cli.mjs <file> --json` |
| `impeccable` | the market leader with 61 deterministic rules and 68k stars | `npx impeccable detect <dir>` |
| `gate_baseline` | the founder's previous gate, `designkit/scripts/anti-slop-check.py` | `python scripts/anti-slop-check.py <file>` |

`gate_baseline` is the honest within lineage baseline: it is the tool the same author shipped before, and it is the tool that passed the page containing the banned gradient.

### Lane B: spec integrity (a design spec in, findings out)

Google `@google/design.md` lint is a spec validator, not an artifact scanner. It is measured on its own lane against a DESIGN.md fixture set, and reported separately, clearly labelled as a different input format. It is never scored as if it had lost or won Lane A.

## The corpus

`bench/corpus/labeled.jsonl`, one JSON object per line:

```json
{
  "id": "slop-014",
  "html": "path/to/file.html",
  "labels": ["purple-gradient", "three-equal-cards"],
  "label_severity": "blocker",
  "injection": ["purple-gradient", "three-equal-cards"],
  "source": "synthetic-injected | curated-real | escape-regression"
}
```

Construction rules:

1. **Synthetic injected pairs.** For each tell in `spec/CHECKS.md`, one clean base page and one copy with exactly that tell injected, with nothing else changed. This gives labels that are known by construction rather than by opinion.
2. **Curated real.** A small set of real shaped pages that carry tells, labels assigned by reading the file, each label citing the line that justifies it.
3. **Escape regression set.** Pages that carry at least one blocker level tell while an existing tool returns a pass verdict. The `layout.css` gradient page belongs here.

## Metrics, exactly

- **Detection**: a tool detects a tell on a file if it emits at least one finding that maps to that tell id. For tools with their own vocabulary, W6 maintains an explicit mapping table in `bench/lib/map.json`, versioned and visible, so the mapping cannot be tuned after seeing results.
- **Precision, recall, F1**: computed per tell id, then macro averaged over the tell ids present in the corpus. Reported per adapter.
- **Escape rate**: over the escape regression set, the fraction of blocker bearing files that the tool rates as clean or pass with notes. Lower is better. This is the headline number, because it is the failure mode the market actually ships.
- **Coverage**: how many of the 40 check ids in `spec/CHECKS.md` an adapter has any equivalent for. A tool cannot be credited for recall on tells it structurally cannot see; coverage is reported beside every score.

## Blind pairwise (render quality)

Protocol, fixed before generating anything:

1. **Briefs**: 6 briefs, chosen to span the four modes, written in `bench/briefs/`.
2. **Methods**: our pipeline (contract then generate then self-judge then fix) versus at least one strong alternative pipeline (a leading public skill, run the same way).
3. **Generation**: each brief times each method, artifacts stored under `results/blind/<brief>/<method>.html`.
4. **Anonymization**: artifacts are renamed to opaque ids, method order randomized per pair by a seed recorded in the results file.
5. **Judging**: judges are models that did not generate the artifacts. Each pair is judged on a fixed rubric, both orders, to control position bias. Raw judgments are stored.
6. **Statistics**: win rate with a bootstrap confidence interval. If the interval includes 0.5, the honest headline is "no measurable difference", not a win.

## Reporting rules

1. Every number in `results/` must be regenerable by `node bench/run-all.mjs`. A number that cannot be regenerated is deleted.
2. Every table states the adapter, the corpus, the lane, and the coverage.
3. Losses and ties are printed in the same section as wins. A results file without a losses section is invalid.
4. No unverified external number appears in this repo. Third party numbers, if cited in docs, carry a URL and a date.
