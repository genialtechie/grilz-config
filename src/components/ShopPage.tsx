import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { TenantProvider } from '../lib/tenant/context';
import { loadTenant, type LoadedTenant } from '../lib/tenant/loadTenant';

const Configurator = lazy(() => import('./Configurator'));

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

export default function ShopPage() {
  const { slug = '' } = useParams();
  const posthog = usePostHog();
  const [loaded, setLoaded] = useState<LoadedTenant | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setLoaded(null);
    void loadTenant(slug.toLowerCase(), abort.signal).then((result) => {
      if (!abort.signal.aborted) setLoaded(result);
    });
    return () => abort.abort();
  }, [slug, attempt]);

  useEffect(() => {
    if (loaded?.state !== 'ok') return;
    // Every event from this page is attributed to the shop.
    posthog.register({ tenant: loaded.slug });
    posthog.group('tenant', loaded.slug);
    document.title = `Design your custom grillz · ${loaded.config.brand.name}`;
    return () => posthog.unregister('tenant');
  }, [loaded, posthog]);

  if (!loaded) return <Loading />;
  if (loaded.state === 'not_found') {
    return <StatePage title="This builder doesn't exist" text="Check the link with the shop that sent it, or ask them for a new one." />;
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
    <TenantProvider slug={loaded.slug} config={loaded.config} demo={loaded.demo}>
      <Suspense fallback={<Loading />}>
        <Configurator />
      </Suspense>
    </TenantProvider>
  );
}
