import { useEffect, useState, type FormEvent } from 'react';
import { Check, Pencil } from 'lucide-react';
import { publishAsMember, saveDraft, type MyShop } from '../admin/data';
import { loadShopConfig, quickPricingFits, type Loaded } from './shopConfig';
import { checkLines, editLine, quickAnswers, quickPricing, type CheckLine, type QuickAnswers } from '../lib/quickPricing';
import type { TenantConfig } from '../lib/tenant/schema';

const usd = (value: number) => `$${value.toLocaleString('en-US')}`;
const number = (value: string) => (value.trim() === '' ? NaN : Number(value));

/**
 * Quick pricing (MAG-90): three questions, then a check screen of what a 6-top
 * costs. Tapping a line changes the price behind it; Save publishes.
 * `prompt`: shown on Leads while the shop still has the starting prices.
 */
export function QuickPricing({ shop, prompt = false, onSaved }: { shop: MyShop; prompt?: boolean; onSaved?: () => void }) {
  const owner = shop.role !== 'staff';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Whether the shop was on the starting prices when the page opened: the Leads prompt stays through a save, to show it worked.
  const [startedOnDefault, setStartedOnDefault] = useState(false);
  const [step, setStep] = useState<'summary' | 'questions' | 'check'>('summary');
  const [answers, setAnswers] = useState({ gold: '', iced: '', feeKind: 'service' as QuickAnswers['fee']['kind'], fee: '' });
  const [pricing, setPricing] = useState<TenantConfig['pricing'] | null>(null);
  const [editing, setEditing] = useState<CheckLine['id'] | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void loadShopConfig(shop.slug).then((result) => {
      setLoaded(result);
      if (!result) return;
      setStartedOnDefault(result.config.pricing.source === 'default');
      const current = quickAnswers(result.config.pricing);
      setAnswers({ gold: String(current.gold), iced: String(current.iced), feeKind: current.fee.kind, fee: current.fee.amount ? String(current.fee.amount) : '' });
      setStep(owner && result.config.pricing.source === 'default' ? 'questions' : 'summary');
    });
  }, [shop.slug, owner]);

  if (!loaded || !quickPricingFits(loaded.config)) return null;
  if (prompt && (!startedOnDefault || !owner)) return null;

  const toCheck = (event: FormEvent) => {
    event.preventDefault();
    const gold = number(answers.gold);
    const iced = number(answers.iced);
    const fee = answers.feeKind === 'none' ? 0 : number(answers.fee);
    if (!(gold > 0)) return setNotice({ kind: 'error', text: 'Add your 10K gold price per tooth.' });
    if (!(iced > gold)) return setNotice({ kind: 'error', text: 'The iced price should be more than the gold price: it includes the stones.' });
    if (answers.feeKind !== 'none' && !(fee >= 0)) return setNotice({ kind: 'error', text: answers.feeKind === 'service' ? 'Add your service fee, or pick None.' : 'Add your minimum order, or pick None.' });
    setNotice(null);
    setPricing(quickPricing(loaded.config.pricing, { gold, iced, fee: { kind: answers.feeKind, amount: fee } }));
    setStep('check');
  };

  const save = async () => {
    if (!pricing) return;
    setBusy(true);
    setNotice(null);
    try {
      // On top of the newest config, so nothing else changes with the prices.
      const fresh = (await loadShopConfig(shop.slug)) ?? loaded;
      const config = { ...fresh.config, pricing: { ...pricing, source: 'quick' as const } };
      const row = await saveDraft(fresh.tenant, fresh.configs, config);
      await publishAsMember(row.id);
      setLoaded({ ...fresh, config });
      setStep('summary');
      setNotice({ kind: 'ok', text: 'Saved. Customers see your prices within a minute.' });
      onSaved?.();
    } catch (reason) {
      setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setBusy(false);
    }
  };

  const lines = checkLines(pricing ?? loaded.config.pricing);
  const shown = pricing ?? loaded.config.pricing;
  const feeLine = shown.base > 0 ? `Plus a ${usd(shown.base)} service fee on every order.` : shown.minimumOrder > 0 ? `Orders under ${usd(shown.minimumOrder)} are raised to ${usd(shown.minimumOrder)}.` : 'No service fee or minimum order.';

  return (
    <section className="admin-card admin-section dash-quick">
      <h2 className="dash-serif">{step === 'summary' ? <>Your <em>prices</em></> : <>Set your <em>prices</em></>}</h2>
      {step === 'questions' && (
        <>
          <p className="admin-muted admin-section__hint">{loaded.config.pricing.source === 'default' ? 'Your builder is live with starting prices. Answer three questions and everything else is worked out from them.' : 'Answer three questions and everything else is worked out from them.'}</p>
          <form className="dash-quick__form" onSubmit={toCheck} noValidate>
            <label className="admin-field">
              <span>10K gold, per tooth</span>
              <div className="admin-prefix"><em>$</em><input type="number" inputMode="decimal" min={1} value={answers.gold} onChange={(event) => setAnswers({ ...answers, gold: event.target.value })} /></div>
            </label>
            <label className="admin-field">
              <span>Iced 10K, per tooth</span>
              <div className="admin-prefix"><em>$</em><input type="number" inputMode="decimal" min={1} value={answers.iced} aria-describedby="quick-iced-hint" onChange={(event) => setAnswers({ ...answers, iced: event.target.value })} /></div>
              <small id="quick-iced-hint" className="admin-muted dash-small">With moissanite: gold and stones together.</small>
            </label>
            <fieldset className="admin-field">
              <legend>Service fee or minimum order</legend>
              <div className="dash-quick__fee">
                {(['service', 'minimum', 'none'] as const).map((kind) => (
                  <label key={kind} className={`dash-quick__choice${answers.feeKind === kind ? ' is-active' : ''}`}>
                    <input type="radio" name="fee" checked={answers.feeKind === kind} onChange={() => setAnswers({ ...answers, feeKind: kind })} />
                    {{ service: 'Service fee', minimum: 'Minimum order', none: 'None' }[kind]}
                  </label>
                ))}
              </div>
              {answers.feeKind !== 'none' && (
                <div className="admin-prefix"><em>$</em><input type="number" inputMode="decimal" min={0} aria-label={answers.feeKind === 'service' ? 'Service fee' : 'Minimum order'} value={answers.fee} onChange={(event) => setAnswers({ ...answers, fee: event.target.value })} /></div>
              )}
            </fieldset>
            {notice && <p className={notice.kind === 'ok' ? 'admin-notice' : 'admin-error'} role="status">{notice.text}</p>}
            <div className="dash-quick__actions">
              <button className="admin-button admin-button--primary" type="submit">See my prices</button>
              {loaded.config.pricing.source !== 'default' && <button className="admin-button" type="button" onClick={() => setStep('summary')}>Cancel</button>}
            </div>
          </form>
        </>
      )}

      {step !== 'questions' && (
        <>
          <p className="admin-muted admin-section__hint">{step === 'check' ? 'What a 6-top costs. Tap a line to change it.' : 'What a 6-top costs in your builder.'}</p>
          <ul className="dash-quick__lines">
            {lines.map((line) => (
              <li key={line.id}>
                {editing === line.id ? (
                  <form className="dash-quick__edit" onSubmit={(event) => { event.preventDefault(); const value = number(editValue); if (value > 0 && pricing) setPricing(editLine(pricing, line.id, value)); setEditing(null); }}>
                    <span>{line.label}, per tooth</span>
                    <div className="admin-prefix"><em>$</em><input type="number" inputMode="decimal" min={1} value={editValue} autoFocus onChange={(event) => setEditValue(event.target.value)} aria-label={`${line.label}, per tooth`} /></div>
                    <button className="admin-button admin-button--small" type="submit"><Check size={14} /> Done</button>
                  </form>
                ) : step === 'check' ? (
                  <button type="button" className="dash-quick__line" onClick={() => { setEditing(line.id); setEditValue(String(line.perTooth)); }}>
                    <span>6 top · {line.label}</span>
                    <strong>{usd(line.total)}</strong>
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                ) : (
                  <div className="dash-quick__line">
                    <span>6 top · {line.label}</span>
                    <strong>{usd(line.total)}</strong>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="admin-muted dash-small dash-quick__fee-line">{feeLine}</p>
          {notice && <p className={notice.kind === 'ok' ? 'admin-notice' : 'admin-error'} role="status">{notice.text}</p>}
          {owner ? (
            <div className="dash-quick__actions">
              {step === 'check' ? (
                <>
                  <button className="admin-button admin-button--primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save prices'}</button>
                  <button className="admin-button" type="button" disabled={busy} onClick={() => { setStep('questions'); setEditing(null); }}>Back</button>
                </>
              ) : (
                <button className="admin-button" type="button" onClick={() => { setPricing(null); setStep('questions'); setNotice(null); }}>Change prices</button>
              )}
            </div>
          ) : (
            <p className="admin-muted dash-small">The shop owner sets prices.</p>
          )}
        </>
      )}
    </section>
  );
}
