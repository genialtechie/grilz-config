// Load test for the public read paths: N virtual customers each open a shop's
// builder like a browser does (page HTML, shop config, embed script) and the
// uptime check runs alongside. Read-only: it never sends a design, renders a
// photo or touches the dashboard, and fetches no JS, so no analytics events.
//
//   npx tsx scripts/load-test.ts --origin https://vvslab.magpollo.com --users 50 --seconds 60 --slug vvslab
//
// Exits 1 when the error rate is over 1% or a path's p95 is over --p95 ms (default 1500).

type Sample = { path: string; ms: number; ok: boolean; status: number };

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
};

const origin = arg('origin', 'http://127.0.0.1:5173').replace(/\/$/, '');
const users = Number(arg('users', '50'));
const seconds = Number(arg('seconds', '60'));
const slug = arg('slug', 'vvslab');
const p95Limit = Number(arg('p95', '1500'));

const PATHS = [`/b/${slug}`, `/api/tenant/${slug}`, '/embed.js'];
const samples: Sample[] = [];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function hit(path: string) {
  const started = performance.now();
  try {
    const response = await fetch(`${origin}${path}`, { headers: { 'User-Agent': 'vvslab-load-test' } });
    await response.arrayBuffer();
    samples.push({ path, ms: performance.now() - started, ok: response.ok, status: response.status });
  } catch {
    samples.push({ path, ms: performance.now() - started, ok: false, status: 0 });
  }
}

async function customer(deadline: number) {
  // Stagger starts over the first few seconds, like real arrivals.
  await sleep(Math.random() * 3000);
  while (Date.now() < deadline) {
    for (const path of PATHS) await hit(path);
    // Time spent designing before the next visit.
    await sleep(500 + Math.random() * 1500);
  }
}

async function uptimeProbe(deadline: number) {
  while (Date.now() < deadline) {
    await hit('/api/health');
    await sleep(2000);
  }
}

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

async function main() {
  console.log(`Load test: ${users} users for ${seconds}s against ${origin} (shop ${slug})`);
  const deadline = Date.now() + seconds * 1000;
  await Promise.all([...Array.from({ length: users }, () => customer(deadline)), uptimeProbe(deadline)]);

  const rows = [...PATHS, '/api/health'].map((path) => {
    const own = samples.filter((sample) => sample.path === path);
    const ms = own.map((sample) => sample.ms);
    const errors = own.filter((sample) => !sample.ok);
    return {
      path,
      requests: own.length,
      errors: errors.length,
      statuses: [...new Set(errors.map((sample) => sample.status))].join(',') || '-',
      p50: Math.round(percentile(ms, 50)),
      p95: Math.round(percentile(ms, 95)),
      p99: Math.round(percentile(ms, 99)),
      max: Math.round(Math.max(0, ...ms)),
    };
  });
  console.table(rows);
  const total = samples.length;
  const errors = samples.filter((sample) => !sample.ok).length;
  const errorRate = total ? errors / total : 1;
  console.log(`${total} requests, ${(total / seconds).toFixed(1)} req/s, ${(errorRate * 100).toFixed(2)}% errors`);

  const slow = rows.filter((row) => row.p95 > p95Limit);
  if (errorRate > 0.01 || slow.length) {
    console.error(`FAIL: ${errorRate > 0.01 ? 'error rate over 1%' : ''}${slow.length ? ` p95 over ${p95Limit}ms on ${slow.map((row) => row.path).join(', ')}` : ''}`);
    process.exit(1);
  }
  console.log('PASS');
}

void main();
