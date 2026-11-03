import { describe, expect, it } from 'vitest';

import { hexToBigNumber } from './hex-to-big-number.js';

describe('hexToBigNumber', () => {
  it('parses a 0x-prefixed hex string', () => {
    expect(hexToBigNumber('0x2a').toString(10)).toBe('42');
  });

  it('parses an uppercase 0X-prefixed hex string', () => {
    expect(hexToBigNumber('0X2A').toString(10)).toBe('42');
  });

  it('parses an unprefixed hex string as hex, not decimal', () => {
    expect(hexToBigNumber('2a').toString(10)).toBe('42');
  });
});
