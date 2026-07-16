import { describe, expect, test } from 'bun:test';

import { recommendationsUrl } from './bilibili';

describe('Bilibili endpoint compatibility', () => {
  test('does not send unsupported recommendation page-size parameters', () => {
    const url = new URL(recommendationsUrl());
    expect(url.searchParams.get('fresh_type')).toBe('3');
    expect(url.searchParams.has('ps')).toBe(false);
  });
});
