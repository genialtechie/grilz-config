import { FANG_TEETH, METALS, icedBorder, isGold, opalOf, type SetOptions, type ToothDesign } from './renderSpec';
import type { ToothCustomization } from './types';

/** What the 3D model draws for one tooth of the set (the builder and the /lab page share this). */
export function toothCustomization(design: ToothDesign, set: Pick<SetOptions, 'fangs' | 'cut'>, index: number): ToothCustomization {
  const metal = METALS.find((item) => item.id === design.metal)!;
  return {
    material: isGold(design.metal) ? 'gold' : 'silver',
    color: metal.swatch,
    metal: metal.id,
    style: design.type === 'plain' || icedBorder(design) ? design.style : undefined,
    opal: opalOf(design) ?? undefined,
    // A coat only lives on a plain tooth (the parse boundary strips it
    // elsewhere), so the preview never has to coat stones or a photo.
    pvd: design.type === 'plain' ? design.pvd : undefined,
    photo: design.type === 'photo',
    fang: set.fangs && FANG_TEETH.includes(index),
    cut: set.cut,
    hasDiamonds: design.type === 'iced',
    diamondType: design.stone === 'moissanite' ? 'moissanite' : 'lab',
    setting: design.setting,
  };
}
