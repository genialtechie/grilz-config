import { describe, expect, it } from 'vitest';
import golden from './fixtures/golden.json';
import { DESIGNS } from './designs';
import { buildFillPrompt, buildRenderPrompt, GRILLZ_TYPES, KARATS, METALS, planMasks, SETTINGS, STONES, STYLES, summarizeDesign } from '../renderSpec';
import { depositFor, priceBreakdown, priceHints } from '../pricing';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

// Golden tests: tenant zero must price, describe and prompt every design exactly
// as the builder did before prices moved into the tenant config.
type Golden = { pricing: unknown; deposit: number; summary: string[]; prompt: string; promptWithInspiration: string; edits: unknown };
const fixtures = golden as unknown as Record<string, Golden> & { __hints: unknown };
const { pricing, deposit } = VVSLAB_CONFIG;

describe('tenant zero matches the pre-tenant builder', () => {
  for (const [name, spec] of Object.entries(DESIGNS)) {
    it(name, () => {
      const want = fixtures[name];
      const breakdown = priceBreakdown(pricing, spec.teeth, spec);
      expect(breakdown).toEqual(want.pricing);
      expect(depositFor(deposit, breakdown.total)).toBe(want.deposit);
      expect(summarizeDesign(spec)).toEqual(want.summary);
      expect(buildRenderPrompt(spec, false)).toBe(want.prompt);
      expect(buildRenderPrompt(spec, true)).toBe(want.promptWithInspiration);
      expect(planMasks(spec).map((plan) => ({ plan, prompt: buildFillPrompt(spec, plan) }))).toEqual(want.edits);
    });
  }

  it('option card hints', () => {
    const hints = priceHints(pricing);
    expect({
      metal: METALS.flatMap((m) => KARATS.map((k) => hints.metal(m.id, k.id))),
      style: STYLES.map((s) => hints.style(s.id)),
      stone: STONES.map((s) => hints.stone(s.id)),
      setting: SETTINGS.map((s) => hints.setting(s.id)),
      type: GRILLZ_TYPES.map((t) => hints.type(t.id)),
    }).toEqual(fixtures.__hints);
  });
});
