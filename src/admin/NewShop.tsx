import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTenant } from './data';
import { TEMPLATES } from './templates';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const RESERVED = new Set(['admin', 'api', 'app', 'b', 'www', 'dashboard', 'login', 'signup', 'help', 'support', 'assets', 'static', 'configurator', 'watch', 'welcome']);
const slugify = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export function NewShop() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [kind, setKind] = useState<'shop' | 'fixture'>('shop');
  const [template, setTemplate] = useState(TEMPLATES[0].id);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(name);
  const slugError = !effectiveSlug ? '' : !SLUG.test(effectiveSlug) ? 'Lowercase letters, numbers and dashes.' : RESERVED.has(effectiveSlug) ? 'That link is reserved.' : '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2 || slugError || !effectiveSlug) return setError('Add a shop name and a valid link.');
    setSaving(true);
    setError('');
    try {
      const config = TEMPLATES.find((item) => item.id === template)!.build(name.trim());
      await createTenant({ slug: effectiveSlug, name: name.trim(), kind, config });
      navigate(`/admin/shops/${effectiveSlug}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message.includes('duplicate') ? 'A shop already uses that link.' : message);
      setSaving(false);
    }
  };

  return (
    <main className="admin-main admin-main--narrow">
      <h1>New shop</h1>
      <form className="admin-card admin-form" onSubmit={submit}>
        <label className="admin-field">
          <span>Shop name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="MD Jewels" autoFocus />
        </label>
        <label className="admin-field">
          <span>Link</span>
          <div className="admin-prefix"><em>vvslab.magpollo.com/b/</em>
            <input value={effectiveSlug} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} maxLength={40} />
          </div>
          {slugError && <small className="admin-error">{slugError}</small>}
        </label>
        <fieldset className="admin-field">
          <legend>Start from</legend>
          {TEMPLATES.map((item) => (
            <label key={item.id} className="admin-radio">
              <input type="radio" name="template" checked={template === item.id} onChange={() => setTemplate(item.id)} />
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            </label>
          ))}
        </fieldset>
        <fieldset className="admin-field">
          <legend>Type</legend>
          <label className="admin-radio">
            <input type="radio" name="kind" checked={kind === 'shop'} onChange={() => setKind('shop')} />
            <span><strong>Paying shop</strong><small>Leads email the shop</small></span>
          </label>
          <label className="admin-radio">
            <input type="radio" name="kind" checked={kind === 'fixture'} onChange={() => setKind('fixture')} />
            <span><strong>Test or demo shop</strong><small>Leads email Magpollo, marked [Test shop]</small></span>
          </label>
        </fieldset>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="admin-button admin-button--primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create shop'}</button>
      </form>
    </main>
  );
}
