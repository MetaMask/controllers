import fixtures from '../test/fixtures';
import { ed25519, secp256k1 } from './curves';
import { SLIP10Node } from './SLIP10Node';
import { BIP44PurposeNodeToken } from './constants';
import { createBip39KeyFromSeed, deriveChildKey } from './derivers/bip39';
import { hexStringToBuffer } from './utils';

const defaultBip39NodeToken = `bip39:${fixtures.local.mnemonic}` as const;

describe('SLIP10Node', () => {
  describe('fromExtendedKey', () => {
    it('initializes a new node from a private key', async () => {
      const [privateKey, , chainCode] = await deriveChildKey(
        fixtures.local.mnemonic,
      );

      const node = await SLIP10Node.fromExtendedKey({
        privateKey,
        chainCode,
        depth: 0,
        curve: 'secp256k1',
      });

      expect(node.depth).toBe(0);
      expect(node.privateKeyBuffer).toHaveLength(32);
      expect(node.publicKeyBuffer).toHaveLength(65);
    });

    it('initializes a new node from a hexadecimal private key and chain code', async () => {
      const [privateKey, , chainCode] = await deriveChildKey(
        fixtures.local.mnemonic,
      );

      const node = await SLIP10Node.fromExtendedKey({
        privateKey: privateKey.toString('hex'),
        chainCode: chainCode.toString('hex'),
        depth: 0,
        curve: 'secp256k1',
      });

      expect(node.depth).toBe(0);
      expect(node.privateKeyBuffer).toHaveLength(32);
      expect(node.publicKeyBuffer).toHaveLength(65);
    });

    it('initializes a new ed25519 node from a private key', async () => {
      const [privateKey, , chainCode] = await deriveChildKey(
        fixtures.local.mnemonic,
      );

      const node = await SLIP10Node.fromExtendedKey({
        privateKey,
        chainCode,
        depth: 0,
        curve: 'ed25519',
      });

      expect(node.depth).toBe(0);
      expect(node.privateKeyBuffer).toHaveLength(32);
      expect(node.publicKeyBuffer).toHaveLength(33);
    });

    it('initializes a new node from a public key', async () => {
      const [privateKey, , chainCode] = await deriveChildKey(
        fixtures.local.mnemonic,
      );

      const privateNode = await SLIP10Node.fromExtendedKey({
        privateKey,
        chainCode,
        depth: 0,
        curve: 'secp256k1',
      });

      const node = await SLIP10Node.fromExtendedKey({
        publicKey: privateNode.publicKeyBuffer,
        chainCode: privateNode.chainCodeBuffer,
        depth: 0,
        curve: 'secp256k1',
      });

      expect(node.depth).toBe(0);
      expect(node.privateKeyBuffer).toBeUndefined();
      expect(node.publicKeyBuffer).toHaveLength(65);
    });

    it('initializes a new ed25519 node from a public key', async () => {
      const [privateKey, , chainCode] = await deriveChildKey(
        fixtures.local.mnemonic,
      );

      const privateNode = await SLIP10Node.fromExtendedKey({
        privateKey,
        chainCode,
        depth: 0,
        curve: 'ed25519',
      });

      const node = await SLIP10Node.fromExtendedKey({
        publicKey: privateNode.publicKeyBuffer,
        chainCode: privateNode.chainCodeBuffer,
        depth: 0,
        curve: 'ed25519',
      });

      expect(node.depth).toBe(0);
      expect(node.privateKeyBuffer).toBeUndefined();
      expect(node.publicKeyBuffer).toHaveLength(33);
    });

    it('initializes a new node from a hexadecimal public key and chain code', async () => {
      const [privateKey, , chainCode] = await deriveChildKey(
        fixtures.local.mnemonic,
      );

      const privateNode = await SLIP10Node.fromExtendedKey({
        privateKey,
        chainCode,
        depth: 0,
        curve: 'secp256k1',
      });

      const node = await SLIP10Node.fromExtendedKey({
        publicKey: privateNode.publicKey,
        chainCode: privateNode.chainCode,
        depth: 0,
        curve: 'secp256k1',
      });

      expect(node.depth).toBe(0);
      expect(node.privateKeyBuffer).toBeUndefined();
      expect(node.publicKeyBuffer).toHaveLength(65);
    });

    it('initializes a new node from JSON', async () => {
      const [privateKey, , chainCode] = await deriveChildKey(
        fixtures.local.mnemonic,
      );

      const node = await SLIP10Node.fromExtendedKey({
        privateKey,
        chainCode,
        depth: 0,
        curve: 'secp256k1',
      });

      expect(await SLIP10Node.fromJSON(node.toJSON())).toStrictEqual(node);
    });

    it('initializes a new node from JSON with a public key', async () => {
      const [privateKey, , chainCode] = await deriveChildKey(
        fixtures.local.mnemonic,
      );

      const node = await SLIP10Node.fromExtendedKey({
        privateKey,
        chainCode,
        depth: 0,
        curve: 'secp256k1',
      });

      const neuteredNode = node.neuter();

      expect(await SLIP10Node.fromJSON(neuteredNode.toJSON())).toStrictEqual(
        neuteredNode,
      );
    });

    it('throws if no public or private key is specified', async () => {
      await expect(
        SLIP10Node.fromExtendedKey({
          chainCode: Buffer.alloc(32, 1),
          depth: 0,
          curve: 'secp256k1',
        }),
      ).rejects.toThrow(
        'Invalid options: Must provide either a private key or a public key.',
      );
    });

    it('throws if the depth is invalid', async () => {
      const inputs = [
        -1,
        0.1,
        -0.1,
        NaN,
        Infinity,
        '0',
        'zero',
        {},
        null,
        undefined,
      ];

      for (const input of inputs) {
        await expect(
          SLIP10Node.fromExtendedKey({
            depth: input as any,
            publicKey: Buffer.alloc(65, 1),
            chainCode: Buffer.alloc(32, 1),
            curve: 'secp256k1',
          }),
        ).rejects.toThrow(
          `Invalid HD tree path depth: The depth must be a positive integer. Received: "${input}"`,
        );
      }
    });

    it('throws if the private key is invalid', async () => {
      await expect(
        SLIP10Node.fromExtendedKey({
          privateKey: 'foo',
          chainCode: Buffer.alloc(32, 1),
          depth: 0,
          curve: 'secp256k1',
        }),
      ).rejects.toThrow(
        'Invalid value: Must be a valid hex string of length: 64.',
      );
    });

    it('throws if the private key is not a Buffer or hexadecimal string', async () => {
      await expect(
        SLIP10Node.fromExtendedKey({
          // @ts-expect-error Invalid private key type.
          privateKey: 123,
          chainCode: Buffer.alloc(32, 1),
          depth: 0,
          curve: 'secp256k1',
        }),
      ).rejects.toThrow(
        'Invalid value: Expected a Buffer or hexadecimal string.',
      );
    });
  });

  describe('fromDerivationPath', () => {
    it('initializes a new node from a derivation path', async () => {
      // Ethereum coin type node
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
        curve: 'secp256k1',
      });

      expect(node.depth).toStrictEqual(2);
      expect(node.toJSON()).toStrictEqual({
        depth: 2,
        curve: 'secp256k1',
        privateKey: node.privateKey,
        publicKey: node.publicKey,
        chainCode: node.chainCode,
      });
    });

    it('throws if the derivation path is empty', async () => {
      await expect(
        SLIP10Node.fromDerivationPath({
          derivationPath: [] as any,
          curve: 'secp256k1',
        }),
      ).rejects.toThrow(
        'Invalid derivation path: May not specify an empty derivation path.',
      );
    });

    it('throws if no derivation path is specified', async () => {
      await expect(
        // @ts-expect-error No derivation path specified
        SLIP10Node.fromDerivationPath({
          curve: 'secp256k1',
        }),
      ).rejects.toThrow('Invalid options: Must provide a derivation path.');
    });

    it('throws if the derivation path is of depth 0 and not a single BIP-39 node', async () => {
      await expect(
        SLIP10Node.fromDerivationPath({
          derivationPath: [`bip32:0'`] as any,
          curve: 'secp256k1',
        }),
      ).rejects.toThrow(
        'Invalid HD path segment: The segment must consist of a single BIP-39 node for depths of 0. Received: "bip32:0\'".',
      );
    });

    it('throws an error if attempting to modify the fields of a node', async () => {
      const node: any = await SLIP10Node.fromDerivationPath({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
        curve: 'secp256k1',
      });

      // getter
      expect(() => (node.privateKey = 'foo')).toThrow(
        /^Cannot set property privateKey of .+ which has only a getter/iu,
      );

      // frozen / readonly
      [
        'depth',
        'privateKeyBuffer',
        'publicKeyBuffer',
        'chainCodeBuffer',
      ].forEach((property) => {
        expect(() => (node[property] = Buffer.allocUnsafe(64).fill(1))).toThrow(
          expect.objectContaining({
            name: 'TypeError',
            message: expect.stringMatching(
              `Cannot assign to read only property '${property}' of object`,
            ),
          }),
        );
      });
    });

    it('throws an error if no curve is specified', async () => {
      // @ts-expect-error No curve specified, but required in type
      await expect(SLIP10Node.fromDerivationPath({})).rejects.toThrow(
        'Invalid curve: Must specify a curve.',
      );
    });

    it('throws an error for unsupported curves', async () => {
      await expect(
        // @ts-expect-error Invalid curve name for type
        SLIP10Node.fromDerivationPath({ curve: 'foo bar' }),
      ).rejects.toThrow(
        'Invalid curve: Only the following curves are supported: secp256k1, ed25519.',
      );
    });
  });

  describe('derive', () => {
    it('derives a child node', async () => {
      const coinTypeNode = `bip32:40'`;
      const targetNode = await SLIP10Node.fromDerivationPath({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          coinTypeNode,
        ],
        curve: 'secp256k1',
      });

      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [defaultBip39NodeToken, BIP44PurposeNodeToken],
        curve: 'secp256k1',
      });

      const childNode = await node.derive([coinTypeNode]);

      expect(childNode).toMatchObject({
        depth: targetNode.depth,
        privateKey: targetNode.privateKey,
        chainCode: targetNode.chainCode,
      });
    });

    // TODO: Public key derivation
    it('throws when trying to derive a node without a private key', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [defaultBip39NodeToken, BIP44PurposeNodeToken],
        curve: 'secp256k1',
      });

      await expect(node.neuter().derive([`bip32:0'`])).rejects.toThrow(
        'Unable to derive child key: No private key.',
      );
    });

    it('throws if the child derivation path is zero', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:3'`,
          `bip32:0'`,
        ],
        curve: 'secp256k1',
      });

      await expect(node.derive([] as any)).rejects.toThrow(
        'Invalid HD tree derivation path: Deriving a path of length 0 is not defined',
      );
    });

    it('throws when trying to derive a unhardened node with ed25519', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:3'`,
          `bip32:0'`,
        ],
        curve: 'ed25519',
      });

      await expect(node.derive(['bip32:0'])).rejects.toThrow(
        'Invalid path: Cannot derive unhardened child keys with ed25519.',
      );
    });
  });

  describe('publicKey', () => {
    const {
      ed25519: { slip10 },
      bip32,
    } = fixtures;

    it.each(slip10)(
      'returns the public key for an ed25519 node',
      async ({ hexSeed, keys }) => {
        const [privateKey, , chainCode] = await createBip39KeyFromSeed(
          hexStringToBuffer(hexSeed),
          ed25519,
        );

        for (const { path, publicKey } of keys) {
          const node = await SLIP10Node.fromExtendedKey({
            privateKey,
            chainCode,
            curve: 'ed25519',
            depth: 0,
          });

          if (path.ours.tuple.length === 0) {
            continue;
          }

          const childNode = await node.derive(path.ours.tuple);
          expect(childNode.publicKey).toBe(publicKey);
        }
      },
    );

    it.each(bip32)(
      'returns the public key for an secp256k1 node',
      async ({ hexSeed, keys }) => {
        const [privateKey, , chainCode] = await createBip39KeyFromSeed(
          hexStringToBuffer(hexSeed),
          secp256k1,
        );

        for (const { path, publicKey } of keys) {
          const node = await SLIP10Node.fromExtendedKey({
            privateKey,
            chainCode,
            curve: 'secp256k1',
            depth: 0,
          });

          if (path.ours.tuple.length === 0) {
            continue;
          }

          const childNode = await node.derive(path.ours.tuple);
          expect(childNode.publicKey).toBe(publicKey);
        }
      },
    );
  });

  describe('address', () => {
    const { hexSeed, path, sampleAddressIndices } =
      fixtures['ethereumjs-wallet'];

    it.each(sampleAddressIndices)(
      'returns the address for an secp256k1 node',
      async ({ index, address }) => {
        const [privateKey, , chainCode] = await createBip39KeyFromSeed(
          hexStringToBuffer(hexSeed),
          secp256k1,
        );

        const node = await SLIP10Node.fromExtendedKey({
          privateKey,
          chainCode,
          curve: 'secp256k1',
          depth: 0,
        });

        const childNode = await node.derive([
          ...path.ours.tuple,
          `bip32:${index}`,
        ]);

        expect(childNode.address).toBe(address);
      },
    );

    it('throws an error when trying to get an address for an ed25519 node', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
        curve: 'ed25519',
      });

      expect(() => node.address).toThrow(
        'Unable to get address for this node: Only secp256k1 is supported.',
      );
    });
  });

  describe('neuter', () => {
    it('returns a SLIP-10 node without a private key', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:0'`,
          `bip32:0'`,
        ],
        curve: 'secp256k1',
      });

      const neuterNode = node.neuter();

      expect(neuterNode.privateKey).toBeUndefined();
      expect(neuterNode.privateKeyBuffer).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    it('returns a JSON-compatible representation of the node', async () => {
      const node = await SLIP10Node.fromDerivationPath({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
        curve: 'secp256k1',
      });

      expect(node.depth).toStrictEqual(2);

      const nodeJson = node.toJSON();
      expect(nodeJson).toStrictEqual({
        depth: node.depth,
        curve: 'secp256k1',
        privateKey: node.privateKey,
        publicKey: node.publicKey,
        chainCode: node.chainCode,
      });

      expect(JSON.parse(JSON.stringify(nodeJson))).toStrictEqual({
        depth: node.depth,
        curve: 'secp256k1',
        privateKey: node.privateKey,
        publicKey: node.publicKey,
        chainCode: node.chainCode,
      });
    });
  });
});
