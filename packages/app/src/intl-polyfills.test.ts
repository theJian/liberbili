import { describe, expect, test } from 'bun:test';

import './intl-polyfills';

describe('Intl polyfills', () => {
  test('provide plural rules for every supported locale', () => {
    expect(new Intl.PluralRules('en').select(1)).toBe('one');
    expect(new Intl.PluralRules('en').select(2)).toBe('other');
    expect(new Intl.PluralRules('zh-Hans').select(1)).toBe('other');
  });
});
