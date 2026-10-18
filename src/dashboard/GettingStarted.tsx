import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Rocket } from 'lucide-react';
import { getTenant, goLive, type MyShop } from '../admin/data';
import { parseTenantConfig } from '../lib/tenant/schema';

// First-run checklist for a shop that isn't live yet, and the trial banner.

type Step = { done: boolean; title: string; text: string; to?: string };

export function TrialBanner({ shop }: { shop: MyShop }) {
  if (shop.plan !== 'trial' || !shop.trial_ends_at) return null;
  const days = Math.ceil((new Date(shop.trial_ends_at).getTime() - Date.now()) / 864e5);
  const link = import.meta.env.VITE_PLAN_PAYMENT_LINK;
  const href = link ? `${link}${link.includes('?') ? '&' : '?'}client_reference_id=${encodeURIComponent(shop.slug)}` : `mailto:salesteam@magpollo.com?subject=${encodeURIComponent(`Start my plan: ${shop.name}`)}`;
  return (
    <div className={`dash-trial ${days <= 3 ? 'is-urgent' : ''}`}>
      <span>{days > 0 ? `Free trial · ${days} day${days === 1 ? '' : 's'} left` : 'Your free trial has ended'}</span>
      <a href={href} target="_blank" rel="noopener">Start your plan · $199/mo</a>
    </div>
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
