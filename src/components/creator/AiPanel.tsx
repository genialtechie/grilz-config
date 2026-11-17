import { useEffect, useRef, type ReactNode } from 'react';
import { Composer } from './Composer';
import { Ico } from './icons';
import { SetPicture } from './SetPicture';
import { AI_FREE } from './StartPanel';
import { formatPhone } from './phone';
import type { SetKind } from './model';

export type AiMessage = { me: string; picture: string | null; title: string; hint: string[]; set: { top: number; bottom: number; kind: SetKind } };
export type AiStep = 'talk' | 'contact' | 'code';

type Props = {
  step: AiStep;
  messages: AiMessage[];
  text: string;
  picture: string | null;
  busy: boolean;
  error: string;
  /** A phone is verified on this device. */
  known: boolean;
  /** Free builds left on this phone (null before the server has said). */
  left: number | null;
  shopName: string;
  name: string;
  phone: string;
  contactError: { field: 'name' | 'phone'; text: string } | null;
  code: string;
  codeError: string;
  resendIn: number;
  grab: ReactNode;
  onHeadPointerDown?: (event: React.PointerEvent) => void;
  onText: (text: string) => void;
  onPicture: (file: File | null) => void;
  onSend: () => void;
  onBack: () => void;
  onHand: () => void;
  onName: (name: string) => void;
  onPhone: (phone: string) => void;
  onSendCode: () => void;
  onCode: (code: string) => void;
  onWrongNumber: () => void;
  onResend: () => void;
};

function Row({ title, hint, thumb, lead }: { title: string; hint: ReactNode; thumb: ReactNode; lead?: boolean }) {
  return (
    <div className={lead ? 'mrow lead' : 'mrow'}>
      <span className="txt">
        <b>{title}</b>
        <span className="ins">{hint}</span>
      </span>
      <span className="prev">{thumb}</span>
    </div>
  );
}

function freeWords(known: boolean, left: number | null) {
  if (!known) return `${AI_FREE} free AI builds per phone. Each one costs us money, so we text you a code first.`;
  const l = left ?? AI_FREE;
  return l ? `${l} of ${AI_FREE} free builds left on this phone. Every build counts, small changes too.` : `That was your ${AI_FREE} free builds on this phone.`;
}

/**
 * "Describe it" (decided Nov 17): a conversation. One box, then keep talking; the phone sign-up comes
 * first and says why, plainly; every phone gets 3 free builds and every reply counts. The AI builds the
 * closest version on the 3D, all editable, and says what's different.
 */
export function AiPanel(props: Props) {
  const body = useRef<HTMLDivElement | null>(null);
  const first = !props.messages.length;
  const out = props.known && props.left === 0;
  // Keep talking opens on the latest reply.
  useEffect(() => {
    if (props.step === 'talk' && body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [props.step, props.messages.length]);

  if (props.step === 'contact') {
    const said = props.text.trim() || (props.picture ? 'A picture' : '');
    return (
      <>
        {props.grab}
        <div className="thead" onPointerDown={props.onHeadPointerDown}>
          <h2>Where should we text your code?</h2>
        </div>
        <div className="tbody flow">
          {said && (
            <div className="chat">
              <div className="me">
                {said}
                {props.picture && <img alt="Your picture" src={props.picture} />}
              </div>
            </div>
          )}
          <p className="intro">
            Every AI build costs us money, so we ask for your phone first. Each phone gets {AI_FREE} free builds, and it’s the number {props.shopName} texts about your grill.
          </p>
          <section className="sect">
            <div className="field">
              <label htmlFor="aname">First name</label>
              <input
                id="aname"
                type="text"
                autoComplete="given-name"
                autoCapitalize="words"
                value={props.name}
                aria-invalid={props.contactError?.field === 'name'}
                onChange={(event) => props.onName(event.target.value.slice(0, 40))}
                onKeyDown={(event) => event.key === 'Enter' && props.onSendCode()}
              />
            </div>
            <div className="field">
              <label htmlFor="aphone">Phone</label>
              <input
                id="aphone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(555) 012-3456"
                value={props.phone}
                aria-invalid={props.contactError?.field === 'phone'}
                onChange={(event) => props.onPhone(formatPhone(event.target.value))}
                onKeyDown={(event) => event.key === 'Enter' && props.onSendCode()}
              />
            </div>
            <p className="err" role="alert">
              {props.contactError?.text ?? props.error}
            </p>
            <p className="note">{props.shopName} texts you about this grill only. We’ll send a code first; msg &amp; data rates may apply.</p>
          </section>
        </div>
        <div className="tfoot col">
          <div className="btns">
            <button type="button" className="cta ghost second" onClick={props.onBack}>
              Back
            </button>
            <button type="button" className="cta" disabled={props.busy} onClick={props.onSendCode}>
              {props.busy ? 'Sending…' : 'Text me a code'}
            </button>
          </div>
          <p className="free">Free. Nothing to pay.</p>
        </div>
      </>
    );
  }

  if (props.step === 'code') {
    return (
      <>
        {props.grab}
        <div className="thead" onPointerDown={props.onHeadPointerDown}>
          <h2>Enter the 6-digit code</h2>
        </div>
        <div className="tbody flow">
          <p className="intro">
            We texted it to <b>{formatPhone(props.phone)}</b>.{' '}
            <button type="button" className="link" onClick={props.onWrongNumber}>
              Wrong number? Change it
            </button>
          </p>
          <section className="sect">
            <label className="otp">
              <span className="sr">6-digit code</span>
              <input
                id="aotp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={props.code}
                disabled={props.busy}
                autoFocus
                onChange={(event) => props.onCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <span className="boxes" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <i key={i} className={i === Math.min(props.code.length, 5) && !props.busy ? 'at' : undefined}>
                    {props.code[i] ?? ''}
                  </i>
                ))}
              </span>
            </label>
            <p className="err" role="alert">
              {props.codeError}
            </p>
            <p className="note">
              {props.busy ? (
                'Checking…'
              ) : props.resendIn > 0 ? (
                `Send a new code in 0:${String(props.resendIn).padStart(2, '0')}`
              ) : (
                <button type="button" className="link" onClick={props.onResend}>
                  Send a new code
                </button>
              )}
            </p>
          </section>
        </div>
        <div className="tfoot col">
          <div className="btns">
            <button type="button" className="cta ghost second" onClick={props.onWrongNumber}>
              Back
            </button>
            <button type="button" className="cta" disabled>
              {props.busy ? 'Building…' : 'Build it'}
            </button>
          </div>
          <p className="free">It builds as soon as the code is in.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {props.grab}
      <div className="thead" onPointerDown={props.onHeadPointerDown}>
        <h2>{first ? 'Describe your grill' : 'Keep talking'}</h2>
      </div>
      <div className="tbody flow" ref={body} aria-live="polite">
        {first ? (
          <p className="intro">Say it the way you’d say it to a jeweler. AI builds the closest version in the 3D, tells you what’s different, and you can change anything after.</p>
        ) : (
          <div className="chat">
            {props.messages.map((m, i) => (
              <div key={i} className="turn">
                <div className="me">
                  {m.me}
                  {m.picture && <img alt="Your picture" src={m.picture} />}
                </div>
                <Row
                  lead
                  title={m.title}
                  hint={m.hint.map((line, k) => (
                    <span key={k}>
                      {k > 0 && <br />}
                      {line}
                    </span>
                  ))}
                  thumb={<SetPicture {...m.set} />}
                />
              </div>
            ))}
          </div>
        )}
        {props.busy && <p className="note">Building it…</p>}
        {props.error && (
          <p className="err" role="alert">
            {props.error}
          </p>
        )}
        {out && <Row lead title="Keep going by hand" hint="Everything on your grill is still yours to change: tap a part on top, or tap teeth on the 3D." thumb={<Ico name="check" />} />}
      </div>
      <div className="tfoot col">
        <div className="btns end">
          <button type="button" className="cta ghost second" onClick={props.onBack}>
            Back
          </button>
          {out ? (
            <button type="button" className="cta" onClick={props.onHand}>
              Keep editing by hand
            </button>
          ) : (
            <Composer
              id="aitext"
              placeholder={first ? 'Iced out bottom 8 in white gold, with fangs' : 'Make the front two rose gold'}
              text={props.text}
              picture={props.picture}
              busy={props.busy}
              onText={props.onText}
              onPicture={props.onPicture}
              onSend={props.onSend}
            />
          )}
        </div>
        <p className="free">{freeWords(props.known, props.left)}</p>
      </div>
    </>
  );
}
