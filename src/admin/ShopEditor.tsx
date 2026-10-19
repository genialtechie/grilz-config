import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Eye, EyeOff, Pause, Play, Rocket, Save, Trash2, Upload, X } from 'lucide-react';
import { CUTS, GRILLZ_TYPES, INSCRIPTION_STYLES, KARATS, MAX_ADD_ONS, METALS, MOLDS, SETTINGS, STONES, STYLES } from '../lib/renderSpec';
import { describeChanges } from '../lib/tenant/diff';
import { FONT_PAIRS, PRICE_DISPLAYS, parseTenantConfig, type TenantConfig } from '../lib/tenant/schema';
import { contrast, usableAccent } from '../lib/tenant/theme';
import { getTenant, offboardShop, publish, publishAsMember, saveDraft, setStatus, STATUS_LABEL, uploadLogo, type ConfigRow, type TenantRow } from './data';
import { LeadsPanel } from './LeadsPanel';
import { TeamPanel } from '../dashboard/TeamPanel';
import { WebsitePanel } from '../dashboard/WebsitePanel';
import { StripeConnect } from '../dashboard/StripeConnect';
import { SAMPLE_PRICING } from './templates';

// One page per shop: edit the config as a draft, preview it, publish it, and
// switch the shop live or paused. Validation is the same zod schema the API
// uses, so a config that saves here is one the builder can load.
//
// mode="shop" is the jeweler's own dashboard: drafts save as they type, the
// preview sits beside the form, publishing shows what changes first and goes
// through the server (which keeps plan-controlled fields), and admin-only
// controls (status, AI allowance, footer, test-shop notes) are hidden.

type Mode = 'admin' | 'shop';
type EditorProps = { mode?: Mode; slug?: string; role?: 'admin' | 'owner' | 'staff' };

type Option = { id: string; label: string };
type Loaded = { tenant: TenantRow; configs: ConfigRow[] };

const FONT_LABEL: Record<(typeof FONT_PAIRS)[number], string> = { 'modern-sans': 'Modern sans', 'serif-classic': 'Classic serif', editorial: 'Editorial' };
const DISPLAY_LABEL: Record<(typeof PRICE_DISPLAYS)[number], string> = { exact: 'Exact price', from: '"From" price', hidden: 'Price on request' };

const RESET_LABEL: Record<string, string> = { 'ai.monthlyGenerations': 'AI photo allowance', 'brand.poweredBy': '"Powered by VVS Lab" footer' };

const parseRow = (row: ConfigRow | undefined): TenantConfig | null => {
  if (!row) return null;
  const parsed = parseTenantConfig(row.config);
  return parsed.ok ? parsed.config : null;
};

const startingConfig = (configs: ConfigRow[]): TenantConfig | null => {
  const row = configs.find((item) => item.status === 'draft') ?? configs.find((item) => item.status === 'published') ?? configs[0];
  if (!row) return null;
  const parsed = parseTenantConfig(row.config);
  return parsed.ok ? parsed.config : (row.config as TenantConfig);
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="admin-card admin-section">
      <h2>{title}</h2>
      {hint && <p className="admin-muted admin-section__hint">{hint}</p>}
      {children}
    </section>
  );
}

function Issue({ issues, path }: { issues: Map<string, string>; path: string }) {
  const hit = [...issues.entries()].find(([key]) => key === path || key.startsWith(`${path}.`));
  return hit ? <small className="admin-error">{hit[1]}</small> : null;
}

function Money({ label, value, onChange, step = 5, suffix = '' }: { label: string; value: number | undefined; onChange: (value: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="admin-field admin-field--money">
      <span>{label}</span>
      <div className="admin-prefix">
        {!suffix && <em>$</em>}
        <input type="number" inputMode="decimal" min={0} step={step} value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function Checks({ options, selected, onToggle }: { options: readonly Option[]; selected: readonly string[]; onToggle: (id: string, on: boolean) => void }) {
  return (
    <div className="admin-checks">
      {options.map((option) => (
        <label key={option.id} className="admin-check">
          <input type="checkbox" checked={selected.includes(option.id)} onChange={(event) => onToggle(option.id, event.target.checked)} />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function ShopEditor({ mode = 'admin', slug: slugProp, role = 'admin' }: EditorProps = {}) {
  const params = useParams();
  const slug = slugProp ?? params.slug ?? '';
  const shop = mode === 'shop';
  const canPublish = role !== 'staff';
  const canUpload = role !== 'staff';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string; link?: { href: string; label: string } } | null>(null);
  const [tab, setTab] = useState<'setup' | 'leads' | 'team' | 'website'>('setup');
  const [emailsText, setEmailsText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [showPreview, setShowPreview] = useState(() => typeof window === 'undefined' || window.innerWidth > 1080);
  const [previewKey, setPreviewKey] = useState(0);
  const [cardReady, setCardReady] = useState(false);
  const saving = useRef<Promise<unknown> | null>(null);

  const reload = useCallback(async () => {
    const result = await getTenant(slug);
    setLoaded(result);
    const start = result ? startingConfig(result.configs) : null;
    setConfig(start);
    setEmailsText(start?.leads.email.join(', ') ?? '');
    setDirty(false);
  }, [slug]);

  useEffect(() => {
    reload().catch((reason: Error) => setNotice({ kind: 'error', text: reason.message }));
  }, [reload]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const parsed = useMemo(() => (config ? parseTenantConfig(config) : null), [config]);
  const issues = useMemo(() => new Map(parsed && !parsed.ok ? parsed.issues.map((issue) => [issue.path, issue.message]) : []), [parsed]);

  // Shop mode: save the draft a moment after they stop typing, then refresh the
  // preview. The form keeps what they typed meanwhile.
  useEffect(() => {
    if (!shop || !dirty || !loaded || !config || !parsed?.ok) return;
    const timer = window.setTimeout(() => {
      const snapshot = JSON.stringify(config);
      const work = (async () => {
        await saving.current;
        const fresh = await getTenant(slug);
        if (!fresh) return;
        await saveDraft(fresh.tenant, fresh.configs, config);
        const after = await getTenant(slug);
        if (after) setLoaded(after);
        setConfig((current) => {
          if (current && JSON.stringify(current) === snapshot) setDirty(false);
          return current;
        });
        setPreviewKey((key) => key + 1);
      })().catch((reason: Error) => setNotice({ kind: 'error', text: `Couldn't save: ${reason.message}` }));
      saving.current = work;
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [shop, dirty, loaded, config, parsed, slug]);

  if (!loaded && !notice) return <main className="admin-main"><p className="admin-muted">Loading…</p></main>;
  if (!loaded || !config) {
    return (
      <main className="admin-main">
        {!shop && <Link to="/admin" className="admin-back"><ArrowLeft size={15} /> Shops</Link>}
        <p className="admin-error">{notice?.text ?? 'Shop not found.'}</p>
      </main>
    );
  }

  const { tenant, configs } = loaded;
  const draft = configs.find((row) => row.status === 'draft');
  const published = configs.find((row) => row.status === 'published');
  const liveConfig = parseRow(published);
  const changes = describeChanges(liveConfig, config);

  const update = (change: (next: TenantConfig) => void) => {
    setConfig((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      change(next);
      return next;
    });
    setDirty(true);
    setNotice(null);
  };

  /** Turning an option on gives it a sample price so the config stays valid. */
  const toggle = (list: keyof Pick<TenantConfig['catalog'], 'metals' | 'karats' | 'types' | 'styles' | 'settings' | 'stones' | 'cuts' | 'molds'>, id: string, on: boolean) =>
    update((next) => {
      const current = next.catalog[list] as string[];
      next.catalog[list] = (on ? [...current, id] : current.filter((item) => item !== id)) as never;
      const order = { metals: METALS, karats: KARATS, types: GRILLZ_TYPES, styles: STYLES, settings: SETTINGS, stones: STONES, cuts: CUTS, molds: MOLDS }[list] as readonly Option[];
      (next.catalog[list] as string[]).sort((a, b) => order.findIndex((item) => item.id === a) - order.findIndex((item) => item.id === b));
      const prices = { metals: 'metalPerTooth', karats: 'karatMultiplier', styles: 'stylePerTooth', settings: 'settingPerTooth', stones: 'stonePerTooth' } as const;
      const key = prices[list as keyof typeof prices];
      if (on && key) {
        const map = next.pricing[key] as Record<string, number>;
        if (map[id] === undefined) map[id] = (SAMPLE_PRICING[key] as Record<string, number>)[id] ?? 0;
      }
    });

  const run = async (label: string, work: () => Promise<string | null>) => {
    setBusy(label);
    setNotice(null);
    try {
      const text = await work();
      if (text) setNotice({ kind: 'ok', text });
    } catch (reason) {
      setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    await saving.current;
    const fresh = shop ? await getTenant(slug) : loaded;
    const row = await saveDraft(fresh?.tenant ?? tenant, fresh?.configs ?? configs, config);
    await reload();
    setPreviewKey((key) => key + 1);
    return row;
  };

  const onSave = () => run('save', async () => `Draft v${(await save()).version} saved.`);
  // Preview is a plain link to the saved draft: scripted tabs are blocked or
  // detached by some browsers (including in-app ones), links never are.
  const previewHref = (version: number) => `${window.location.origin}/b/${tenant.slug}?preview=${version}`;
  const onSaveAndPreview = () =>
    void run('preview', async () => {
      const row = await save();
      setNotice({ kind: 'ok', text: `Draft v${row.version} saved.`, link: { href: previewHref(row.version), label: 'Open preview' } });
      return null;
    });

  const onPublishShop = () =>
    run('publish', async () => {
      const row = dirty || !draft ? await save() : draft;
      const result = await publishAsMember(row.id);
      setConfirming(false);
      await reload();
      const kept = result.reset.map((path) => RESET_LABEL[path] ?? path);
      const base = result.live ? `Published. Customers see v${result.version} within a minute.` : `Published v${result.version}. Customers see it once you switch your builder on (top of this page).`;
      return kept.length ? `${base} ${kept.join(' and ')} stay as your plan sets them.` : base;
    });

  const onPublish = () =>
    run('publish', async () => {
      const row = dirty || !draft ? await save() : draft;
      const version = await publish(row.id);
      await reload();
      return tenant.status === 'live' ? `v${version} is live. Customers see it within a minute.` : `v${version} published. Switch the shop live when it's ready.`;
    });
  const onStatus = (next: Exclude<TenantRow['status'], 'offboarded'>) =>
    run('status', async () => {
      await setStatus(tenant.id, next);
      await reload();
      return next === 'live' ? `${config.brand.name} is live at /b/${tenant.slug}.` : `${config.brand.name} is ${STATUS_LABEL[next].toLowerCase()}.`;
    });
  const onOffboard = () =>
    run('status', async () => {
      try {
        const result = await offboardShop(tenant.id);
        return `${result.message} Leads are deleted in 90 days.`;
      } finally {
        await reload();
      }
    });

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setNotice({ kind: 'error', text: 'Logos must be under 2 MB.' });
    await run('logo', async () => {
      const url = await uploadLogo(tenant.id, file);
      update((next) => {
        next.brand.logo = url;
      });
      return 'Logo uploaded. Save the draft to keep it.';
    });
  };

  const accentShown = usableAccent(config.brand.accent || '#000000');
  const accentAdjusted = /^#[0-9a-f]{6}$/i.test(config.brand.accent) && accentShown.toLowerCase() !== config.brand.accent.toLowerCase();
  const { catalog, pricing, deposit } = config;
  const pick = <T extends Option>(list: readonly T[], ids: readonly string[]) => list.filter((item) => ids.includes(item.id));

  return (
    <main className="admin-main">
      {!shop && <Link to="/admin" className="admin-back"><ArrowLeft size={15} /> Shops</Link>}
      <div className="admin-title-row">
        <div>
          <h1>{config.brand.name}</h1>
          {shop ? (
            <p className="admin-muted">
              <span className={`admin-pill admin-pill--${tenant.status}`}>{STATUS_LABEL[tenant.status]}</span>{' '}
              {dirty ? 'Saving…' : draft ? (changes.length ? `${changes.length} unpublished change${changes.length > 1 ? 's' : ''}` : 'Draft matches your live page') : 'Up to date'}
            </p>
          ) : (
            <p className="admin-muted">
              <span className={`admin-pill admin-pill--${tenant.status}`}>{STATUS_LABEL[tenant.status]}</span>{' '}
              /b/{tenant.slug} · live config {published ? `v${published.version}` : 'none yet'}
              {draft ? ` · draft v${draft.version}` : ''}{dirty ? ' · unsaved changes' : ''}
            </p>
          )}
        </div>
        {shop ? (
          <div className="admin-actions">
            <button className="admin-button dash-preview-toggle" type="button" onClick={() => setShowPreview((value) => !value)}>
              {showPreview ? <EyeOff size={15} /> : <Eye size={15} />} {showPreview ? 'Hide preview' : 'Preview'}
            </button>
            {canPublish ? (
              <button className="admin-button admin-button--primary" type="button" onClick={() => setConfirming(true)} disabled={!!busy || !parsed?.ok || (!dirty && (!draft || !changes.length))}>
                <Rocket size={15} /> Publish
              </button>
            ) : (
              <span className="admin-muted">The owner publishes changes.</span>
            )}
          </div>
        ) : (
        <div className="admin-actions">
          <button className="admin-button" type="button" onClick={onSave} disabled={!!busy || !parsed?.ok}><Save size={15} /> Save draft</button>
          {draft && !dirty ? (
            <a className="admin-button" href={previewHref(draft.version)} target="_blank" rel="noopener"><Eye size={15} /> Preview</a>
          ) : (
            <button className="admin-button" type="button" onClick={onSaveAndPreview} disabled={!!busy || !parsed?.ok}><Eye size={15} /> Save &amp; preview</button>
          )}
          <button className="admin-button admin-button--primary" type="button" onClick={onPublish} disabled={!!busy || !parsed?.ok || (!dirty && !draft)}><Rocket size={15} /> Publish</button>
          {tenant.status === 'live' ? (
            <button className="admin-button" type="button" onClick={() => onStatus('paused')} disabled={!!busy}><Pause size={15} /> Pause</button>
          ) : (
            <button className="admin-button" type="button" onClick={() => onStatus('live')} disabled={!!busy || !published}><Play size={15} /> Go live</button>
          )}
          {tenant.status === 'offboarded' ? (
            <button className="admin-button" type="button" disabled={!!busy} onClick={() => void onOffboard()} title="Runs any offboarding step that didn't finish">
              <Archive size={15} /> Finish offboarding
            </button>
          ) : (
            <button className="admin-button" type="button" disabled={!!busy} onClick={() => {
              if (window.confirm(`Offboard ${config.brand.name}? The page closes, their plan ends at the end of the paid period (no further charges), and their custom domain is removed. The team keeps read access to export leads for 90 days, then leads and logos are deleted. The link stays reserved.`)) void onOffboard();
            }}><Archive size={15} /> Offboard</button>
          )}
        </div>
        )}
      </div>
      {notice && (
        <p className={notice.kind === 'ok' ? 'admin-notice' : 'admin-error admin-notice'} role="status">
          {notice.text}
          {notice.link && <> <a href={notice.link.href} target="_blank" rel="noopener">{notice.link.label} ↗</a></>}
        </p>
      )}
      {parsed && !parsed.ok && (
        <div className="admin-card admin-issues" role="alert">
          <strong>Fix before saving</strong>
          <ul>{parsed.issues.slice(0, 6).map((issue) => <li key={issue.path}>{issue.path}: {issue.message}</li>)}</ul>
        </div>
      )}

      {confirming && (
        <div className="admin-card dash-confirm" role="dialog" aria-label="Publish changes">
          <div className="dash-confirm__head">
            <strong>Publish {changes.length} change{changes.length === 1 ? '' : 's'}?</strong>
            <button className="admin-icon-button" type="button" aria-label="Cancel" onClick={() => setConfirming(false)}><X size={15} /></button>
          </div>
          <ul>{changes.slice(0, 30).map((change, index) => <li key={index}><span className="admin-muted">{change.area}</span> {change.text}</li>)}</ul>
          {changes.length > 30 && <p className="admin-muted">…and {changes.length - 30} more.</p>}
          <div className="admin-actions">
            <button className="admin-button" type="button" onClick={() => setConfirming(false)}>Keep editing</button>
            <button className="admin-button admin-button--primary" type="button" disabled={!!busy} onClick={() => void onPublishShop()}><Rocket size={15} /> {busy === 'publish' ? 'Publishing…' : 'Publish now'}</button>
          </div>
        </div>
      )}

      {!shop && (
      <div className="admin-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'setup'} className={tab === 'setup' ? 'is-active' : ''} type="button" onClick={() => setTab('setup')}>Setup</button>
        <button role="tab" aria-selected={tab === 'leads'} className={tab === 'leads' ? 'is-active' : ''} type="button" onClick={() => setTab('leads')}>Leads</button>
        <button role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'is-active' : ''} type="button" onClick={() => setTab('team')}>Team</button>
        <button role="tab" aria-selected={tab === 'website'} className={tab === 'website' ? 'is-active' : ''} type="button" onClick={() => setTab('website')}>Share</button>
      </div>
      )}

      {tab === 'website' && !shop ? (
        <WebsitePanel shop={{ ...tenant, role: 'admin' }} embedded />
      ) : tab === 'team' && !shop ? (
        <TeamPanel shop={{ ...tenant, role: 'admin' }} embedded />
      ) : tab === 'leads' && !shop ? (
        <LeadsPanel tenantId={tenant.id} shopName={config.brand.name} />
      ) : (
        <div className={shop && showPreview ? 'dash-editor' : ''}>
        <div className="admin-sections">
          <Section title="Brand">
            <div className="admin-grid">
              <label className="admin-field">
                <span>Shop name</span>
                <input value={config.brand.name} maxLength={60} onChange={(event) => update((next) => { next.brand.name = event.target.value; })} />
                <Issue issues={issues} path="brand.name" />
              </label>
              <label className="admin-field">
                <span>Instagram</span>
                <div className="admin-prefix"><em>@</em>
                  <input value={config.brand.instagram ?? ''} onChange={(event) => update((next) => { next.brand.instagram = event.target.value.replace(/^@/, '').trim() || undefined; })} />
                </div>
                <Issue issues={issues} path="brand.instagram" />
              </label>
              <label className="admin-field">
                <span>Phone</span>
                <input value={config.brand.phone ?? ''} placeholder="(404) 555-0100" onChange={(event) => update((next) => { next.brand.phone = event.target.value.trim() || undefined; })} />
              </label>
              <label className="admin-field">
                <span>Fonts</span>
                <select value={config.brand.fontPair} onChange={(event) => update((next) => { next.brand.fontPair = event.target.value as TenantConfig['brand']['fontPair']; })}>
                  {FONT_PAIRS.map((pair) => <option key={pair} value={pair}>{FONT_LABEL[pair]}</option>)}
                </select>
              </label>
              <label className="admin-field">
                <span>Accent colour</span>
                <div className="admin-color">
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(config.brand.accent) ? config.brand.accent : '#000000'} onChange={(event) => update((next) => { next.brand.accent = event.target.value.toUpperCase(); })} aria-label="Pick accent colour" />
                  <input value={config.brand.accent} maxLength={7} onChange={(event) => update((next) => { next.brand.accent = event.target.value; })} />
                </div>
                {accentAdjusted ? (
                  <small className="admin-muted">Too light to read on the page, so text uses <span className="admin-swatch" style={{ background: accentShown }} /> {accentShown} (contrast {contrast(accentShown, '#faf8f5').toFixed(1)}).</small>
                ) : null}
                <Issue issues={issues} path="brand.accent" />
              </label>
              <div className="admin-field">
                <span>Logo</span>
                <div className="admin-logo">
                  {config.brand.logo ? <img src={config.brand.logo} alt="" /> : <span className="admin-muted">No logo: the shop name is shown as a wordmark.</span>}
                  {canUpload && (
                  <label className="admin-button admin-button--small"><Upload size={14} /> Upload
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void onLogo(event.target.files?.[0])} />
                  </label>
                  )}
                  {config.brand.logo && canUpload && <button className="admin-icon-button" type="button" aria-label="Remove logo" onClick={() => update((next) => { delete next.brand.logo; })}><Trash2 size={14} /></button>}
                </div>
              </div>
            </div>
            {!shop && (
            <label className="admin-check">
              <input type="checkbox" checked={config.brand.poweredBy} onChange={(event) => update((next) => { next.brand.poweredBy = event.target.checked; })} />
              Show &quot;Powered by VVS Lab&quot; in the footer
            </label>
            )}
          </Section>

          <Section title="What they sell" hint="Anything switched off disappears from every step of the builder.">
            <h3>Metals</h3><Checks options={METALS} selected={catalog.metals} onToggle={(id, on) => toggle('metals', id, on)} />
            <h3>Gold karats</h3><Checks options={KARATS} selected={catalog.karats} onToggle={(id, on) => toggle('karats', id, on)} />
            <h3>Types</h3><Checks options={GRILLZ_TYPES} selected={catalog.types} onToggle={(id, on) => toggle('types', id, on)} />
            <h3>Finishes</h3><Checks options={STYLES} selected={catalog.styles} onToggle={(id, on) => toggle('styles', id, on)} />
            {catalog.types.includes('iced') && (
              <>
                <h3>Stone settings</h3><Checks options={SETTINGS} selected={catalog.settings} onToggle={(id, on) => toggle('settings', id, on)} />
                <h3>Stones</h3><Checks options={STONES} selected={catalog.stones} onToggle={(id, on) => toggle('stones', id, on)} />
              </>
            )}
            <h3>Fit</h3><Checks options={CUTS} selected={catalog.cuts} onToggle={(id, on) => toggle('cuts', id, on)} />
            <h3>Molds</h3><Checks options={MOLDS} selected={catalog.molds} onToggle={(id, on) => toggle('molds', id, on)} />
            <h3>Extras</h3>
            <div className="admin-checks">
              <label className="admin-check"><input type="checkbox" checked={catalog.fangs} onChange={(event) => update((next) => { next.catalog.fangs = event.target.checked; })} /> Fangs</label>
              <label className="admin-check"><input type="checkbox" checked={catalog.vision} onChange={(event) => update((next) => { next.catalog.vision = event.target.checked; })} /> Ideas &amp; inspiration upload</label>
              <label className="admin-check"><input type="checkbox" checked={catalog.inscription.enabled} onChange={(event) => update((next) => {
                next.catalog.inscription.enabled = event.target.checked;
                if (event.target.checked) next.catalog.inscription.styles.forEach((style) => { next.pricing.inscription[style] ??= SAMPLE_PRICING.inscription[style] ?? 0; });
              })} /> Inscriptions</label>
            </div>
            {catalog.inscription.enabled && (
              <Checks options={INSCRIPTION_STYLES} selected={catalog.inscription.styles} onToggle={(id, on) => update((next) => {
                const styles = next.catalog.inscription.styles;
                next.catalog.inscription.styles = (on ? [...styles, id] : styles.filter((item) => item !== id)) as typeof styles;
                if (on) next.pricing.inscription[id as keyof typeof next.pricing.inscription] ??= SAMPLE_PRICING.inscription[id as keyof typeof SAMPLE_PRICING.inscription] ?? 0;
              })} />
            )}
            <Issue issues={issues} path="catalog" />
          </Section>

          <Section title="Prices" hint="Per tooth unless noted. The builder and every lead use exactly these numbers.">
            <div className="admin-radios">
              {PRICE_DISPLAYS.map((mode) => (
                <label key={mode} className="admin-check"><input type="radio" name="display" checked={pricing.display === mode} onChange={() => update((next) => { next.pricing.display = mode; })} /> {DISPLAY_LABEL[mode]}</label>
              ))}
            </div>
            <div className="admin-grid admin-grid--prices">
              <Money label="Service fee (per order)" value={pricing.base} onChange={(value) => update((next) => { next.pricing.base = value; })} />
              <Money label="Minimum order" value={pricing.minimumOrder} onChange={(value) => update((next) => { next.pricing.minimumOrder = value; })} />
            </div>
            <h3>Metal</h3>
            <div className="admin-grid admin-grid--prices">
              {pick(METALS, catalog.metals).map((metal) => (
                <Money key={metal.id} label={metal.label} value={pricing.metalPerTooth[metal.id]} onChange={(value) => update((next) => { next.pricing.metalPerTooth[metal.id] = value; })} />
              ))}
            </div>
            {catalog.metals.some((metal) => ['yellow', 'white', 'rose'].includes(metal)) && (
              <>
                <h3>Karat multiplier (gold)</h3>
                <div className="admin-grid admin-grid--prices">
                  {pick(KARATS, catalog.karats).map((karat) => (
                    <Money key={karat.id} label={karat.label} step={0.05} suffix="×" value={pricing.karatMultiplier[karat.id]} onChange={(value) => update((next) => { next.pricing.karatMultiplier[karat.id] = value; })} />
                  ))}
                </div>
              </>
            )}
            <h3>Finish</h3>
            <div className="admin-grid admin-grid--prices">
              {pick(STYLES, catalog.styles).map((style) => (
                <Money key={style.id} label={style.label} value={pricing.stylePerTooth[style.id]} onChange={(value) => update((next) => { next.pricing.stylePerTooth[style.id] = value; })} />
              ))}
            </div>
            {catalog.types.includes('iced') && (
              <>
                <h3>Stones and settings</h3>
                <div className="admin-grid admin-grid--prices">
                  {pick(STONES, catalog.stones).map((stone) => (
                    <Money key={stone.id} label={stone.label} value={pricing.stonePerTooth[stone.id]} onChange={(value) => update((next) => { next.pricing.stonePerTooth[stone.id] = value; })} />
                  ))}
                  {pick(SETTINGS, catalog.settings).map((setting) => (
                    <Money key={setting.id} label={`${setting.label} setting`} value={pricing.settingPerTooth[setting.id]} onChange={(value) => update((next) => { next.pricing.settingPerTooth[setting.id] = value; })} />
                  ))}
                </div>
                {catalog.styles.includes('open-face') && (
                  <>
                    <h3>Iced open face</h3>
                    <p className="admin-muted admin-section__hint">An open face holds fewer stones than a full face. Charge a share of the stone and setting prices, plus your open-face labour.</p>
                    <div className="admin-grid admin-grid--prices">
                      <Money label="Share of stone price" step={5} suffix="%" value={pricing.icedOpenFace?.stoneShare ?? 100} onChange={(value) => update((next) => { next.pricing.icedOpenFace = { ...next.pricing.icedOpenFace, stoneShare: Math.min(100, value) }; })} />
                      <Money label="Open-face labour" value={pricing.icedOpenFace?.perTooth ?? pricing.stylePerTooth['open-face']} onChange={(value) => update((next) => { next.pricing.icedOpenFace = { stoneShare: next.pricing.icedOpenFace?.stoneShare ?? 100, perTooth: value }; })} />
                    </div>
                  </>
                )}
              </>
            )}
            <h3>Set-size discounts</h3>
            <p className="admin-muted admin-section__hint">Take a percentage off the per-tooth prices once a set reaches a size, e.g. 5% off from 8 teeth. The biggest one the set reaches applies.</p>
            {(pricing.volume ?? []).map((tier, index) => (
              <div key={index} className="admin-grid admin-grid--prices admin-tier">
                <Money label="From (teeth)" step={1} suffix="teeth" value={tier.minTeeth} onChange={(value) => update((next) => { next.pricing.volume![index].minTeeth = Math.round(value); })} />
                <Money label="Discount" step={1} suffix="% off" value={tier.percentOff} onChange={(value) => update((next) => { next.pricing.volume![index].percentOff = value; })} />
                <button className="admin-icon-button" type="button" aria-label="Remove this discount" onClick={() => update((next) => { next.pricing.volume = next.pricing.volume!.filter((_, i) => i !== index); })}><Trash2 size={14} /></button>
              </div>
            ))}
            {(pricing.volume?.length ?? 0) < 4 && (
              <button className="admin-button admin-button--small" type="button" onClick={() => update((next) => { const tiers = next.pricing.volume ?? []; const last = tiers.at(-1); next.pricing.volume = [...tiers, { minTeeth: last ? Math.min(32, last.minTeeth + 4) : 8, percentOff: last ? Math.min(90, last.percentOff + 5) : 5 }]; })}>
                Add a set-size discount
              </button>
            )}
            <h3>Extras (per order)</h3>
            <div className="admin-grid admin-grid--prices">
              {catalog.fangs && <Money label="Fangs" value={pricing.extras.fangs} onChange={(value) => update((next) => { next.pricing.extras.fangs = value; })} />}
              {catalog.cuts.includes('permanent') && <Money label="Permanent look" value={pricing.extras.permanent} onChange={(value) => update((next) => { next.pricing.extras.permanent = value; })} />}
              {catalog.types.includes('photo') && <Money label="Photo artwork" value={pricing.extras.photo} onChange={(value) => update((next) => { next.pricing.extras.photo = value; })} />}
              {catalog.inscription.enabled && pick(INSCRIPTION_STYLES, catalog.inscription.styles).map((style) => (
                <Money key={style.id} label={`Inscription · ${style.label}`} value={pricing.inscription[style.id]} onChange={(value) => update((next) => { next.pricing.inscription[style.id] = value; })} />
              ))}
            </div>
            <Issue issues={issues} path="pricing" />
          </Section>

          <Section title="Add-ons" hint="Your own extras, offered on the builder's Extras step: rush order, carrier case, cleaning kit… Customers tick the ones they want and the price is added to the estimate.">
            {(catalog.addOns ?? []).map((addOn, index) => (
              <div key={addOn.id} className="admin-addon">
                <label className="admin-field">
                  <span>Name</span>
                  <input value={addOn.label} maxLength={40} placeholder="Rush order (2 weeks)" onChange={(event) => update((next) => { next.catalog.addOns![index].label = event.target.value; })} />
                </label>
                <label className="admin-field">
                  <span>Detail (optional)</span>
                  <input value={addOn.detail ?? ''} maxLength={80} placeholder="Jump the queue" onChange={(event) => update((next) => { const value = event.target.value; if (value) next.catalog.addOns![index].detail = value; else delete next.catalog.addOns![index].detail; })} />
                </label>
                <Money label="Price" value={addOn.price} onChange={(value) => update((next) => { next.catalog.addOns![index].price = value; })} />
                <label className="admin-field">
                  <span>Charged</span>
                  <select value={addOn.per} onChange={(event) => update((next) => { next.catalog.addOns![index].per = event.target.value as 'order' | 'tooth'; })}>
                    <option value="order">Once per order</option>
                    <option value="tooth">Per tooth</option>
                  </select>
                </label>
                <button className="admin-icon-button" type="button" aria-label={`Remove ${addOn.label || 'this add-on'}`} onClick={() => update((next) => { next.catalog.addOns = next.catalog.addOns!.filter((_, i) => i !== index); })}><Trash2 size={14} /></button>
              </div>
            ))}
            {(catalog.addOns?.length ?? 0) < MAX_ADD_ONS && (
              <button
                className="admin-button admin-button--small"
                type="button"
                onClick={() => update((next) => { next.catalog.addOns = [...(next.catalog.addOns ?? []), { id: `addon-${Date.now().toString(36)}`, label: '', price: 0, per: 'order' }]; })}
              >
                Add an add-on
              </button>
            )}
            <Issue issues={issues} path="catalog.addOns" />
          </Section>

          <Section title="Deposit" hint="Optional. Customers see it after they send their design. Card deposits go straight to your own Stripe account.">
            <div className="admin-radios">
              <label className="admin-check"><input type="radio" name="deposit" checked={deposit.mode === 'none'} onChange={() => update((next) => { next.deposit.mode = 'none'; })} /> No deposit</label>
              <label className="admin-check"><input type="radio" name="deposit" checked={deposit.mode === 'link'} onChange={() => update((next) => { next.deposit.mode = 'link'; })} /> Shop&apos;s payment link</label>
              <label className={cardReady ? 'admin-check' : 'admin-check admin-check--disabled'}><input type="radio" name="deposit" disabled={!cardReady && deposit.mode !== 'stripe'} checked={deposit.mode === 'stripe'} onChange={() => update((next) => { next.deposit.mode = 'stripe'; })} /> Card, through Stripe</label>
            </div>
            <StripeConnect tenantId={tenant.id} canManage={role !== 'staff'} onStatus={(status) => setCardReady(status.chargesEnabled)} />
            {deposit.mode !== 'none' && (
              <>
                {deposit.mode === 'link' && (
                  <label className="admin-field">
                    <span>Payment link</span>
                    <input type="url" placeholder="https://cash.app/$shop or a Square/Stripe link" value={deposit.link ?? ''} onChange={(event) => update((next) => { next.deposit.link = event.target.value.trim() || undefined; })} />
                    <Issue issues={issues} path="deposit.link" />
                  </label>
                )}
                <div className="admin-radios">
                  <label className="admin-check"><input type="radio" name="rule" checked={deposit.rule.type === 'fixed'} onChange={() => update((next) => { next.deposit.rule = { type: 'fixed', amount: 100 }; })} /> Fixed amount</label>
                  <label className="admin-check"><input type="radio" name="rule" checked={deposit.rule.type === 'percent'} onChange={() => update((next) => { next.deposit.rule = { type: 'percent', value: 25, min: 100, roundTo: 10 }; })} /> % of the estimate</label>
                </div>
                <div className="admin-grid admin-grid--prices">
                  {deposit.rule.type === 'fixed' ? (
                    <Money label="Deposit" value={deposit.rule.amount} onChange={(value) => update((next) => { if (next.deposit.rule.type === 'fixed') next.deposit.rule.amount = value; })} />
                  ) : (
                    <>
                      <Money label="Percent" step={1} suffix="%" value={deposit.rule.value} onChange={(value) => update((next) => { if (next.deposit.rule.type === 'percent') next.deposit.rule.value = value; })} />
                      <Money label="At least" value={deposit.rule.min} onChange={(value) => update((next) => { if (next.deposit.rule.type === 'percent') next.deposit.rule.min = value; })} />
                    </>
                  )}
                </div>
                <Issue issues={issues} path="deposit.rule" />
              </>
            )}
          </Section>

          <Section title="Leads and AI photos">
            <label className="admin-field">
              <span>Send leads to (up to 5 emails, comma separated)</span>
              <input
                value={emailsText}
                placeholder="orders@theirshop.com"
                onChange={(event) => {
                  setEmailsText(event.target.value);
                  update((next) => { next.leads.email = event.target.value.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean); });
                }}
              />
              {tenant.kind !== 'shop' && !shop && <small className="admin-muted">Test shop: leads go to Magpollo whatever is set here.</small>}
              <Issue issues={issues} path="leads" />
            </label>
            {shop ? (
              <p>Your plan includes <strong>{(liveConfig ?? config).ai.monthlyGenerations} AI photos a month</strong>.</p>
            ) : (
            <div className="admin-grid admin-grid--prices">
              <Money label="AI photos per month" step={10} suffix="photos" value={config.ai.monthlyGenerations} onChange={(value) => update((next) => { next.ai.monthlyGenerations = Math.round(value); })} />
            </div>
            )}
            <small className="admin-muted">Mixed designs use more than one generation each. At the limit, customers still send their design and see the 3D view instead of a photo.</small>
          </Section>
        </div>
        {shop && showPreview && (
          <aside className="dash-preview" aria-label="Preview of your page">
            <div className="dash-preview__bar">
              <span>{draft ? `Preview · draft` : 'Your live page'}</span>
              <a href={draft ? previewHref(draft.version) : `/b/${tenant.slug}`} target="_blank" rel="noopener">Open ↗</a>
            </div>
            <div className="dash-preview__frame">
              <iframe key={`${previewKey}-${draft?.version ?? 0}`} title="Preview of your page" src={draft ? `/b/${tenant.slug}?preview=${draft.version}` : `/b/${tenant.slug}`} />
            </div>
          </aside>
        )}
        </div>
      )}
    </main>
  );
}
