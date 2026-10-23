// 20 varied designs used by the golden tests (prices, prompts, edit plans).
import type { RenderSpec, RenderTooth, SetOptions, ToothDesign } from '../renderSpec';

const T = (index: number, design: Partial<ToothDesign> = {}): RenderTooth => ({
  index,
  metal: 'yellow',
  karat: '10k',
  type: 'plain',
  style: 'solid',
  setting: 'honeycomb',
  stone: 'moissanite',
  ...design,
});
const row = (from: number, count: number, design: Partial<ToothDesign> = {}) => Array.from({ length: count }, (_, i) => T(from + i, design));
const set = (patch: Partial<SetOptions> = {}): SetOptions => ({ fangs: false, cut: 'deep', vision: '', inscriptions: [], ...patch });
const spec = (teeth: RenderTooth[], patch: Partial<SetOptions> = {}): RenderSpec => ({ ...set(patch), teeth });

export const DESIGNS: Record<string, RenderSpec> = {
  plain6x6: spec([...row(5, 6), ...row(21, 6)]),
  top6White14k: spec(row(5, 6, { metal: 'white', karat: '14k' })),
  single: spec([T(7)]),
  twoPieceRose: spec(row(7, 2, { metal: 'rose', karat: '18k' })),
  fullSetSilver: spec([...row(0, 16, { metal: 'silver' }), ...row(16, 16, { metal: 'silver' })]),
  iced8x8: spec([...row(4, 8, { type: 'iced' }), ...row(20, 8, { type: 'iced' })]),
  icedMosaicNatural: spec(row(5, 6, { type: 'iced', setting: 'mosaic', stone: 'natural', karat: '14k' })),
  icedProngLabPlatinum: spec(row(5, 6, { type: 'iced', setting: 'prong', stone: 'lab', metal: 'platinum' })),
  openFaceFangs: spec(row(5, 6, { style: 'open-face', metal: 'rose' }), { fangs: true }),
  diamondCut10x10: spec([...row(3, 10, { style: 'diamond-cut' }), ...row(19, 10, { style: 'diamond-cut' })]),
  diamondDustPermanent: spec(row(5, 6, { style: 'diamond-dust' }), { cut: 'permanent' }),
  engravingVision: spec(row(5, 6, { style: 'engraving' }), { vision: 'Add a small star on my left front tooth' }),
  opalsWhite: spec(row(6, 4, { style: 'opals', metal: 'white', karat: '14k' })),
  photoGrillz: spec(row(7, 2, { type: 'photo' })),
  mixedFour: spec([T(4, { style: 'engraving', karat: '14k' }), T(5, { style: 'open-face', karat: '14k' }), T(6, { style: 'diamond-cut', karat: '14k' }), T(7, { type: 'iced', karat: '14k' }), T(8, { type: 'iced', karat: '14k' }), T(9, { style: 'diamond-cut', karat: '14k' }), T(10, { style: 'open-face', karat: '14k' }), T(11, { style: 'engraving', karat: '14k' })], { fangs: true }),
  twoTone: spec([...row(5, 6, { type: 'iced', metal: 'rose', karat: '14k', setting: 'prong', stone: 'lab' }), ...row(21, 6, { metal: 'white', karat: '14k', style: 'diamond-cut' })], { inscriptions: [{ text: 'VVS', teeth: [23], style: 'iced', font: 'block', enamel: null }] }),
  alternating: spec([T(4, { type: 'iced' }), T(5), T(6, { type: 'iced' }), T(7), T(8, { type: 'iced' }), T(9), T(10, { type: 'iced' }), T(11)]),
  inscriptionCut: spec(row(5, 6), { inscriptions: [{ text: 'HB', teeth: [6], style: 'cut', font: 'block', enamel: null }] }),
  inscriptionEngravedFangs: spec(row(5, 6, { metal: 'white' }), { fangs: true, inscriptions: [{ text: 'MAG$', teeth: [8], style: 'engraved', font: 'block', enamel: null }] }),
  bottomOnly: spec(row(21, 6, { type: 'iced', stone: 'natural' }), { cut: 'permanent' }),
};
