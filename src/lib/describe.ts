// "Describe it": the AI builds a grill from someone's words or picture. STAND-IN until the backend track
// lands POST /api/describe (OpenAI, the key the server already has). Signatures are the contract.
import type { RenderSpec } from './renderSpec';

export type DescribeRequest = { tenant: string; words?: string; picture?: string; phoneToken: string; current?: RenderSpec };
export type DescribeResult =
  | { ok: true; spec: RenderSpec; /** "Built it" or "Built the closest match", plus what's different */ note: string; closest: boolean; buildsLeft: number }
  | { ok: false; error: string; code: 'no_builds_left' | 'unverified' | 'failed' };

export async function describeBuild(req: DescribeRequest): Promise<DescribeResult> {
  try {
    const r = await fetch('/api/describe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
    const body = (await r.json().catch(() => ({}))) as DescribeResult;
    return r.ok ? body : { ok: false, error: (body as { error?: string }).error ?? 'The AI is busy. Try again.', code: (body as { code?: 'failed' }).code ?? 'failed' };
  } catch { return { ok: false, error: 'No connection. Try again.', code: 'failed' }; }
}
