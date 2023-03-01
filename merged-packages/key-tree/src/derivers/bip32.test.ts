import { bytesToHex, hexToBytes } from '@metamask/utils';
import { CURVE } from '@noble/secp256k1';

import fixtures from '../../test/fixtures';
import { secp256k1 } from '../curves';
import { hexStringToBytes } from '../utils';
import {
  privateAdd,
  privateKeyToEthAddress,
  publicKeyToEthAddress,
} from './bip32';

const privateAddFixtures = fixtures['secp256k1-node'].privateAdd;

describe('privateAdd', () => {
  const PRIVATE_KEY = hexStringToBytes(
    '51f34c9afc9d5b43e085688db58bb923c012bb07e42a8eaf18a8400aa9a167fb',
  );

  it.each(privateAddFixtures)(
    'adds a tweak to a private key',
    ({ privateKey, tweak, result }) => {
      const expected = hexStringToBytes(result);

      expect(
        privateAdd(
          hexStringToBytes(privateKey),
          hexStringToBytes(tweak),
          secp256k1,
        ),
      ).toStrictEqual(expected);
    },
  );

  it('throws if the tweak is larger than the curve order', () => {
    const tweak = hexStringToBytes(CURVE.n.toString(16));

    expect(() => privateAdd(PRIVATE_KEY, tweak, secp256k1)).toThrow(
      'Invalid tweak: Tweak is larger than the curve order.',
    );
  });

  it('throws if the result is invalid', () => {
    // n - 1
    const privateKey = hexStringToBytes(
      'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
    );

    // 1
    const tweak = hexStringToBytes(
      '0000000000000000000000000000000000000000000000000000000000000001',
    );

    expect(() => privateAdd(privateKey, tweak, secp256k1)).toThrow(
      'Invalid private key or tweak: The resulting private key is invalid.',
    );
  });

  it.each([
    '0x7ebc0a630524c2d5ac55a98b8527a8ab2e842cd7b4037baadc463e597183408200',
    '0xa0a86d020f4c512b8639c38ecb9a3792f1575d3a4ad832e2523fd447c67170',
    '0x0efd64c97a920e71d90cf54589fb8a93',
    '0x1',
  ])('throws if the tweak is not 32 bytes long', (tweak) => {
    expect(() => privateAdd(PRIVATE_KEY, hexToBytes(tweak), secp256k1)).toThrow(
      'Invalid tweak: Tweak must be a non-zero 32-byte Uint8Array.',
    );
  });

  it('throws if the tweak is zero', () => {
    expect(() =>
      privateAdd(PRIVATE_KEY, new Uint8Array(32).fill(0), secp256k1),
    ).toThrow('Invalid tweak: Tweak must be a non-zero 32-byte Uint8Array.');
  });
});

describe('privateKeyToEthAddress', () => {
  it('returns the Ethereum address for a private key', () => {
    const { privateKey, address } = fixtures['ethereumjs-wallet'];

    expect(
      bytesToHex(privateKeyToEthAddress(hexStringToBytes(privateKey))),
    ).toBe(address);
  });

  it('throws for invalid private keys', () => {
    // @ts-expect-error Invalid public key type.
    expect(() => privateKeyToEthAddress('foo')).toThrow(
      'Invalid key: The key must be a 32-byte, non-zero Uint8Array.',
    );

    expect(() => privateKeyToEthAddress(new Uint8Array(31).fill(1))).toThrow(
      'Invalid key: The key must be a 32-byte, non-zero Uint8Array.',
    );
  });
});

describe('publicKeyToEthAddress', () => {
  it('returns the Ethereum address for a public key', () => {
    const { publicKey, address } = fixtures['ethereumjs-wallet'];

    expect(bytesToHex(publicKeyToEthAddress(hexStringToBytes(publicKey)))).toBe(
      address,
    );
  });

  it('throws for invalid public keys', () => {
    // @ts-expect-error Invalid public key type.
    expect(() => publicKeyToEthAddress('foo')).toThrow(
      'Invalid key: The key must be a 65-byte, non-zero Uint8Array.',
    );

    expect(() => publicKeyToEthAddress(new Uint8Array(64).fill(1))).toThrow(
      'Invalid key: The key must be a 65-byte, non-zero Uint8Array.',
    );
  });
});
