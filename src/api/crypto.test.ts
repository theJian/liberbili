import { describe, expect, test } from 'bun:test';

import { avToBv, bvToAv, mixinKey, signWbi, ticketSignature } from './crypto';

describe('Bilibili crypto compatibility', () => {
  test('round-trips AV and BV identifiers', () => {
    for (const aid of [1, 170001, 455017605, 882584971]) {
      expect(bvToAv(avToBv(aid))).toBe(aid);
    }
  });

  test('builds the documented WBI mixin permutation', () => {
    const source =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-';
    expect(mixinKey(source.slice(0, 32), source.slice(32))).toHaveLength(32);
  });

  test('signing is deterministic for a fixed clock', () => {
    const signed = signWbi(
      { bvid: 'BV1xx411c7mD', cid: 123 },
      '12345678901234567890123456789012',
      1_700_000_000_000,
    );
    expect(signed).toContain('wts=1700000000');
    expect(signed).toMatch(/w_rid=[a-f0-9]{32}$/);
    expect(
      signWbi(
        { cid: 123, bvid: 'BV1xx411c7mD' },
        '12345678901234567890123456789012',
        1_700_000_000_000,
      ),
    ).toBe(signed);
  });

  test('ticket HMAC has a SHA-256 digest', () => {
    expect(ticketSignature(1_700_000_000)).toMatch(/^[a-f0-9]{64}$/);
  });
});
