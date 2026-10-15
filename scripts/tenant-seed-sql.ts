// Prints idempotent SQL that seeds tenant zero (vvslab, demo) and the test fixture
// with published configs. Usage: npx tsx scripts/tenant-seed-sql.ts > seed.sql
import { parseTenantConfig, type TenantConfig } from '../src/lib/tenant/schema';
import { VVSLAB_CONFIG } from '../src/lib/tenant/vvslab';

const fixture: TenantConfig = {
  ...structuredClone(VVSLAB_CONFIG),
  brand: { name: 'Fixture Jewelers', accent: '#2F6FEB', fontPair: 'modern-sans', instagram: 'fixture.jewelers', poweredBy: true },
  deposit: { mode: 'link', link: 'https://example.com/pay', rule: { type: 'fixed', amount: 100 } },
};

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const tenants: { slug: string; name: string; kind: string; status: string; config: TenantConfig }[] = [
  { slug: 'vvslab', name: 'VVS Lab', kind: 'demo', status: 'live', config: VVSLAB_CONFIG },
  { slug: 'fixture', name: 'Fixture Jewelers', kind: 'fixture', status: 'live', config: fixture },
];

const lines = ['begin;'];
for (const t of tenants) {
  const parsed = parseTenantConfig(t.config);
  if (!parsed.ok) throw new Error(`${t.slug}: ${JSON.stringify(parsed.issues)}`);
  const json = literal(JSON.stringify(parsed.config));
  lines.push(
    `insert into public.tenants (slug, name, kind, status) values (${literal(t.slug)}, ${literal(t.name)}, ${literal(t.kind)}, ${literal(t.status)}) on conflict (slug) do update set name = excluded.name, kind = excluded.kind, status = excluded.status;`,
    `insert into public.tenant_configs (tenant_id, version, config, status, published_at) select id, 1, ${json}::jsonb, 'published', now() from public.tenants where slug = ${literal(t.slug)} on conflict (tenant_id, version) do update set config = excluded.config;`,
    `update public.tenants set published_version = 1 where slug = ${literal(t.slug)};`,
  );
}
lines.push('commit;');
console.log(lines.join('\n'));
