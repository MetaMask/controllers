import {
  BIP39Node,
  BIP44PurposeNodeToken,
  CoinTypeHDPathString,
  HardenedBIP32Node,
  BIP44Depth,
} from './constants';
import { JsonBIP44Node, BIP44Node, BIP44NodeInterface } from './BIP44Node';
import {
  base64StringToBuffer,
  getBIP44CoinTypeToAddressPathTuple,
  getBIP44CoinTypePathString,
  isValidBase64StringKey,
  CoinTypeToAddressIndices,
  getHardenedBIP32NodeToken,
  getUnhardenedBIP32NodeToken,
  getBIP44ChangePathString,
  getBIP32NodeToken,
} from './utils';
import { secp256k1 } from './curves';
import { deriveChildNode } from './SLIP10Node';

export type CoinTypeHDPathTuple = [
  BIP39Node,
  typeof BIP44PurposeNodeToken,
  HardenedBIP32Node,
];
export const BIP_44_COIN_TYPE_DEPTH = 2;

export type JsonBIP44CoinTypeNode = JsonBIP44Node & {
  readonly coin_type: number;
  readonly path: CoinTypeHDPathString;
};

export type BIP44CoinTypeNodeInterface = BIP44NodeInterface & {
  readonly coin_type: number;
  readonly path: CoinTypeHDPathString;
};

/**
 * A wrapper object for BIP-44 `coin_type` keys. `coin_type` is the index
 * specifying the protocol for which deeper keys are intended. For the
 * authoritative list of coin types, please see
 * [SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md).
 *
 * Recall that a BIP-44 HD tree path consists of the following nodes:
 *
 * `m / 44' / coin_type' / account' / change / address_index`
 *
 * With the following depths:
 *
 * `0 / 1 / 2 / 3 / 4 / 5`
 *
 */
export class BIP44CoinTypeNode implements BIP44CoinTypeNodeInterface {
  /**
   * Constructs a BIP-44 `coin_type` node. `coin_type` is the index
   * specifying the protocol for which deeper keys are intended. For the
   * authoritative list of coin types, please see
   * [SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md).
   *
   * Recall that a BIP-44 HD tree path consists of the following nodes:
   *
   * `m / 44' / coin_type' / account' / change / address_index`
   *
   * With the following depths:
   *
   * `0 / 1 / 2 / 3 / 4 / 5`
   *
   * @param nodeOrPathTuple - The {@link BIP44Node} or derivation path for the
   * key of this `coin_type` node.
   * @param coin_type - The coin_type index of this node. Must be a non-negative
   * integer.
   */
  static async create(
    nodeOrPathTuple: CoinTypeHDPathTuple | BIP44Node | JsonBIP44Node,
    coin_type?: number,
  ): Promise<BIP44CoinTypeNode> {
    if (Array.isArray(nodeOrPathTuple)) {
      if (coin_type !== undefined) {
        throw new Error(
          'Invalid parameters: May not specify both coin type and a derivation path. The coin type will be computed from the derivation path.',
        );
      }

      validateCoinTypeNodeDepth(nodeOrPathTuple.length - 1);

      const node = await BIP44Node.create({
        derivationPath: nodeOrPathTuple,
      });

      // Split the bip32 string token and extract the coin_type index
      const coinType = Number.parseInt(
        nodeOrPathTuple[BIP_44_COIN_TYPE_DEPTH].split(':')[1].replace(`'`, ''),
        10,
      );

      return new BIP44CoinTypeNode(node, coinType);
    }

    validateCoinTypeNodeDepth(nodeOrPathTuple.depth);
    validateCoinTypeParentKey(nodeOrPathTuple.key);

    const keyBuffer =
      nodeOrPathTuple instanceof BIP44Node
        ? nodeOrPathTuple.keyBuffer
        : base64StringToBuffer(nodeOrPathTuple.key);

    if (
      typeof coin_type !== 'number' ||
      !Number.isInteger(coin_type) ||
      coin_type < 0
    ) {
      throw new Error(
        'Invalid coin type: The specified coin type must be a non-negative integer number.',
      );
    }

    const node =
      nodeOrPathTuple instanceof BIP44Node
        ? nodeOrPathTuple
        : await BIP44Node.create({
            depth: BIP_44_COIN_TYPE_DEPTH,
            key: keyBuffer,
          });

    return new BIP44CoinTypeNode(node, coin_type);
  }

  readonly #node: BIP44Node;

  public get depth(): BIP44Depth {
    return this.#node.depth;
  }

  public get key(): string {
    return this.#node.key;
  }

  public get keyBuffer(): Buffer {
    return this.#node.keyBuffer;
  }

  public readonly path: CoinTypeHDPathString;

  public readonly coin_type: number;

  private constructor(node: BIP44Node, coin_type: number) {
    this.#node = node;
    this.coin_type = coin_type;
    this.path = getBIP44CoinTypePathString(coin_type);

    Object.freeze(this);
  }

  /**
   * Derives a BIP-44 `address_index` key corresponding to the path of this
   * node and the specified `account`, `change`, and `address_index` values.
   * `address_index` keys are normally the keys used to generate user account
   * addresses.
   *
   * Recall that a BIP-44 HD tree path consists of the following nodes:
   *
   * `m / 44' / coin_type' / account' / change / address_index`
   *
   * With the following depths:
   *
   * `0 / 1 / 2 / 3 / 4 / 5`
   *
   * @param indices - The BIP-44 index values to use in key derivation.
   * @param indices.account - The `account` index. Default: `0`
   * @param indices.change - The `change` index. Default: `0`
   * @param indices.address_index - The `address_index` index.
   * @returns
   */
  async deriveBIP44AddressKey({
    account = 0,
    change = 0,
    address_index,
  }: CoinTypeToAddressIndices): Promise<Buffer> {
    const childKey = await this.#node.derive(
      getBIP44CoinTypeToAddressPathTuple({ account, change, address_index }),
    );

    return childKey.keyBuffer;
  }

  toJSON(): JsonBIP44CoinTypeNode {
    return {
      ...this.#node.toJSON(),
      coin_type: this.coin_type,
      path: this.path,
    };
  }
}

/**
 * Validates the depth of a `coin_type` node. Simply, ensures that it is the
 * number `2`. An error is thrown if validation fails.
 *
 * @param depth - The depth to validate.
 */
function validateCoinTypeNodeDepth(depth: number) {
  if (depth !== BIP_44_COIN_TYPE_DEPTH) {
    throw new Error(
      `Invalid depth: Coin type nodes must be of depth ${BIP_44_COIN_TYPE_DEPTH}. Received: "${depth}"`,
    );
  }
}

/**
 * Validates a `coin_type` Base64 string key. "Parent" is in the name because
 * it's also in the message that's thrown on validation failure.
 *
 * @param parentKey The `coin_type` key to validate.
 */
function validateCoinTypeParentKey(parentKey: string) {
  if (!isValidBase64StringKey(parentKey)) {
    throw new Error('Invalid parent key: Must be a non-zero 64-byte key.');
  }
}

/**
 * Derives a BIP-44 address key corresponding to the specified derivation path,
 * given either by a {@link BIP44CoinTypeNode} or derivation path tuple.
 *
 * Recall that a BIP-44 HD tree path consists of the following nodes:
 *
 * `m / 44' / coin_type' / account' / change / address_index`
 *
 * With the following depths:
 *
 * `0 / 1 / 2 / 3 / 4 / 5`
 *
 * @param parentKeyOrNode - The `coin_type` parent key to derive from.
 * @param indices - The `account`, `change`, and `address_index` used for
 * derivation.
 * @returns The derived `address_index` key for the specified derivation path.
 */
export async function deriveBIP44AddressKey(
  parentKeyOrNode: string | BIP44CoinTypeNode | JsonBIP44CoinTypeNode,
  { account = 0, change = 0, address_index }: CoinTypeToAddressIndices,
): Promise<Buffer> {
  if (typeof parentKeyOrNode === 'string') {
    validateCoinTypeParentKey(parentKeyOrNode);
  } else {
    validateCoinTypeNodeDepth(parentKeyOrNode.depth);
    validateCoinTypeParentKey(parentKeyOrNode.key);
  }

  let keyBuffer: Buffer;
  if (parentKeyOrNode instanceof BIP44CoinTypeNode) {
    keyBuffer = parentKeyOrNode.keyBuffer;
  } else {
    keyBuffer = base64StringToBuffer(
      typeof parentKeyOrNode === 'string'
        ? parentKeyOrNode
        : parentKeyOrNode.key,
    );
  }

  const childNode = await deriveChildNode(
    keyBuffer,
    BIP_44_COIN_TYPE_DEPTH,
    getBIP44CoinTypeToAddressPathTuple({ account, change, address_index }),
    secp256k1,
  );

  return childNode.key;
}

type BIP44AddressKeyDeriver = {
  /**
   * @param address_index - The `address_index` value.
   * @param isHardened - Whether the derived index is hardened.
   * @returns The key corresponding to the path of this deriver and the
   * specified `address_index` value.
   */
  (address_index: number, isHardened?: boolean): Promise<Buffer>;

  /**
   * A human-readable representation of the derivation path of this deriver
   * function, excluding the `address_index`, which is parameterized.
   *
   * Recall that a BIP-44 HD tree path consists of the following nodes:
   *
   * `m / 44' / coin_type' / account' / change / address_index`
   *
   * With the following depths:
   *
   * `0 / 1 / 2 / 3 / 4 / 5`
   */
  path: ReturnType<typeof getBIP44ChangePathString>;

  /**
   * The `coin_type` index of addresses derived by this deriver function.
   */
  coin_type: number;
};

/**
 * Creates a function that derives BIP-44 address keys corresponding to the
 * specified derivation path, given either by a {@link BIP44CoinTypeNode} or
 * derivation path tuple.
 *
 * Recall that a BIP-44 HD tree path consists of the following nodes:
 *
 * `m / 44' / coin_type' / account' / change / address_index`
 *
 * With the following depths:
 *
 * `0 / 1 / 2 / 3 / 4 / 5`
 *
 * @param node - The {@link BIP44CoinTypeNode} to derive address keys from.
 * This node contains a BIP-44 key of depth 2, `coin_type`.
 * @param accountAndChangeIndices - The `account` and `change` indices that
 * will be used to derive addresses.
 * @returns The deriver function for the derivation path specified by the
 * `coin_type` node, `account`, and `change` indices.
 */
export function getBIP44AddressKeyDeriver(
  node: BIP44CoinTypeNode | JsonBIP44CoinTypeNode,
  accountAndChangeIndices?: Omit<CoinTypeToAddressIndices, 'address_index'>,
) {
  const { account = 0, change = 0 } = accountAndChangeIndices || {};
  const { key, depth } = node;
  validateCoinTypeNodeDepth(depth);
  validateCoinTypeParentKey(key);

  const parentKeyBuffer =
    node instanceof BIP44CoinTypeNode
      ? node.keyBuffer
      : base64StringToBuffer(key);

  const accountNode = getHardenedBIP32NodeToken(account);
  const changeNode = getBIP32NodeToken(change);

  const bip44AddressKeyDeriver: BIP44AddressKeyDeriver = async (
    address_index: number,
    isHardened = false,
  ): Promise<Buffer> => {
    const childNode = await deriveChildNode(
      parentKeyBuffer,
      BIP_44_COIN_TYPE_DEPTH,
      [
        accountNode,
        changeNode,
        isHardened
          ? getHardenedBIP32NodeToken(address_index)
          : getUnhardenedBIP32NodeToken(address_index),
      ],
      secp256k1,
    );

    return childNode.key;
  };

  bip44AddressKeyDeriver.coin_type = node.coin_type;
  bip44AddressKeyDeriver.path = getBIP44ChangePathString(node.path, {
    account,
    change,
  });
  Object.freeze(bip44AddressKeyDeriver);
  return bip44AddressKeyDeriver;
}
