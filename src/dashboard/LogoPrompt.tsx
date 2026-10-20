import { useEffect, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { publishAsMember, saveDraft, uploadLogo, type MyShop } from '../admin/data';
import { monogram } from '../lib/tenant/monogram';
import { loadShopConfig, type Loaded } from './shopConfig';
import { logoFile } from './shrinkImage';

// A new shop shows a monogram from its name (MAG-91). This card asks for the
// real logo: a file, or a photo of the sign or card. It saves and publishes
// straight away, like the quick prices. No Instagram scraping.

export function LogoPrompt({ shop }: { shop: MyShop }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const owner = shop.role !== 'staff';

  useEffect(() => {
    if (owner) void loadShopConfig(shop.slug).then(setLoaded);
  }, [owner, shop.slug]);

  if (!owner || !loaded || (loaded.config.brand.logo && notice?.kind !== 'ok')) return null;

  const pick = async (picked: File | undefined) => {
    if (!picked || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const file = await logoFile(picked);
      const url = await uploadLogo(shop.id, file);
      // On top of the newest config, so nothing else changes with the logo.
      const fresh = (await loadShopConfig(shop.slug)) ?? loaded;
      const config = { ...fresh.config, brand: { ...fresh.config.brand, logo: url } };
      const row = await saveDraft(fresh.tenant, fresh.configs, config);
      await publishAsMember(row.id);
      setLoaded({ ...fresh, config });
      setNotice({ kind: 'ok', text: 'Saved. Your builder shows it within a minute.' });
    } catch (reason) {
      setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setBusy(false);
    }
  };

  const logo = loaded.config.brand.logo;
  return (
    <section className="admin-card admin-section dash-logo">
      <div className="dash-logo__mark">{logo ? <img src={logo} alt="" /> : <span aria-hidden="true">{monogram(loaded.config.brand.name)}</span>}</div>
      <div className="dash-logo__body">
        <h2>{logo ? 'Your logo' : 'Add your logo'}</h2>
        <p className="admin-muted">{logo ? 'Customers see it at the top of your builder.' : 'Until then your builder shows these initials. Upload it, or take a photo of your sign or card.'}</p>
        <div className="dash-logo__actions">
          <label className="admin-button admin-button--small"><Upload size={14} /> {logo ? 'Change' : 'Upload'}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={(event) => void pick(event.target.files?.[0])} />
          </label>
          <label className="admin-button admin-button--small"><Camera size={14} /> Take a photo
            <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={(event) => void pick(event.target.files?.[0])} />
          </label>
          {busy && <span className="admin-muted dash-small">Saving…</span>}
        </div>
        {notice && <p className={notice.kind === 'ok' ? 'admin-notice' : 'admin-error'} role="status">{notice.text}</p>}
      </div>
    </section>
  );
}
