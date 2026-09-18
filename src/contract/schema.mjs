// src/contract/schema.mjs - Zero-dependency schema validator for DesignContract
// Hard rule: no em-dash or en-dash in this file or its outputs.

export const MODES = ['persuade', 'operate', 'read', 'experience'];

export function validateContract(c) {
  const errors = [];
  if (!c || typeof c !== 'object') return { valid: false, errors: ['Contract must be an object'] };

  if (c.contract_version !== '1.0') errors.push('contract_version must be "1.0"');

  if (!c.brief || typeof c.brief !== 'object') {
    errors.push('brief must be an object');
  } else {
    for (const f of ['goal', 'audience', 'success_metric']) {
      if (typeof c.brief[f] !== 'string' || c.brief[f].length < 8) {
        errors.push(`brief.${f} must be string of at least 8 chars`);
      }
    }
  }

  if (!MODES.includes(c.mode)) {
    errors.push(`mode must be one of: ${MODES.join(', ')}`);
  }

  if (!c.rationale || typeof c.rationale !== 'object') {
    errors.push('rationale must be an object');
  } else {
    for (const f of ['problem', 'user', 'trade_off']) {
      if (typeof c.rationale[f] !== 'string' || c.rationale[f].length < 8) {
        errors.push(`rationale.${f} must be string of at least 8 chars`);
      }
    }
  }

  if (!c.dials || typeof c.dials !== 'object') {
    errors.push('dials must be an object');
  } else {
    for (const d of ['expressiveness', 'density', 'motion', 'ornament']) {
      const v = c.dials[d];
      if (typeof v !== 'number' || v < 1 || v > 5 || !Number.isInteger(v)) {
        errors.push(`dials.${d} must be integer 1..5`);
      }
    }
  }

  if (!Array.isArray(c.layout_plan) || c.layout_plan.length < 3) {
    errors.push('layout_plan must be an array of at least 3 items');
  } else {
    const families = [];
    let prevFamily = null;
    for (let i = 0; i < c.layout_plan.length; i++) {
      const item = c.layout_plan[i];
      if (!item || typeof item !== 'object') {
        errors.push(`layout_plan[${i}] must be an object`);
        continue;
      }
      if (typeof item.section !== 'string' || item.section.length < 2) {
        errors.push(`layout_plan[${i}].section missing or too short`);
      }
      if (typeof item.family !== 'string' || item.family.length < 3) {
        errors.push(`layout_plan[${i}].family missing or too short`);
      } else {
        families.push(item.family);
        if (item.family === prevFamily) {
          errors.push(`layout_plan[${i}]: adjacent sections repeat family "${item.family}"`);
        }
        prevFamily = item.family;
      }
      if (typeof item.why !== 'string' || item.why.length < 8) {
        errors.push(`layout_plan[${i}].why missing or too short`);
      }
    }
    const distinct = new Set(families);
    if (c.layout_plan.length >= 5 && distinct.size < 3) {
      errors.push(`layout_plan has ${c.layout_plan.length} sections but only ${distinct.size} distinct families (need at least 3)`);
    }
  }

  if (!c.token_plan || typeof c.token_plan !== 'object') {
    errors.push('token_plan must be an object');
  } else {
    for (const f of ['accent', 'neutrals', 'type_scale']) {
      if (typeof c.token_plan[f] !== 'string' || c.token_plan[f].length < 4) {
        errors.push(`token_plan.${f} must be string of at least 4 chars`);
      }
    }
  }

  if (!Array.isArray(c.bans) || c.bans.length < 4) {
    errors.push('bans must be array of at least 4 tell ids');
  }

  if (typeof c.not_for !== 'string' || c.not_for.length < 12) {
    errors.push('not_for must be string of at least 12 chars stating when this ruling is the wrong call');
  }

  if (!Array.isArray(c.decisions_used) || c.decisions_used.length < 1) {
    errors.push('decisions_used must be array of at least 1 decision id');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
