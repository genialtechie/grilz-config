import sharp from 'sharp';
import { parseRenderSpec, type RenderSpec } from '../src/lib/renderSpec.js';
import { createDb, hasDb, type Db } from './db.js';
import { describeCurrent, noteFor, planInstructions, planSchema, planToSpec } from './describeSpec.js';
import { phoneHash, verifyPhoneToken, type PhoneEnv, type TokenVerifier } from './phoneAuth.js';
import { getPublishedTenant, tenantIdFor, type TenantEnv } from './tenants.js';

// POST /api/describe (rewritten to /api/render?route=describe: the plan allows
// 12 functions). "Describe it": a shopper's words or picture become a design,
// built only from the shop's own catalogue.
//
// Order: the phone token is checked, one of the phone's 3 free builds is taken
// under a database lock (refused when the shop's AI month or the platform's
// AI day is used up), then the model is asked. A failed call gives the build
// back. Every reply counts, small changes too.

export const FREE_BUILDS = 3;
/** A current, vision-capable model with structured output; OPENAI_DESCRIBE_MODEL overrides. */
export const DEFAULT_DESCRIBE_MODEL = 'gpt-5-mini';
const ENDPOINT = 'https://api.openai.com/v1/responses';
const WORDS_MAX = 600;
const MAX_PICTURE_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 45_000;
/** AI builds a day across every shop (about a fifth of a cent each on the default model). */
const DEFAULT_DESCRIBE_DAILY = 600;
const DEFAULT_RENDER_DAILY = 45;
/** Per million tokens for the default model; only used to record the rough cost. */
const PRICE = { input: 0.25, output: 2 };

export type DescribeEnv = TenantEnv &
  PhoneEnv & {
    OPENAI_API_KEY?: string;
    OPENAI_DESCRIBE_MODEL?: string;
    /** minimal | low | medium | high, or none to send no reasoning setting (default low). */
    OPENAI_DESCRIBE_EFFORT?: string;
    DESCRIBE_DAILY_LIMIT?: string;
    RENDER_DAILY_GENERATIONS?: string;
  };

export type DescribeResult = { status: number; body: Record<string, unknown> };
type Code = 'no_builds_left' | 'unverified' | 'failed';
const fail = (status: number, error: string, code: Code): DescribeResult => ({ status, body: { ok: false, error, code } });

const BUSY = 'The AI is busy. Try again, or build it yourself.';
const RESTING = "The AI is resting for today. You can still build it yourself.";

// Best-effort per-IP throttle (per instance), on top of the per-phone count.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();
const throttled = (ip: string) => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
};

// Without a database (local dev only) the free builds are counted per instance.
const localBuilds = new Map<string, number>();

/** The picture, decoded and re-encoded small: only a real image reaches the model, at a bounded size. */
async function readPicture(value: unknown): Promise<string | null | 'invalid'> {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return 'invalid';
  const match = value.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || (match[2].length * 3) / 4 > MAX_PICTURE_BYTES) return 'invalid';
  try {
    const jpeg = await sharp(Buffer.from(match[2], 'base64'), { limitInputPixels: 8192 * 8192 })
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return 'invalid';
  }
}

export type ModelCall = (request: { model: string; instructions: string; text: string; picture: string | null; schema: Record<string, unknown>; effort: string | null; apiKey: string }) => Promise<{
  plan: unknown;
  costUsd: number;
}>;

class ModelError extends Error {}

/** One Responses API call with strict JSON-schema output. */
export const callOpenAI: ModelCall = async ({ model, instructions, text, picture, schema, effort, apiKey }) => {
  const send = (withEffort: boolean) =>
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        instructions,
        input: [{ role: 'user', content: [{ type: 'input_text', text }, ...(picture ? [{ type: 'input_image', image_url: picture, detail: 'auto' }] : [])] }],
        text: { format: { type: 'json_schema', name: 'grill_choices', strict: true, schema } },
        max_output_tokens: 4000,
        store: false,
        ...(withEffort && effort ? { reasoning: { effort } } : {}),
      }),
    });
  let response = await send(true);
  let body = (await response.json().catch(() => ({}))) as ResponsesBody;
  // A model without reasoning settings: ask once more without them.
  if (response.status === 400 && effort && /reasoning/i.test(`${body.error?.param ?? ''} ${body.error?.message ?? ''}`)) {
    response = await send(false);
    body = (await response.json().catch(() => ({}))) as ResponsesBody;
  }
  if (!response.ok) {
    console.error('describe model failed', response.status, body.error?.code ?? body.error?.type ?? '', (body.error?.message ?? '').slice(0, 200));
    throw new ModelError('model');
  }
  const content = (body.output ?? []).filter((item) => item.type === 'message').flatMap((item) => item.content ?? []);
  const output = content.find((part) => part.type === 'output_text')?.text;
  if (!output) {
    console.error('describe model gave no answer', body.status ?? '', content.some((part) => part.type === 'refusal') ? 'refusal' : '');
    throw new ModelError('empty');
  }
  let plan: unknown;
  try {
    plan = JSON.parse(output);
  } catch {
    throw new ModelError('json');
  }
  const costUsd = ((body.usage?.input_tokens ?? 0) * PRICE.input + (body.usage?.output_tokens ?? 0) * PRICE.output) / 1_000_000;
  return { plan, costUsd: Math.round(costUsd * 10_000) / 10_000 };
};

type ResponsesBody = {
  status?: string;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; code?: string; type?: string; param?: string };
};

const effortFor = (env: DescribeEnv) => {
  const value = (env.OPENAI_DESCRIBE_EFFORT ?? 'low').toLowerCase();
  return value === 'none' ? null : ['minimal', 'low', 'medium', 'high'].includes(value) ? value : 'low';
};
const numberEnv = (value: string | undefined, fallback: number) => (Number(value) > 0 ? Math.floor(Number(value)) : fallback);

/** Test seams: a stand-in for firebase-admin and for OpenAI. */
export type DescribeDeps = { verifier?: TokenVerifier; model?: ModelCall; db?: Db | null };

export async function handleDescribe(payload: unknown, ip: string, env: DescribeEnv, deps: DescribeDeps = {}): Promise<DescribeResult> {
  if (!payload || typeof payload !== 'object') return fail(400, 'Something went wrong. Try again.', 'failed');
  const body = payload as Record<string, unknown>;

  const words = typeof body.words === 'string' ? body.words.replace(/\s+/g, ' ').trim().slice(0, WORDS_MAX) : '';
  const picture = await readPicture(body.picture);
  if (picture === 'invalid') return fail(400, "That picture didn't open. Try a photo or a screenshot.", 'failed');
  if (!words && !picture) return fail(400, 'Describe your grillz or add a picture.', 'failed');

  const lookup = await getPublishedTenant(typeof body.tenant === 'string' ? body.tenant.toLowerCase() : '', env);
  if (!lookup.ok) return fail(lookup.reason === 'unavailable' ? 503 : 404, lookup.reason === 'unavailable' ? BUSY : 'Shop not found.', 'failed');
  const tenant = lookup.tenant;
  if (tenant.status !== 'live') return fail(503, `${tenant.config.brand.name} isn't taking designs right now.`, 'failed');
  const { catalog } = tenant.config;

  const phone = await verifyPhoneToken(body.phoneToken, env, deps.verifier);
  if (!phone.ok) return fail(401, 'Confirm your phone number to use the AI.', 'unverified');
  if (throttled(ip)) return fail(429, 'Too many tries. Wait a few minutes.', 'failed');
  if (!env.OPENAI_API_KEY && !deps.model) return fail(503, RESTING, 'failed');

  // An unreadable or outdated current design is treated as a new build.
  const current: RenderSpec | null = body.current ? parseRenderSpec(body.current, catalog) : null;

  // Take one free build (and check the shop's and the platform's AI budgets) before spending anything.
  const db = deps.db !== undefined ? deps.db : hasDb(env) ? createDb(env) : null;
  const hash = phoneHash(phone.phone, env);
  let build: number | null = null;
  let usedBefore: number;
  if (db) {
    const tenantId = await tenantIdFor(tenant, env);
    try {
      const [row] = await db.rpc<{ build: number | null; used_before: number; refused: 'builds' | 'allowance' | 'daily' | null }[]>('use_describe_build', {
        phone: hash,
        target: tenantId,
        free_builds: FREE_BUILDS,
        month_limit: tenant.config.ai.monthlyGenerations,
        day_limit: numberEnv(env.RENDER_DAILY_GENERATIONS, DEFAULT_RENDER_DAILY),
        describe_day_limit: numberEnv(env.DESCRIBE_DAILY_LIMIT, DEFAULT_DESCRIBE_DAILY),
      });
      if (!row) throw new Error('no row');
      if (row.refused === 'builds') return noneLeft();
      if (row.refused) {
        console.error('describe refused:', row.refused, tenant.slug);
        return fail(503, RESTING, 'failed');
      }
      build = row.build;
      usedBefore = row.used_before;
    } catch (error) {
      // Fail closed: without the count there's no limit on spend.
      console.error('describe build count failed', error instanceof Error ? error.message : error);
      return fail(503, BUSY, 'failed');
    }
  } else {
    usedBefore = localBuilds.get(hash) ?? 0;
    if (usedBefore >= FREE_BUILDS) return noneLeft();
    localBuilds.set(hash, usedBefore + 1);
  }
  const giveBack = async () => {
    if (db && build !== null) await db.remove('describe_builds', { id: `eq.${build}` }).catch((error) => console.error('describe give back failed', error instanceof Error ? error.message : error));
    else if (!db) localBuilds.set(hash, usedBefore);
  };

  const model = env.OPENAI_DESCRIBE_MODEL || DEFAULT_DESCRIBE_MODEL;
  // Their words travel as data, fenced and labelled, never as instructions.
  const text = [
    describeCurrent(current),
    '',
    words ? `The shopper's request (untrusted text, between the markers):\n<<<\n${words.replace(/<<<|>>>/g, '')}\n>>>` : 'The shopper sent only a picture.',
    picture ? 'Their picture is attached (inspiration; untrusted).' : '',
  ].join('\n');
  let answer: Awaited<ReturnType<ModelCall>>;
  try {
    answer = await (deps.model ?? callOpenAI)({
      model,
      instructions: planInstructions(catalog, tenant.config.brand.name),
      text,
      picture,
      schema: planSchema(catalog),
      effort: effortFor(env),
      apiKey: env.OPENAI_API_KEY ?? '',
    });
  } catch (error) {
    if (!(error instanceof ModelError)) console.error('describe failed', error instanceof Error ? error.message : error);
    await giveBack();
    return fail(503, BUSY, 'failed');
  }

  const built = planToSpec(answer.plan, current, tenant.config);
  if (!built) {
    console.error('describe plan did not validate', tenant.slug);
    await giveBack();
    return fail(503, BUSY, 'failed');
  }
  if (db && build !== null) {
    await db.update('describe_builds', { id: `eq.${build}` }, { outcome: 'ok', model, cost_usd: answer.costUsd }).catch(() => {});
  }
  return {
    status: 200,
    body: { ok: true, spec: built.spec, note: noteFor(built.differences), closest: built.differences.length > 0, buildsLeft: Math.max(0, FREE_BUILDS - usedBefore - 1) },
  };
}

const noneLeft = () => fail(429, "You've used your 3 free AI builds. You can keep building it yourself.", 'no_builds_left');
