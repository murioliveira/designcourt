# Design brief

Fill every field. A field you cannot answer gets `unknown, assumed X`, never a blank. Save as `.designcourt/brief.md`. This file is the only input the planner gets.

## 1. Core

**goal** (one sentence, what this page must make happen, 8+ characters):

**audience** (who, in what situation, on what device, 8+ characters):

**success_metric** (how you will know it worked, 8+ characters):

## 2. Surface

**surface_type** (landing | pricing | signup | dashboard | admin | settings | docs | editorial | changelog | portfolio | gallery | component | redesign):

**existing_page** (URL, file path, or `none`):

**mode_guess** (persuade | operate | read | experience | `let the planner decide`):

**sections_planned** (list them, even roughly, the planner needs a count):

## 3. Content inventory

**real_content_available** (what you actually have: copy, data, images, logos, numbers):

**missing_content** (what will have to be marked as placeholder or omitted):

**data_or_numbers** (any figure that will appear on the page, and its source. If a figure has no source it is either deleted or marked `<!-- mock -->`):

## 4. Constraints

**brand_locks** (existing colours, typeface, logo, radius. Existing brand beats any new accent):

**must_preserve** (URLs, nav labels, form field names, legal copy, analytics):

**accessibility** (target level, known audience needs, legal requirement):

**technical** (static HTML | framework | no build step | must run offline | other):

**language** (the single language of the visible copy, and the `lang` value it implies):

## 5. References and taste

**vibe_words** (the user's own words, quoted):

**reference_urls** (pages the user pointed at, and what they like about each):

**explicitly_disliked** (anything the user rejected by name):

## 6. Off limits

**never_do** (anything the user forbade, plus the universal tells you will carry into `bans`):

**open_questions** (ambiguity you could not resolve. Ask at most one, and only if two readings give different modes):

---

## Worked example

```markdown
# Design brief

## 1. Core
goal: get a self hosted user to run the install command and reach a working local instance
audience: a backend engineer evaluating three self hosted options during a work afternoon, on a laptop, one of them is already open in a terminal
success_metric: the install command is copied from the page, and the reader reaches the first success state without leaving the page to search for prerequisites

## 2. Surface
surface_type: docs
existing_page: none
mode_guess: read
sections_planned: intro, install, concepts, example, next steps (5)

## 3. Content inventory
real_content_available: install commands for three OSes, the CLI help text, a real log excerpt from a local run, the licence
missing_content: no logo mark, no screenshots, no customer quotes. Placeholder slots will be marked in the markup
data_or_numbers: startup time measured locally at 340ms, source is the local run log. No other figures will appear

## 4. Constraints
brand_locks: none given, so the planner picks one accent and one neutral ramp
must_preserve: the repository name, the licence name, the exact command strings
accessibility: WCAG AA on all body text and all code blocks, keyboard reachable copy buttons
technical: static HTML plus one CSS file, no build step, must work offline from the repo
language: English, lang="en"

## 5. References and taste
vibe_words: "calm", "no marketing voice", "like reading a manual written by someone competent"
reference_urls: the project README on GitHub, liked because the first screen answers what it is
explicitly_disliked: a prior version with a centered hero and three feature cards

## 6. Off limits
never_do: no fake terminal screenshots built from divs, no scroll cue, no version number in the footer, no eyebrow on every section
open_questions: unknown, assumed the reader arrives from a search result and does not know the product name
```

The planner turns that into a `read` mode ruling with five sections and at least three distinct layout families, and the judge later checks the artifact against exactly those families, tokens and bans.
