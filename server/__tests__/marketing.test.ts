import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readUnsubscribeLink, unsubscribeUrl, verifyResendSignature } from '../marketing';

const env = { LEAD_TOKEN_SECRET: 'secret-one', PUBLIC_ORIGIN: 'https://vvslab.test' };

describe('unsubscribe links', () => {
  it('round-trip the address and topic, case-insensitively', () => {
    const url = new URL(unsubscribeUrl('Ava@Example.com', 'tips', env));
    expect(url.origin + url.pathname).toBe('https://vvslab.test/api/unsubscribe');
    expect(readUnsubscribeLink(url.searchParams, env)).toEqual({ email: 'ava@example.com', topic: 'tips' });
  });

  it('refuse a different address, topic tampering to nonsense, or another secret', () => {
    const url = new URL(unsubscribeUrl('ava@example.com', 'news', env));
    const other = new URLSearchParams(url.searchParams);
    other.set('e', Buffer.from('bob@example.com').toString('base64url'));
    expect(readUnsubscribeLink(other, env)).toBeNull();
    const badTopic = new URLSearchParams(url.searchParams);
    badTopic.set('topic', 'everything');
    expect(readUnsubscribeLink(badTopic, env)).toBeNull();
    expect(readUnsubscribeLink(url.searchParams, { LEAD_TOKEN_SECRET: 'secret-two' })).toBeNull();
  });
});

describe('Resend webhook signatures', () => {
  const secret = `whsec_${Buffer.from('webhook-key').toString('base64')}`;
  const body = '{"type":"email.complained"}';
  const sign = (id: string, timestamp: string, payload: string) => createHmac('sha256', Buffer.from('webhook-key')).update(`${id}.${timestamp}.${payload}`).digest('base64');

  it('accepts a fresh, correctly signed event', () => {
    const now = Date.now();
    const timestamp = String(Math.floor(now / 1000));
    expect(verifyResendSignature(body, { id: 'msg_1', timestamp, signature: `v1,${sign('msg_1', timestamp, body)}` }, secret, now)).toBe(true);
    expect(verifyResendSignature(body, { id: 'msg_1', timestamp, signature: `v1,bogus v1,${sign('msg_1', timestamp, body)}` }, secret, now)).toBe(true);
  });

  it('rejects a changed body, an old timestamp, or no secret', () => {
    const now = Date.now();
    const timestamp = String(Math.floor(now / 1000));
    const signature = `v1,${sign('msg_1', timestamp, body)}`;
    expect(verifyResendSignature('{"type":"email.bounced"}', { id: 'msg_1', timestamp, signature }, secret, now)).toBe(false);
    expect(verifyResendSignature(body, { id: 'msg_1', timestamp, signature }, secret, now + 10 * 60_000)).toBe(false);
    expect(verifyResendSignature(body, { id: 'msg_1', timestamp, signature }, undefined, now)).toBe(false);
  });
});
