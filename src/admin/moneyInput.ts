/**
 * What one keystroke in a Money field means: the number to publish to the
 * draft, or undefined when the field is mid-number and nothing should be
 * published yet.
 *
 * A `type="number"` input sanitizes a lone "-" to "" both on read and on
 * controlled write, so a negative could never be typed at all — it landed
 * as +$60 (MAG-219 re-review F1). Money fields that allow negatives are
 * therefore `type="text"` (inputMode="decimal" keeps the numeric keyboard)
 * and hold the raw string in local state; this is the parse half of that.
 * "" is a cleared field (0, today's behavior); "-" / "-." are
 * intermediates; anything else that parses to a finite number is published.
 */
export const moneyKeystroke = (raw: string): number | undefined => {
  if (raw === '') return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};
