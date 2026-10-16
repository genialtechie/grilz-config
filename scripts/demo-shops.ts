// Prints idempotent SQL for two visual-review shops (kind=fixture):
// a gold-only budget shop and a premium iced shop. Usage: npx tsx scripts/demo-shops.ts
import { parseTenantConfig, type TenantConfig } from '../src/lib/tenant/schema';
import { VVSLAB_CONFIG } from '../src/lib/tenant/vvslab';

const base = (): TenantConfig => structuredClone(VVSLAB_CONFIG);

const gold = base();
gold.brand = { name: 'Gold Block', accent: '#B8860B', fontPair: 'modern-sans', instagram: 'goldblock.atl', poweredBy: true };
gold.catalog = { ...gold.catalog, metals: ['yellow', 'white'], karats: ['10k', '14k'], types: ['plain', 'iced'], styles: ['solid', 'diamond-cut'], settings: ['honeycomb'], stones: ['moissanite'], fangs: true, inscription: { enabled: false, styles: ['cut'] }, vision: false, molds: ['kit', 'store'] };
gold.pricing = { ...gold.pricing, display: 'from', base: 100, metalPerTooth: { yellow: 90, white: 95 }, karatMultiplier: { '10k': 1, '14k': 1.35 }, stylePerTooth: { solid: 0, 'diamond-cut': 25 }, stonePerTooth: { moissanite: 60 }, settingPerTooth: { honeycomb: 0 }, extras: { fangs: 100, permanent: 80, photo: 0 }, minimumOrder: 300 };
gold.deposit = { mode: 'none', rule: { type: 'fixed', amount: 0 } };

const ice = base();
ice.brand = { name: 'Icebox Jewelers', logo: '__LOGO__', accent: '#1E5AA8', fontPair: 'serif-classic', instagram: 'iceboxjewelers', phone: '+1 404 555 0142', poweredBy: true };
ice.catalog = { ...ice.catalog, metals: ['yellow', 'white', 'rose', 'platinum'], karats: ['14k', '18k'], types: ['plain', 'iced'], styles: ['solid', 'open-face', 'diamond-cut', 'engraving'], settings: ['honeycomb', 'mosaic', 'prong'], stones: ['lab', 'natural'], fangs: true, inscription: { enabled: true, styles: ['iced', 'cut'] }, vision: true };
ice.pricing = { ...ice.pricing, base: 400, metalPerTooth: { yellow: 220, white: 230, rose: 220, platinum: 420 }, karatMultiplier: { '14k': 1, '18k': 1.3 }, stylePerTooth: { solid: 0, 'open-face': 60, 'diamond-cut': 50, engraving: 80 }, stonePerTooth: { lab: 240, natural: 520 }, settingPerTooth: { honeycomb: 0, mosaic: 40, prong: 20 }, inscription: { iced: 250, cut: 120 }, minimumOrder: 1000 };
ice.deposit = { mode: 'link', link: 'https://example.com/icebox-deposit', rule: { type: 'percent', value: 30, min: 300, roundTo: 50 } };

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const logo = process.argv[2] ?? '';
const lines = ['begin;'];
for (const [slug, name, config] of [['gold-block', 'Gold Block', gold], ['icebox', 'Icebox Jewelers', ice]] as const) {
  const json = JSON.parse(JSON.stringify(config).replace('__LOGO__', logo));
  const parsed = parseTenantConfig(json);
  if (!parsed.ok) throw new Error(`${slug}: ${JSON.stringify(parsed.issues)}`);
  lines.push(
    `insert into public.tenants (slug, name, kind, status) values (${literal(slug)}, ${literal(name)}, 'fixture', 'live') on conflict (slug) do update set name = excluded.name, status = excluded.status;`,
    `insert into public.tenant_configs (tenant_id, version, config, status, published_at) select id, 1, ${literal(JSON.stringify(parsed.config))}::jsonb, 'published', now() from public.tenants where slug = ${literal(slug)} on conflict (tenant_id, version) do update set config = excluded.config;`,
    `update public.tenants set published_version = 1 where slug = ${literal(slug)};`,
  );
}
lines.push('commit;');
console.log(lines.join('\n'));
