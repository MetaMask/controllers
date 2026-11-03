import { BigNumber } from 'bignumber.js';
import { describe, expect, it } from 'vitest';

import { hexToBigNumber, parseDecimal } from './big-number.js';

describe('big-number utils', () => {
  describe('parseDecimal', () => {
    it.each([
      ['1.5', '1.5'],
      ['0', '0'],
      ['-2', '-2'],
      ['1e3', '1000'],
      ['0x5208', '21000'],
      [42, '42'],
      [new BigNumber('7.25'), '7.25'],
    ])('parses %j', (value, expected) => {
      expect(parseDecimal(value)?.toFixed()).toBe(expected);
    });

    it.each([
      'invalid',
      '',
      '1.2.3',
      'Infinity',
      '-Infinity',
      'NaN',
      NaN,
      Infinity,
      undefined,
      null,
    ])('returns undefined for %j', (value) => {
      expect(parseDecimal(value)).toBeUndefined();
    });
  });

  describe('hexToBigNumber', () => {
    it('parses a 0x-prefixed hex string', () => {
      expect(hexToBigNumber('0x2a').toString(10)).toBe('42');
    });

    it('parses an unprefixed hex string as hex, not decimal', () => {
      expect(hexToBigNumber('2a').toString(10)).toBe('42');
    });
  });
});
