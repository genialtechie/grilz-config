// "Describe it": the AI builds a grill from someone's words or picture, from the shop's own catalogue.
// POST /api/describe (server/describe.ts, OpenAI on the key the server already has). 3 free builds per
// verified phone; every reply counts. Signatures are the contract between tracks.
import { forgetPhone, freshPhoneToken, rememberedPhone } from './phoneAuth';
import type { RenderSpec } from './renderSpec';

export type DescribeRequest = { tenant: string; words?: string; picture?: string; phoneToken: string; current?: RenderSpec };
export type DescribeResult =
  | { ok: true; spec: RenderSpec; /** "Built it" or "Built the closest match", plus what's different */ note: string; closest: boolean; buildsLeft: number }
  | { ok: false; error: string; code: 'no_builds_left' | 'unverified' | 'failed' };

const UNVERIFIED: DescribeResult = { ok: false, error: 'Confirm your phone number to use the AI.', code: 'unverified' };

export async function describeBuild(req: DescribeRequest): Promise<DescribeResult> {
  // Firebase tokens last an hour: the remembered phone's token is refreshed before it's sent.
  let phoneToken = req.phoneToken;
  if (phoneToken && phoneToken === rememberedPhone()?.token) {
    const fresh = await freshPhoneToken();
    if (!fresh) {
      forgetPhone();
      return UNVERIFIED;
    }
    phoneToken = fresh;
  }
  try {
    const r = await fetch('/api/describe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...req, phoneToken }) });
    const body = (await r.json().catch(() => ({}))) as DescribeResult;
    if (r.ok) return body;
    const code = (body as { code?: 'no_builds_left' | 'unverified' | 'failed' }).code ?? 'failed';
    if (code === 'unverified') forgetPhone();
    return { ok: false, error: (body as { error?: string }).error ?? 'The AI is busy. Try again.', code };
  } catch {
    return { ok: false, error: 'No connection. Try again.', code: 'failed' };
  }
}
