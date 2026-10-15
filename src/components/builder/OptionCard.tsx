import { Check } from 'lucide-react';

type OptionCardProps = {
  label: string;
  detail?: string;
  hint?: string;
  image?: string;
  swatch?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

// A photo card for one option. Cards sit in a grid on desktop and a
// horizontally scrolling row on phones so the 3D model keeps the screen.
export function OptionCard({ label, detail, hint, image, swatch, selected, disabled, onSelect }: OptionCardProps) {
  return (
    <button
      className={`option-card${selected ? ' option-card--selected' : ''}`}
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="option-card__media">
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span className="option-card__swatch" style={{ backgroundColor: swatch }} />}
        {swatch && image && <span className="option-card__dot" style={{ backgroundColor: swatch }} />}
        {selected && <span className="option-card__check"><Check size={13} strokeWidth={3} /></span>}
      </span>
      <span className="option-card__text">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
        {hint && <small className="option-card__hint">{hint}</small>}
      </span>
    </button>
  );
}
