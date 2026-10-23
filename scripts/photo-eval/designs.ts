import type { RenderSpec, RenderTooth, ToothDesign } from '../../src/lib/renderSpec';

// The AI photo eval set (MAG-76): designs rebuilt from real jewelers' photos.
// Each must come out of the AI photo exactly as configured.

const tooth = (index: number, design: Partial<ToothDesign> = {}): RenderTooth => ({
  index, metal: 'yellow', karat: '14k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'lab', ...design,
});
const run = (from: number, to: number, design: Partial<ToothDesign> = {}, special: Record<number, Partial<ToothDesign>> = {}) =>
  Array.from({ length: to - from + 1 }, (_, i) => tooth(from + i, { ...design, ...special[from + i] }));

export type EvalDesign = { id: string; title: string; reference: string; spec: RenderSpec };

export const EVAL_DESIGNS: EvalDesign[] = [
  {
    id: 'pink-script',
    title: 'Bottom 8, yellow gold, a name in script with pink enamel',
    reference: 'IG: polished bottom 8 with "Soiree" in cursive across six teeth, pink enamel fill',
    // The name runs across the six front teeth; teeth 21–26 are the lower canines and incisors.
    spec: { fangs: false, cut: 'deep', vision: '', inscriptions: [{ text: 'Soiree', teeth: [21, 22, 23, 24, 25, 26], style: 'engraved', font: 'script', enamel: 'pink' }], teeth: run(20, 27) },
  },
  {
    id: 'opal-monogram',
    title: 'Top and bottom 8, white gold, fire opals, script monograms',
    reference: 'IG: white gold 8/8, fire opals on the canines, "Gi" engraved on a top front tooth and "Joe" across the two bottom teeth next to the canine on the viewer\'s right',
    spec: {
      fangs: false, cut: 'deep', vision: '',
      inscriptions: [
        // Index 0 is the viewer's right: 7 is the right-hand upper central incisor, 21 the lower canine on that side.
        { text: 'Gi', teeth: [7], style: 'engraved', font: 'script', enamel: null },
        { text: 'Joe', teeth: [22, 23], style: 'engraved', font: 'script', enamel: null },
      ],
      teeth: [
        ...run(4, 11, { metal: 'white' }, { 5: { style: 'opals', opal: 'fire' }, 10: { style: 'opals', opal: 'fire' } }),
        ...run(20, 27, { metal: 'white' }, { 21: { style: 'opals', opal: 'fire' }, 26: { style: 'opals', opal: 'fire' } }),
      ],
    },
  },
  {
    id: 'iced-8x8',
    title: 'Top and bottom 8, white gold, fully iced pavé',
    reference: 'IF & Co (Playboi Carti): white gold 8/8 fully iced pavé, on a mold',
    spec: { fangs: false, cut: 'deep', vision: '', inscriptions: [], teeth: [...run(4, 11, { metal: 'white', type: 'iced' }), ...run(20, 27, { metal: 'white', type: 'iced' })] },
  },
];
