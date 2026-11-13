import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { BuilderShell } from './builder/BuilderShell';
import { loadable } from '../lib/loadable';
import { posterFor } from '../lib/poster';
import { fontPairClass, themeStyle } from '../lib/tenant/theme';
import { useTenant } from '../lib/tenant/useTenant';
import { TenantProvider } from '../lib/tenant/context';
import { inlineTenant, loadTenant, type LoadedTenant } from '../lib/tenant/loadTenant';

const Configurator = loadable(() => import('./Configurator'));
// The builder's code starts loading with this page, not after the shop's config arrives.
void Configurator.preload();

// /b/<slug>: a shop's own builder. Loads the shop's published config, then
// renders the shared builder inside that shop's brand.

function StatePage({ title, text, action }: { title: string; text: string; action?: { label: string; href: string } }) {
  return (
    <main className="shop-state">
      <div className="shop-state__card">
        <h1>{title}</h1>
        <p>{text}</p>
        {action && (
          <a className="primary-button" href={action.href}>
            {action.label}
          </a>
        )}
      </div>
    </main>
  );
}

function Loading() {
  return (
    <div className="route-loader" role="status">
      <span />
      Loading the builder
    </div>
  );
}

/** The builder's frame in the shop's theme, with the still of its opening set, while the builder's code downloads. */
function ShopShell() {
  const tenant = useTenant();
  const brand = tenant.config.brand;
  return (
    <BuilderShell
      poster={posterFor(tenant.defaultTooth, tenant.defaultSet)}
      className={tenant.demo ? undefined : `configurator-shell shop-shell ${fontPairClass(brand)}`}
      style={tenant.demo ? undefined : themeStyle(brand)}
    />
  );
}

export default function ShopPage({ slug: slugProp }: { slug?: string } = {}) {
  const params = useParams();
  const slug = slugProp ?? params.slug ?? '';
  const [search] = useSearchParams();
  // ?preview=<version>: a signed-in admin or shop member checking an unpublished draft.
  const previewVersion = Number(search.get('preview')) || null;
  // Back from the shop's Stripe checkout after paying a deposit.
  const [depositPaid, setDepositPaid] = useState(search.get('deposit') === 'paid');
  const posthog = usePostHog();
  // The page arrives with the shop's config in it, so the builder shows at once (drafts are always fetched).
  const [loaded, setLoaded] = useState<LoadedTenant | null>(() => (previewVersion ? null : inlineTenant(slug.toLowerCase())));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setLoaded(previewVersion ? null : inlineTenant(slug.toLowerCase()));
    const load = async () => {
      let preview: { version: number; token: string | null } | undefined;
      if (previewVersion) {
        // The Supabase client only loads for previews, never for customers.
        const { accessToken } = await import('../admin/supabase');
        preview = { version: previewVersion, token: await accessToken().catch(() => null) };
      }
      const result = await loadTenant(slug.toLowerCase(), abort.signal, preview);
      if (abort.signal.aborted) return;
      // The page's copy can be a few minutes old; this answer is the latest. It replaces
      // the copy only when it differs (a new price list, a paused shop), and a failed
      // check keeps the builder that is already on screen.
      setLoaded((current) => {
        if (!current) return result;
        if (result.state === 'unavailable') return current;
        return JSON.stringify(current) === JSON.stringify(result) ? current : result;
      });
    };
    void load();
    return () => abort.abort();
  }, [slug, attempt, previewVersion]);

  useEffect(() => {
    if (loaded?.state !== 'ok') return;
    // Every event from this page is attributed to the shop.
    if (loaded.preview) return;
    posthog.register({ tenant: loaded.slug });
    posthog.group('tenant', loaded.slug);
    document.title = `Design your custom grillz · ${loaded.config.brand.name}`;
    return () => posthog.unregister('tenant');
  }, [loaded, posthog]);

  if (!loaded) return <Loading />;
  if (loaded.state === 'not_found') {
    return <StatePage title="This builder isn’t open" text="The link may be wrong, or the shop hasn’t switched its builder on yet. Check with the shop that sent it." action={{ label: 'Shop owner? Sign in', href: '/dashboard' }} />;
  }
  if (loaded.state === 'sign_in') {
    return <StatePage title="Sign in to preview" text="Drafts are only visible to the shop's team and VVS Lab." action={{ label: 'Sign in', href: '/admin' }} />;
  }
  if (loaded.state === 'unavailable') {
    return (
      <main className="shop-state">
        <div className="shop-state__card">
          <h1>We couldn&apos;t load this builder</h1>
          <p>Check your connection and try again.</p>
          <button className="primary-button" type="button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      </main>
    );
  }
  if (loaded.status === 'offboarded') {
    return <StatePage title="This builder is closed" text={`${loaded.config.brand.name} no longer takes designs here. Contact the shop directly.`} />;
  }
  if (loaded.status !== 'live') {
    const { brand } = loaded.config;
    return (
      <StatePage
        title={`${brand.name} will be back soon`}
        text="This builder is taking a short break."
        action={brand.instagram ? { label: `Message @${brand.instagram}`, href: `https://ig.me/m/${brand.instagram}` } : undefined}
      />
    );
  }
  return (
    <>
    {depositPaid && (
      <div className="deposit-toast" role="status">
        <span>Deposit received. {loaded.config.brand.name} will reach out to confirm your design.</span>
        <button type="button" onClick={() => setDepositPaid(false)} aria-label="Dismiss">×</button>
      </div>
    )}
    <TenantProvider slug={loaded.slug} config={loaded.config} demo={loaded.demo} version={loaded.version} preview={loaded.preview} promos={loaded.promos}>
      {loaded.preview && (
        <div className="preview-banner" role="status">
          Draft preview · v{loaded.version} · customers can&apos;t see this yet
        </div>
      )}
      <Configurator fallback={<ShopShell />} />
    </TenantProvider>
    </>
  );
}
