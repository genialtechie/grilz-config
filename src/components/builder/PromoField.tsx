import { useState, type FormEvent } from 'react';
import { Tag } from 'lucide-react';
import { checkPromo } from '../../lib/leads';
import { promoTerms, type Promo } from '../../lib/promo';

type Props = {
  shop: string;
  applied: Promo | null;
  /** Set when the order is under the code's minimum: the amount it needs. */
  minOrder?: number;
  /** After the design is sent the code is part of it and can't change. */
  locked: boolean;
  formatPrice: (value: number) => string;
  onChange: (promo: Promo | null) => void;
};

/** "Have a promo code?" on the Review step: shown only when the shop has a code to give. */
export function PromoField({ shop, applied, minOrder, locked, formatPrice, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    const result = await checkPromo(shop, code);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onChange(result.promo);
    setCode('');
  };

  if (applied) {
    return (
      <div className="promo">
        <div className="promo-applied">
          <Tag size={14} aria-hidden="true" />
          <span><strong>{applied.code}</strong> · {promoTerms(applied)}</span>
          {!locked && <button className="text-button" type="button" onClick={() => onChange(null)}>Remove</button>}
        </div>
        {minOrder !== undefined && <p className="promo-note">Applies to orders of {formatPrice(minOrder)} or more.</p>}
      </div>
    );
  }
  if (locked) return null;
  if (!open) {
    return (
      <button className="text-button promo-toggle" type="button" onClick={() => setOpen(true)}>
        Have a promo code?
      </button>
    );
  }
  return (
    <form className="promo" onSubmit={(event) => void apply(event)}>
      <div className="promo-row">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Promo code"
          aria-label="Promo code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
          autoFocus
        />
        <button className="secondary-button" type="submit" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Apply'}</button>
      </div>
      {error && <p className="promo-note promo-note--error" role="alert">{error}</p>}
    </form>
  );
}
