import { MousePointer2, Plus, Type, X } from 'lucide-react';
import {
  ENAMELS,
  INSCRIPTION_FONTS,
  INSCRIPTION_MAX,
  INSCRIPTION_CHARS,
  wearerToothName,
  type InscriptionStyleId,
} from '../../lib/renderSpec';
import { draftRow, fitsTeeth, newDraft, type InscriptionDraft } from '../../lib/inscriptionDrafts';

// Initials or a name on the set (MAG-76): text, block or script, the shop's
// letter styles, enamel colour for engraved letters, and the teeth it runs
// across (tap the first tooth, then the last). One more on the other row.

type Props = {
  drafts: InscriptionDraft[];
  onChange: (drafts: InscriptionDraft[]) => void;
  /** Which draft is choosing its teeth on the model. */
  picking: number | null;
  onPicking: (draft: number | null) => void;
  styles: readonly { id: InscriptionStyleId; label: string; detail: string }[];
  hint: (style: InscriptionStyleId) => string | undefined;
  /** Rows of the set that have teeth (0 upper, 1 lower). */
  rows: number[];
};

const placement = (draft: InscriptionDraft) =>
  draft.teeth.length === 1 ? `On your ${wearerToothName(draft.teeth[0])}` : `Across ${draft.teeth.length} ${draft.teeth[0] < 16 ? 'top' : 'bottom'} teeth`;

export function InscriptionEditor({ drafts, onChange, picking, onPicking, styles, hint, rows }: Props) {
  const update = (index: number, patch: Partial<InscriptionDraft>) => onChange(drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  const usedRows = drafts.map(draftRow);
  const canAdd = drafts.length < 2 && drafts[0].text.trim() !== '' && drafts[0].teeth.length > 0 && rows.some((row) => row !== usedRows[0]);

  return (
    <>
      {drafts.map((draft, index) => {
        const script = draft.font === 'script';
        const active = picking === index;
        return (
          <div key={index} className={index ? 'inscription-draft inscription-draft--more' : 'inscription-draft'}>
            <div className="inscription-row">
              <Type size={16} />
              <input
                className={`inscription-input${script ? ' inscription-input--script' : ''}`}
                value={draft.text}
                onChange={(event) => update(index, { text: event.target.value.replace(INSCRIPTION_CHARS, '').slice(0, INSCRIPTION_MAX) })}
                placeholder={index ? 'e.g. your initials' : 'e.g. HB or a name'}
                maxLength={INSCRIPTION_MAX}
                aria-label={index ? 'More text, on the other row' : 'Initials or text'}
              />
              <small>{draft.text.length}/{INSCRIPTION_MAX}</small>
              {index > 0 && (
                <button className="inscription-remove" type="button" aria-label="Remove this text" onClick={() => {
                  onChange(drafts.slice(0, 1));
                  if (picking === 1) onPicking(null);
                }}>
                  <X size={15} />
                </button>
              )}
            </div>
            {draft.text.trim() && (
              <>
                <div className="segmented-control inscription-fonts" role="group" aria-label="Lettering">
                  {INSCRIPTION_FONTS.map((font) => (
                    <button key={font.id} type="button" className={draft.font === font.id ? 'segment segment--selected' : 'segment'} onClick={() => update(index, { font: font.id })}>
                      <span className={font.id === 'script' ? 'inscription-font-sample--script' : undefined}>{font.label}</span>
                    </button>
                  ))}
                </div>
                <div className="segmented-control segmented-control--three inscription-styles">
                  {styles.map((style) => (
                    <button
                      key={style.id}
                      className={draft.style === style.id ? 'segment segment--selected' : 'segment'}
                      type="button"
                      onClick={() => update(index, { style: style.id })}
                      title={style.detail}
                    >
                      {style.label}
                      {hint(style.id) && <small>{hint(style.id)}</small>}
                    </button>
                  ))}
                </div>
                {draft.style === 'engraved' && (
                  <div className="enamel-row" role="group" aria-label="Enamel colour">
                    <span>Enamel</span>
                    <button type="button" className={draft.enamel === null ? 'enamel-swatch enamel-swatch--none is-selected' : 'enamel-swatch enamel-swatch--none'} onClick={() => update(index, { enamel: null })} aria-label="No enamel" aria-pressed={draft.enamel === null} />
                    {ENAMELS.map((enamel) => (
                      <button
                        key={enamel.id}
                        type="button"
                        className={draft.enamel === enamel.id ? 'enamel-swatch is-selected' : 'enamel-swatch'}
                        style={{ background: enamel.swatch }}
                        onClick={() => update(index, { enamel: enamel.id })}
                        aria-label={`${enamel.label} enamel`}
                        aria-pressed={draft.enamel === enamel.id}
                      />
                    ))}
                  </div>
                )}
                <button className={`tooth-pick-button${active ? ' tooth-pick-button--active' : ''}`} type="button" onClick={() => onPicking(active ? null : index)}>
                  <MousePointer2 size={15} />
                  {active
                    ? draft.anchor !== null
                      ? 'Now tap the last tooth (or the same one again)'
                      : 'Tap the first tooth on the model…'
                    : draft.teeth.length
                      ? `${placement(draft)} · Change`
                      : 'Choose the teeth on the model'}
                </button>
                {!draft.teeth.length && !active && <small className="field-hint">Tap one tooth, or the first and last of a run for a name across several.</small>}
                {draft.teeth.length > 0 && !fitsTeeth(draft) && <small className="field-hint field-hint--warn">That many letters needs more teeth: up to 6 a tooth.</small>}
              </>
            )}
          </div>
        );
      })}
      {canAdd && (
        <button className="text-button text-button--left" type="button" onClick={() => onChange([...drafts, newDraft(drafts[0].style)])}>
          <Plus size={15} /> Add text on the {usedRows[0] === 0 ? 'bottom' : 'top'} teeth
        </button>
      )}
    </>
  );
}
