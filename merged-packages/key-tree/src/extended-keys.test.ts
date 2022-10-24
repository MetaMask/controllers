import { hexToBytes } from '@metamask/utils';
import {
  decodeExtendedKey,
  encodeExtendedKey,
  ExtendedKey,
  PRIVATE_KEY_VERSION,
  PUBLIC_KEY_VERSION,
} from './extended-keys';
import { hexStringToBytes } from './utils';

describe('decodeExtendedKey', () => {
  it('decodes an extended public key', () => {
    const extendedKey =
      'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';

    expect(decodeExtendedKey(extendedKey)).toStrictEqual({
      depth: 0,
      parentFingerprint: 0,
      index: 0,
      chainCode: hexToBytes(
        '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508',
      ),
      publicKey: hexToBytes(
        '0439a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c23cbe7ded0e7ce6a594896b8f62888fdbc5c8821305e2ea42bf01e37300116281',
      ),
      version: PUBLIC_KEY_VERSION,
    });
  });

  it('decodes an extended private key', () => {
    const extendedKey =
      'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';

    expect(decodeExtendedKey(extendedKey)).toStrictEqual({
      depth: 0,
      parentFingerprint: 0,
      index: 0,
      chainCode: hexStringToBytes(
        '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508',
      ),
      privateKey: hexStringToBytes(
        'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
      ),
      version: PRIVATE_KEY_VERSION,
    });
  });

  it('throws if the extended key is not a valid Base58 string', () => {
    const extendedKey =
      'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMP';

    expect(() => decodeExtendedKey(extendedKey)).toThrow(
      'Invalid value: Value is not base58-encoded, or the checksum is invalid.',
    );
  });

  it('throws if the extended key is not 78 bytes long', () => {
    const extendedKey = '3kSkWR5gTP';

    expect(() => decodeExtendedKey(extendedKey)).toThrow(
      'Invalid extended key: Expected a length of 78, got 3.',
    );
  });

  it('throws if the chain code is invalid', () => {
    const extendedKey =
      'xprv9s21ZrQH143K24Mfq5zL5MhWK9hUhhGbd45hLXo2Pq2oqzMMo63oStZzFAp8UkorEcJ4wSbGzEaLySRnFibyHm9Wvj72EK5vSiRn21B5B1e';

    expect(() => decodeExtendedKey(extendedKey)).toThrow(
      'Invalid extended key: Chain code must be a 32-byte non-zero byte array.',
    );
  });

  it('throws if the key is invalid', () => {
    const extendedKey =
      'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChijLXZSun8bsGj49MuvWWsqL9fqS5fhiDUkRQvq8cj8L42RGwHP';

    expect(() => decodeExtendedKey(extendedKey)).toThrow(
      'Invalid extended key: Key must be a 33-byte non-zero byte array.',
    );
  });

  it('throws if the public key does not start with 0x02 or 0x03', () => {
    const extendedKey =
      'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gYxFk5nqmbwrSjnkQvUtYydeKpRyanfmc6qmeyusqpnVEF2j8DGn';

    expect(() => decodeExtendedKey(extendedKey)).toThrow(
      'Invalid extended key: Public key must start with 0x02 or 0x03.',
    );
  });

  it('throws if the private key does not start with 0x00', () => {
    const extendedKey =
      'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiCqXZ9CTurr9xyzDFnddSPdB3k1pPUqfyv5k5KrkLa5wTGuBuaXXE';

    expect(() => decodeExtendedKey(extendedKey)).toThrow(
      'Invalid extended key: Private key must start with 0x00.',
    );
  });

  it('throws if the version is invalid', () => {
    const extendedKey =
      'xpuawnJgETRpXRUEauaMeTjxFtUTpGU6atj1BvkT6gWzaHrxtD2MWRCJkqjJE5j5VQuSNXkpoT7VPMHTTsFeySMd9WrjsTy28qcuJywWdgp5PfV';

    expect(() => decodeExtendedKey(extendedKey)).toThrow(
      'Invalid extended key: Expected a public (xpub) or private key (xprv) version.',
    );
  });
});

describe('encodeExtendedKey', () => {
  it('encodes an extended public key', () => {
    const extendedKey: ExtendedKey = {
      depth: 0,
      parentFingerprint: 0,
      index: 0,
      chainCode: hexStringToBytes(
        '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508',
      ),
      publicKey: hexStringToBytes(
        '0439a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c23cbe7ded0e7ce6a594896b8f62888fdbc5c8821305e2ea42bf01e37300116281',
      ),
      version: PUBLIC_KEY_VERSION,
    };

    expect(encodeExtendedKey(extendedKey)).toBe(
      'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8',
    );
  });

  it('encodes an extended private key', () => {
    const extendedKey: ExtendedKey = {
      depth: 0,
      parentFingerprint: 0,
      index: 0,
      chainCode: hexStringToBytes(
        '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508',
      ),
      privateKey: hexStringToBytes(
        'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
      ),
      version: PRIVATE_KEY_VERSION,
    };

    expect(encodeExtendedKey(extendedKey)).toBe(
      'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
    );
  });
});
