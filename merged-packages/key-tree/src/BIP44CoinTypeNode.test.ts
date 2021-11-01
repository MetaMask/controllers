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
  describe('constructor', () => {
    it('initializes a BIP44CoinTypeNode (derivation path)', () => {
      const node = new BIP44CoinTypeNode([
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

    it('initializes a BIP44CoinTypeNode (BIP44Node)', () => {
      const bip44Node = new BIP44Node({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      });

      const coinType = 60;
      const pathString = `m / bip32:44' / bip32:${coinType}'`;
      const node = new BIP44CoinTypeNode(bip44Node, coinType);

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

    it('initializes a BIP44CoinTypeNode (serialized BIP44Node)', () => {
      const bip44Node = new BIP44Node({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      });

      const coinType = 60;
      const pathString = `m / bip32:44' / bip32:${coinType}'`;
      const node = new BIP44CoinTypeNode(bip44Node.toJSON(), coinType);

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

    it('throws if both coin type and derivation path are specified', () => {
      expect(
        () =>
          new BIP44CoinTypeNode(
            [defaultBip39NodeToken, BIP44PurposeNodeToken, `bip32:60'`],
            60,
          ),
      ).toThrow(
        'Invalid parameters: May not specify both coin type and a derivation path. The coin type will be computed from the derivation path.',
      );
    });

    it('throws if derivation path has invalid depth', () => {
      [
        [defaultBip39NodeToken, BIP44PurposeNodeToken],
        [defaultBip39NodeToken, BIP44PurposeNodeToken, `bip32:60'`, `bip32:0'`],
      ].forEach((invalidDerivationPath) => {
        expect(
          () => new BIP44CoinTypeNode(invalidDerivationPath as any),
        ).toThrow(
          `Invalid depth: Coin type nodes must be of depth ${BIP_44_COIN_TYPE_DEPTH}. Received: "${
            invalidDerivationPath.length - 1
          }"`,
        );
      });
    });

    it('throws if node has invalid depth', () => {
      const arbitraryCoinType = 78;

      [
        { key: 'foo', depth: 1 },
        { key: 'foo', depth: 3 },
      ].forEach((invalidNode) => {
        expect(
          () => new BIP44CoinTypeNode(invalidNode as any, arbitraryCoinType),
        ).toThrow(
          `Invalid depth: Coin type nodes must be of depth ${BIP_44_COIN_TYPE_DEPTH}. Received: "${invalidNode.depth}"`,
        );
      });
    });

    it('throws if node has invalid key', () => {
      const arbitraryCoinType = 78;

      [
        { key: 'foo', depth: 2 },
        { key: 1, depth: 2 },
        { key: Buffer.allocUnsafe(64).fill(1).toString('hex'), depth: 2 },
        { key: Buffer.allocUnsafe(63).fill(1).toString('base64'), depth: 2 },
        { key: Buffer.alloc(64).toString('base64'), depth: 2 },
      ].forEach((invalidNode) => {
        expect(
          () => new BIP44CoinTypeNode(invalidNode as any, arbitraryCoinType),
        ).toThrow('Invalid parent key: Must be a non-zero 64-byte key.');
      });
    });

    it('throws if coin type is invalid', () => {
      const jsonNode = new BIP44Node({
        derivationPath: [
          defaultBip39NodeToken,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ],
      }).toJSON();

      ['60', 1.1, -1, {}].forEach((invalidCoinType) => {
        expect(
          () => new BIP44CoinTypeNode(jsonNode, invalidCoinType as any),
        ).toThrow(
          'Invalid coin type: The specified coin type must be a non-negative integer number.',
        );
      });
    });
  });

  describe('deriveBIP44AddressKey', () => {
    const coinTypePath = [
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:60'`,
    ] as const;

    it('derives an address_index key (default inputs)', () => {
      const expectedKey = new BIP44Node({
        derivationPath: [...coinTypePath, `bip32:0'`, `bip32:0`, `bip32:0`],
      }).key;

      const coinTypeNode = new BIP44CoinTypeNode([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        coinTypeNode
          .deriveBIP44AddressKey({ address_index: 0 })
          .toString('base64'),
      ).toStrictEqual(expectedKey);
    });

    it('derives an address_index key (default inputs, different address_index)', () => {
      const expectedKey = new BIP44Node({
        derivationPath: [...coinTypePath, `bip32:0'`, `bip32:0`, `bip32:99`],
      }).key;

      const coinTypeNode = new BIP44CoinTypeNode([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        coinTypeNode
          .deriveBIP44AddressKey({ address_index: 99 })
          .toString('base64'),
      ).toStrictEqual(expectedKey);
    });

    it('derives an address_index key (non-default account value)', () => {
      const expectedKey = new BIP44Node({
        derivationPath: [...coinTypePath, `bip32:4'`, `bip32:0`, `bip32:0`],
      }).key;

      const coinTypeNode = new BIP44CoinTypeNode([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        coinTypeNode
          .deriveBIP44AddressKey({ account: 4, address_index: 0 })
          .toString('base64'),
      ).toStrictEqual(expectedKey);
    });

    it('derives an address_index key (non-default change value)', () => {
      const expectedKey = new BIP44Node({
        derivationPath: [...coinTypePath, `bip32:0'`, `bip32:3`, `bip32:0`],
      }).key;

      const coinTypeNode = new BIP44CoinTypeNode([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        coinTypeNode
          .deriveBIP44AddressKey({ change: 3, address_index: 0 })
          .toString('base64'),
      ).toStrictEqual(expectedKey);
    });

    it('derives an address_index key (non-default account and change values)', () => {
      const expectedKey = new BIP44Node({
        derivationPath: [...coinTypePath, `bip32:4'`, `bip32:3`, `bip32:0`],
      }).key;

      const coinTypeNode = new BIP44CoinTypeNode([
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:60'`,
      ]);

      expect(
        coinTypeNode
          .deriveBIP44AddressKey({
            account: 4,
            change: 3,
            address_index: 0,
          })
          .toString('base64'),
      ).toStrictEqual(expectedKey);
    });
  });

  describe('toJSON', () => {
    it('returns a JSON-compatible representation of the node', () => {
      const coinType = 60;
      const node = new BIP44CoinTypeNode([
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
  it('derives a BIP-44 address key (default inputs)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    }).key;

    expect(
      deriveBIP44AddressKey(parentNode, { address_index: 0 }).toString(
        'base64',
      ),
    ).toStrictEqual(expectedKey);
  });

  it('derives an address_index key (default inputs, different address_index)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:3333`,
      ],
    }).key;

    expect(
      deriveBIP44AddressKey(parentNode, { address_index: 3333 }).toString(
        'base64',
      ),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (non-default account value)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:3'`,
        `bip32:0`,
        `bip32:0`,
      ],
    }).key;

    expect(
      deriveBIP44AddressKey(parentNode, {
        account: 3,
        address_index: 0,
      }).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (non-default change value)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:9`,
        `bip32:0`,
      ],
    }).key;

    expect(
      deriveBIP44AddressKey(parentNode, {
        change: 9,
        address_index: 0,
      }).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (non-default account and change values)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:3'`,
        `bip32:9`,
        `bip32:0`,
      ],
    }).key;

    expect(
      deriveBIP44AddressKey(parentNode, {
        account: 3,
        change: 9,
        address_index: 0,
      }).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (JSON node)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]).toJSON();

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    }).key;

    expect(
      deriveBIP44AddressKey(parentNode, { address_index: 0 }).toString(
        'base64',
      ),
    ).toStrictEqual(expectedKey);
  });

  it('derives a BIP-44 address key (string key)', () => {
    const coinType = 60;
    const parentKey = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]).key;

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    }).key;

    expect(
      deriveBIP44AddressKey(parentKey, { address_index: 0 }).toString('base64'),
    ).toStrictEqual(expectedKey);
  });

  it('throws if a node value is invalid', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    [
      {},
      { account: -1 },
      { change: 1.1 },
      { address_index: 'foo' },
      { account: NaN },
      { account: null },
      { account: {} },
    ].forEach((invalidInput) => {
      expect(() =>
        deriveBIP44AddressKey(parentNode, invalidInput as any),
      ).toThrow(`Invalid BIP-32 index: Must be a non-negative integer.`);
    });
  });
});

describe('getBIP44AddressKeyDeriver', () => {
  it('returns the expected BIP-44 address key deriver function (default inputs)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    }).key;

    expect(deriver(0).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (different coin_type)', () => {
    const coinType = 8129837;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    }).key;

    expect(deriver(0).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (default inputs, different address_index)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:9873`,
      ],
    }).key;

    expect(deriver(9873).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (non-default account value)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:46' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode, { account: 46 });
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:46'`,
        `bip32:0`,
        `bip32:0`,
      ],
    }).key;

    expect(deriver(0).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (non-default change value)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:2`;

    const deriver = getBIP44AddressKeyDeriver(parentNode, { change: 2 });
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:2`,
        `bip32:0`,
      ],
    }).key;

    expect(deriver(0).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (non-default account and change values)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
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

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:46'`,
        `bip32:2`,
        `bip32:0`,
      ],
    }).key;

    expect(deriver(0).toString('base64')).toStrictEqual(expectedKey);
  });

  it('returns the expected BIP-44 address key deriver function (JSON node)', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]).toJSON();
    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    const expectedKey = new BIP44Node({
      derivationPath: [
        defaultBip39NodeToken,
        BIP44PurposeNodeToken,
        `bip32:${coinType}'`,
        `bip32:0'`,
        `bip32:0`,
        `bip32:0`,
      ],
    }).key;

    expect(deriver(0).toString('base64')).toStrictEqual(expectedKey);
  });

  it('throws if a node value is invalid', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
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

  it('deriver throws if address_index value is invalid', () => {
    const coinType = 60;
    const parentNode = new BIP44CoinTypeNode([
      defaultBip39NodeToken,
      BIP44PurposeNodeToken,
      `bip32:${coinType}'`,
    ]);

    const expectedPath = `m / bip32:44' / bip32:${coinType}' / bip32:0' / bip32:0`;

    const deriver = getBIP44AddressKeyDeriver(parentNode);
    expect(deriver.coin_type).toStrictEqual(coinType);
    expect(deriver.path).toStrictEqual(expectedPath);

    [
      {},
      { address_index: -1 },
      { address_index: 1.1 },
      { address_index: NaN },
      { address_index: null },
      { address_index: {} },
    ].forEach((invalidInput) => {
      expect(() => deriver(invalidInput as any)).toThrow(
        `Invalid BIP-32 index: Must be a non-negative integer.`,
      );
    });
  });
});
