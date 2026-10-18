import { useEffect, useState } from 'react';
import { shopStats, viewStats, type MyShop, type ShopStats } from '../admin/data';

// The week at a glance: design requests and how they're moving, popular
// options, and (when analytics is connected) how many people opened the builder.

const RANGES = [
  [7, 'Last 7 days'],
  [30, 'Last 30 days'],
  [90, 'Last 90 days'],
] as const;

const usd = (value: number) => `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="admin-card dash-tile">
      <span className="admin-muted">{label}</span>
      <strong>{value}</strong>
      {sub && <small className="admin-muted">{sub}</small>}
    </div>
  );
}

export function StatsPanel({ shop }: { shop: MyShop }) {
  const [days, setDays] = useState<number>(7);
  const [stats, setStats] = useState<{ now: ShopStats; before: ShopStats } | null>(null);
  const [views, setViews] = useState<Awaited<ReturnType<typeof viewStats>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setStats(null);
    const now = new Date();
    const since = new Date(now.getTime() - days * 864e5);
    const prior = new Date(now.getTime() - 2 * days * 864e5);
    Promise.all([shopStats(shop.id, since), shopStats(shop.id, prior)])
      .then(([current, both]) => {
        // "before" is the period just before this one: both periods minus the current one.
        const before: ShopStats = { ...both, leads: both.leads - current.leads, value: both.value - current.value, contacted: both.contacted - current.contacted, deposits: both.deposits - current.deposits, won: both.won - current.won, wonValue: both.wonValue - current.wonValue };
        setStats({ now: current, before });
      })
      .catch((reason: Error) => setError(reason.message));
    viewStats(shop.id, days).then(setViews).catch(() => setViews({ available: false }));
  }, [shop.id, days]);

  const delta = (now: number, before: number) => (before ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}% vs the ${days} days before` : now ? 'New this period' : undefined);

  return (
    <main className="admin-main">
      <div className="admin-title-row">
        <h1 className="dash-h1">Stats</h1>
        <select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Period">
          {RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {!stats ? (
        <p className="admin-muted">Loading…</p>
      ) : (
        <>
          <div className="dash-tiles">
            {views?.available && <Tile label="Opened your builder" value={views.views ?? 0} sub={`${views.started ?? 0} started a design`} />}
            <Tile label="Design requests" value={stats.now.leads} sub={delta(stats.now.leads, stats.before.leads)} />
            {views?.available && <Tile label="Builder → request" value={pct(stats.now.leads, views.views ?? 0)} sub="of people who opened it sent a design" />}
            <Tile label="Requested value" value={usd(stats.now.value)} sub="total of the estimates sent" />
            <Tile label="Contacted" value={pct(stats.now.contacted, stats.now.leads)} sub={`${stats.now.contacted} of ${stats.now.leads} requests`} />
            <Tile label="Deposits" value={stats.now.deposits} sub={`${stats.now.won} won · ${usd(stats.now.wonValue)}`} />
          </div>
          <section className="admin-card admin-section">
            <h2>What customers pick</h2>
            {stats.now.popular.length ? (
              <ol className="dash-popular">
                {stats.now.popular.map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                    <span className="dash-bar" style={{ width: `${Math.max(8, (item.count / stats.now.popular[0].count) * 100)}%` }} />
                    <span className="admin-muted">{item.count}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="admin-muted">No requests in this period yet.</p>
            )}
          </section>
          <p className="admin-muted dash-small">Mark requests as Contacted, Deposit paid or Won on the Leads tab and these numbers follow.</p>
        </>
      )}
    </main>
  );
}
