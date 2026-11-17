import { useId, type ReactNode, type RefObject } from 'react';
import { CircleCheck, Instagram, MessageCircle, Package, ScanLine, Store, Wallet } from 'lucide-react';
import type { MoldId } from '../../../lib/renderSpec';
import { FIT_WORDS, depositWords, formatPhone, sentFooter, type DepositState } from './afterLogic';
import { Row } from './parts';

const FIT_ICON: Record<MoldId, ReactNode> = { kit: <Package aria-hidden />, own: <ScanLine aria-hidden />, store: <Store aria-hidden /> };

export type FieldState = { value: string; status: 'idle' | 'busy' | 'done' | 'error'; message: string };

export type SentScreenProps = {
  shop: string;
  headRef: RefObject<HTMLHeadingElement>;
  phone: string;
  /** The photo, here when the builder has no place for it on the stage. */
  photo: ReactNode;
  /** The still and the photo, for the round pictures in What happens next. */
  still: string;
  finalPhoto: string | null;
  mold: MoldId | undefined;
  /** The deposit, when this shop can take one here; null hides the row. */
  deposit: { amount: number; state: DepositState; error: string; note: string } | null;
  onSkip: () => void;
  onPay: () => void;
  canSave: boolean;
  onSave: () => void;
  saveMessage: string;
  instagram: FieldState;
  onInstagram: (value: string) => void;
  onInstagramDone: () => void;
  follow: string | null;
  email: FieldState;
  onEmail: (value: string) => void;
  onSendEmail: () => void;
  onStartOver: () => void;
};

/** Screen 3, Sent: the photo develops, the deposit, one small card while it develops, what happens next. */
export function SentScreen(props: SentScreenProps) {
  const id = useId();
  const { shop, deposit } = props;
  const buttons = sentFooter(deposit?.state ?? null, deposit?.amount ?? 0);
  const fit = props.mold ? FIT_WORDS[props.mold] : null;
  const steps: { title: string; hint?: string; thumb: ReactNode }[] = [
    { title: `${shop} texts you`, thumb: <MessageCircle aria-hidden /> },
    { title: 'Fitting', hint: fit?.title, thumb: props.mold ? FIT_ICON[props.mold] : <Package aria-hidden /> },
    { title: 'They make it', thumb: <img alt="" src={props.still} /> },
    { title: 'It’s yours', thumb: <img alt="" src={props.finalPhoto ?? props.still} /> },
  ];
  return (
    <>
      <div className="after-head" aria-live="polite">
        <h2 ref={props.headRef} tabIndex={-1}>
          Sent. {shop} will text you.
        </h2>
        <p className="sub">At {formatPhone(props.phone)}.</p>
      </div>
      <div className="after-body">
        {props.photo}
        {deposit && (
          <div className="sect">
            {(() => {
              const words = depositWords(shop, deposit.amount, deposit.state);
              return <Row lead title={words.title} hint={words.hint} thumb={deposit.state === 'paid' ? <CircleCheck aria-hidden /> : <Wallet aria-hidden />} />;
            })()}
            <p className="err" role="alert">
              {deposit.error}
            </p>
            {deposit.note && (
              <p className="note" role="status">
                {deposit.note}
              </p>
            )}
          </div>
        )}

        <section className="sect" aria-labelledby={`${id}-while`}>
          <h3 className="sec" id={`${id}-while`}>
            While your photo develops
          </h3>
          <div className="card">
            <div className="field">
              <label htmlFor={`${id}-ig`}>Your Instagram</label>
              <input
                id={`${id}-ig`}
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="@"
                value={props.instagram.value}
                onChange={(event) => props.onInstagram(event.target.value)}
                onBlur={props.onInstagramDone}
                onKeyDown={(event) => event.key === 'Enter' && props.onInstagramDone()}
                aria-describedby={`${id}-ig-note`}
                aria-invalid={props.instagram.status === 'error'}
              />
              <p className={props.instagram.status === 'error' ? 'err' : 'note'} id={`${id}-ig-note`} aria-live="polite">
                {props.instagram.status === 'error' ? props.instagram.message : props.instagram.status === 'done' ? `Added. ${shop} sees it as you typed it.` : `${shop} sees it as you typed it.`}
              </p>
            </div>
            {props.follow && <Row kind="link" href={`https://www.instagram.com/${props.follow}/`} title={`Follow @${props.follow}`} hint="Opens Instagram" thumb={<Instagram aria-hidden />} />}
            <div className="field">
              <label htmlFor={`${id}-email`}>Email me a copy</label>
              <div className="inrow">
                <input
                  id={`${id}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  enterKeyHint="send"
                  value={props.email.value}
                  onChange={(event) => props.onEmail(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && props.onSendEmail()}
                  aria-invalid={props.email.status === 'error'}
                  aria-describedby={`${id}-email-msg`}
                />
                <button type="button" className="small" onClick={props.onSendEmail} disabled={!props.email.value.trim() || props.email.status === 'busy' || props.email.status === 'done'}>
                  {props.email.status === 'busy' ? 'Sending…' : props.email.status === 'done' ? 'Sent' : 'Send'}
                </button>
              </div>
              <p className={props.email.status === 'error' ? 'err' : 'note'} id={`${id}-email-msg`} aria-live="polite">
                {props.email.message}
              </p>
            </div>
          </div>
        </section>

        <section className="sect" aria-labelledby={`${id}-next`}>
          <h3 className="sec" id={`${id}-next`}>
            What happens next
          </h3>
          <ol className="steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="n" aria-hidden>
                  {index + 1}
                </span>
                <span className="txt">
                  <b>{step.title}</b>
                  {step.hint && <span className="ins">{step.hint}</span>}
                </span>
                <span className="prev">{step.thumb}</span>
              </li>
            ))}
          </ol>
        </section>

        <button type="button" className="link" onClick={props.onStartOver}>
          Start a new build
        </button>
      </div>
      <div className="after-foot">
        {props.saveMessage && (
          <p className="note" role="status" style={{ textAlign: 'center' }}>
            {props.saveMessage}
          </p>
        )}
        <div className="btns">
          {buttons.map((button) => (
            <button
              key={button.action + button.label}
              type="button"
              className={`cta${button.ghost ? ' ghost' : ''}`}
              aria-busy={button.busy || undefined}
              disabled={button.busy || (button.action === 'save' && !props.canSave)}
              onClick={button.action === 'skip' ? props.onSkip : button.action === 'pay' ? props.onPay : props.onSave}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
