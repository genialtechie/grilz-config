import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { createPromoCode, deletePromoCode, listPromoCodes, updatePromoCode, type MyShop, type PromoCodeRow } from '../admin/data';
import { normalizePromoCode, PROMO_PATTERN, promoTerms } from '../lib/promo';

const usd = (value: number) => `$${value.toLocaleString('en-US')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });

/** Where a code stands for customers right now. */
const stateOf = (row: PromoCodeRow): { label: string; tone: 'live' | 'paused' | 'offboarded' } => {
  if (!row.active) return { label: 'Paused', tone: 'paused' };
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return { label: 'Ended', tone: 'offboarded' };
  if (row.max_uses !== null && row.uses >= row.max_uses) return { label: 'Used up', tone: 'offboarded' };
  return { label: 'Active', tone: 'live' };
};

const termsOf = (row: PromoCodeRow) =>
  [
    promoTerms(row),
    row.min_order > 0 && `orders from ${usd(row.min_order)}`,
    row.expires_at && `until ${day(row.expires_at)}`,
    row.max_uses !== null ? `${row.uses} of ${row.max_uses} used` : `used ${row.uses} ${row.uses === 1 ? 'time' : 'times'}`,
  ]
    .filter(Boolean)
    .join(' · ');

const EMPTY = { code: '', kind: 'percent' as 'percent' | 'amount', value: '', minOrder: '', ends: '', maxUses: '' };

/** Promo codes for the shop's customers: made and paused here, live straight away (no publishing). */
export function PromoCodes({ shop }: { shop: MyShop }) {
  const owner = shop.role === 'owner' || shop.role === 'admin';
  const [codes, setCodes] = useState<PromoCodeRow[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(() => listPromoCodes(shop.id).then(setCodes).catch((error: Error) => setNotice({ kind: 'error', text: error.message })), [shop.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (work: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ kind: 'ok', text: await work() });
      await load();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    const code = normalizePromoCode(form.code);
    const value = Number(form.value);
    const minOrder = form.minOrder ? Number(form.minOrder) : 0;
    const maxUses = form.maxUses ? Math.round(Number(form.maxUses)) : null;
    if (!PROMO_PATTERN.test(code)) return setNotice({ kind: 'error', text: 'Codes are 3 to 24 letters or numbers (dashes allowed in the middle).' });
    if (!(value > 0) || (form.kind === 'percent' && value > 90)) return setNotice({ kind: 'error', text: form.kind === 'percent' ? 'Pick a discount from 1% to 90%.' : 'Pick an amount off above $0.' });
    if (minOrder < 0 || (maxUses !== null && maxUses < 1)) return setNotice({ kind: 'error', text: 'Check the minimum order and the number of uses.' });
    // Ends at the close of the chosen day, in the shop's time.
    const expires = form.ends ? new Date(`${form.ends}T23:59:59`).toISOString() : null;
    void act(async () => {
      await createPromoCode(shop.id, { code, kind: form.kind, value, min_order: minOrder, expires_at: expires, max_uses: maxUses });
      setForm(EMPTY);
      setAdding(false);
      return `${code} is live. Customers can use it in your builder now.`;
    });
  };

  const field = (key: keyof typeof EMPTY) => ({ value: form[key], onChange: (event: { target: { value: string } }) => setForm({ ...form, [key]: key === 'code' ? event.target.value.toUpperCase() : event.target.value }) });

  return (
    <section className="admin-card admin-section">
      <h2>Promo codes</h2>
      <p className="admin-muted admin-section__hint">Post a code in your stories or DMs. Customers enter it on the last step of your builder, and you see it on their design request. Codes work the moment you add them; the code box only shows while you have an active one.</p>
      {notice && <p className={notice.kind === 'ok' ? 'admin-notice' : 'admin-error admin-notice'} role="status">{notice.text}</p>}
      {codes === null ? (
        <p className="admin-muted">Loading…</p>
      ) : codes.length > 0 && (
        <ul className="dash-promos">
          {codes.map((row) => {
            const state = stateOf(row);
            return (
              <li key={row.id}>
                <div>
                  <div className="dash-promos__head"><strong className="dash-promos__code">{row.code}</strong><span className={`admin-pill admin-pill--${state.tone}`}>{state.label}</span></div>
                  <div className="admin-muted dash-small">{termsOf(row)}</div>
                </div>
                {owner && (
                  <div className="dash-promos__actions">
                    <button className="admin-button admin-button--small" type="button" disabled={busy} onClick={() => void act(async () => { await updatePromoCode(row.id, { active: !row.active }); return row.active ? `${row.code} is paused.` : `${row.code} is back on.`; })}>
                      {row.active ? 'Pause' : 'Resume'}
                    </button>
                    {row.uses === 0 && (
                      <button className="admin-icon-button" type="button" disabled={busy} aria-label={`Delete ${row.code}`} onClick={() => { if (window.confirm(`Delete ${row.code}?`)) void act(async () => { await deletePromoCode(row.id); return `${row.code} is deleted.`; }); }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!owner && codes?.length === 0 && <p className="admin-muted">No codes yet. The shop owner adds them.</p>}
      {owner && !adding && (
        <button className="admin-button admin-button--small" type="button" onClick={() => setAdding(true)}>{codes?.length ? 'Add a code' : 'Add your first code'}</button>
      )}
      {owner && adding && (
        <form className="dash-promos__form" onSubmit={add}>
          <div className="admin-grid admin-grid--prices">
            <label className="admin-field">
              <span>Code</span>
              <input {...field('code')} placeholder="SUMMER15" maxLength={24} autoCapitalize="characters" autoComplete="off" spellCheck={false} required />
            </label>
            <label className="admin-field">
              <span>Discount</span>
              <div className="dash-promos__discount">
                <input type="number" inputMode="decimal" min={1} step={1} {...field('value')} placeholder={form.kind === 'percent' ? '15' : '50'} required />
                <select value={form.kind} aria-label="Discount type" onChange={(event) => setForm({ ...form, kind: event.target.value as 'percent' | 'amount' })}>
                  <option value="percent">% off</option>
                  <option value="amount">$ off</option>
                </select>
              </div>
            </label>
            <label className="admin-field">
              <span>Minimum order <em>(optional)</em></span>
              <input type="number" inputMode="decimal" min={0} step={50} {...field('minOrder')} placeholder="$0" />
            </label>
            <label className="admin-field">
              <span>Last day <em>(optional)</em></span>
              <input type="date" {...field('ends')} min={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="admin-field">
              <span>Number of uses <em>(optional)</em></span>
              <input type="number" inputMode="numeric" min={1} step={1} {...field('maxUses')} placeholder="No limit" />
            </label>
          </div>
          <div className="dash-promos__form-actions">
            <button className="admin-button admin-button--primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add code'}</button>
            <button className="admin-button" type="button" disabled={busy} onClick={() => { setAdding(false); setForm(EMPTY); setNotice(null); }}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
