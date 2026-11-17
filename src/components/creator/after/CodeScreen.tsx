import { useEffect, useId, type RefObject } from 'react';
import { CODE_LENGTH, cleanCode, formatPhone, resendState } from './afterLogic';

export type CodeScreenProps = {
  shop: string;
  phone: string;
  code: string;
  onCode: (code: string) => void;
  codeRef: RefObject<HTMLInputElement>;
  /** Seconds until a new code can be asked for. */
  resendIn: number;
  onResend: () => void;
  resent: boolean;
  busy: 'checking' | 'sending' | 'texting' | null;
  error: string;
  onWrongNumber: () => void;
  onBack: () => void;
};

type OtpNavigator = Navigator & { credentials: { get: (options: { otp: { transport: string[] }; signal: AbortSignal }) => Promise<{ code?: string } | null> } };

/** Screen 2, the code: it fills itself from the text on phones, and the 6th digit sends. */
export function CodeScreen(props: CodeScreenProps) {
  const id = useId();
  const { onCode } = props;
  // Android Chrome reads the code from the text (WebOTP); iPhones offer it above the keyboard (one-time-code).
  useEffect(() => {
    if (!('OTPCredential' in window)) return;
    const abort = new AbortController();
    (navigator as OtpNavigator).credentials
      .get({ otp: { transport: ['sms'] }, signal: abort.signal })
      .then((otp) => otp?.code && onCode(cleanCode(otp.code)))
      .catch(() => {
        // cancelled or not offered: typing still works
      });
    return () => abort.abort();
  }, [onCode]);

  const resend = resendState(props.resendIn);
  const working = props.busy !== null;
  const at = Math.min(props.code.length, CODE_LENGTH - 1);
  return (
    <>
      <div className="after-head">
        <h2 tabIndex={-1}>Enter the 6-digit code</h2>
      </div>
      <div className="after-body">
        <p className="intro">
          We texted it to <b>{formatPhone(props.phone)}</b>.{' '}
          <button type="button" className="link inline" onClick={props.onWrongNumber}>
            Wrong number? Change it
          </button>
        </p>
        <section className="sect">
          <label className="otp" data-bad={props.error ? '' : undefined}>
            <span className="sr">6-digit code</span>
            <input
              ref={props.codeRef}
              id={`${id}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              value={props.code}
              disabled={working}
              onChange={(event) => props.onCode(cleanCode(event.target.value))}
              aria-invalid={Boolean(props.error)}
              aria-describedby={`${id}-code-err ${id}-code-note`}
            />
            <span className="boxes" aria-hidden="true">
              {Array.from({ length: CODE_LENGTH }, (_, index) => (
                <i key={index} className={index === at && !working ? 'at' : undefined}>
                  {props.code[index] ?? ''}
                </i>
              ))}
            </span>
          </label>
          <p className="err" id={`${id}-code-err`} role="alert">
            {props.error}
          </p>
          <p className="sr" aria-live="polite">
            {props.busy === 'checking' ? 'Checking the code' : props.busy === 'sending' ? `Sending to ${props.shop}` : props.resent ? 'A new code is on its way.' : ''}
          </p>
          <p className="note" id={`${id}-code-note`}>
            {props.busy === 'checking' ? (
              'Checking…'
            ) : props.busy === 'sending' ? (
              `Sending to ${props.shop}…`
            ) : resend.canResend ? (
              <button type="button" className="link" onClick={props.onResend}>
                Send a new code
              </button>
            ) : (
              <>
                {props.resent ? 'A new code is on its way. ' : ''}
                {resend.text}
              </>
            )}
          </p>
        </section>
      </div>
      <div className="after-foot">
        <div className="btns">
          <button type="button" className="cta ghost" onClick={props.onBack}>
            Back
          </button>
          <button type="button" className="cta" disabled aria-busy={working}>
            {props.busy === 'checking' || props.busy === 'sending' ? 'Sending…' : `Send to ${props.shop}`}
          </button>
        </div>
        <p className="free">It sends as soon as the code is in.</p>
      </div>
    </>
  );
}
