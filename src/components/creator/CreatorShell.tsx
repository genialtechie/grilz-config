/**
 * The creator's frame while its code downloads: the start page's background and a quiet line, so the
 * page doesn't flash white or the old builder's layout. Kept free of imports: it loads with the page.
 */
export function CreatorShell() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading the builder"
      style={{
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        backgroundColor: '#f8f7f4',
        backgroundImage: 'radial-gradient(rgba(0,0,0,.03) 1px, transparent 1px)',
        backgroundSize: '4px 4px',
        color: '#66645e',
        font: "500 11px/1 'Geist', ui-sans-serif, system-ui, sans-serif",
        letterSpacing: '.1em',
        textTransform: 'uppercase',
      }}
    >
      Setting the stage…
    </main>
  );
}
