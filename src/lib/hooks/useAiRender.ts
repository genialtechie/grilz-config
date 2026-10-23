import { useCallback, useEffect, useRef, useState } from 'react';
import type { LeadReceipt } from '../leads';
import type { RenderSpec } from '../renderSpec';

export type RenderStatus = 'idle' | 'rendering' | 'ready' | 'error' | 'paused';

const USAGE_KEY = 'magpollo_ai_renders';
export const MAX_RENDERS_PER_VISITOR = 3;

const readUsage = () => {
  try {
    return Number(window.localStorage.getItem(USAGE_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
};

const writeUsage = (value: number) => {
  try {
    window.localStorage.setItem(USAGE_KEY, String(value));
  } catch {
    // The server-side throttle still applies when storage is unavailable.
  }
};

export const useAiRender = (tenant = 'vvslab') => {
  const [status, setStatus] = useState<RenderStatus>('idle');
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The 3D capture sent for this render: shown in place of the photo when renders are paused.
  const [preview, setPreview] = useState<string | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [rendersUsed, setRendersUsed] = useState(readUsage);
  const controller = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setStatus('idle');
    setImage(null);
    setError(null);
    setPreview(null);
    setSeconds(null);
    setStartedAt(null);
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(async (
    preview: string,
    spec: RenderSpec,
    inspiration?: string | null,
    masks: { indices: number[]; mask: string }[] = [],
    lead: LeadReceipt | null = null,
    /** The photo stage's still and tooth labels, for the OpenAI photo. */
    photo: { image: string; labels: string } | null = null,
  ) => {
    const used = readUsage();
    if (used >= MAX_RENDERS_PER_VISITOR) {
      setStatus('error');
      setError('You have used all the free photo renders for this demo.');
      return { ok: false as const, reason: 'limit' };
    }
    writeUsage(used + 1);
    setRendersUsed(used + 1);
    // A render that fails does not count against the visitor's free renders.
    const refund = () => {
      writeUsage(used);
      setRendersUsed(used);
    };

    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setStatus('rendering');
    setImage(null);
    setError(null);
    setPreview(photo?.image ?? preview);
    setStartedAt(Date.now());

    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant, image: preview, spec, inspiration: inspiration ?? undefined, masks, photo: photo ?? undefined, leadId: lead?.leadId, leadToken: lead?.token }),
        signal: abort.signal,
      });
      const body = (await response.json().catch(() => ({}))) as {
        image?: string;
        seconds?: number;
        error?: string;
        code?: string;
      };
      if (abort.signal.aborted) return { ok: false as const, reason: 'aborted' };
      if (!response.ok || !body.image) {
        refund();
        if (body.code === 'paused') {
          setStatus('paused');
          setError(null);
          return { ok: false as const, reason: 'paused' };
        }
        setStatus('error');
        setError(body.error ?? 'The render failed. Please try again.');
        return { ok: false as const, reason: `http_${response.status}` };
      }
      setImage(body.image);
      setSeconds(body.seconds ?? null);
      setStatus('ready');
      return { ok: true as const, seconds: body.seconds ?? null };
    } catch {
      if (abort.signal.aborted) return { ok: false as const, reason: 'aborted' };
      refund();
      setStatus('error');
      setError('Could not reach the renderer. Check your connection and try again.');
      return { ok: false as const, reason: 'network' };
    }
  }, [tenant]);

  return {
    status,
    image,
    error,
    preview,
    seconds,
    startedAt,
    rendersLeft: Math.max(0, MAX_RENDERS_PER_VISITOR - rendersUsed),
    start,
    reset,
  };
};
