import { bytesToHex } from '@noble/hashes/utils';
import fixtures from '../../test/fixtures';
import { hexStringToBuffer } from '../utils';
import {
  compressPublicKey,
  curve,
  getPublicKey,
  isValidPrivateKey,
  publicAdd,
} from './ed25519';

describe('ed25519', () => {
  describe('curve', () => {
    it('has the curve parameters', () => {
      // This is unused for derivation, but to keep the coverage and TypeScript happy, there's
      // a simple test here that asserts the value of `curve.n`.
      expect(curve.n).toBe(
        BigInt(
          '7237005577332262213973186563042994240857116359379907606001950938285454250989',
        ),
      );
    });
  });

  describe('isValidPrivateKey', () => {
    it('returns true', () => {
      expect(
        isValidPrivateKey(fixtures.ed25519.slip10[0].keys[0].privateKey),
      ).toBe(true);
    });
  });

  describe('getPublicKey', () => {
    const { slip10 } = fixtures.ed25519;

    it.each(slip10)(
      'returns the 0-padded public key for a private key',
      async ({ keys }) => {
        for (const { privateKey, publicKey } of keys) {
          expect(bytesToHex(await getPublicKey(privateKey))).toBe(publicKey);
          expect(bytesToHex(await getPublicKey(privateKey, true))).toBe(
            publicKey,
          );
        }
      },
    );
  });

  describe('publicAdd', () => {
    it('throws an error', () => {
      expect(() => publicAdd(Buffer.alloc(1), Buffer.alloc(1))).toThrow(
        'Ed25519 does not support public key derivation.',
      );
    });
  });

  describe('compressPublicKey', () => {
    const { slip10 } = fixtures.ed25519;

    it.each(slip10)('returns the same public key', async ({ keys }) => {
      for (const { publicKey } of keys) {
        const publicKeyBuffer = hexStringToBuffer(publicKey);
        expect(compressPublicKey(publicKeyBuffer)).toStrictEqual(
          publicKeyBuffer,
        );
      }
    });
  });
});
