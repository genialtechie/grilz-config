import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPhotoPrompt } from '../../src/lib/renderSpec';
import { checkPhoto } from '../../server/photoCheck';
import { editPhoto, estimateCost, type ImageQuality } from '../../server/openaiImage';
import { EVAL_DESIGNS } from './designs';

// The AI photo eval (MAG-76): sends each design's 3D still (from capture.ts)
// to the image model once, saves the photo, scores it with the automatic
// checks, and records what it cost. Spending is capped: a ledger in the output
// folder keeps the running total, and a call that could take it past the
// budget is refused before it is sent.
//   npx tsx scripts/photo-eval/run.ts <dir> --label run1 --quality medium [--designs a,b] [--model m] [--dry]

const args = process.argv.slice(2);
const dir = args[0];
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const label = option('label') ?? 'run';
const quality = (option('quality') ?? 'medium') as ImageQuality;
const model = option('model');
const only = option('designs')?.split(',');
const dry = args.includes('--dry');
const BUDGET = Number(process.env.PHOTO_EVAL_BUDGET ?? 2.5);

const apiKey = process.env.OPENAI_API_KEY;
if (!dir || !existsSync(dir)) throw new Error('usage: run.ts <capture dir> [--label x] [--quality low|medium|high] [--designs a,b] [--dry]');
if (!apiKey && !dry) throw new Error('OPENAI_API_KEY is not set');

type Entry = { at: string; design: string; label: string; model: string; quality: string; usage: unknown; costUsd: number; seconds: number; check: unknown };
const ledgerFile = join(dir, 'ledger.json');
const ledger: { spent: number; calls: Entry[] } = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, 'utf8')) : { spent: 0, calls: [] };
const save = () => writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

const designs = EVAL_DESIGNS.filter((design) => !only || only.includes(design.id));
console.log(`budget $${BUDGET.toFixed(2)} · spent so far $${ledger.spent.toFixed(4)} · ${designs.length} call(s) at ${quality}, about $${estimateCost(quality).toFixed(3)} each at most`);

for (const design of designs) {
  const estimate = estimateCost(quality);
  if (ledger.spent + estimate > BUDGET) {
    console.log(`STOP: ${design.id} could take spending to $${(ledger.spent + estimate).toFixed(3)}, over the $${BUDGET.toFixed(2)} budget.`);
    break;
  }
  const still = readFileSync(join(dir, `${design.id}-still.jpg`)).toString('base64');
  const labels = readFileSync(join(dir, `${design.id}-still-labels.png`)).toString('base64');
  const prompt = buildPhotoPrompt(design.spec);
  if (dry) {
    console.log(`[dry] ${design.id}: ${prompt.length} characters of prompt, up to $${estimate.toFixed(3)}`);
    continue;
  }
  const started = Date.now();
  try {
    const result = await editPhoto({ apiKey: apiKey!, image: still, prompt, quality, model, deadline: Date.now() + 170_000 });
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    ledger.spent = Math.round((ledger.spent + result.usage.costUsd) * 10_000) / 10_000;
    const file = join(dir, `${design.id}-${label}.jpg`);
    writeFileSync(file, Buffer.from(result.image, 'base64'));
    const check = await checkPhoto(result.image, still, labels, design.spec);
    ledger.calls.push({ at: new Date().toISOString(), design: design.id, label, model: result.model, quality, usage: result.usage, costUsd: result.usage.costUsd, seconds, check });
    save();
    console.log(`${design.id}: $${result.usage.costUsd.toFixed(4)} (in ${result.usage.textIn}+${result.usage.imageIn} img, out ${result.usage.imageOut}) · ${seconds}s · check ${check.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(check.scores)} ${check.reasons.join('; ')} → ${file}`);
  } catch (error) {
    // A failed call may still be billed; record it so the total stays honest.
    ledger.calls.push({ at: new Date().toISOString(), design: design.id, label, model: model ?? 'default', quality, usage: null, costUsd: 0, seconds: Math.round((Date.now() - started) / 1000), check: { error: error instanceof Error ? error.message : String(error) } });
    save();
    console.log(`${design.id}: ERROR ${error instanceof Error ? error.message : error}`);
    break;
  }
}
console.log(`spent so far $${ledger.spent.toFixed(4)} of $${BUDGET.toFixed(2)}`);
