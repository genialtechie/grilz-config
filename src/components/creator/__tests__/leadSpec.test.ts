import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTenant } from '../../../lib/tenant/tenant';
import { VVSLAB_CONFIG } from '../../../lib/tenant/vvslab';
import { blankDesign, placeCharm, setRange, toSpec, withLine } from '../model';

// The spec the builder sends for two lines of letters and a charm. The same
// fixture goes through POST /api/leads in server/__tests__/leadsLetters.test.ts,
// so the shop's summary and email are checked against what the builder makes.
const shop = buildTenant('vvslab', VVSLAB_CONFIG, true);
const FIXTURE = new URL('./fixtures/lead-two-lines.json', import.meta.url);

describe('the builder’s lead spec', () => {
  it('carries both lines of letters and the charm, as the server fixture has them', () => {
    let d = setRange(blankDesign(shop), 6, 6);
    d = withLine(withLine(d, 0, { text: 'AB' }), 1, { text: 'Lainee', font: 'script', style: 'engraved', enamel: 'pink', teeth: [22, 23, 24, 25] });
    d = placeCharm(d, [8], 'crown');
    expect(toSpec(d)).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  });
});
