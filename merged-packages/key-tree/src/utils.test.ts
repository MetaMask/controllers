import {
  getBIP32NodeToken,
  getBIP44ChangePathString,
  getBIP44CoinTypePathString,
  getBIP44CoinTypeToAddressPathTuple,
  getHardenedBIP32NodeToken,
  getUnhardenedBIP32NodeToken,
  isValidBufferKey,
  nullableHexStringToBuffer,
  getBuffer,
  getFingerprint,
  hexStringToBuffer,
  validateBIP32Index,
  isValidBIP32Index,
  isHardened,
  stripHexPrefix,
  isValidHexString,
  bytesToNumber,
  encodeBase58check,
  decodeBase58check,
} from './utils';

import { BIP44Node } from './BIP44Node';

// Inputs used for testing non-negative integers
const inputs = [-1, 1.1, NaN, {}, null, undefined] as number[];

describe('getBIP44CoinTypePathString', () => {
  it('returns a BIP-44 coin type path string', () => {
    expect(getBIP44CoinTypePathString(0)).toBe(`m / bip32:44' / bip32:0'`);
    expect(getBIP44CoinTypePathString(1)).toBe(`m / bip32:44' / bip32:1'`);
    expect(getBIP44CoinTypePathString(1000)).toBe(
      `m / bip32:44' / bip32:1000'`,
    );
  });

  it.each(inputs)('validates the index', (input) => {
    expect(() => getBIP44CoinTypePathString(input)).toThrow(
      'Invalid BIP-32 index: Must be a non-negative integer.',
    );
  });
});

describe('getBIP44ChangePathString', () => {
  const coinTypePath = getBIP44CoinTypePathString(1);

  it('returns a BIP-44 change path string (default values)', () => {
    expect(getBIP44ChangePathString(coinTypePath, {})).toBe(
      `${coinTypePath} / bip32:0' / bip32:0`,
    );
  });

  it('returns a BIP-44 change path string (custom change)', () => {
    expect(getBIP44ChangePathString(coinTypePath, { change: 1 })).toBe(
      `${coinTypePath} / bip32:0' / bip32:1`,
    );
  });

  it('returns a BIP-44 change path string (custom account)', () => {
    expect(getBIP44ChangePathString(coinTypePath, { account: 1 })).toBe(
      `${coinTypePath} / bip32:1' / bip32:0`,
    );
  });

  it('returns a BIP-44 change path string (custom change, custom account)', () => {
    expect(
      getBIP44ChangePathString(coinTypePath, { account: 2, change: 3 }),
    ).toBe(`${coinTypePath} / bip32:2' / bip32:3`);
  });

  it.each([-1, 1.1])('validates the index', (input) => {
    expect(() =>
      getBIP44ChangePathString(coinTypePath, { account: input }),
    ).toThrow('Invalid BIP-32 index: Must be a non-negative integer.');
  });
});

describe('getBIP44CoinTypeToAddressPathTuple', () => {
  it('returns a BIP-44 coin type as address path tuple (default values)', () => {
    expect(
      getBIP44CoinTypeToAddressPathTuple({ address_index: 0 }),
    ).toStrictEqual([`bip32:0'`, `bip32:0`, `bip32:0`]);
  });

  it('returns a BIP-44 coin type as address path tuple (custom address_index)', () => {
    expect(
      getBIP44CoinTypeToAddressPathTuple({ address_index: 1 }),
    ).toStrictEqual([`bip32:0'`, `bip32:0`, `bip32:1`]);
  });

  it('returns a BIP-44 coin type as address path tuple (custom change, hardened address_index)', () => {
    expect(
      getBIP44CoinTypeToAddressPathTuple({
        change: 1,
        address_index: { index: 2, hardened: true },
      }),
    ).toStrictEqual([`bip32:0'`, `bip32:1`, `bip32:2'`]);
  });

  it('returns a BIP-44 coin type as address path tuple (custom account, hardened change and address_index)', () => {
    expect(
      getBIP44CoinTypeToAddressPathTuple({
        account: 1,
        change: { index: 2, hardened: true },
        address_index: { index: 3, hardened: true },
      }),
    ).toStrictEqual([`bip32:1'`, `bip32:2'`, `bip32:3'`]);
  });

  it.each([-1, 1.1, NaN, {}] as number[])('validates the index', (input) => {
    expect(() =>
      getBIP44CoinTypeToAddressPathTuple({ account: input, address_index: 0 }),
    ).toThrow('Invalid BIP-32 index: Must be a non-negative integer.');
  });
});

describe('getHardenedBIP32NodeToken', () => {
  it('returns a hardened BIP-32 node token', () => {
    expect(getHardenedBIP32NodeToken(0)).toBe(`bip32:0'`);
    expect(getHardenedBIP32NodeToken(1)).toBe(`bip32:1'`);
    expect(getHardenedBIP32NodeToken(1000)).toBe(`bip32:1000'`);
  });

  it.each(inputs)('validates the index', (input) => {
    expect(() => getHardenedBIP32NodeToken(input)).toThrow(
      'Invalid BIP-32 index: Must be a non-negative integer.',
    );
  });
});

describe('getUnhardenedBIP32NodeToken', () => {
  it('returns an unhardened BIP-32 node token', () => {
    expect(getUnhardenedBIP32NodeToken(0)).toBe(`bip32:0`);
    expect(getUnhardenedBIP32NodeToken(1)).toBe(`bip32:1`);
    expect(getUnhardenedBIP32NodeToken(1000)).toBe(`bip32:1000`);
  });

  it.each(inputs)('validates the index', (input) => {
    expect(() => getUnhardenedBIP32NodeToken(input)).toThrow(
      'Invalid BIP-32 index: Must be a non-negative integer.',
    );
  });
});

describe('getBIP32NodeToken', () => {
  it('returns a BIP-32 node token (normal index)', () => {
    expect(getBIP32NodeToken(1)).toBe(`bip32:1`);
  });

  it('returns a BIP-32 node token (hardened index)', () => {
    expect(getBIP32NodeToken({ index: 1, hardened: true })).toBe(`bip32:1'`);
  });

  it('throws if the object is missing parameters', () => {
    // @ts-expect-error Invalid type.
    expect(() => getBIP32NodeToken({})).toThrow(
      'Invalid BIP-32 index: Must be an object containing the index and whether it is hardened.',
    );
  });

  it.each([NaN, {}, null, undefined] as number[])(
    'validates the index',
    (input) => {
      expect(() => getBIP32NodeToken({ hardened: true, index: input })).toThrow(
        'Invalid BIP-32 index: Must be an object containing the index and whether it is hardened.',
      );
    },
  );
});

describe('validateBIP32Index', () => {
  it('does not throw if the index is valid', () => {
    expect(() => validateBIP32Index(0)).not.toThrow();
    expect(() => validateBIP32Index(1)).not.toThrow();
    expect(() => validateBIP32Index(1000)).not.toThrow();
  });

  it.each(inputs)('throws if the index is invalid', (input) => {
    expect(() => validateBIP32Index(input)).toThrow(
      'Invalid BIP-32 index: Must be a non-negative integer.',
    );
  });
});

describe('isValidBIP32Index', () => {
  it('returns true if the index is valid', () => {
    expect(isValidBIP32Index(0)).toBe(true);
    expect(isValidBIP32Index(1)).toBe(true);
    expect(isValidBIP32Index(1000)).toBe(true);
  });

  it.each(inputs)('returns false if the index is invalid', (input) => {
    expect(isValidBIP32Index(input)).toBe(false);
  });
});

describe('isHardened', () => {
  it('returns true if the index is hardened', () => {
    expect(isHardened(`0'`)).toBe(true);
    expect(isHardened(`1'`)).toBe(true);
    expect(isHardened(`1000'`)).toBe(true);
  });

  it('returns false if the index is not hardened', () => {
    expect(isHardened(`0`)).toBe(false);
    expect(isHardened(`1`)).toBe(false);
    expect(isHardened(`1000`)).toBe(false);
  });
});

describe('stripHexPrefix', () => {
  it('strips the hex prefix from a string', () => {
    expect(stripHexPrefix('0x123')).toBe('123');
    expect(stripHexPrefix('0x')).toBe('');
  });

  it('does not change a string without a prefix', () => {
    expect(stripHexPrefix('123')).toBe('123');
    expect(stripHexPrefix('')).toBe('');
  });
});

describe('isValidHexString', () => {
  it('returns true if the string is a valid hex string', () => {
    expect(isValidHexString('0x123')).toBe(true);
    expect(isValidHexString('0x0')).toBe(true);
  });

  it('returns false if the string is not a valid hex string', () => {
    expect(isValidHexString('')).toBe(false);
    expect(isValidHexString('0x')).toBe(false);
    expect(isValidHexString('0x0g')).toBe(false);
  });
});

describe('hexStringToBuffer', () => {
  it('returns the same buffer if a buffer is passed', () => {
    const buffer = Buffer.from('123', 'hex');
    expect(hexStringToBuffer(buffer)).toBe(buffer);
  });

  it('returns a buffer from a hex string', () => {
    expect(hexStringToBuffer('1234')).toStrictEqual(Buffer.from('1234', 'hex'));
    expect(hexStringToBuffer('0x1234')).toStrictEqual(
      Buffer.from('1234', 'hex'),
    );
  });

  it('throws if the string is not a valid hex string', () => {
    expect(() => hexStringToBuffer('')).toThrow('Invalid hex string: "".');
    expect(() => hexStringToBuffer('0x')).toThrow('Invalid hex string: "0x".');
    expect(() => hexStringToBuffer('0x0g')).toThrow(
      'Invalid hex string: "0x0g".',
    );
  });
});

describe('nullableHexStringToBuffer', () => {
  it('returns the same buffer if a buffer is passed', () => {
    const buffer = Buffer.from('123', 'hex');
    expect(nullableHexStringToBuffer(buffer)).toBe(buffer);
  });

  it('returns a buffer for a hexadecimal string', () => {
    expect(nullableHexStringToBuffer('1234')).toStrictEqual(
      Buffer.from('1234', 'hex'),
    );

    expect(nullableHexStringToBuffer('0x1234')).toStrictEqual(
      Buffer.from('1234', 'hex'),
    );
  });

  it('returns undefined for falsy values', () => {
    expect(nullableHexStringToBuffer(undefined)).toBeUndefined();
  });

  it('throws if the string is not a valid hex string', () => {
    expect(() => nullableHexStringToBuffer('')).toThrow(
      'Invalid hex string: "".',
    );

    expect(() => nullableHexStringToBuffer('0x')).toThrow(
      'Invalid hex string: "0x".',
    );

    expect(() => nullableHexStringToBuffer('0x0g')).toThrow(
      'Invalid hex string: "0x0g".',
    );
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

describe('isValidInteger', () => {
  it('returns true if the value is a positive integer', () => {
    expect(isValidBIP32Index(0)).toBe(true);
    expect(isValidBIP32Index(1)).toBe(true);
    expect(isValidBIP32Index(1000)).toBe(true);
  });

  it.each(inputs)(
    'returns false if the value is not a positive integer',
    (input) => {
      expect(isValidBIP32Index(input)).toBe(false);
    },
  );
});

describe('bytesToNumber', () => {
  it('returns a bigint from a buffer', () => {
    expect(bytesToNumber(Buffer.from('123', 'hex'))).toBe(BigInt(BigInt(18)));
    expect(bytesToNumber(Buffer.from('456', 'hex'))).toBe(BigInt(BigInt(69)));
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

describe('encodeBase58Check', () => {
  it('encodes a buffer with Base58check', () => {
    expect(encodeBase58check(Buffer.from('foo bar'))).toBe('SQHFQMRT97ajZaP');
  });
});

describe('decodeBase58Check', () => {
  it('decodes a Base58check encoded string', () => {
    expect(decodeBase58check('SQHFQMRT97ajZaP')).toStrictEqual(
      Buffer.from('foo bar'),
    );
  });

  it('throws if the checksum is invalid', () => {
    expect(() => decodeBase58check('SQHFQMRT97ajZff')).toThrow(
      'Invalid value: Value is not base58-encoded, or the checksum is invalid.',
    );
  });
});

describe('getFingerprint', () => {
  it('returns the fingerprint for a compressed public key', async () => {
    const node = await BIP44Node.fromExtendedKey(
      'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
    );

    expect(getFingerprint(node.compressedPublicKeyBuffer)).toBe(876747070);
  });

  it('throws if the public key is not a valid buffer', async () => {
    expect(() => getFingerprint(Buffer.alloc(33).fill(0))).toThrow(
      'Invalid public key: The key must be a 33-byte, non-zero Buffer.',
    );

    expect(() => getFingerprint(Buffer.alloc(65).fill(1))).toThrow(
      'Invalid public key: The key must be a 33-byte, non-zero Buffer.',
    );
  });
});
