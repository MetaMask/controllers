import { describe, expect, it } from 'vitest';

import { LenientBigNumber } from './lenientBigNumber.js';

describe('LenientBigNumber', () => {
  it('parses valid numeric strings', () => {
    expect(new LenientBigNumber('1.5').toFixed()).toBe('1.5');
  });

  it('returns NaN for invalid input instead of throwing', () => {
    expect(new LenientBigNumber('not-a-number').isNaN()).toBe(true);
  });
});
