import { MAX_MASKED_GROUPS, buildFillPrompt, buildRenderPrompt, parseRenderSpec, type RenderSpec } from '../src/lib/renderSpec.js';

// Turns a 3D configurator screenshot into a studio product photo with FLUX.2 pro.
// Shared by the Vercel function (api/render.ts) and the Vite dev server.

const BFL = 'https://api.bfl.ai/v1';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const POLL_INTERVAL_MS = 1500;
// The whole request (main render + masked edits) must finish inside the
// function's maxDuration in vercel.json (120s), with room to respond.
const BUDGET_MS = 105_000;
const JOB_TIMEOUT_MS = 55_000;

// Best-effort per-IP throttle. Serverless instances do not share memory, so this
// only slows down abuse; the client also caps renders per visitor.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

const throttled = (ip: string) => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
};

export type RenderEnv = {
  FLUX_API_KEY?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  RENDER_DAILY_CAP?: string;
};

// Hard daily budget across all instances, via Upstash Redis REST (free tier).
// Skipped when Upstash is not configured. Fails open if Redis is unreachable,
// so an Upstash outage does not take the demo down.
const overDailyCap = async (env: RenderEnv): Promise<boolean> => {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  const cap = Number(env.RENDER_DAILY_CAP ?? '100') || 100;
  const key = `renders:${new Date().toISOString().slice(0, 10)}`;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, '172800'],
      ]),
    });
    if (!response.ok) return false;
    const [incr] = (await response.json()) as [{ result?: number }];
    return (incr?.result ?? 0) > cap;
  } catch {
    return false;
  }
};

export type RenderResult = { status: number; body: Record<string, unknown> };

const fail = (status: number, error: string): RenderResult => ({ status, body: { error } });

const readImage = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || (match[2].length * 3) / 4 > MAX_IMAGE_BYTES) return null;
  return match[2];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class JobError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Submits one BFL job, polls until it is ready, and returns the result as base64 JPEG.
async function runJob(endpoint: string, body: Record<string, unknown>, apiKey: string, deadline: number): Promise<string> {
  const submit = await fetch(`${BFL}/${endpoint}`, {
    method: 'POST',
    headers: { 'x-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ ...body, output_format: 'jpeg', safety_tolerance: 2 }),
  });
  if (!submit.ok) {
    console.error('bfl submit failed', endpoint, submit.status, (await submit.text()).slice(0, 300));
    throw new JobError(502, 'The renderer is busy. Please try again.');
  }
  const job = (await submit.json()) as { id?: string; polling_url?: string };
  const pollUrl = job.polling_url ?? (job.id ? `${BFL}/get_result?id=${job.id}` : null);
  if (!pollUrl) throw new JobError(502, 'The renderer returned an unexpected response.');

  const stopAt = Math.min(deadline, Date.now() + JOB_TIMEOUT_MS);
  while (Date.now() < stopAt) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await fetch(pollUrl, { headers: { 'x-key': apiKey, accept: 'application/json' } });
    if (!poll.ok) continue;
    const result = (await poll.json()) as { status?: string; result?: { sample?: string } };
    if (result.status === 'Ready' && result.result?.sample) {
      // Signed result URLs expire after ~10 minutes, so fetch the image now.
      const imageResponse = await fetch(result.result.sample);
      if (!imageResponse.ok) throw new JobError(502, 'Could not download the render.');
      return Buffer.from(await imageResponse.arrayBuffer()).toString('base64');
    }
    if (result.status && !['Pending', 'Processing', 'Queued'].includes(result.status)) {
      console.error('bfl job failed', endpoint, result.status);
      throw new JobError(
        422,
        result.status === 'Content Moderated' || result.status === 'Request Moderated'
          ? 'This design could not be rendered.'
          : 'The render failed. Please try again.',
      );
    }
  }
  throw new JobError(504, 'The render took too long. Please try again.');
}

type MaskJob = { indices: number[]; mask: string; prompt: string };

const parseMasks = (value: unknown, spec: RenderSpec): MaskJob[] | null => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_MASKED_GROUPS) return null;
  const jobs: MaskJob[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const { indices, mask } = item as { indices?: unknown; mask?: unknown };
    if (!Array.isArray(indices) || !indices.length || !indices.every((index) => Number.isInteger(index))) return null;
    const maskBase64 = typeof mask === 'string' && mask.startsWith('data:image/png;') ? readImage(mask) : null;
    const prompt = buildFillPrompt(spec, indices as number[]);
    if (!maskBase64 || !prompt) return null;
    jobs.push({ indices: indices as number[], mask: maskBase64, prompt });
  }
  return jobs;
};

export async function handleRender(payload: unknown, ip: string, env: RenderEnv): Promise<RenderResult> {
  try {
    return await render(payload, ip, env);
  } catch (error) {
    // Network failures to the renderer must never crash the function.
    console.error('render failed', error instanceof Error ? error.message : error);
    return fail(502, 'The renderer is unavailable. Please try again.');
  }
}

async function render(payload: unknown, ip: string, env: RenderEnv): Promise<RenderResult> {
  const apiKey = env.FLUX_API_KEY;
  if (!apiKey) return fail(503, 'Rendering is not configured.');
  if (!payload || typeof payload !== 'object') return fail(400, 'Invalid request.');

  const { image, spec: rawSpec, inspiration, masks: rawMasks } = payload as {
    image?: unknown;
    spec?: unknown;
    inspiration?: unknown;
    masks?: unknown;
  };
  const spec = parseRenderSpec(rawSpec);
  if (!spec) return fail(400, 'Invalid design.');

  const base64 = readImage(image);
  if (!base64) return fail(400, 'Invalid preview image.');
  let inspirationBase64: string | null = null;
  if (inspiration !== undefined && inspiration !== null) {
    inspirationBase64 = readImage(inspiration);
    if (!inspirationBase64) return fail(400, 'Invalid inspiration image.');
  }
  const masks = parseMasks(rawMasks, spec);
  if (!masks) return fail(400, 'Invalid tooth masks.');

  if (throttled(ip)) return fail(429, 'Too many renders. Try again in a few minutes.');
  if (await overDailyCap(env)) return fail(429, 'Demo photo renders are paused for today. Check back tomorrow.');

  const started = Date.now();
  const deadline = started + BUDGET_MS;
  let result: string;
  try {
    result = await runJob(
      'flux-2-pro',
      {
        prompt: buildRenderPrompt(spec, Boolean(inspirationBase64)),
        input_image: base64,
        ...(inspirationBase64 ? { input_image_2: inspirationBase64 } : {}),
      },
      apiKey,
      deadline,
    );
  } catch (error) {
    if (error instanceof JobError) return fail(error.status, error.message);
    throw error;
  }

  // Repaint each tooth group that differs from the majority inside its own mask.
  // A failed or late edit keeps the photo we already have rather than failing.
  let edits = 0;
  for (const job of masks) {
    if (deadline - Date.now() < 25_000) break;
    try {
      result = await runJob('flux-pro-1.0-fill', { image: result, mask: job.mask, prompt: job.prompt }, apiKey, deadline);
      edits += 1;
    } catch (error) {
      console.error('masked edit skipped', job.indices, error instanceof Error ? error.message : error);
    }
  }

  return {
    status: 200,
    body: {
      image: `data:image/jpeg;base64,${result}`,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      edits,
    },
  };
}
