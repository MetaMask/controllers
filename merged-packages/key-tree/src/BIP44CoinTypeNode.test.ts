import fixtures from '../test/fixtures';
import {
  BIP_44_COIN_TYPE_DEPTH,
  BIP44Node,
  BIP44CoinTypeNode,
  BIP44PurposeNodeToken,
  deriveBIP44AddressKey,
  getBIP44AddressKeyDeriver,
} from '.';

const defaultBip39NodeToken = `bip39:${fixtures.local.mnemonic}` as const;

describe('BIP44CoinTypeNode', () => {
  describe('create', () => {
    it('initializes a BIP44CoinTypeNode (derivation path)', async () => {
      const node = await BIP44CoinTypeNode.create([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);
      const coinType = 60;
      const pathString = `m / bip32:44' / bip32:${coinType}'`;

      expect(node.coin_type).toStrictEqual(coinType);
      expect(node.depth).toStrictEqual(2);
      expect(node.key).toHaveLength(88);
      expect(node.keyBuffer.toString('base64')).toStrictEqual(node.key);
      expect(node.path).toStrictEqual(pathString);

      expect(node.toJSON()).toStrictEqual({
        coin_type: coinType,
        depth: 2,
        key: node.key,
        path: pathString,
      });
    });

    it('initializes a BIP44CoinTypeNode (BIP44Node)', async () => {
      const bip44Node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      });

      const coinType = 60;
      const pathString = `m / bip32:44' / bip32:${coinType}'`;
      const node = await BIP44CoinTypeNode.create(bip44Node, coinType);

      expect(node.coin_type).toStrictEqual(coinType);
      expect(node.depth).toStrictEqual(2);
      expect(node.key).toHaveLength(88);
      expect(node.keyBuffer.toString('base64')).toStrictEqual(node.key);
      expect(node.path).toStrictEqual(pathString);

      expect(node.toJSON()).toStrictEqual({
        coin_type: coinType,
        depth: 2,
        key: node.key,
        path: pathString,
      });
    });

    it('initializes a BIP44CoinTypeNode (serialized BIP44Node)', async () => {
      const bip44Node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      });

      const coinType = 60;
      const pathString = `m / bip32:44' / bip32:${coinType}'`;
      const node = await BIP44CoinTypeNode.create(bip44Node.toJSON(), coinType);

      expect(node.coin_type).toStrictEqual(coinType);
      expect(node.depth).toStrictEqual(2);
      expect(node.key).toHaveLength(88);
      expect(node.keyBuffer.toString('base64')).toStrictEqual(node.key);
      expect(node.path).toStrictEqual(pathString);

      expect(node.toJSON()).toStrictEqual({
        coin_type: coinType,
        depth: 2,
        key: node.key,
        path: pathString,
      });
    });

    it('throws if both coin type and derivation path are specified', async () => {
      await expect(
        BIP44CoinTypeNode.create(
          [defaultBip39NodeToken, BIP44PurposeNodeToken, `bip32:60'`],
          60,
        ),
      ).rejects.toThrow(
        'Invalid parameters: May not specify both coin type and a derivation path. The coin type will be computed from the derivation path.',
      );
    });

    it('throws if derivation path has invalid depth', async () => {
      await expect(
        BIP44CoinTypeNode.create([
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
        ] as any),
      ).rejects.toThrow(
        `Invalid depth: Coin type nodes must be of depth ${BIP_44_COIN_TYPE_DEPTH}. Received: "1"`,
      );

      await expect(
        BIP44CoinTypeNode.create([
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
          `bip32:0'`,
        ] as any),
      ).rejects.toThrow(
        `Invalid depth: Coin type nodes must be of depth ${BIP_44_COIN_TYPE_DEPTH}. Received: "3"`,
      );
    });

    it('throws if node has invalid depth', async () => {
      const arbitraryCoinType = 78;

      await expect(
        BIP44CoinTypeNode.create(
          { key: 'foo', depth: 1 } as any,
          arbitraryCoinType,
        ),
      ).rejects.toThrow(
        `Invalid depth: Coin type nodes must be of depth ${BIP_44_COIN_TYPE_DEPTH}. Received: "1"`,
      );

      await expect(
        BIP44CoinTypeNode.create(
          { key: 'foo', depth: 3 } as any,
          arbitraryCoinType,
        ),
      ).rejects.toThrow(
        `Invalid depth: Coin type nodes must be of depth ${BIP_44_COIN_TYPE_DEPTH}. Received: "3"`,
      );
    });

    it('throws if node has invalid key', async () => {
      const arbitraryCoinType = 78;
      const inputs = [
        { key: 'foo', depth: 2 },
        { key: 1, depth: 2 },
        { key: Buffer.allocUnsafe(64).fill(1).toString('hex'), depth: 2 },
        { key: Buffer.allocUnsafe(63).fill(1).toString('base64'), depth: 2 },
        { key: Buffer.alloc(64).toString('base64'), depth: 2 },
      ];

      for (const input of inputs) {
        await expect(
          BIP44CoinTypeNode.create(input as any, arbitraryCoinType),
        ).rejects.toThrow(
          'Invalid parent key: Must be a non-zero 64-byte key.',
        );
      }
    });

    it('throws if coin type is invalid', async () => {
      const node = await BIP44Node.create({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      });
      const jsonNode = node.toJSON();

      const inputs = ['60', 1.1, -1, {}];

      for (const input of inputs) {
        await expect(
          BIP44CoinTypeNode.create(jsonNode, input as any),
        ).rejects.toThrow(
          'Invalid coin type: The specified coin type must be a non-negative integer number.',
        );
      }
    });
  });

  describe('deriveBIP44AddressKey', () => {
    const coinTypePath = [
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:60'`,
    ] as const;

    it('derives an address_index key (default inputs)', async () => {
      const node = await BIP44Node.create({
        derivationPath: [...coinTypePath, `bip32:0'`, `bip32:0`, `bip32:0`],
      });
      const expectedKey = node.key;

      const coinTypeNode = await BIP44CoinTypeNode.create([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        (
          await coinTypeNode.deriveBIP44AddressKey({ address_index: 0 })
        ).toString('base64'),
      ).toStrictEqual(expectedKey);
    });

    it('derives an address_index key (default inputs, different address_index)', async () => {
      const node = await BIP44Node.create({
        derivationPath: [...coinTypePath, `bip32:0'`, `bip32:0`, `bip32:99`],
      });
      const expectedKey = node.key;

      const coinTypeNode = await BIP44CoinTypeNode.create([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        (
          await coinTypeNode.deriveBIP44AddressKey({ address_index: 99 })
        ).toString('base64'),
      ).toStrictEqual(expectedKey);
    });

    it('derives an address_index key (non-default account value)', async () => {
      const node = await BIP44Node.create({
        derivationPath: [...coinTypePath, `bip32:4'`, `bip32:0`, `bip32:0`],
      });
      const expectedKey = node.key;

      const coinTypeNode = await BIP44CoinTypeNode.create([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        (
          await coinTypeNode.deriveBIP44AddressKey({
            account: 4,
            address_index: 0,
          })
        ).toString('base64'),
      ).toStrictEqual(expectedKey);
    });

    it('derives an address_index key (non-default change value)', async () => {
      const node = await BIP44Node.create({
        derivationPath: [...coinTypePath, `bip32:0'`, `bip32:3`, `bip32:0`],
      });
      const expectedKey = node.key;

      const coinTypeNode = await BIP44CoinTypeNode.create([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        (
          await coinTypeNode.deriveBIP44AddressKey({
            change: 3,
            address_index: 0,
          })
        ).toString('base64'),
      ).toStrictEqual(expectedKey);
    });

    it('derives an address_index key (non-default account and change values)', async () => {
      const node = await BIP44Node.create({
        derivationPath: [...coinTypePath, `bip32:4'`, `bip32:3`, `bip32:0`],
      });
      const expectedKey = node.key;

      const coinTypeNode = await BIP44CoinTypeNode.create([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        (
          await coinTypeNode.deriveBIP44AddressKey({
            account: 4,
            change: 3,
            address_index: 0,
          })
        ).toString('base64'),
      ).toStrictEqual(expectedKey);
    });
  });

  describe('toJSON', () => {
    it('returns a JSON-compatible representation of the node', async () => {
      const coinType = 60;
      const node = await BIP44CoinTypeNode.create([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
      ]);
      const pathString = `m / bip32:44' / bip32:${coinType}'`;

      expect(node.coin_type).toStrictEqual(coinType);
      expect(node.depth).toStrictEqual(2);
      expect(typeof node.key).toStrictEqual('string');
      expect(node.key).toHaveLength(88);
      expect(node.keyBuffer.toString('base64')).toStrictEqual(node.key);
      expect(node.path).toStrictEqual(pathString);

      const nodeJson = node.toJSON();
      expect(nodeJson).toStrictEqual({
        coin_type: coinType,
        depth: 2,
        key: node.key,
        path: pathString,
      });

      expect(JSON.parse(JSON.stringify(nodeJson))).toStrictEqual({
        coin_type: coinType,
        depth: 2,
        key: node.key,
        path: pathString,
      });
    });
  });
});

describe('deriveBIP44AddressKey', () => {
  it('derives a BIP-44 address key (default inputs)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect(
      (await deriveBIP44AddressKey(parentNode, { address_index: 0 })).toString(
        'base64',
      ),
    ).toStrictEqual(expectedKey);
  });

  it('derives an address_index key (default inputs, different address_index)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:3333`,
      ],
    });
    const expectedKey = node.key;

    expect(
      (
        await deriveBIP44AddressKey(parentNode, { address_index: 3333 })
      ).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives an address_index key (default inputs, object address_index)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:3333`,
      ],
    });
    const expectedKey = node.key;

    expect(
      (
        await deriveBIP44AddressKey(parentNode, {
          address_index: {
            index: 3333,
            hardened: false,
          },
        })
      ).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives an address_index key (default inputs, hardened address_index)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:3333'`,
      ],
    });
    const expectedKey = node.key;

    expect(
      (
        await deriveBIP44AddressKey(parentNode, {
          address_index: {
            index: 3333,
            hardened: true,
          },
        })
      ).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (non-default account value)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:3'`,
        `bip32:0`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect(
      (
        await deriveBIP44AddressKey(parentNode, {
          account: 3,
          address_index: 0,
        })
      ).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (non-default change value)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:9`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect(
      (
        await deriveBIP44AddressKey(parentNode, {
          change: 9,
          address_index: 0,
        })
      ).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (non-default account and change values)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:3'`,
        `bip32:9`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect(
      (
        await deriveBIP44AddressKey(parentNode, {
          account: 3,
          change: 9,
          address_index: 0,
        })
      ).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (JSON node)', async () => {
    const coinType = 60;
    const node = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const parentNode = node.toJSON();

    const expectedNode = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    });
    const expectedKey = expectedNode.key;

    expect(
      (await deriveBIP44AddressKey(parentNode, { address_index: 0 })).toString(
        'base64',
      ),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (string key)', async () => {
    const coinType = 60;
    const node = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const parentKey = node.key;

    const expectedNode = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    });
    const expectedKey = expectedNode.key;

    expect(
      (await deriveBIP44AddressKey(parentKey, { address_index: 0 })).toString(
        'base64',
      ),
    ).toStrictEqual(expectedKey);
  });

  it('throws if a node value is invalid', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const inputs = [
      { account: -1 },
      { change: 1.1 },
      { account: NaN },
      { account: null },
      { account: {} },
    ];

    for (const input of inputs) {
      await expect(
        deriveBIP44AddressKey(parentNode, input as any),
      ).rejects.toThrow(
        `Invalid BIP-32 index: Must be a non-negative integer.`,
      );
    }
  });

  it('throws if the change or address_index value is invalid', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const inputs = [
      {},
      { change: {} },
      { change: null },
      { change: undefined },
      { address_index: {} },
      { address_index: 'foo' },
      { address_index: { index: 1 } },
      { address_index: { index: 1.1, hardened: true } },
      { address_index: { hardened: true } },
      { address_index: { index: 1, hardened: 'foo' } },
    ];

    for (const input of inputs) {
      await expect(
        deriveBIP44AddressKey(parentNode, input as any),
      ).rejects.toThrow(
        `Invalid BIP-32 index: Must be an object containing the index and whether it is hardened.`,
      );
    }
  });
});

describe('getBIP44AddressKeyDeriver', () => {
  it('returns the expected BIP-44 address key deriver function (default inputs)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(0)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function and derives a hardened index (default inputs)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0'`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(0, true)).toString('base64')).toStrictEqual(
      expectedKey,
    );
  });

  it('returns the expected BIP-44 address key deriver function and derives a hardened index (default inputs, different address_index)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:9873'`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(9873, true)).toString('base64')).toStrictEqual(
      expectedKey,
    );
  });

  it('returns the expected BIP-44 address key deriver function (different coin_type)', async () => {
    const coinType = 8129837;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(0)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (default inputs, different address_index)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:9873`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(9873)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (non-default account value)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:46' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode, { account: 46 });
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:46'`,
        `bip32:0`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(0)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (non-default change value)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:2`;

    const deriver = getBIP44AddressKeyDeriver(parentNode, { change: 2 });
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:2`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(0)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (object change value)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:2`;

    const deriver = getBIP44AddressKeyDeriver(parentNode, {
      change: {
        index: 2,
        hardened: false,
      },
    });
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:2`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(0)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (hardened change value)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:2'`;

    const deriver = getBIP44AddressKeyDeriver(parentNode, {
      change: {
        index: 2,
        hardened: true,
      },
    });
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:2'`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(0)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (non-default account and change values)', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:46' / bip32:2`;

    const deriver = getBIP44AddressKeyDeriver(parentNode, {
      account: 46,
      change: 2,
    });
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const node = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:46'`,
        `bip32:2`,
        `bip32:0`,
      ],
    });
    const expectedKey = node.key;

    expect((await deriver(0)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (JSON node)', async () => {
    const coinType = 60;
    const node = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const parentNode = node.toJSON();
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const expectedNode = await BIP44Node.create({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    });
    const expectedKey = expectedNode.key;

    expect((await deriver(0)).toString('base64')).toStrictEqual(expectedKey);
  });

  it('throws if a node value is invalid', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    [
      { account: -1 },
      { change: 1.1 },
      { account: NaN },
      { account: null },
      { account: {} },
    ].forEach((invalidInput) => {
      expect(() =>
        getBIP44AddressKeyDeriver(parentNode, invalidInput as any),
      ).toThrow(`Invalid BIP-32 index: Must be a non-negative integer.`);
    });
  });

  it('deriver throws if address_index value is invalid', async () => {
    const coinType = 60;
    const parentNode = await BIP44CoinTypeNode.create([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const inputs = [
      {},
      { address_index: -1 },
      { address_index: 1.1 },
      { address_index: NaN },
      { address_index: null },
      { address_index: {} },
    ];

    for (const input of inputs) {
      await expect(deriver(input as any)).rejects.toThrow(
        `Invalid BIP-32 index: Must be a non-negative integer.`,
      );
    }
  });
});
