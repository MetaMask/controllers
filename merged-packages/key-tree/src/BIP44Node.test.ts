import fixtures from '../test/fixtures';
import { BIP44Node, BIP44PurposeNodeToken } from '.';

const defaultBip39NodeToken = `bip39:${fixtures.local.mnemonic}` as const;

describe('BIP44Node', () => {
  describe('create', () => {
    it('initializes a new node (depth, derivationPath)', async () => {
      // Ethereum coin type node
      const node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(2);
      expect(node.toJSON()).toStrictEqual({
        depth: 2,
        key: node.key,
      });
    });

    it('initializes a new node (depth, buffer key)', async () => {
      const node = await BIP44Node.create({
        depth: 1,
        key: Buffer.alloc(64).fill(1),
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(1);
      expect(node.toJSON()).toStrictEqual({
        depth: 1,
        key: node.key,
      });
    });

    it('initializes a new node (depth, Base64 string key)', async () => {
      const node = await BIP44Node.create({
        depth: 3,
        key: Buffer.alloc(64).fill(2).toString('base64'),
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(3);
      expect(node.toJSON()).toStrictEqual({
        depth: 3,
        key: node.key,
      });
    });

    it('initializes a new node (depth, hex string key)', async () => {
      const node = await BIP44Node.create({
        depth: 3,
        key: Buffer.alloc(64).fill(2).toString('hex'),
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(3);
      expect(node.toJSON()).toStrictEqual({
        depth: 3,
        key: node.key,
      });
    });

    it('initializes a new node (depth, 0x-prefixed hex string key)', async () => {
      const node = await BIP44Node.create({
        depth: 3,
        key: `0x${Buffer.alloc(64).fill(2).toString('hex')}`,
      });

      expect(node.key).toHaveLength(88);
      expect(node.depth).toStrictEqual(3);
      expect(node.toJSON()).toStrictEqual({
        depth: 3,
        key: node.key,
      });
    });

    it('throws an error if attempting to modify the fields of a node', async () => {
      const node: any = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      });

      // getter
      ['key', 'depth', 'keyBuffer'].forEach((property) => {
        expect(() => (node[property] = Buffer.allocUnsafe(64).fill(1))).toThrow(
          expect.objectContaining({
            name: 'TypeError',
            message: expect.stringMatching(
              /^Cannot set property .+ of .+ which has only a getter/iu,
            ),
          }),
        );
      });
    });

    it('throws if the depth is invalid', async () => {
      const validBufferKey = Buffer.alloc(64).fill(1);

      await expect(
        BIP44Node.create({
          depth: 6,
          key: validBufferKey,
        }),
      ).rejects.toThrow(
        `Invalid HD tree path depth: The depth must be a positive integer N such that 0 <= N <= 5. Received: "6"`,
      );
    });

    it('throws if both a derivation path and a depth are specified', async () => {
      await expect(
        BIP44Node.create({
          depth: 2, // This is the correct depth, but it's still forbidden
          derivationPath: [
            defaultBip39NodeToken,
            BIP44PurposeNodeToken,
            `bip32:60'`,
          ],
        }),
      ).rejects.toThrow(
        'Invalid parameters: May not specify a depth if a derivation path is specified. The depth will be calculated from the path.',
      );
    });

    it('throws if neither a derivation path nor a key is specified', async () => {
      await expect(BIP44Node.create({ depth: 1 })).rejects.toThrow(
        'Invalid parameters: Must specify either key or derivation path.',
      );
    });

    it('throws if both a derivation path and a key are specified', async () => {
      await expect(
        BIP44Node.create({
          depth: 1,
          derivationPath: [defaultBip39NodeToken],
          key: Buffer.alloc(64).fill(1),
        }),
      ).rejects.toThrow(
        'Invalid parameters: May not specify a derivation path if a key is specified. Initialize the node with just the parent key and its depth, then call node.derive() with your desired path.',
      );
    });

    it('throws if the derivation path is of depth 0 and not a single BIP-39 node', async () => {
      await expect(
        BIP44Node.create({ derivationPath: [`bip32:0'`] as any }),
      ).rejects.toThrow(
        'Invalid derivation path: The "m" / seed node (depth 0) must be a BIP-39 node.',
      );
    });

    it('throws if the depth 1 node of the derivation path is not the BIP-44 purpose node', async () => {
      await expect(
        BIP44Node.create({
          derivationPath: [defaultBip39NodeToken, `bip32:43'`] as any,
        }),
      ).rejects.toThrow(
        `Invalid derivation path: The "purpose" node (depth 1) must be the string "${BIP44PurposeNodeToken}".`,
      );
    });

    it('throws if the depth 2 node of the derivation path is not a hardened BIP-32 node', async () => {
      await expect(
        BIP44Node.create({
          derivationPath: [
            defaultBip39NodeToken,
            BIP44PurposeNodeToken,
            `bip32:60`,
          ] as any,
        }),
      ).rejects.toThrow(
        'Invalid derivation path: The "coin_type" node (depth 2) must be a hardened BIP-32 node.',
      );
    });

    it('throws if the depth 3 node of the derivation path is not a hardened BIP-32 node', async () => {
      await expect(
        BIP44Node.create({
          derivationPath: [
            defaultBip39NodeToken,
            BIP44PurposeNodeToken,
            `bip32:60'`,
            `bip32:0`,
          ] as any,
        }),
      ).rejects.toThrow(
        'Invalid derivation path: The "account" node (depth 3) must be a hardened BIP-32 node.',
      );
    });

    it('throws if the depth 4 node of the derivation path is not a BIP-32 node', async () => {
      await expect(
        BIP44Node.create({
          derivationPath: [
            defaultBip39NodeToken,
            BIP44PurposeNodeToken,
            `bip32:60'`,
            `bip32:0'`,
            `bip32:-1`,
          ],
        }),
      ).rejects.toThrow(
        'Invalid derivation path: The "change" node (depth 4) must be a BIP-32 node.',
      );
    });

    it('throws if the depth 5 node of the derivation path is not a BIP-32 node', async () => {
      await expect(
        BIP44Node.create({
          derivationPath: [
            defaultBip39NodeToken,
            BIP44PurposeNodeToken,
            `bip32:60'`,
            `bip32:0'`,
            `bip32:0`,
            `bip32:-1`,
          ],
        }),
      ).rejects.toThrow(
        'Invalid derivation path: The "address_index" node (depth 5) must be a BIP-32 node.',
      );
    });

    it('throws if the key is neither a string nor a buffer', async () => {
      await expect(
        BIP44Node.create({ depth: 0, key: {} as any }),
      ).rejects.toThrow(
        'Invalid key: Must be a Buffer or string if specified. Received: "object"',
      );
    });

    it('throws if the key is an invalid Buffer', async () => {
      const invalidLengthBuffer = Buffer.alloc(63).fill(1);
      const zeroBuffer = Buffer.alloc(64);

      await expect(
        BIP44Node.create({ depth: 0, key: invalidLengthBuffer }),
      ).rejects.toThrow(
        'Invalid buffer key: Must be a 64-byte, non-empty Buffer.',
      );

      await expect(
        BIP44Node.create({ depth: 0, key: zeroBuffer }),
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
          BIP44Node.create({ depth: 0, key: input }),
        ).rejects.toThrow(
          'Invalid string key: Must be a 64-byte hexadecimal or Base64 string.',
        );
      }
    });
  });

  describe('derive', () => {
    it('derives a child node', async () => {
      const coinTypeNode = `bip32:40'`;
      const targetNode = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          coinTypeNode,
        ],
      });

      const node = await BIP44Node.create({
        derivationPath: [defaultBip39NodeToken, BIP44PurposeNodeToken],
      });

      const childNode = await node.derive([coinTypeNode]);

      expect(childNode).toMatchObject({
        depth: targetNode.depth,
        key: targetNode.key,
      });
    });

    it('throws if the parent node is already a leaf node', async () => {
      const node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:3'`,
          `bip32:0'`,
          `bip32:0`,
          `bip32:0`,
        ],
      });

      await expect(node.derive([`bip32:1`])).rejects.toThrow(
        'Illegal operation: This HD tree node is already a leaf node.',
      );
    });

    it('throws if the child derivation path is zero', async () => {
      const node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:3'`,
          `bip32:0'`,
        ],
      });

      await expect(node.derive([] as any)).rejects.toThrow(
        'Invalid HD tree derivation path: Deriving a path of length 0 is not defined',
      );
    });

    it('throws if the depth 1 node of the derivation path is not the BIP-44 purpose node', async () => {
      const node = await BIP44Node.create({
        derivationPath: [defaultBip39NodeToken],
      });

      await expect(node.derive([`bip32:43'`])).rejects.toThrow(
        `Invalid derivation path: The "purpose" node (depth 1) must be the string "${BIP44PurposeNodeToken}".`,
      );
    });

    it('throws if the depth 2 node of the derivation path is not a hardened BIP-32 node', async () => {
      const node = await BIP44Node.create({
        derivationPath: [defaultBip39NodeToken, BIP44PurposeNodeToken],
      });

      await expect(node.derive([`bip32:60`])).rejects.toThrow(
        'Invalid derivation path: The "coin_type" node (depth 2) must be a hardened BIP-32 node.',
      );
    });

    it('throws if the depth 3 node of the derivation path is not a hardened BIP-32 node', async () => {
      const node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      });

      await expect(node.derive([`bip32:0`])).rejects.toThrow(
        'Invalid derivation path: The "account" node (depth 3) must be a hardened BIP-32 node.',
      );
    });

    it('throws if the depth 4 node of the derivation path is not a BIP-32 node', async () => {
      const node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
          `bip32:0'`,
        ],
      });

      await expect(node.derive([`bip32:-1'`])).rejects.toThrow(
        'Invalid derivation path: The "change" node (depth 4) must be a BIP-32 node.',
      );
    });

    it('throws if the depth 5 node of the derivation path is not a BIP-32 node', async () => {
      const node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
          `bip32:0'`,
          `bip32:0`,
        ],
      });

      await expect(node.derive([`bip32:-1`])).rejects.toThrow(
        'Invalid derivation path: The "address_index" node (depth 5) must be a BIP-32 node.',
      );
    });
  });

  describe('toJSON', () => {
    it('returns a JSON-compatible representation of the node', async () => {
      const node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
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
