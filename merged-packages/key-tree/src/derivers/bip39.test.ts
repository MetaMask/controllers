import {
  assert,
  bigIntToBytes,
  concatBytes,
  hexToBytes,
} from '@metamask/utils';
import * as hmacModule from '@noble/hashes/hmac';

import fixtures from '../../test/fixtures';
import { secp256k1, ed25519Bip32, type Curve } from '../curves';
import {
  entropyToCip3MasterNode,
  createBip39KeyFromSeed,
  deriveChildKey,
} from './bip39';

describe('createBip39KeyFromSeed', () => {
  const RANDOM_SEED = hexToBytes(
    '0xea82e6ee9d319c083007d0b011a37b0e480ae02417a988ac90355abd53cd04fc',
  );

  it('throws if the seed is less than 16 bytes', async () => {
    await expect(
      createBip39KeyFromSeed(new Uint8Array(15), secp256k1),
    ).rejects.toThrow(
      'Invalid seed: The seed must be between 16 and 64 bytes long.',
    );
  });

  it('throws if the seed is greater than 64 bytes', async () => {
    await expect(
      createBip39KeyFromSeed(new Uint8Array(65), secp256k1),
    ).rejects.toThrow(
      'Invalid seed: The seed must be between 16 and 64 bytes long.',
    );
  });

  it('throws if the private key is zero', async () => {
    // Mock the hmac function to return a zero private key.
    jest.spyOn(hmacModule, 'hmac').mockImplementation(() => new Uint8Array(64));

    await expect(
      createBip39KeyFromSeed(RANDOM_SEED, secp256k1),
    ).rejects.toThrow(
      'Invalid private key: The private key must greater than 0 and less than the curve order.',
    );
  });

  it.each([
    bigIntToBytes(secp256k1.curve.n),
    concatBytes([secp256k1.curve.n + BigInt(1)]),
  ])(
    'throws if the private key is greater than or equal to the curve order',
    async (privateKey) => {
      // For this test to be effective, the private key must be 32 bytes.
      assert(privateKey.length === 32);

      // Mock the hmac function to return a private key larger than the curve order.
      jest
        .spyOn(hmacModule, 'hmac')
        .mockImplementation(() =>
          concatBytes([privateKey, new Uint8Array(32)]),
        );

      await expect(
        createBip39KeyFromSeed(RANDOM_SEED, secp256k1),
      ).rejects.toThrow(
        'Invalid private key: The private key must greater than 0 and less than the curve order.',
      );
    },
  );

  it('throws with unsupported masterNodeGenerationSpec error', async () => {
    await expect(
      deriveChildKey({
        path: '',
        curve: {
          masterNodeGenerationSpec: 'notValidMasterNodeGenerationSpec',
        } as unknown as Curve,
      }),
    ).rejects.toThrow('Unsupported master node generation spec.');
  });
});

describe('Cip3', () => {
  fixtures.cip3.forEach((fixture) => {
    describe('entropyToCip3MasterNode', () => {
      it('derives the correct bip39 key for ed25519Bip32 curve', async () => {
        const result = await entropyToCip3MasterNode(
          hexToBytes(fixture.entropyHex),
          ed25519Bip32,
        );
        const { bip39Node } = fixture.nodes;
        expect(result.privateKey).toBe(bip39Node.privateKey);
        expect(result.chainCode).toBe(bip39Node.chainCode);
      });
    });

    describe('deriveChildKey', () => {
      it('derives the correct child key for ed25519Bip32 curve from mnemonic', async () => {
        const result = await deriveChildKey({
          path: fixture.mnemonic,
          curve: ed25519Bip32,
        });
        const { bip39Node } = fixture.nodes;
        expect(result.privateKey).toBe(bip39Node.privateKey);
        expect(result.chainCode).toBe(bip39Node.chainCode);
      });
    });
  });
});
