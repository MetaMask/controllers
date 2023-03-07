import { bytesToHex, hexToBytes } from '@metamask/utils';
import { CURVE } from '@noble/secp256k1';

import fixtures from '../../test/fixtures';
import { BIP_32_HARDENED_OFFSET } from '../constants';
import { ed25519, secp256k1 } from '../curves';
import { SLIP10Node } from '../SLIP10Node';
import { hexStringToBytes } from '../utils';
import {
  deriveChildKey,
  privateAdd,
  privateKeyToEthAddress,
  publicKeyToEthAddress,
} from './bip32';
import { bip39MnemonicToMultipath, createBip39KeyFromSeed } from './bip39';

const privateAddFixtures = fixtures['secp256k1-node'].privateAdd;

describe('deriveChildKey', () => {
  describe('private key derivation', () => {
    it('handles invalid keys using BIP-32', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [bip39MnemonicToMultipath(fixtures.local.mnemonic)],
        curve: 'secp256k1',
        specification: 'bip32',
      });

      // Simulate an invalid key once.
      jest.spyOn(secp256k1, 'isValidPrivateKey').mockReturnValueOnce(false);

      const childNode = await deriveChildKey({
        node,
        path: `0'`,
        curve: secp256k1,
        specification: 'bip32',
      });

      expect(childNode.index).toBe(BIP_32_HARDENED_OFFSET + 1);
      expect(childNode).toMatchInlineSnapshot(`
        Object {
          "chainCode": "0xe7862c5448c2e347dbdd0ee287e69888beec88e958388c927d2eff0e04df88f8",
          "curve": "secp256k1",
          "depth": 1,
          "index": 2147483649,
          "masterFingerprint": 3293725253,
          "parentFingerprint": 3293725253,
          "privateKey": "0xdcc114faa58e3feccf10e6658494c0c48b9d146dec313f0dedbd263547da23dc",
          "publicKey": "0x044948f8f48422b7608754bf228d93aff08c8e27fa46397afd80632be39f1213f8ca7aa33fd2b3630bdbbfa259841ca66f18de39f1de89a603c34f15378c817c24",
          "specification": "bip32",
        }
      `);
    });

    it.each(fixtures.errorHandling.bip32.keys)(
      'handles invalid keys using BIP-32 (test vectors)',
      async ({ path, privateKey, chainCode, index, depth }) => {
        const node = await createBip39KeyFromSeed(
          hexToBytes(fixtures.errorHandling.bip32.hexSeed),
          secp256k1,
        );

        // Simulate an invalid key once.
        jest.spyOn(secp256k1, 'isValidPrivateKey').mockReturnValueOnce(false);

        const childNode = await node.derive(path.ours.tuple);
        expect(childNode.privateKey).toBe(privateKey);
        expect(childNode.chainCode).toBe(chainCode);
        expect(childNode.index).toBe(index);
        expect(childNode.depth).toBe(depth);
      },
    );

    it('handles invalid keys using SLIP-10', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [bip39MnemonicToMultipath(fixtures.local.mnemonic)],
        curve: 'secp256k1',
        specification: 'slip10',
      });

      // Simulate an invalid key once.
      jest.spyOn(secp256k1, 'isValidPrivateKey').mockReturnValueOnce(false);

      const childNode = await deriveChildKey({
        node,
        path: `0'`,
        curve: secp256k1,
        specification: 'slip10',
      });

      expect(childNode.index).toBe(BIP_32_HARDENED_OFFSET);
      expect(childNode).toMatchInlineSnapshot(`
        Object {
          "chainCode": "0x69c58a9e53bb674d1bbeb871975f01adce5e058cdcba89f8930225341a75b439",
          "curve": "secp256k1",
          "depth": 1,
          "index": 2147483648,
          "masterFingerprint": 3293725253,
          "parentFingerprint": 3293725253,
          "privateKey": "0xb9dbe9cda5d858df377ab6c6a9b3efef99269142e390d24aaceb49c547b9fcad",
          "publicKey": "0x0422a2beb2a0c800ef19200db9161a3a7ee5645ccf67c05e18e7055a73cb1e1451f2c85f9aaac274bd16ea9a77f102feef3aba3f37ed6ac6e0961fb569011e42cf",
          "specification": "slip10",
        }
      `);
    });

    it.each(fixtures.errorHandling.slip10.keys)(
      'handles invalid keys using SLIP-10 (test vectors)',
      async ({ path, privateKey, chainCode }) => {
        const node = await createBip39KeyFromSeed(
          hexToBytes(fixtures.errorHandling.slip10.hexSeed),
          secp256k1,
          'slip10',
        );

        // Simulate an invalid key once.
        jest.spyOn(secp256k1, 'isValidPrivateKey').mockReturnValueOnce(false);

        const childNode = await node.derive(path.ours.tuple);
        expect(childNode.privateKey).toBe(privateKey);
        expect(childNode.chainCode).toBe(chainCode);
      },
    );

    it('throws the original error if the curve is ed25519', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [bip39MnemonicToMultipath(fixtures.local.mnemonic)],
        curve: 'ed25519',
        specification: 'slip10',
      });

      // This should never be the case.
      const error = new Error('Unable to derive child key.');
      jest.spyOn(ed25519, 'getPublicKey').mockRejectedValueOnce(error);

      await expect(
        deriveChildKey({
          node,
          path: `0'`,
          curve: ed25519,
          specification: 'slip10',
        }),
      ).rejects.toThrow(error);
    });
  });

  describe('public key derivation', () => {
    it('handles invalid keys using BIP-32', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [bip39MnemonicToMultipath(fixtures.local.mnemonic)],
        curve: 'secp256k1',
        specification: 'bip32',
      }).then((privateNode) => privateNode.neuter());

      // Simulate an invalid key once.
      jest.spyOn(secp256k1, 'publicAdd').mockImplementationOnce(() => {
        throw new Error('Invalid key.');
      });

      const childNode = await deriveChildKey({
        node,
        path: `0`,
        curve: secp256k1,
        specification: 'bip32',
      });

      expect(childNode.index).toBe(1);
      expect(childNode).toMatchInlineSnapshot(`
        Object {
          "chainCode": "0x4304d9e48a694baabefba498c2ef85f9e88307f4f621f79f19cbf5f704483130",
          "curve": "secp256k1",
          "depth": 1,
          "index": 1,
          "masterFingerprint": 3293725253,
          "parentFingerprint": 3293725253,
          "privateKey": undefined,
          "publicKey": "0x048aa5d3fe38c7e81685f9efa72d8b4e9f2cb61647c954e9cdf324a6eefe8a4a00c2b7fa2b2d3e598c87d244fb4eb8708e402aa5ccd945533f4a6ddbc026f77c7b",
          "specification": "bip32",
        }
      `);
    });

    it('handles invalid keys using SLIP-10', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [bip39MnemonicToMultipath(fixtures.local.mnemonic)],
        curve: 'secp256k1',
        specification: 'slip10',
      }).then((privateNode) => privateNode.neuter());

      // Simulate an invalid key once.
      jest.spyOn(secp256k1, 'publicAdd').mockImplementationOnce(() => {
        throw new Error('Invalid key.');
      });

      const childNode = await deriveChildKey({
        node,
        path: `0`,
        curve: secp256k1,
        specification: 'slip10',
      });

      expect(childNode.index).toBe(0);
      expect(childNode).toMatchInlineSnapshot(`
        Object {
          "chainCode": "0x03eebbe4707329e7da4aef868adb65f21bdc8712a86567b17a15ee4c3f01a57a",
          "curve": "secp256k1",
          "depth": 1,
          "index": 0,
          "masterFingerprint": 3293725253,
          "parentFingerprint": 3293725253,
          "privateKey": undefined,
          "publicKey": "0x04bc28203026c9fda2030f00ca592bdbe25392a106afae5205fa07dc4d77ecc61d21fa7a4bf21920abb52f56ae87f2d7b10d5db8d51229dea9c98c6b7982d514f9",
          "specification": "slip10",
        }
      `);
    });
  });

  it('throws an error if the specification is undefined', async () => {
    const node = await SLIP10Node.fromDerivationPath({
      derivationPath: [bip39MnemonicToMultipath(fixtures.local.mnemonic)],
      curve: 'secp256k1',
    });

    await expect(
      deriveChildKey({
        node,
        path: `'bip32:0'`,
        curve: secp256k1,
        specification: undefined,
      }),
    ).rejects.toThrow(`Invalid specification: Must be specified.`);
  });

  it.each(['foo', 'bip-32', 'slip-10', 'BIP32', 'SLIP10'])(
    'throws an error if the specification is invalid',
    async (specification) => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [bip39MnemonicToMultipath(fixtures.local.mnemonic)],
        curve: 'secp256k1',
      });

      await expect(
        deriveChildKey({
          node,
          path: `'bip32:0'`,
          curve: secp256k1,
          // @ts-expect-error Invalid specification type.
          specification,
        }),
      ).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Invalid specification: Must be one of bip32, slip10. Received "${specification}".`,
      );
    },
  );

  it('throws an error if the curve is ed25519 and the specification is bip32', async () => {
    const node = await SLIP10Node.fromDerivationPath({
      derivationPath: [bip39MnemonicToMultipath(fixtures.local.mnemonic)],
      curve: 'secp256k1',
    });

    await expect(
      deriveChildKey({
        node,
        path: `'bip32:0'`,
        curve: ed25519,
        specification: 'bip32',
      }),
    ).rejects.toThrow(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Invalid specification: The ed25519 curve only supports "slip10".`,
    );
  });
});

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
