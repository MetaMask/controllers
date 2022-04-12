import {
  getBuffer,
  hexStringToBuffer,
  isValidBufferKey,
  nullableHexStringToBuffer,
} from './utils';

describe('nullableHexStringToBuffer', () => {
  it('returns a buffer for a hexadecimal string', () => {
    expect(nullableHexStringToBuffer('1234')).toStrictEqual(
      Buffer.from('1234', 'hex'),
    );
  });

  it('returns a buffer for a 0x-prefixed hexadecimal string', () => {
    expect(nullableHexStringToBuffer('0x1234')).toStrictEqual(
      Buffer.from('1234', 'hex'),
    );
  });

  it('returns undefined when passed undefined', () => {
    expect(nullableHexStringToBuffer(undefined)).toBeUndefined();
  });
});

describe('isValidBufferKey', () => {
  it('checks the buffer length', () => {
    expect(isValidBufferKey(Buffer.alloc(32).fill(1), 32)).toBe(true);
    expect(isValidBufferKey(Buffer.alloc(31).fill(1), 32)).toBe(false);
  });

  it('checks if the buffer has at least one non-zero byte', () => {
    expect(isValidBufferKey(Buffer.alloc(32).fill(1), 32)).toBe(true);
    expect(isValidBufferKey(Buffer.alloc(32).fill(0), 32)).toBe(false);
  });
});

describe('getBuffer', () => {
  it('returns a buffer for a hexadecimal string', () => {
    expect(getBuffer('0x1234', 2)).toStrictEqual(hexStringToBuffer('1234'));
    expect(getBuffer('1234', 2)).toStrictEqual(hexStringToBuffer('1234'));
  });

  it('returns the same buffer if a buffer is passed', () => {
    const buffer = hexStringToBuffer('1234');
    expect(getBuffer(buffer, 2)).toBe(buffer);
  });

  it('throws if the length is invalid', () => {
    expect(() => getBuffer('1234', 1)).toThrow(
      'Invalid value: Must be a non-zero 1-byte buffer.',
    );

    expect(() => getBuffer(hexStringToBuffer('1234'), 1)).toThrow(
      'Invalid value: Must be a non-zero 1-byte buffer.',
    );
  });
});
