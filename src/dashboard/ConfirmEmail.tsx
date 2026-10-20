import { useEffect, useState, type FormEvent } from 'react';
import { emailStatus, resendConfirmEmail } from '../admin/data';
import { codeDigits, verifyEmailCode } from './emailCode';

// The email isn't proved yet when signup or a claim link signs someone in on
// the spot (MAG-91). Until they tap the emailed link or enter its code, this
// bar stays up, and payouts, team invites and custom domains stay locked
// (the server enforces that; their panels show its message).

function CodeForm({ email, onDone }: { email: string; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const failed = await verifyEmailCode(email, code);
    setBusy(false);
    if (failed) setError(failed);
    else onDone();
  };

  return (
    <form className="dash-code" onSubmit={submit}>
      <label>
        <span>Code from the email</span>
        <input value={code} onChange={(event) => setCode(codeDigits(event.target.value))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" placeholder="123456" required />
      </label>
      <button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Confirm'}</button>
      {error && <small role="alert">{error}</small>}
    </form>
  );
}

export function ConfirmBanner({ email, shop }: { email: string; shop: string }) {
  const [confirmed, setConfirmed] = useState(true);
  const [entering, setEntering] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const check = () => void emailStatus().then((status) => setConfirmed(status.confirmed)).catch(() => undefined);
  useEffect(check, []);

  if (confirmed) return null;

  const resend = async () => {
    setBusy(true);
    setNote('');
    try {
      const result = await resendConfirmEmail(shop);
      if (result.confirmed) setConfirmed(true);
      else setNote(`Sent to ${email}.`);
      setEntering(true);
    } catch (reason) {
      setNote((reason as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="dash-trial dash-verify" role="status">
      <span>Confirm your email so customer requests reach you</span>
      <button type="button" disabled={busy} onClick={() => void resend()}>{busy ? 'Sending…' : 'Resend'}</button>
      {!entering && <button type="button" onClick={() => setEntering(true)}>Enter code</button>}
      {note && <span>{note}</span>}
      {entering && <CodeForm email={email} onDone={check} />}
    </div>
  );
}
