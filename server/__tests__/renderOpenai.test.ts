import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RenderSpec, RenderTooth } from '../../src/lib/renderSpec';
import { labelColor } from '../../src/lib/photoLabels';
import { checkPhoto } from '../photoCheck';
import { handleRender, renderProvider } from '../render';
import { usageCost } from '../openaiImage';

// The OpenAI photo path (MAG-76), with OpenAI stubbed at the network edge: one
// edit of the photo-stage still, checked against it, retried once, and the
// still itself if the photo keeps drifting. No real calls, no spend.

const tooth = (index: number): RenderTooth => ({ index, metal: 'yellow', karat: '14k', type: 'plain', style: 'solid', setting: 'honeycomb', stone: 'lab' });
const spec: RenderSpec = { fangs: false, cut: 'deep', vision: '', inscriptions: [], teeth: [tooth(22), tooth(23), tooth(24)] };
const env = { OPENAI_API_KEY: 'test', RENDER_PROVIDER: 'openai', OPENAI_IMAGE_QUALITY: 'medium' };

let still = '';
let labels = '';
let drifted = '';
const box = (left: number) => ({ left, top: 420, width: 180, height: 220 });

/** A charcoal frame with three teeth (gold, or silver when drifted), and its label map. */
async function frame(colour: string, offset = 0) {
  const teeth = [0, 1, 2].map((i) => ({ input: { create: { width: 180, height: 220, channels: 3 as const, background: colour } }, ...box(480 + i * 200 + offset) }));
  return (await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#2c2a27' } }).composite(teeth).jpeg().toBuffer()).toString('base64');
}

beforeAll(async () => {
  still = await frame('#d9a93c');
  drifted = await frame('#c9cacc', 140);
  const parts = [22, 23, 24].map((index, i) => {
    const [r, g, b] = labelColor(index);
    return { input: { create: { width: 180, height: 220, channels: 3 as const, background: { r, g, b } } }, ...box(480 + i * 200) };
  });
  labels = (await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#000000' } }).composite(parts).png().toBuffer()).toString('base64');
});

afterEach(() => vi.unstubAllGlobals());

const usage = { input_tokens: 1800, input_tokens_details: { text_tokens: 300, image_tokens: 1500 }, output_tokens: 1568 };
function stubOpenAI(images: string[], status = 200, error?: { code: string }) {
  const calls: FormData[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://api.openai.com/')) throw new Error(`unexpected fetch ${url}`);
    calls.push(init?.body as FormData);
    if (status !== 200) return Response.json({ error }, { status });
    return Response.json({ data: [{ b64_json: images[Math.min(calls.length - 1, images.length - 1)] }], usage });
  }));
  return calls;
}

const request = () => ({
  tenant: 'vvslab',
  image: `data:image/jpeg;base64,${still}`,
  spec,
  photo: { image: `data:image/jpeg;base64,${still}`, labels: `data:image/png;base64,${labels}` },
});
let ip = 0;
const nextIp = () => `10.9.0.${(ip += 1)}`;

describe('OpenAI photo', () => {
  it('is the provider when its key is set, unless told otherwise', () => {
    expect(renderProvider({ OPENAI_API_KEY: 'x' })).toBe('openai');
    expect(renderProvider({})).toBe('flux');
    expect(renderProvider({ OPENAI_API_KEY: 'x', RENDER_PROVIDER: 'flux' })).toBe('flux');
  });

  it('costs what the usage says', () => {
    // 300 text in at $5/M, 1500 image in at $8/M, 1568 out at $30/M.
    expect(usageCost(usage).costUsd).toBeCloseTo(0.0015 + 0.012 + 0.04704, 4);
  });

  it('one edit of the still, sent with the pinned model and the photo prompt', async () => {
    const calls = stubOpenAI([still]);
    const result = await handleRender(request(), nextIp(), env);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ checked: true, edits: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0].get('model')).toBe('gpt-image-2.5-sunburst-2026-09-08');
    expect(calls[0].get('quality')).toBe('medium');
    expect(calls[0].get('size')).toBe('1536x1024');
    expect(String(calls[0].get('prompt'))).toContain('Make this image a real photograph of exactly this piece of jewelry');
  });

  it('retries a photo that drifted, then shows the still rather than a different piece', async () => {
    const check = await checkPhoto(drifted, still, labels, spec);
    expect(check.pass).toBe(false);
    expect(check.reasons.join(' ')).toMatch(/metal colour|layout/);
    const calls = stubOpenAI([drifted, drifted]);
    const result = await handleRender(request(), nextIp(), env);
    expect(calls).toHaveLength(2);
    expect(result.body).toMatchObject({ checked: false, image: `data:image/jpeg;base64,${still}` });
  });

  it('a good retry is used', async () => {
    const calls = stubOpenAI([drifted, still]);
    const result = await handleRender(request(), nextIp(), env);
    expect(calls).toHaveLength(2);
    expect(result.body).toMatchObject({ checked: true });
  });

  it('pauses when the account is out of credits', async () => {
    stubOpenAI([], 429, { code: 'insufficient_quota' });
    const result = await handleRender(request(), nextIp(), env);
    expect(result).toMatchObject({ status: 503, body: { code: 'paused' } });
  });

  it('needs the still: a page without it is refused when there is no FLUX fallback', async () => {
    stubOpenAI([still]);
    const { photo: _photo, ...old } = request();
    void _photo;
    expect((await handleRender(old, nextIp(), env)).status).toBe(400);
  });
});
