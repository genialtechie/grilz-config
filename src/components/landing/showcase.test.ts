import { describe, expect, it } from 'vitest';
import { buildTenant } from '../../lib/tenant/tenant';
import { VVSLAB_CONFIG } from '../../lib/tenant/vvslab';
import { showcaseBuilds } from './showcase';

describe('the front door showcase', () => {
  const builds = showcaseBuilds(buildTenant('vvslab', VVSLAB_CONFIG, true));

  it('shows every build in the prototype order the demo shop sells', () => {
    expect(builds.map((build) => build.id)).toEqual(['iced8', 'fangs', 'tone', 'open', 'gold66']);
  });

  it('prices each caption with the demo shop’s real prices', () => {
    expect(builds.find((build) => build.id === 'tone')?.caption).toBe('Two-tone 6 × 6 · from $2,000');
    builds.forEach((build) => expect(build.caption).toMatch(/ · from \$\d{1,3}(,\d{3})*$/));
  });

  it('puts the two-tone accent on the two front top teeth', () => {
    const tone = builds.find((build) => build.id === 'tone')!;
    expect(Object.keys(tone.design.overrides).map(Number)).toEqual([7, 8]);
    expect(tone.design.overrides[7].metal).toBe('white');
  });
});
