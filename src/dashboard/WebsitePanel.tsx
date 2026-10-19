import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Check, Copy, Globe, RefreshCw, Trash2 } from 'lucide-react';
import { checkDomain, connectDomain, disconnectDomain, getDomain, type DomainInfo, type MyShop } from '../admin/data';

// Everywhere the shop can put its builder: the link for the IG bio, the embed
// code for its website (with steps for each site builder), and its own domain.

function CopyBox({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the text is selectable either way.
    }
  };
  return (
    <div className="dash-copy">
      <span className="admin-muted dash-small">{label}</span>
      <div className="dash-copy__row">
        {multiline ? <textarea readOnly value={value} rows={2} aria-label={label} onFocus={(event) => event.target.select()} /> : <span className="dash-copy__text">{value}</span>}
        <button className="admin-button admin-button--small" type="button" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  );
}

const GUIDES: { name: string; steps: ReactNode[] }[] = [
  {
    name: 'Shopify',
    steps: [
      <>Online Store → <strong>Pages</strong> → Add page (call it “Design your grillz”).</>,
      <>Click <strong>Show HTML</strong> (the <code>&lt;&gt;</code> button) in the editor and paste the embed code.</>,
      <>Save, then add the page to your menu under Online Store → Navigation.</>,
    ],
  },
  {
    name: 'Wix',
    steps: [
      <>In the editor, <strong>Add</strong> (+) → Embed Code → <strong>Embed HTML</strong>.</>,
      <>Choose “Code”, paste the embed code, and click Update.</>,
      <>Drag the box to full width and at least 700 px tall, then Publish.</>,
    ],
  },
  {
    name: 'Squarespace',
    steps: [
      <>Edit a page → add a block → <strong>Code</strong>.</>,
      <>Paste the embed code (leave “Display source” off) and Save.</>,
      <>Code blocks need a Business plan or higher. On lower plans, use the button link instead.</>,
    ],
  },
  {
    name: 'WooCommerce / WordPress',
    steps: [
      <>Edit a page → add a <strong>Custom HTML</strong> block.</>,
      <>Paste the embed code and Update.</>,
      <>Caching plugins don’t affect it: the builder loads from VVS Lab.</>,
    ],
  },
];

function DomainSection({ shop, owner }: { shop: MyShop; owner: boolean }) {
  const [info, setInfo] = useState<DomainInfo | null | undefined>(undefined);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getDomain(shop.id).then(setInfo).catch(() => setInfo(null));
  }, [shop.id]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } catch (reason) {
      setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setBusy(false);
    }
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await connectDomain(shop.id, input);
      setInfo(result);
      setInput('');
      setNotice({ kind: 'ok', text: 'Added. Now add the DNS record below where you bought the domain.' });
    });
  };

  if (info === undefined) return <p className="admin-muted">Loading…</p>;

  if (!info) {
    return owner ? (
      <form className="dash-invite" onSubmit={add}>
        <input value={input} placeholder="build.yourshop.com" onChange={(event) => setInput(event.target.value)} aria-label="Domain" required />
        <button className="admin-button admin-button--primary" type="submit" disabled={busy}><Globe size={15} /> Connect</button>
        {notice && <p className={notice.kind === 'ok' ? 'admin-notice' : 'admin-error'} role="status">{notice.text}</p>}
      </form>
    ) : (
      <p className="admin-muted">No custom domain yet. The shop owner can connect one.</p>
    );
  }

  return (
    <div>
      <p>
        <strong>{info.domain}</strong>{' '}
        <span className={`admin-pill admin-pill--${info.status === 'active' ? 'live' : 'draft'}`}>{info.status === 'active' ? 'Live' : 'Waiting for DNS'}</span>
      </p>
      {info.status === 'active' ? (
        <p className="admin-muted">Your builder is live at <a href={`https://${info.domain}`} target="_blank" rel="noopener">https://{info.domain}</a>, with a secure (https) certificate.</p>
      ) : (
        <>
          <p className="admin-muted">Add {info.records.length === 1 ? 'this record' : 'these records'} in your domain’s DNS settings (GoDaddy, Namecheap, Squarespace Domains, Cloudflare…). It usually goes live within an hour.</p>
          <table className="dash-dns">
            <thead><tr><th>Type</th><th>Name</th><th>Value</th></tr></thead>
            <tbody>
              {info.records.map((record) => (
                <tr key={`${record.type}-${record.name}`}>
                  <td>{record.type}</td>
                  <td><code>{record.name}</code></td>
                  <td><code>{record.value}</code><div className="admin-muted dash-small">{record.why}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {info.problem && <p className="admin-muted">{info.problem}</p>}
        </>
      )}
      <div className="admin-actions">
        {info.status !== 'active' && (
          <button className="admin-button" type="button" disabled={busy} onClick={() => void run(async () => setInfo(await checkDomain(shop.id)))}><RefreshCw size={14} /> Check now</button>
        )}
        {owner && (
          <button className="admin-button" type="button" disabled={busy} onClick={() => {
            if (!window.confirm(`Disconnect ${info.domain}? Links to it will stop working.`)) return;
            void run(async () => {
              await disconnectDomain(shop.id);
              setInfo(null);
            });
          }}><Trash2 size={14} /> Disconnect</button>
        )}
      </div>
      {notice && <p className={notice.kind === 'ok' ? 'admin-notice' : 'admin-error admin-notice'} role="status">{notice.text}</p>}
    </div>
  );
}

export function WebsitePanel({ shop, embedded = false }: { shop: MyShop; embedded?: boolean }) {
  const origin = window.location.origin;
  const link = `${origin}/b/${shop.slug}`;
  const code = `<script src="${origin}/embed.js" data-shop="${shop.slug}" async></script>`;
  const [guide, setGuide] = useState(GUIDES[0].name);
  const owner = shop.role === 'owner' || shop.role === 'admin';
  const current = GUIDES.find((item) => item.name === guide) ?? GUIDES[0];

  return (
    <main className={embedded ? '' : 'admin-main'}>
      {!embedded && <h1 className="dash-h1">Your builder, everywhere</h1>}
      <section className="admin-card admin-section">
        <h2>Link</h2>
        <p className="admin-muted admin-section__hint">For your Instagram bio, stories, DMs and texts.</p>
        <CopyBox label="Your builder link" value={link} />
      </section>

      <section className="admin-card admin-section">
        <h2>Your website</h2>
        <p className="admin-muted admin-section__hint">Paste this where the builder should appear. On phones it shows a button that opens the builder full screen. Designs sent from your site arrive like any other, marked with your site’s name.</p>
        <CopyBox label="Embed code" value={code} multiline />
        <div className="admin-tabs dash-guide-tabs" role="tablist">
          {GUIDES.map((item) => (
            <button key={item.name} role="tab" type="button" aria-selected={guide === item.name} className={guide === item.name ? 'is-active' : ''} onClick={() => setGuide(item.name)}>{item.name}</button>
          ))}
        </div>
        <ol className="dash-steps">{current.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
        <p className="admin-muted dash-small">Your site only lets you add code to the page header? Paste the code there, then put <code>{`<div data-vvslab-shop="${shop.slug}"></div>`}</code> where the builder should go.</p>
      </section>

      <section className="admin-card admin-section">
        <h2>Your own domain</h2>
        <p className="admin-muted admin-section__hint">Run the builder at an address like <strong>build.yourshop.com</strong>. Use a subdomain so your main website keeps working.</p>
        <DomainSection shop={shop} owner={owner} />
      </section>
    </main>
  );
}
