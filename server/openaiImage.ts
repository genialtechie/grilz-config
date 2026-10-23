// The AI photo with OpenAI's image model (MAG-76): one edit of the photo
// stage's still. Masks are not used: OpenAI documents that masking with GPT
// Image is "entirely prompt-based", so the still itself carries the exact
// design and the photo is checked against it afterwards (photoCheck.ts).

const ENDPOINT = 'https://api.openai.com/v1/images/edits';
/** Pinned so results don't shift under us; OPENAI_IMAGE_MODEL overrides. */
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-sunburst-2026-09-08';
export type ImageQuality = 'low' | 'medium' | 'high';

/** Prices per million tokens (GPT Image 2 / 2.5, Images API: no cached-input discount). */
const PRICE = { textIn: 5, imageIn: 8, imageOut: 30 };

export type ImageUsage = { textIn: number; imageIn: number; imageOut: number; costUsd: number };

/** What a call costs, from the usage OpenAI returns. */
export function usageCost(usage: { input_tokens_details?: { text_tokens?: number; image_tokens?: number }; input_tokens?: number; output_tokens?: number } | undefined): ImageUsage {
  const imageIn = usage?.input_tokens_details?.image_tokens ?? 0;
  const textIn = usage?.input_tokens_details?.text_tokens ?? Math.max(0, (usage?.input_tokens ?? 0) - imageIn);
  const imageOut = usage?.output_tokens ?? 0;
  const costUsd = (textIn * PRICE.textIn + imageIn * PRICE.imageIn + imageOut * PRICE.imageOut) / 1_000_000;
  return { textIn, imageIn, imageOut, costUsd: Math.round(costUsd * 10_000) / 10_000 };
}

/**
 * The most a call could cost, to refuse one the budget can't cover: output at
 * OpenAI's published GPT Image 2 per-image prices (landscape), plus a generous
 * input allowance for the still and the prompt.
 */
export function estimateCost(quality: ImageQuality): number {
  const output = { low: 0.006, medium: 0.045, high: 0.165 }[quality];
  return Math.round((output * 1.3 + 0.05) * 1000) / 1000;
}

export class ImageError extends Error {
  constructor(readonly status: number, message: string, readonly code: 'paused' | 'failed' | 'refused') {
    super(message);
  }
}

export async function editPhoto(options: {
  apiKey: string;
  /** JPEG, base64 (no data: prefix). */
  image: string;
  prompt: string;
  model?: string;
  quality?: ImageQuality;
  size?: string;
  deadline?: number;
}): Promise<{ image: string; usage: ImageUsage; model: string }> {
  const model = options.model || DEFAULT_IMAGE_MODEL;
  const form = new FormData();
  form.append('model', model);
  form.append('image', new Blob([Buffer.from(options.image, 'base64')], { type: 'image/jpeg' }), 'still.jpg');
  form.append('prompt', options.prompt);
  form.append('size', options.size ?? '1536x1024');
  form.append('quality', options.quality ?? 'high');
  form.append('output_format', 'jpeg');
  form.append('output_compression', '92');
  form.append('n', '1');
  const remaining = options.deadline ? options.deadline - Date.now() : 100_000;
  if (remaining < 15_000) throw new ImageError(504, 'The photo took too long. Please try again.', 'failed');
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(remaining),
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: { b64_json?: string }[];
    usage?: Parameters<typeof usageCost>[0];
    error?: { message?: string; code?: string; type?: string };
  };
  if (!response.ok) {
    const code = body.error?.code ?? body.error?.type ?? '';
    // Out of credits or over the account's limit: pause photos rather than fail them one by one.
    if (response.status === 401 || response.status === 403 || code === 'insufficient_quota' || code === 'billing_hard_limit_reached') {
      throw new ImageError(503, 'Studio photos are paused right now.', 'paused');
    }
    if (response.status === 400 && /safety|moderation/i.test(`${code} ${body.error?.message ?? ''}`)) {
      throw new ImageError(422, 'This design could not be rendered. Try changing your notes or reference image.', 'refused');
    }
    console.error('openai image failed', response.status, code, (body.error?.message ?? '').slice(0, 200));
    throw new ImageError(502, 'The renderer is unavailable. Please try again.', 'failed');
  }
  const image = body.data?.[0]?.b64_json;
  if (!image) throw new ImageError(502, 'The renderer returned no image. Please try again.', 'failed');
  return { image, usage: usageCost(body.usage), model };
}
