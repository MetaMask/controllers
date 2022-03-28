import fixtures from '../test/fixtures';
import { ed25519, secp256k1 } from './curves';
import { SLIP10Node } from './SLIP10Node';
import { BIP44PurposeNodeToken } from './constants';

const defaultBip39NodeToken = `bip39:${fixtures.local.mnemonic}` as const;

describe('SLIP10Node', () => {
  describe('create', () => {
    it('initializes a new node (depth, derivationPath)', async () => {
      // Ethereum coin type node
      const node = await SLIP10Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
        curve: secp256k1,
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(2);
      expect(node.toJSON()).toStrictEqual({
        depth: 2,
        key: node.key,
      });
    });

    it('initializes a new node (depth, buffer key)', async () => {
      const node = await SLIP10Node.create({
        depth: 1,
        key: Buffer.alloc(64).fill(1),
        curve: secp256k1,
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(1);
      expect(node.toJSON()).toStrictEqual({
        depth: 1,
        key: node.key,
      });
    });

    it('initializes a new node (depth, Base64 string key)', async () => {
      const node = await SLIP10Node.create({
        depth: 3,
        key: Buffer.alloc(64).fill(2).toString('base64'),
        curve: secp256k1,
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(3);
      expect(node.toJSON()).toStrictEqual({
        depth: 3,
        key: node.key,
      });
    });

    it('initializes a new node (depth, hex string key)', async () => {
      const node = await SLIP10Node.create({
        depth: 3,
        key: Buffer.alloc(64).fill(2).toString('hex'),
        curve: secp256k1,
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(3);
      expect(node.toJSON()).toStrictEqual({
        depth: 3,
        key: node.key,
      });
    });

    it('initializes a new node (depth, 0x-prefixed hex string key)', async () => {
      const node = await SLIP10Node.create({
        depth: 3,
        key: `0x${Buffer.alloc(64).fill(2).toString('hex')}`,
        curve: secp256k1,
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(3);
      expect(node.toJSON()).toStrictEqual({
        depth: 3,
        key: node.key,
      });
    });

    it('throws if the depth is invalid', async () => {
      const validBufferKey = Buffer.alloc(64).fill(1);
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
          SLIP10Node.create({
            depth: input as any,
            key: validBufferKey,
            curve: secp256k1,
          }),
        ).rejects.toThrow(
          `Invalid HD tree path depth: The depth must be a positive integer. Received: "${input}"`,
        );
      }
    });

    it('throws if both a derivation path and a depth are specified', async () => {
      await expect(
        SLIP10Node.create({
          depth: 2 as any, // This is the correct depth, but it's still forbidden
          derivationPath: [
            defaultBip39NodeToken,
            BIP44PurposeNodeToken,
            `bip32:60'`,
          ],
          curve: secp256k1,
        }),
      ).rejects.toThrow(
        'Invalid parameters: May not specify a depth if a derivation path is specified. The depth will be calculated from the path.',
      );
    });

    it('throws if both a derivation path and a key are specified', async () => {
      await expect(
        SLIP10Node.create({
          derivationPath: [
            defaultBip39NodeToken,
            BIP44PurposeNodeToken,
            `bip32:60'`,
          ],
          key: Buffer.alloc(64).fill(1) as any,
          curve: secp256k1,
        }),
      ).rejects.toThrow(
        'Invalid parameters: May not specify a derivation path if a key is specified. Initialize the node with just the parent key and its depth, then call node.derive() with your desired path.',
      );
    });

    it('throws if neither a derivation path nor a key is specified', async () => {
      await expect(
        // @ts-expect-error Missing key or derivation path
        SLIP10Node.create({ depth: 1, curve: secp256k1 }),
      ).rejects.toThrow(
        'Invalid parameters: Must specify either key or derivation path.',
      );
    });

    it('throws if the derivation path is empty', async () => {
      await expect(
        SLIP10Node.create({ derivationPath: [] as any, curve: secp256k1 }),
      ).rejects.toThrow(
        'Invalid derivation path: May not specify an empty derivation path.',
      );
    });

    it('throws if the derivation path is of depth 0 and not a single BIP-39 node', async () => {
      await expect(
        SLIP10Node.create({
          derivationPath: [`bip32:0'`] as any,
          curve: secp256k1,
        }),
      ).rejects.toThrow(
        'Invalid HD path segment: The segment must consist of a single BIP-39 node for depths of 0. Received: "bip32:0\'".',
      );
    });

    it('throws if the key is neither a string nor a buffer', async () => {
      await expect(
        SLIP10Node.create({ depth: 0, key: {} as any, curve: secp256k1 }),
      ).rejects.toThrow(
        'Invalid key: Must be a Buffer or string if specified. Received: "object"',
      );
    });

    it('throws if the key is an invalid Buffer', async () => {
      const invalidLengthBuffer = Buffer.alloc(63).fill(1);
      const zeroBuffer = Buffer.alloc(64);

      await expect(
        SLIP10Node.create({
          depth: 0,
          key: invalidLengthBuffer,
          curve: secp256k1,
        }),
      ).rejects.toThrow(
        'Invalid buffer key: Must be a 64-byte, non-empty Buffer.',
      );

      await expect(
        SLIP10Node.create({ depth: 0, key: zeroBuffer, curve: secp256k1 }),
      ).rejects.toThrow(
        'Invalid buffer key: Must be a 64-byte, non-empty Buffer.',
      );
    });

    it('throws if the key is an invalid string', async () => {
      const hexInputs = [
        Buffer.alloc(64).toString('hex'),
        Buffer.alloc(63).fill(1).toString('hex'),
      ];

      const inputs = [
        // Base64
        Buffer.alloc(64).toString('base64'),
        Buffer.alloc(63).fill(1).toString('base64'),

        // Hexadecimal
        ...hexInputs,
        ...hexInputs.map((input) => `0x${input}`),
      ];

      for (const input of inputs) {
        await expect(
          SLIP10Node.create({ depth: 0, key: input, curve: secp256k1 }),
        ).rejects.toThrow(
          'Invalid string key: Must be a 64-byte hexadecimal or Base64 string.',
        );
      }
    });

    it('throws an error if attempting to modify the fields of a node', async () => {
      const node: any = await SLIP10Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
        curve: secp256k1,
      });

      // getter
      expect(() => (node.key = 'foo')).toThrow(
        /^Cannot set property key of .+ which has only a getter/iu,
      );

      // frozen / readonly
      ['depth', 'keyBuffer'].forEach((property) => {
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
      await expect(SLIP10Node.create({})).rejects.toThrow(
        'Invalid curve: Must specify a curve.',
      );
    });

    it('throws an error for unsupported curves', async () => {
      await expect(
        // @ts-expect-error Invalid curve name for type
        SLIP10Node.create({ curve: { ...secp256k1, name: 'foo bar' } }),
      ).rejects.toThrow(
        'Invalid curve: Only the following curves are supported: secp256k1, ed25519.',
      );
    });
  });

  describe('derive', () => {
    it('derives a child node', async () => {
      const coinTypeNode = `bip32:40'`;
      const targetNode = await SLIP10Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          coinTypeNode,
        ],
        curve: secp256k1,
      });

      const node = await SLIP10Node.create({
        derivationPath: [defaultBip39NodeToken, BIP44PurposeNodeToken],
        curve: secp256k1,
      });

      const childNode = await node.derive([coinTypeNode]);

      expect(childNode).toMatchObject({
        depth: targetNode.depth,
        key: targetNode.key,
      });
    });

    it('throws if the child derivation path is zero', async () => {
      const node = await SLIP10Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:3'`,
          `bip32:0'`,
        ],
        curve: secp256k1,
      });

      await expect(node.derive([] as any)).rejects.toThrow(
        'Invalid HD tree derivation path: Deriving a path of length 0 is not defined',
      );
    });

    it('throws when trying to derive a unhardened node with ed25519', async () => {
      const node = await SLIP10Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:3'`,
          `bip32:0'`,
        ],
        curve: ed25519,
      });

      await expect(node.derive(['bip32:0'])).rejects.toThrow(
        'Invalid path: Cannot derive unhardened child keys with ed25519.',
      );
    });
  });

  describe('toJSON', () => {
    it('returns a JSON-compatible representation of the node', async () => {
      const node = await SLIP10Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
        curve: secp256k1,
      });

      expect(typeof node.key).toStrictEqual('string');
      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(2);

      const nodeJson = node.toJSON();
      expect(nodeJson).toStrictEqual({
        depth: node.depth,
        key: node.key,
      });

      expect(JSON.parse(JSON.stringify(nodeJson))).toStrictEqual({
        depth: node.depth,
        key: node.key,
      });
    });
  });
});
