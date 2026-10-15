import sharp from 'sharp';
import { buildFillPrompt, buildRenderPrompt, editModel, parseRenderSpec, planMasks, type RenderSpec } from '../src/lib/renderSpec.js';
import { VVSLAB_CONFIG } from '../src/lib/tenant/vvslab.js';

// Turns a 3D configurator screenshot into a studio product photo with FLUX.2:
// one main render, then zoomed section edits blended back through 3D masks.
// Shared by the Vercel function (api/render.ts) and the Vite dev server.

const BFL = 'https://api.bfl.ai/v1';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const POLL_INTERVAL_MS = 1500;
// The whole request (main render + masked edits) must finish inside the
// function's maxDuration in vercel.json (120s), with room to respond.
const BUDGET_MS = 105_000;
const JOB_TIMEOUT_MS = 55_000;
// BFL rejects bursts of parallel jobs (HTTP 429), so section edits run a few at a time.
const EDIT_CONCURRENCY = 4;
const EDIT_SIZE = 1024;

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
  /** Daily budget in FLUX generations (one per main render or section edit). */
  RENDER_DAILY_GENERATIONS?: string;
};

// Rough cost of one FLUX.2 generation in BFL credits (1 credit = $0.01), used to
// stop before starting a render the account cannot pay for.
const CREDITS_PER_GENERATION = 7;
const DEFAULT_DAILY_GENERATIONS = 45; // about $3 a day
const PAUSED = 'Studio photos are paused right now.';

// Daily budget in generations, so a complex design (main render + up to 10
// section edits) costs more of it than a simple one. Shared across instances via
// Upstash Redis REST when configured; otherwise counted per instance, which only
// slows spending down. Fails open if Redis is unreachable.
const localSpend = new Map<string, number>();

const overDailyBudget = async (env: RenderEnv, generations: number): Promise<boolean> => {
  const cap = Number(env.RENDER_DAILY_GENERATIONS ?? DEFAULT_DAILY_GENERATIONS) || DEFAULT_DAILY_GENERATIONS;
  const key = `generations:${new Date().toISOString().slice(0, 10)}`;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const spent = (localSpend.get(key) ?? 0) + generations;
    if (spent > cap) return true;
    localSpend.clear();
    localSpend.set(key, spent);
    return false;
  }
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCRBY', key, String(generations)],
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

// The BFL balance, cached briefly per instance. Lets us refuse a render up front
// (a clear "paused" message) instead of failing halfway through.
let creditCache: { value: number; at: number } | null = null;

const bflCredits = async (apiKey: string): Promise<number | null> => {
  if (creditCache && Date.now() - creditCache.at < 60_000) return creditCache.value;
  try {
    const response = await fetch(`${BFL}/credits`, { headers: { 'x-key': apiKey, accept: 'application/json' } });
    if (!response.ok) return null;
    const { credits } = (await response.json()) as { credits?: number };
    if (typeof credits !== 'number') return null;
    creditCache = { value: credits, at: Date.now() };
    return credits;
  } catch {
    return null;
  }
};

export type RenderResult = { status: number; body: Record<string, unknown> };

// `code` lets the client tell a temporary hiccup (retry) from paused renders (no retry).
const fail = (status: number, error: string, code = 'failed'): RenderResult => ({ status, body: { error, code } });

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
    readonly code = 'failed',
  ) {
    super(message);
  }
}

// Submits one BFL job, polls until it is ready, and returns the result as base64 JPEG.
async function runJob(endpoint: string, body: Record<string, unknown>, apiKey: string, deadline: number): Promise<string> {
  let submit: Response | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    submit = await fetch(`${BFL}/${endpoint}`, {
      method: 'POST',
      headers: { 'x-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ ...body, output_format: 'jpeg', safety_tolerance: 2 }),
    });
    if (submit.status !== 429 || Date.now() > deadline - 20_000) break;
    await sleep(1500 + attempt * 1500);
  }
  if (!submit) throw new JobError(502, 'The renderer is busy. Please try again.');
  if (submit.status === 402) {
    creditCache = { value: 0, at: Date.now() };
    console.error('bfl out of credits', endpoint);
    throw new JobError(503, PAUSED, 'paused');
  }
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
    const poll = await fetch(pollUrl, { headers: { 'x-key': apiKey, accept: 'application/json' } }).catch(() => null);
    if (!poll?.ok) continue;
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

type MaskJob = { kind: string; indices: number[]; mask: string; prompt: string; model: string };

// The client must send exactly the edits the server would plan for this design,
// in the same order; prompts are always built here.
const parseMasks = (value: unknown, spec: RenderSpec): MaskJob[] | null => {
  const plan = planMasks(spec);
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length !== plan.length) return null;
  const jobs: MaskJob[] = [];
  for (const [position, item] of value.entries()) {
    const expected = plan[position];
    if (!item || typeof item !== 'object') return null;
    const { kind, indices, mask } = item as { kind?: unknown; indices?: unknown; mask?: unknown };
    if (kind !== expected.kind || !Array.isArray(indices) || indices.join(',') !== expected.indices.join(',')) return null;
    const maskBase64 = typeof mask === 'string' && mask.startsWith('data:image/png;') ? readImage(mask) : null;
    const prompt = buildFillPrompt(spec, expected);
    if (!maskBase64 || !prompt) return null;
    jobs.push({ kind: expected.kind, indices: expected.indices, mask: maskBase64, prompt, model: editModel(expected) });
  }
  return jobs;
};

type Raw = { data: Buffer; width: number; height: number; channels: number };

const toRaw = async (input: Buffer, channels: 1 | 3, size?: { width: number; height: number }): Promise<Raw> => {
  let image = sharp(input);
  if (size) image = image.resize(size.width, size.height, { fit: 'fill' });
  image = channels === 1 ? image.greyscale() : image.removeAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
};

/** A square crop around the mask with room for context, clamped to the image. */
const cropBox = (mask: Raw) => {
  let x0 = mask.width, y0 = mask.height, x1 = -1, y1 = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[(y * mask.width + x) * mask.channels] > 127) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const limit = Math.min(mask.width, mask.height);
  const side = Math.round(Math.min(limit, Math.max(300, Math.max(x1 - x0, y1 - y0) * 1.9)));
  const clamp = (centre: number, max: number) => Math.round(Math.max(0, Math.min(max - side, centre - side / 2)));
  return { left: clamp((x0 + x1) / 2, mask.width), top: clamp((y0 + y1) / 2, mask.height), width: side, height: side };
};

type SectionEdit = { patch: Raw; alpha: Raw; box: { left: number; top: number; width: number; height: number } };

// Crops the photo around one section, edits the zoomed crop, and returns the
// edited patch with a feathered mask ready to blend back in.
async function runSectionEdit(photo: Buffer, size: { width: number; height: number }, job: MaskJob, apiKey: string, deadline: number): Promise<SectionEdit | null> {
  const mask = await toRaw(Buffer.from(job.mask, 'base64'), 1, size);
  const box = cropBox(mask);
  if (!box) return null;
  const crop = await sharp(photo).extract(box).resize(EDIT_SIZE, EDIT_SIZE, { kernel: 'lanczos3' }).jpeg({ quality: 94 }).toBuffer();
  const edited = await runJob(job.model, { prompt: job.prompt, input_image: crop.toString('base64') }, apiKey, deadline);
  const patch = await toRaw(Buffer.from(edited, 'base64'), 3, { width: box.width, height: box.height });
  const alphaPng = await sharp(Buffer.from(job.mask, 'base64')).resize(size.width, size.height, { fit: 'fill' }).greyscale().extract(box).blur(2.5).png().toBuffer();
  const alpha = await toRaw(alphaPng, 1);
  return { patch, alpha, box };
}

const blend = (base: Raw, edit: SectionEdit) => {
  const { patch, alpha, box } = edit;
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const a = alpha.data[y * alpha.width + x] / 255;
      if (a <= 0) continue;
      const target = ((box.top + y) * base.width + box.left + x) * base.channels;
      const source = (y * patch.width + x) * patch.channels;
      for (let c = 0; c < 3; c += 1) base.data[target + c] = Math.round(patch.data[source + c] * a + base.data[target + c] * (1 - a));
    }
  }
};

/** Runs `tasks` with at most `limit` in flight; results keep their order. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await tasks[index]() };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

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
  // Stage 1: every render is for tenant zero. Stage 2 resolves the tenant from the request.
  const tenant = VVSLAB_CONFIG;
  const spec = parseRenderSpec(rawSpec, tenant.catalog);
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

  if (throttled(ip)) return fail(429, 'Too many renders. Try again in a few minutes.', 'throttled');
  const generations = 1 + masks.length;
  const credits = await bflCredits(apiKey);
  if (credits !== null && credits < CREDITS_PER_GENERATION * generations) {
    console.error('render refused: low credits', credits);
    return fail(503, PAUSED, 'paused');
  }
  if (await overDailyBudget(env, generations)) return fail(503, PAUSED, 'paused');

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
    if (error instanceof JobError) return fail(error.status, error.message, error.code);
    throw error;
  }

  // Repaint each section on a zoomed crop, in parallel, then blend the edits
  // back in plan order. A failed or late edit keeps the main photo there.
  let edits = 0;
  if (masks.length && deadline - Date.now() > 25_000) {
    const photo = Buffer.from(result, 'base64');
    const meta = await sharp(photo).metadata();
    const size = { width: meta.width ?? 1024, height: meta.height ?? 1024 };
    const settled = await pool(masks.map((job) => () => runSectionEdit(photo, size, job, apiKey, deadline)), EDIT_CONCURRENCY);
    const base = await toRaw(photo, 3);
    settled.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled' && outcome.value) {
        blend(base, outcome.value);
        edits += 1;
      } else if (outcome.status === 'rejected') {
        const reason = outcome.reason instanceof Error ? outcome.reason.message : outcome.reason;
        console.error('section edit skipped', masks[index].kind, masks[index].indices, reason);
      }
    });
    if (edits) {
      result = (await sharp(base.data, { raw: { width: base.width, height: base.height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer()).toString('base64');
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
