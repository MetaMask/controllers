import { BigNumber } from 'bignumber.js';
import { describe, expect, it } from 'vitest';

import { parseDecimal } from './parse-decimal.js';

describe('parseDecimal', () => {
  it.each([
    ['1.5', '1.5'],
    ['0', '0'],
    ['-2', '-2'],
    ['5.1901652883e-8', '0.000000051901652883'],
    [42, '42'],
    [new BigNumber('7.25'), '7.25'],
  ])('parses %j', (value, expected) => {
    expect(parseDecimal(value)?.toFixed()).toBe(expected);
  });

  it.each([
    'not-a-number',
    '',
    '1.2.3',
    'Infinity',
    'NaN',
    NaN,
    Infinity,
    undefined,
    null,
  ])('returns undefined for %j', (value) => {
    expect(parseDecimal(value)).toBeUndefined();
  });
});
