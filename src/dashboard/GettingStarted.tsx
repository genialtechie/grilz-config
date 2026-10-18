import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, CreditCard, Download, Lock, Rocket, X } from 'lucide-react';
import { billingPortal, exportShopData, getTenant, goLive, startPlan, type MyShop } from '../admin/data';
import { parseTenantConfig } from '../lib/tenant/schema';
import { onFreeTrial, pickPrompt, trialDaysLeft, trialExpired, type Seen } from '../lib/trial';

// First-run checklist for a shop that isn't live yet, the trial banner, the
// card reminders during the free trial and the gate when it ends.

type Step = { done: boolean; title: string; text: string; to?: string };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

/** Opens Stripe Checkout for the plan. Trial days left carry over, so the card isn't charged until the trial ends. */
function useCheckout(shop: MyShop) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = (work: () => Promise<{ url: string }>) => async () => {
    setBusy(true);
    setError('');
    try {
      window.location.href = (await work()).url;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  };
  return { busy, error, addCard: go(() => startPlan(shop.id)), portal: go(() => billingPortal(shop.id)) };
}

/** What the card button promises: no charge until the trial ends (Stripe needs 48 hours to carry it over). */
const chargeNote = (shop: MyShop) =>
  shop.trial_ends_at && new Date(shop.trial_ends_at).getTime() - Date.now() > 48 * 3600_000
    ? `You won’t be charged until ${fmtDate(shop.trial_ends_at)}. Cancel any time before then and you pay nothing.`
    : 'Your plan starts today: $199 a month, cancel any time.';

export function TrialBanner({ shop, onCard }: { shop: MyShop; onCard?: () => void }) {
  const { busy, error, addCard, portal } = useCheckout(shop);
  const owner = shop.role !== 'staff';
  if (shop.billing_status === 'past_due') {
    return (
      <div className="dash-trial is-urgent">
        <span>Your last payment didn’t go through. Update your card to keep your builder on.</span>
        {owner && <button type="button" disabled={busy} onClick={portal}>Update card</button>}
        {error && <span>{error}</span>}
      </div>
    );
  }
  if (!onFreeTrial(shop)) return null;
  const days = trialDaysLeft(shop);
  return (
    <div className={`dash-trial ${days <= 3 ? 'is-urgent' : ''}`}>
      <span>Free trial · {days} day{days === 1 ? '' : 's'} left</span>
      {owner && <button type="button" disabled={busy} onClick={onCard ?? addCard}>{busy ? 'Opening…' : 'Add your card'}</button>}
      {error && <span>{error}</span>}
    </div>
  );
}

// ---------- Card reminders during the free trial (rules in lib/trial) ----------

const KEY = (shopId: string) => `vvs-card-reminder:${shopId}`;
const readSeen = (shopId: string): Seen => {
  try {
    return JSON.parse(localStorage.getItem(KEY(shopId)) ?? '{}') as Seen;
  } catch {
    return {};
  }
};
const writeSeen = (shopId: string, seen: Seen) => {
  try {
    localStorage.setItem(KEY(shopId), JSON.stringify(seen));
  } catch {
    // Private mode: reminders just aren't rate-limited across visits.
  }
};

export function CardPrompt({ shop, forced, onClose }: { shop: MyShop; forced?: boolean; onClose?: () => void }) {
  const [kind, setKind] = useState<'welcome' | 'reminder' | null>(null);
  const { busy, error, addCard } = useCheckout(shop);
  const eligible = shop.role !== 'staff' && onFreeTrial(shop);
  const days = trialDaysLeft(shop);

  useEffect(() => {
    if (!eligible) return;
    const seen = readSeen(shop.id);
    if (forced) {
      writeSeen(shop.id, { ...seen, welcomed: seen.welcomed ?? Date.now(), last: Date.now() });
      setKind('reminder');
      return;
    }
    const pick = pickPrompt(seen, days);
    if (!pick) return;
    // A moment after the dashboard loads, so it doesn't fight the first paint.
    const timer = window.setTimeout(() => {
      const now = Date.now();
      writeSeen(shop.id, pick === 'welcome' ? { ...seen, welcomed: now, last: now } : { ...seen, last: now });
      setKind(pick);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [eligible, forced, shop.id, days]);

  useEffect(() => {
    if (!kind) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!kind || !eligible) return null;
  const close = () => {
    setKind(null);
    onClose?.();
  };
  const title = kind === 'welcome' ? 'Add a card now, pay nothing today' : days <= 1 ? 'Your free trial ends today' : `${days} days left on your free trial`;
  const text =
    kind === 'welcome'
      ? `Your 14-day trial is free with or without a card. Add one now and your builder keeps running without a gap when the trial ends.`
      : `When the trial ends, your builder stops taking designs until you start your plan. Add your card now and nothing changes for your customers.`;
  return (
    <div className="dash-modal" role="presentation" onClick={(event) => event.target === event.currentTarget && close()}>
      <div className="dash-modal__card admin-card" role="dialog" aria-modal="true" aria-labelledby="card-prompt-title">
        <button className="admin-icon-button dash-modal__x" type="button" onClick={close} aria-label="Close"><X size={16} /></button>
        <CreditCard size={22} />
        <h2 id="card-prompt-title">{title}</h2>
        <p>{text}</p>
        <p className="admin-muted dash-small">{chargeNote(shop)}</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="dash-modal__actions">
          <button className="admin-button admin-button--primary" type="button" disabled={busy} onClick={addCard}>{busy ? 'Opening Stripe…' : 'Add card · $199/mo after trial'}</button>
          <button className="admin-button" type="button" onClick={close}>{kind === 'welcome' ? 'Skip for now' : 'Remind me later'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- The gate when the trial ends ----------

export function TrialGate({ shop, children }: { shop: MyShop; children: ReactNode }) {
  const { busy, error, addCard } = useCheckout(shop);
  const [note, setNote] = useState('');
  if (!trialExpired(shop)) return <>{children}</>;
  const owner = shop.role !== 'staff';
  const download = async () => {
    setNote('');
    try {
      const data = await exportShopData(shop);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      link.download = `${shop.slug}-vvslab-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      setNote('Downloaded.');
    } catch (reason) {
      setNote(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <main className="admin-main">
      <section className="admin-card admin-section dash-gate">
        <Lock size={22} />
        <h1>Your free trial has ended</h1>
        <p>Your builder at /b/{shop.slug} isn’t taking designs right now. Start your plan and it switches back on straight away, with your prices, options and design requests just as you left them.</p>
        {owner ? (
          <>
            <button className="admin-button admin-button--primary" type="button" disabled={busy} onClick={addCard}>{busy ? 'Opening Stripe…' : 'Start your plan · $199/mo'}</button>
            <p className="admin-muted dash-small">Cancel any time from your dashboard.</p>
            {error && <p className="admin-error" role="alert">{error}</p>}
            <button className="admin-button dash-gate__data" type="button" onClick={() => void download()}><Download size={15} /> Download your data</button>
            {note && <p className="admin-muted dash-small">{note}</p>}
          </>
        ) : (
          <p className="admin-muted">Ask the shop owner to start the plan.</p>
        )}
      </section>
    </main>
  );
}

export function GettingStarted({ shop, onLive }: { shop: MyShop; onLive: () => void }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = shop.role !== 'staff';
  const base = `/dashboard/${shop.slug}`;

  useEffect(() => {
    getTenant(shop.slug)
      .then((result) => {
        if (!result) return;
        const published = result.configs.find((row) => row.status === 'published');
        const latest = result.configs[0];
        const parsed = latest ? parseTenantConfig(latest.config) : null;
        const config = parsed?.ok ? parsed.config : null;
        setSteps([
          { done: Boolean(config?.brand.logo), title: 'Add your logo', text: 'Customers see it at the top of your builder.', to: `${base}/shop` },
          { done: (published?.version ?? 0) > 1, title: 'Set what you sell and your prices', text: 'Switch off what you don’t make and put in your prices. Then press Publish.', to: `${base}/shop` },
          { done: Boolean(config?.leads.email.length), title: 'Check where requests go', text: config?.leads.email.length ? `Design requests go to ${config.leads.email.join(', ')}.` : 'Add the email that should get design requests.', to: `${base}/shop` },
        ]);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [shop.slug, base]);

  if (shop.status !== 'draft') return null;

  const goLiveNow = async () => {
    setBusy(true);
    setError('');
    try {
      await goLive(shop.id);
      onLive();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-card admin-section dash-start">
      <h2>Get your builder live</h2>
      <p className="admin-muted admin-section__hint">About 10 minutes. You can change anything later.</p>
      <ol className="dash-start__steps">
        {(steps ?? []).map((step) => (
          <li key={step.title} className={step.done ? 'is-done' : ''}>
            {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            <div>
              <strong>{step.to && !step.done ? <Link to={step.to}>{step.title}</Link> : step.title}</strong>
              <div className="admin-muted">{step.text}</div>
            </div>
          </li>
        ))}
        <li>
          <Rocket size={18} />
          <div>
            <strong>Switch it on</strong>
            <div className="admin-muted">Your link starts working: /b/{shop.slug}. Put it in your Instagram bio.</div>
          </div>
        </li>
      </ol>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {owner ? (
        <button className="admin-button admin-button--primary" type="button" disabled={busy} onClick={() => void goLiveNow()}><Rocket size={15} /> {busy ? 'Switching on…' : 'Switch my builder on'}</button>
      ) : (
        <p className="admin-muted">The shop owner switches the builder on.</p>
      )}
    </section>
  );
}
