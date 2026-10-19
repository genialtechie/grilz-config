import { describe, expect, it } from 'vitest';
import { priceBreakdown } from '../pricing';
import { buildRenderPrompt, describeTooth, DEFAULT_SET, type RenderTooth } from '../renderSpec';
import { VVSLAB_CONFIG } from '../tenant/vvslab';

const iced: RenderTooth = { index: 7, metal: 'yellow', karat: '10k', type: 'iced', style: 'solid', setting: 'honeycomb', stone: 'moissanite' };
const line = (teeth: RenderTooth[], label: string) => priceBreakdown(VVSLAB_CONFIG.pricing, teeth, DEFAULT_SET).lines.find((item) => item.label === label)?.amount ?? 0;

describe('iced open face', () => {
  it("adds the shop's open-face price on top of the stones; other finishes still don't apply to iced teeth", () => {
    const openFace = VVSLAB_CONFIG.pricing.stylePerTooth['open-face'] ?? 0;
    expect(line([{ ...iced, style: 'open-face' }], 'Style & finish')).toBe(openFace);
    expect(line([{ ...iced, style: 'engraving' }], 'Style & finish')).toBe(0);
    expect(line([{ ...iced, style: 'open-face' }], 'Stones')).toBe(line([iced], 'Stones'));
  });

  it('describes the open middle to the AI and on the lead', () => {
    const teeth: RenderTooth[] = [5, 6, 7, 8, 9, 10].map((index) => ({ ...iced, style: 'open-face', index }));
    const prompt = buildRenderPrompt({ ...DEFAULT_SET, teeth }, false);
    expect(prompt).toContain('iced open face');
    expect(prompt).not.toContain('no openings or cut-outs');
    expect(describeTooth({ ...iced, style: 'open-face' })).toContain('Iced open face');
    expect(describeTooth({ ...iced, style: 'engraving' })).not.toContain('open face');
  });
});
