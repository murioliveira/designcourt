# Contract review card

Render this from `.designcourt/contract.json` and show it to the human after step 2 of the loop. Target reading time: 10 seconds. Replace every `<...>` placeholder. Keep it under 30 lines: the human is vetoing the decision, not reviewing a document.

Copy everything from the next line down into the chat.

---

**RULING `<MODE>` for `<SECTION COUNT>` sections** | contract `1.0` | source `contract.json`

`<one line, the trade_off, which says what this page gives up and why>`

**Sections**

| # | section | family | why |
|---|---|---|---|
| 1 | `<name>` | `<family>` | `<reason>` |
| 2 | `<name>` | `<family>` | `<reason>` |
| 3 | `<name>` | `<family>` | `<reason>` |
| 4 | `<name>` | `<family>` | `<reason>` |
| 5 | `<name>` | `<family>` | `<reason>` |

Distinct families `<n>`, adjacent repeats `<none or list>`

**Dials** expressiveness `<1-5>` | density `<1-5>` | motion `<1-5>` | ornament `<1-5>`

**Colour and type** accent `<the one accent and its reason>` | neutrals `<ramp strategy>` | type `<scale strategy>`

**Bans carried into the build** `<ban, ban, ban, ban>` (`<total>` total, all ids from `spec/CHECKS.md`)

**Not for** `<the concrete case where this ruling is the wrong call>`

**Veto** reply `veto: <line>` to change one line, or `ok` to build. Vetoing one line re-plans; the human's word beats the contract.

---

## How to use it

1. Fill it from the contract, not from memory. If a line here disagrees with `.designcourt/contract.json`, the JSON wins and you fix the card.
2. Send it with the three line summary. If the user asked to approve before the build, stop here and wait. Otherwise add "building now, veto any line and I will re-plan".
3. On `veto`: amend `.designcourt/brief.md`, re-run the plan command, rebuild this card, restate. Never edit `contract.json` directly.
4. File the card in the report under "what was decided", so the ruling that was approved is traceable to the artifact that was judged.

## Worked example, filled in

---

**RULING `persuade` for 6 sections** | contract `1.0` | source `contract.json`

Gives up a feature matrix above the fold: this page trades detail for momentum, a procurement buyer needs a different page.

**Sections**

| # | section | family | why |
|---|---|---|---|
| 1 | hero | split-asymmetric | headline needs a real product surface next to it, not a centered stack |
| 2 | problem | stacked-editorial | the complaint is text, give it width and measure |
| 3 | how-it-works | horizontal-rail | three steps read as a sequence, not as three peer cards |
| 4 | proof | two-column-tabular | numbers need labels in a fixed column to be scannable |
| 5 | pricing | bento-mixed | two plans and one guarantee, unequal weight is the truth here |
| 6 | close | feature-led-fullbleed | one action left, one surface behind it |

Distinct families 6, adjacent repeats none

**Dials** expressiveness 4 | density 2 | motion 3 | ornament 3

**Colour and type** accent single saturated teal, because the brief names a calm technical buyer and the category default is indigo | neutrals one cool grey ramp at three steps | type system-ui at a 1.25 ratio, four steps, no Inter default

**Bans carried into the build** `em-dash`, `purple-gradient`, `inter-default`, `filler-verbs` (9 total, all ids from `spec/CHECKS.md`)

**Not for** an enterprise procurement page where the buyer needs a feature matrix and an SOC2 link before any emotional beat.

**Veto** reply `veto: <line>` to change one line, or `ok` to build.
