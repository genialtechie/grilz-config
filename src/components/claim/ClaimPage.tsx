import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthPage } from '../auth/AuthPage';
import { Turnstile } from '../Turnstile';
import { openShop } from '../../admin/supabase';
import { claimToken } from '../../lib/emailSignIn';
import { contrast, usableAccent } from '../../lib/tenant/theme';
import '../auth/auth.css';
import './claim.css';

// /claim/<token> (MAG-89): VVS Lab built this shop ahead of time; the jeweler
// enters their email and it's theirs. main.tsx already moved the token out of
// the address bar (it shows /claim), so analytics never sees it.

type Shop = { name: string; slug: string; logo?: string | null; accent?: string; from?: number | null };
type Status = { state: 'loading' | 'open' | 'claimed' | 'expired' | 'revoked' | 'invalid' | 'error'; shop?: Shop };

const host = typeof window === 'undefined' ? 'vvslab.magpollo.com' : window.location.host;
const usd = (value: number) => `$${value.toLocaleString('en-US')}`;

/** Their builder as customers will see it: their name, their colour, a starting price. */
function Preview({ shop }: { shop: Shop }) {
  // Their colour, darkened if needed so it reads on the card, with text that reads on it.
  const accent = shop.accent && /^#[0-9a-f]{6}$/i.test(shop.accent) ? usableAccent(shop.accent, '#ffffff') : null;
  const style = accent ? ({ '--claim-accent': accent, '--claim-on-accent': contrast(accent, '#ffffff') >= 4.5 ? '#ffffff' : '#1b1714' } as CSSProperties) : undefined;
  return (
    <div className="claim-preview" style={style} aria-label={`Preview of ${shop.name}'s builder`}>
      <div className="claim-preview__bar">
        {shop.logo ? <img src={shop.logo} alt="" /> : <span className="claim-preview__monogram" aria-hidden="true">{shop.name.trim().charAt(0).toUpperCase()}</span>}
        <strong>{shop.name}</strong>
      </div>
      <img className="claim-preview__set" src="/assets/options/grillz/fangs-yes.webp" alt="" width="360" height="270" />
      <div className="claim-preview__foot">
        <span>{shop.from ? <>6 top from <strong>{usd(shop.from)}</strong></> : 'Design your set in 3D'}</span>
        <span className="claim-preview__cta" aria-hidden="true">Design yours</span>
      </div>
      <div className="claim-preview__link">{host}/b/<strong>{shop.slug}</strong></div>
    </div>
  );
}

export default function ClaimPage() {
  const token = useRef(claimToken());
  const opened = useRef(Date.now());
  const [status, setStatus] = useState<Status>({ state: token.current ? 'loading' : 'invalid' });
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!token.current) return;
    fetch(`/api/signup?claim=${encodeURIComponent(token.current)}`, { headers: { accept: 'application/json' } })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Status;
        setStatus(body.state ? body : { state: 'error' });
      })
      .catch(() => setStatus({ state: 'error' }));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: token.current, email, turnstile, website, elapsedMs: Date.now() - opened.current }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; session?: { access_token: string; refresh_token: string }; slug?: string; message?: string; error?: string };
      // Signed in on this phone: straight to their dashboard.
      if (body.ok && body.session && body.slug && (await openShop(body.session, body.slug))) return;
      if (body.ok) {
        setDone(body.message ?? `Check ${email} for a sign-in link.`);
      } else if (body.error === 'claimed' || body.error === 'expired' || body.error === 'revoked' || body.error === 'invalid') {
        setStatus({ state: body.error, shop: status.shop });
      } else {
        setError(body.message ?? 'Something went wrong. Try again.');
      }
    } catch {
      setError('Couldn’t reach VVS Lab. Check your connection and try again.');
    }
    setBusy(false);
  };

  if (done) return <AuthPage title={<>It's <em>yours</em></>} lead={done} foot={<p>Nothing in a minute? Check spam, or sign in at <a href="/dashboard">{host}/dashboard</a>.</p>} />;
  if (status.state === 'loading') return <AuthPage title={<>One <em>moment</em></>} lead="Opening your shop." />;
  if (status.state === 'claimed') {
    return (
      <AuthPage title={<>Already <em>claimed</em></>} lead={<>{status.shop?.name ?? 'This shop'} already has an owner. Sign in to open it.</>}>
        <a className="auth-button" href="/dashboard">Sign in</a>
      </AuthPage>
    );
  }
  if (status.state !== 'open' || !status.shop) {
    const lead =
      status.state === 'expired' ? 'This link has expired. Ask VVS Lab for a new one.'
        : status.state === 'revoked' ? 'This link was cancelled. Ask VVS Lab for a new one.'
          : status.state === 'error' ? 'We couldn’t open this link. Check your connection and try again.'
            : 'This link isn’t valid. Check it, or ask VVS Lab for a new one.';
    return <AuthPage title={<>Link not <em>working</em></>} lead={lead} foot={<p>Already have a shop? <a href="/dashboard">Sign in</a></p>} />;
  }

  const shop = status.shop;
  return (
    <AuthPage title={<>This is your <em>shop</em></>} lead={<>VVS Lab built <strong>{shop.name}</strong> a 3D grillz builder. Enter your email to claim it.</>}>
      <Preview shop={shop} />
      <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
        <label className="auth-field">
          <span>Email</span>
          <input type="email" value={email} required onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} />
          <small>Design requests arrive here.</small>
        </label>
        <div className="auth-trap" aria-hidden="true">
          <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        </div>
        <Turnstile onToken={setTurnstile} />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-button" type="submit" disabled={busy || !email.trim()}>
          {busy ? <><Loader2 className="auth-spinner" size={18} /> Claiming…</> : 'Claim my shop'}
        </button>
        <p className="auth-note">Free for 14 days, no card needed. By continuing you agree to the <a href="/terms" target="_blank" rel="noopener">Terms</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p>
      </form>
    </AuthPage>
  );
}
