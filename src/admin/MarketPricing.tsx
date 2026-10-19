import { useEffect, useState } from 'react';
import { isGold, KARATS, METALS, type MetalId } from '../lib/renderSpec';
import { marketPerTooth, type Spot } from '../lib/metalMarket';
import type { TenantConfig } from '../lib/tenant/schema';
import { latestMetalPrices } from './data';

// The "linked to the market" half of metal pricing: grams and labour per tooth
// for each metal, a markup on the metal, today's prices, and what a tooth
// comes to at today's price. The fixed prices above stay as the fallback.

type Pricing = TenantConfig['pricing'];
type Market = NonNullable<Pricing['market']>;

const usd = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function Field({ label, value, suffix, prefix, step, onChange }: { label: string; value: number | undefined; suffix?: string; prefix?: string; step: number; onChange: (value: number) => void }) {
  return (
    <label className="admin-field admin-field--money">
      <span>{label}</span>
      <div className="admin-prefix">
        {prefix && <em>{prefix}</em>}
        <input type="number" inputMode="decimal" min={0} step={step} value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

export function MarketPricing({ pricing, metals, karats, update }: { pricing: Pricing; metals: MetalId[]; karats: string[]; update: (change: (market: Market) => void) => void }) {
  const [spot, setSpot] = useState<Spot | null | undefined>(undefined);
  useEffect(() => {
    latestMetalPrices().then(setSpot).catch(() => setSpot(null));
  }, []);
  const market = pricing.market!;

  return (
    <div className="admin-market">
      <p className="admin-muted admin-section__hint">
        Each tooth: grams of metal × today’s price for the pure metal × the alloy’s purity (10K is 41.7% gold, 14K 58.5%, 18K 75%, 22K 91.7%; sterling 92.5%), plus your markup on the metal and your labour.
        Prices update twice a day. If no price is available, your fallback fixed prices below apply.
      </p>
      <div className="admin-grid admin-grid--prices">
        <Field label="Markup on metal" suffix="%" step={5} value={market.markupPercent} onChange={(value) => update((next) => { next.markupPercent = value; })} />
      </div>
      {METALS.filter((metal) => metals.includes(metal.id)).map((metal) => (
        <div key={metal.id} className="admin-grid admin-grid--prices">
          <Field label={`${metal.label}: metal per tooth`} suffix="g" step={0.1} value={market.gramsPerTooth[metal.id]} onChange={(value) => update((next) => { next.gramsPerTooth[metal.id] = value; })} />
          <Field label={`${metal.label}: labour per tooth`} prefix="$" step={5} value={market.labourPerTooth[metal.id]} onChange={(value) => update((next) => { next.labourPerTooth[metal.id] = value; })} />
        </div>
      ))}
      {spot === undefined ? (
        <p className="admin-muted">Loading today’s prices…</p>
      ) : spot === null ? (
        <p className="admin-muted">No market price yet. Your fixed prices apply until the first one arrives.</p>
      ) : (
        <div className="admin-market__today">
          <p className="admin-muted">
            Today ({new Date(spot.asOf).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}): gold {usd(Math.round(spot.gold))}/oz · silver {usd(spot.silver)}/oz · platinum {usd(Math.round(spot.platinum))}/oz
          </p>
          <ul>
            {METALS.filter((metal) => metals.includes(metal.id)).flatMap((metal) =>
              (isGold(metal.id) ? KARATS.filter((karat) => karats.includes(karat.id)) : KARATS.slice(0, 1)).map((karat) => {
                const price = marketPerTooth(pricing, spot, metal.id, karat.id);
                return (
                  <li key={`${metal.id}:${karat.id}`}>
                    <span>{metal.label}{isGold(metal.id) ? ` ${karat.label}` : ''}</span>
                    <strong>{price === null ? 'Set grams' : `${usd(price)} / tooth`}</strong>
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
