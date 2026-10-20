import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Turnstile } from '../Turnstile';
import { AuthPage } from '../auth/AuthPage';

// /signup: a jeweler starts a free trial on their own. We create the shop and
// email a sign-in link; the builder is live and they set their prices in /dashboard.

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');

export default function SignupPage() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [terms, setTerms] = useState(false);
  const [website, setWebsite] = useState('');
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [available, setAvailable] = useState<{ ok: boolean; message?: string } | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const opened = useRef(Date.now());
  const host = typeof window === 'undefined' ? 'vvslab.magpollo.com' : window.location.host;

  useEffect(() => {
    document.title = 'Start your free trial · VVS Lab';
  }, []);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    setAvailable(null);
    if (slug.length < 3) return;
    const timer = window.setTimeout(() => {
      fetch(`/api/signup?slug=${encodeURIComponent(slug)}`)
        .then((response) => response.json())
        .then((body: { available?: boolean; message?: string }) => setAvailable({ ok: Boolean(body.available), message: body.message }))
        .catch(() => setAvailable(null));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [slug]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setState('sending');
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, email, instagram, terms, turnstile, website, elapsedMs: Date.now() - opened.current }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string; field?: string };
      if (!response.ok) {
        setError({ field: body.field, message: body.message ?? 'Something went wrong. Try again.' });
        setState('idle');
        return;
      }
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
        lead={<>We sent a link to <strong>{email}</strong>. Open it on this phone: {name || 'your shop'} is live, and you set your prices with three quick questions.</>}
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
          <span>Your link</span>
          <div className="auth-prefix"><em>{host}/b/</em>
            <input value={slug} maxLength={40} required onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} aria-describedby="slug-status" autoCapitalize="none" spellCheck={false} />
          </div>
          <small id="slug-status" className={error?.field === 'slug' || (available && !available.ok) ? 'auth-error' : available?.ok ? 'auth-ok' : undefined}>
            {error?.field === 'slug' ? error.message : available ? (available.ok ? <><Check size={13} /> Available</> : available.message) : 'This is what you’ll put in your Instagram bio.'}
          </small>
        </label>

        <label className="auth-field">
          <span>Email</span>
          <input type="email" value={email} required onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" />
          <small className={error?.field === 'email' ? 'auth-error' : undefined}>{error?.field === 'email' ? error.message : 'Design requests arrive here. You can add more later.'}</small>
        </label>

        <label className="auth-field">
          <span>Instagram <span className="auth-optional">(optional)</span></span>
          <div className="auth-prefix"><em>@</em><input value={instagram} maxLength={31} onChange={(event) => setInstagram(event.target.value.replace(/^@/, ''))} autoCapitalize="none" spellCheck={false} /></div>
          {error?.field === 'instagram' && <small className="auth-error">{error.message}</small>}
        </label>

        <div className="auth-trap" aria-hidden="true">
          <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        </div>

        <label className="auth-check">
          <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
          <span>I agree to the <a href="/terms" target="_blank" rel="noopener">terms</a> and <a href="/privacy" target="_blank" rel="noopener">privacy policy</a>.</span>
        </label>
        {error?.field === 'terms' && <small className="auth-error">{error.message}</small>}

        <Turnstile onToken={setTurnstile} />
        {error && !error.field && <p className="auth-error" role="alert">{error.message}</p>}

        <button className="auth-button" type="submit" disabled={state === 'sending' || (available !== null && !available.ok)}>
          {state === 'sending' ? <><Loader2 className="auth-spinner" size={18} /> Creating your shop…</> : 'Start my free trial'}
        </button>
        <p className="auth-note">No card needed to start.</p>
      </form>
    </AuthPage>
  );
}
