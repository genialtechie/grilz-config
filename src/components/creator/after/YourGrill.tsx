import { useId, type ReactElement, type RefObject } from 'react';
import { CircleCheck, Package, ScanLine, Store } from 'lucide-react';
import type { AddOn, MoldId } from '../../../lib/renderSpec';
import type { PriceLine } from '../../../lib/pricing';
import { FIT_WORDS, formatPhone, money, type ContactError } from './afterLogic';
import { radioKeys } from './keys';
import { Row } from './parts';

const FIT_ICON: Record<MoldId, ReactElement> = { kit: <Package aria-hidden />, own: <ScanLine aria-hidden />, store: <Store aria-hidden /> };

export type YourGrillProps = {
  shop: string;
  headRef: RefObject<HTMLHeadingElement>;
  /** The price lines and total, or null when the shop hides prices. */
  price: { lines: PriceLine[]; total: number } | null;
  fittings: MoldId[];
  mold: MoldId | undefined;
  onMold: (mold: MoldId) => void;
  addOns: readonly AddOn[];
  picked: readonly string[];
  onToggleAddOn: (id: string) => void;
  /** A phone verified on this device: no code this time. */
  verified: { phone: string } | null;
  onChangePhone: () => void;
  name: string;
  phone: string;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  error: ContactError | null;
  nameRef: RefObject<HTMLInputElement>;
  phoneRef: RefObject<HTMLInputElement>;
  more: boolean;
  onMore: () => void;
  note: string;
  onNote: (value: string) => void;
  promos: boolean;
  promoCode: string;
  onPromoCode: (value: string) => void;
  onApplyPromo: () => void;
  promoMessage: string;
  promoBusy: boolean;
  busy: 'texting' | 'sending' | null;
  sendError: string;
  onKeepEditing: () => void;
  onSend: () => void;
};

/** Screen 1, "Here are your grillz": the price, the fitting, where to text, then Send. */
export function YourGrill(props: YourGrillProps) {
  const id = useId();
  const { shop, error } = props;
  const nameErr = error?.field === 'name' ? error.message : '';
  const phoneErr = error?.field === 'phone' ? error.message : '';
  const knownName = props.verified && props.name.trim().length >= 2;
  return (
    <>
      <div className="after-head">
        <h2 ref={props.headRef} tabIndex={-1}>
          Here are your grillz
        </h2>
      </div>
      <div className="after-body">
        <div className="sum">
          <p className="note">
            {shop} confirms the {props.price ? 'exact ' : ''}price after your fitting.
          </p>
          {props.price && (
            <details className="why">
              <summary>What’s in the price</summary>
              <ul>
                {props.price.lines.map((line, index) => (
                  <li key={`${line.label}-${index}`}>
                    <span>{line.label}</span>
                    <span>{money(line.amount)}</span>
                  </li>
                ))}
                <li className="total">
                  <span>About</span>
                  <span>{money(props.price.total)}</span>
                </li>
              </ul>
            </details>
          )}
        </div>

        {props.fittings.length > 0 && (
          <section className="sect" aria-labelledby={`${id}-fit`}>
            <h3 className="sec" id={`${id}-fit`}>
              How will they get the shape of your teeth?
            </h3>
            <div className="rows" role="radiogroup" aria-labelledby={`${id}-fit`} onKeyDown={radioKeys}>
              {props.fittings.map((mold) => (
                <Row key={mold} kind="radio" checked={props.mold === mold} onSelect={() => props.onMold(mold)} title={FIT_WORDS[mold].title} hint={FIT_WORDS[mold].hint(shop)} thumb={FIT_ICON[mold]} />
              ))}
            </div>
          </section>
        )}

        {props.addOns.length > 0 && (
          <section className="sect" aria-labelledby={`${id}-extras`}>
            <h3 className="sec" id={`${id}-extras`}>
              Extras
            </h3>
            <div className="rows">
              {props.addOns.map((addOn) => {
                const on = props.picked.includes(addOn.id);
                return (
                  <div className="xrow" key={addOn.id}>
                    <div>
                      <b id={`${id}-x-${addOn.id}`}>{addOn.label}</b>
                      <span>
                        {money(addOn.price)}
                        {addOn.per === 'tooth' ? ' a tooth' : ''}
                        {addOn.detail ? ` · ${addOn.detail}` : ''}
                      </span>
                    </div>
                    <button type="button" className="sw" role="switch" aria-checked={on} aria-labelledby={`${id}-x-${addOn.id}`} onClick={() => props.onToggleAddOn(addOn.id)} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="sect" aria-labelledby={`${id}-text`}>
          <h3 className="sec" id={`${id}-text`}>
            Where should {shop} text you?
          </h3>
          {(!props.verified || !knownName) && (
            <div className="field">
              <label htmlFor={`${id}-name`}>First name</label>
              <input
                ref={props.nameRef}
                id={`${id}-name`}
                type="text"
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                value={props.name}
                onChange={(event) => props.onName(event.target.value)}
                aria-invalid={Boolean(nameErr)}
                aria-describedby={nameErr ? `${id}-name-err` : undefined}
              />
              <p className="err" id={`${id}-name-err`} role="alert">
                {nameErr}
              </p>
            </div>
          )}
          {props.verified ? (
            <>
              <Row
                title={knownName ? `${props.name.trim()} · ${formatPhone(props.verified.phone)}` : formatPhone(props.verified.phone)}
                hint="Verified on this device, so no code this time."
                thumb={<CircleCheck aria-hidden />}
              />
              <button type="button" className="link" onClick={props.onChangePhone}>
                Change
              </button>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor={`${id}-phone`}>Phone</label>
                <input
                  ref={props.phoneRef}
                  id={`${id}-phone`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(555) 012-3456"
                  enterKeyHint="send"
                  value={props.phone}
                  onChange={(event) => props.onPhone(formatPhone(event.target.value))}
                  onKeyDown={(event) => event.key === 'Enter' && props.onSend()}
                  aria-invalid={Boolean(phoneErr)}
                  aria-describedby={`${phoneErr ? `${id}-phone-err ` : ''}${id}-phone-note`}
                />
                <p className="err" id={`${id}-phone-err`} role="alert">
                  {phoneErr}
                </p>
              </div>
              <p className="note" id={`${id}-phone-note`}>
                {shop} texts you about this grill only. We’ll send a code first; msg &amp; data rates may apply.
              </p>
            </>
          )}
        </section>

        {props.more ? (
          <section className="sect">
            <div className="field">
              <label htmlFor={`${id}-note`}>Note to {shop}</label>
              <textarea id={`${id}-note`} maxLength={200} placeholder="Anything they should know" value={props.note} onChange={(event) => props.onNote(event.target.value)} />
            </div>
            {props.promos && (
              <div className="field">
                <label htmlFor={`${id}-promo`}>Promo code</label>
                <div className="inrow">
                  <input
                    id={`${id}-promo`}
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    value={props.promoCode}
                    onChange={(event) => props.onPromoCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => event.key === 'Enter' && props.onApplyPromo()}
                    aria-describedby={`${id}-promo-msg`}
                  />
                  <button type="button" className="small" onClick={props.onApplyPromo} disabled={!props.promoCode.trim() || props.promoBusy}>
                    {props.promoBusy ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                <p className="note" id={`${id}-promo-msg`} aria-live="polite">
                  {props.promoMessage}
                </p>
              </div>
            )}
          </section>
        ) : (
          <button type="button" className="link" onClick={props.onMore}>
            {props.promos ? '+ Add a note or promo code' : '+ Add a note'}
          </button>
        )}
      </div>
      <div className="after-foot">
        <p className="err" role="alert">
          {props.sendError}
        </p>
        <div className="btns">
          <button type="button" className="cta ghost" onClick={props.onKeepEditing}>
            Keep editing
          </button>
          <button type="button" className="cta" onClick={props.onSend} aria-busy={props.busy !== null} disabled={props.busy !== null}>
            {props.busy === 'texting' ? 'Texting a code…' : props.busy === 'sending' ? 'Sending…' : `Send to ${shop}`}
          </button>
        </div>
        <p className="free">Free. Nothing to pay yet.</p>
      </div>
    </>
  );
}
