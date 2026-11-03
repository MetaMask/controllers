import { describe, expect, it } from 'vitest';

import { LenientBigNumber, hexToBigNumber } from './big-number.js';

describe('big-number utils', () => {
  describe('LenientBigNumber', () => {
    it('parses valid numeric strings', () => {
      expect(new LenientBigNumber('1.5').toFixed()).toBe('1.5');
    });

    it('returns NaN for invalid input instead of throwing', () => {
      expect(new LenientBigNumber('invalid').isNaN()).toBe(true);
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
