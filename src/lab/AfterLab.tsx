import { useMemo, useState } from 'react';
import { AfterFlow } from '../components/creator/after/AfterFlow';
import type { CreatorDesign } from '../components/creator/contract';
import { DEFAULT_SET, type RenderTooth } from '../lib/renderSpec';
import { buildTenant } from '../lib/tenant/tenant';
import { TenantContext } from '../lib/tenant/tenantContext';
import { VVSLAB_CONFIG } from '../lib/tenant/vvslab';

// Dev-only (/lab/after, not routed in production builds): the after-Done flow on a sample design, on a stand-in
// for the builder's stage and panel, so it can be seen before the builder mounts it.
//   ?site=shop       a jeweler's builder (Gold Lab: in-store fitting, its own Instagram, promo codes)
//   ?verified=1      a phone already verified on this device (skips the code)
//   ?mock=0          use the real /api routes (by default leads, the photo, extras and the deposit are faked here)
//   ?photo=6         seconds the faked studio photo takes (default 8)
//   ?stage=0         no place on the stage for the photo, so it develops at the top of Sent

const STILL = '/assets/posters/set-yellow.webp';

const sampleDesign = (): CreatorDesign => {
  const tooth = (index: number): RenderTooth => ({ index, metal: 'yellow', karat: '14k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'moissanite' });
  return {
    spec: { ...DEFAULT_SET, mold: 'kit', teeth: [5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26].map(tooth) },
    summary: '6 × 6 · 14K yellow gold',
    total: 2000,
    deposit: 500,
    preview: STILL,
  };
};

const params = () => new URLSearchParams(window.location.search);

/** Fakes the server so every screen can be walked: a lead id, a photo after a few seconds, extras, a deposit. */
const installMock = () => {
  const seconds = Number(params().get('photo') ?? 8);
  const real = window.fetch.bind(window);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith('/') ? url : new URL(url).pathname;
    if (path === '/api/leads') return json({ leadId: 'lab-lead', token: 'lab-token' });
    if (path === '/api/lead-extra') return json({ ok: true });
    if (path === '/api/promo') return json({ ok: true, promo: { code: 'VVS10', kind: 'percent', value: 10, minOrder: 0 } });
    if (path === '/api/render') {
      await new Promise((resolve) => window.setTimeout(resolve, seconds * 1000));
      const blob = await (await real(STILL)).blob();
      const image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      return json({ image, seconds });
    }
    return real(input, init);
  };
};

export default function AfterLab() {
  const [state] = useState(() => {
    const query = params();
    if (query.get('mock') !== '0') installMock();
    try {
      if (query.get('verified') === '1') localStorage.setItem('vvs-verified-phone', JSON.stringify({ phone: '+15550123456', token: 'dev:5550123456' }));
      else if (query.get('verified') === '0') localStorage.removeItem('vvs-verified-phone');
      if (query.get('verified') === '0') localStorage.removeItem('vvs-first-name');
      // the faked photo should develop every time
      localStorage.removeItem('magpollo_ai_renders');
    } catch {
      // private mode
    }
    const shop = query.get('site') === 'shop';
    const tenant = shop
      ? buildTenant('gold-lab', { ...VVSLAB_CONFIG, brand: { ...VVSLAB_CONFIG.brand, name: 'Gold Lab', instagram: 'goldlab' } }, true, 0, false, true)
      : buildTenant('vvslab', VVSLAB_CONFIG, true);
    return { tenant, stage: query.get('stage') !== '0' };
  });
  const design = useMemo(sampleDesign, []);
  const [key, setKey] = useState(0);
  const [note, setNote] = useState('');

  return (
    <TenantContext.Provider value={state.tenant}>
      <style>{LAB_CSS}</style>
      <div className="al-stage">
        <div className="al-piece" data-after-photo={state.stage ? '' : undefined}>
          <img src={STILL} alt="" />
        </div>
        {note && <p className="al-note" role="status">{note}</p>}
        <div className="al-tray">
          <AfterFlow
            key={key}
            design={design}
            onKeepEditing={() => setNote('Keep editing: back to the builder, design kept.')}
            onStartOver={() => {
              setNote('Start over: to the start page.');
              setKey((value) => value + 1);
            }}
          />
        </div>
      </div>
    </TenantContext.Provider>
  );
}

// A stand-in for the builder's stage and panel (Grill Creator Lab: .stage, .tray), only for this page.
const LAB_CSS = `
body { margin: 0; background: #f1f0ec; }
.al-stage { position: relative; height: 100svh; min-height: 640px; overflow: hidden; background: radial-gradient(120% 90% at 50% 38%, #f6f5f2 0%, #e3e2dd 55%, #cfcec8 100%); }
.al-piece { position: absolute; display: grid; place-items: center; }
.al-piece > img { width: min(520px, 80%); opacity: .9; }
.al-piece:has(.after-photo-portal) > img { opacity: 0; transition: opacity 2.6s ease; }
.al-note { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); margin: 0; z-index: 9; padding: 8px 14px; border-radius: 999px; background: #121211; color: #fff; font: 500 13px/1.3 system-ui, sans-serif; }
.al-tray { position: absolute; z-index: 4; display: flex; flex-direction: column; min-height: 0; background: rgba(250,249,246,.78); backdrop-filter: blur(26px) saturate(1.35); -webkit-backdrop-filter: blur(26px) saturate(1.35); border: 1px solid rgba(255,255,255,.6); box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 24px 60px -24px rgba(40,36,24,.35), 0 0 0 1px rgba(18,18,17,.13); }
@media (min-width: 900px) {
  .al-tray { right: 20px; top: 72px; bottom: 20px; width: 392px; border-radius: 28px; overflow: hidden; }
  .al-piece { left: 0; top: 0; bottom: 0; right: 432px; }
}
@media (max-width: 899px) {
  .al-tray { left: 0; right: 0; bottom: 0; height: 54svh; border-radius: 26px 26px 0 0; border-width: 1px 0 0; overflow: hidden; padding-bottom: env(safe-area-inset-bottom, 0px); }
  .al-piece { left: 0; right: 0; top: 0; bottom: 54svh; }
  .al-piece .after-photo-portal { padding: 56px 16px 12px; }
  .al-piece .after-photo-portal .after-photo { width: min(100%, calc((46svh - 110px) * 4 / 3)); }
}
`;
