# Contract schema, version 1.0

This file is the machine readable twin of section 2 of BUILD-SPEC.md. The ruling generator emits it, the judge consumes it, and the contract checker validates artifacts against it.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DesignContract",
  "type": "object",
  "required": [
    "contract_version",
    "brief",
    "mode",
    "rationale",
    "dials",
    "layout_plan",
    "token_plan",
    "bans",
    "not_for",
    "decisions_used"
  ],
  "additionalProperties": false,
  "properties": {
    "contract_version": { "const": "1.0" },
    "brief": {
      "type": "object",
      "required": ["goal", "audience", "success_metric"],
      "additionalProperties": false,
      "properties": {
        "goal": { "type": "string", "minLength": 8 },
        "audience": { "type": "string", "minLength": 8 },
        "success_metric": { "type": "string", "minLength": 8 }
      }
    },
    "mode": { "enum": ["persuade", "operate", "read", "experience"] },
    "rationale": {
      "type": "object",
      "required": ["problem", "user", "trade_off"],
      "additionalProperties": false,
      "properties": {
        "problem": { "type": "string", "minLength": 8 },
        "user": { "type": "string", "minLength": 8 },
        "trade_off": { "type": "string", "minLength": 8 }
      }
    },
    "dials": {
      "type": "object",
      "required": ["expressiveness", "density", "motion", "ornament"],
      "additionalProperties": false,
      "properties": {
        "expressiveness": { "type": "integer", "minimum": 1, "maximum": 5 },
        "density": { "type": "integer", "minimum": 1, "maximum": 5 },
        "motion": { "type": "integer", "minimum": 1, "maximum": 5 },
        "ornament": { "type": "integer", "minimum": 1, "maximum": 5 }
      }
    },
    "layout_plan": {
      "type": "array",
      "minItems": 3,
      "items": {
        "type": "object",
        "required": ["section", "family", "why"],
        "additionalProperties": false,
        "properties": {
          "section": { "type": "string", "minLength": 2 },
          "family": { "type": "string", "minLength": 3 },
          "why": { "type": "string", "minLength": 8 }
        }
      }
    },
    "token_plan": {
      "type": "object",
      "required": ["accent", "neutrals", "type_scale"],
      "additionalProperties": false,
      "properties": {
        "accent": { "type": "string", "minLength": 4 },
        "neutrals": { "type": "string", "minLength": 4 },
        "type_scale": { "type": "string", "minLength": 4 }
      }
    },
    "bans": {
      "type": "array",
      "minItems": 4,
      "items": { "type": "string" }
    },
    "not_for": { "type": "string", "minLength": 12 },
    "decisions_used": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string" }
    }
  }
}
```

## Invariants the schema cannot express

1. With 5 or more sections in `layout_plan`, at least 3 distinct `family` values must appear.
2. No `family` value may repeat in adjacent entries of `layout_plan`.
3. Every entry of `bans` must be a real tell id from `spec/CHECKS.md`.
4. Every entry of `decisions_used` must be an id present in `decisions/index.json`.
5. `not_for` must name a concrete situation, not a disclaimer.
