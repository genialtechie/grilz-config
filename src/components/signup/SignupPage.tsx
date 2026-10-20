import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Turnstile } from '../Turnstile';
import { AuthPage } from '../auth/AuthPage';
import { openShop } from '../../lib/openShop';

// /signup: a jeweler starts a free trial on their own (MAG-91: three fields).
// We create the shop, live on the starting prices, with its link from their
// Instagram handle or shop name, and sign them in right here. The welcome
// email's link or code confirms the email later.

type Session = { access_token: string; refresh_token: string };

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [website, setWebsite] = useState('');
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [sentMessage, setSentMessage] = useState('');
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const opened = useRef(Date.now());

  useEffect(() => {
    document.title = 'Start your free trial · VVS Lab';
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setState('sending');
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, instagram, turnstile, website, elapsedMs: Date.now() - opened.current }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string; field?: string; slug?: string; session?: Session };
      if (!response.ok) {
        setError({ field: body.field, message: body.message ?? 'Something went wrong. Try again.' });
        setState('idle');
        return;
      }
      // A new account opens its dashboard here; an existing one signs in from the email.
      if (body.session && body.slug && (await openShop(body.session, body.slug))) return;
      setSentMessage(body.message ?? '');
      setState('sent');
    } catch {
      setError({ message: 'Couldn’t reach VVS Lab. Check your connection and try again.' });
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <AuthPage
        title={<>Check your <em>email</em></>}
        lead={sentMessage || <>We sent a link to <strong>{email}</strong>. Open it on this phone: {name || 'your shop'} is live, and you set your prices with three quick questions.</>}
        foot={<p>Nothing there in a minute? Check spam, or email <a href="mailto:salesteam@magpollo.com">salesteam@magpollo.com</a>.</p>}
      />
    );
  }

  return (
    <AuthPage
      title={<>Your own 3D grillz <em>builder</em></>}
      lead="Customers design their set, see your price and send you the order with a studio photo. Free for 14 days, then $199 a month."
      foot={<p>Already have a shop? <a href="/dashboard">Sign in</a></p>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-field">
          <span>Shop name</span>
          <input value={name} maxLength={60} required onChange={(event) => setName(event.target.value)} autoComplete="organization" />
          {error?.field === 'name' && <small className="auth-error">{error.message}</small>}
        </label>

        <label className="auth-field">
          <span>Email</span>
          <input type="email" value={email} required onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" />
          <small className={error?.field === 'email' ? 'auth-error' : undefined}>{error?.field === 'email' ? error.message : 'Design requests arrive here. You can add more later.'}</small>
        </label>

        <label className="auth-field">
          <span>Instagram <span className="auth-optional">(optional)</span></span>
          <div className="auth-prefix"><em>@</em><input value={instagram} maxLength={31} onChange={(event) => setInstagram(event.target.value.replace(/^@/, ''))} autoCapitalize="none" spellCheck={false} /></div>
          <small className={error?.field === 'instagram' ? 'auth-error' : undefined}>{error?.field === 'instagram' ? error.message : 'Your builder’s link uses it.'}</small>
        </label>

        <div className="auth-trap" aria-hidden="true">
          <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        </div>

        <Turnstile onToken={setTurnstile} />
        {error && !error.field && <p className="auth-error" role="alert">{error.message}</p>}

        <button className="auth-button" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? <><Loader2 className="auth-spinner" size={18} /> Creating your shop…</> : 'Start my free trial'}
        </button>
        <p className="auth-note">No card needed to start. By continuing you agree to the <a href="/terms" target="_blank" rel="noopener">Terms</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p>
      </form>
    </AuthPage>
  );
}
