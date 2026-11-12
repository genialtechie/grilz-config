import type { CSSProperties } from 'react';

// The builder's frame, shown while its code downloads: the same header bar,
// 3D view and options panel, empty. With `poster`, the still of the shop's
// opening set sits where the model will be. The real builder then lands in the
// same places, so nothing jumps. Kept free of imports: it loads with the page.
/** The still the server preloaded for this shop's page (server/shopPage.ts), if any. */
const pagePoster = () =>
  typeof document === 'undefined' ? null : (document.querySelector('link[rel="preload"][as="image"][href^="/assets/posters/"]')?.getAttribute('href') ?? null);

export function BuilderShell({ poster, className = 'configurator-shell', style }: { poster?: string | null; className?: string; style?: CSSProperties }) {
  // Before the shop's config is read, the still is the one the server chose for this page.
  const still = poster === undefined ? pagePoster() : poster;
  return (
    <main className={className} style={style} aria-busy="true" aria-label="Loading the builder">
      <header className="builder-header" />
      <div className="builder-workspace">
        <section className="visualizer">
          <div className="viewer-canvas">{still && <img className="viewer-poster" src={still} alt="" decoding="sync" fetchPriority="high" />}</div>
        </section>
        <aside className="builder-panel" />
      </div>
    </main>
  );
}
