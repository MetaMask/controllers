import {
  BIP39Node,
  BIP44Depth,
  BIP44PurposeNodeToken,
  CoinTypeHDPathString,
  HardenedBIP32Node,
} from './constants';
import { BIP44Node, BIP44NodeInterface, JsonBIP44Node } from './BIP44Node';
import {
  CoinTypeToAddressIndices,
  getBIP32NodeToken,
  getBIP44ChangePathString,
  getBIP44CoinTypePathString,
  getBIP44CoinTypeToAddressPathTuple,
  getHardenedBIP32NodeToken,
  getUnhardenedBIP32NodeToken,
  hexStringToBuffer,
  nullableHexStringToBuffer,
} from './utils';
import { secp256k1 } from './curves';
import { ChildNode, deriveChildNode } from './SLIP10Node';

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
   * @param json - The {@link JsonBIP44Node} for the key of this node.
   * @param coin_type - The coin_type index of this node. Must be a non-negative
   * integer.
   */
  static async fromJSON(json: JsonBIP44Node, coin_type: number) {
    validateCoinType(coin_type);
    validateCoinTypeNodeDepth(json.depth);

    const node = await BIP44Node.fromExtendedKey({
      depth: json.depth,
      chainCode: hexStringToBuffer(json.chainCode),
      privateKey: nullableHexStringToBuffer(json.privateKey),
      publicKey: hexStringToBuffer(json.publicKey),
    });

    return new BIP44CoinTypeNode(node, coin_type);
  }

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
   * @param derivationPath - The derivation path for the key of this node.
   */
  static async fromDerivationPath(derivationPath: CoinTypeHDPathTuple) {
    validateCoinTypeNodeDepth(derivationPath.length - 1);

    const node = await BIP44Node.fromDerivationPath({
      derivationPath,
    });

    // Split the bip32 string token and extract the coin_type index
    const coinType = Number.parseInt(
      derivationPath[BIP_44_COIN_TYPE_DEPTH].split(':')[1].replace(`'`, ''),
      10,
    );

    return new BIP44CoinTypeNode(node, coinType);
  }

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
   * @param node - The {@link BIP44Node} for the key of this node.
   * @param coin_type - The coin_type index of this node. Must be a non-negative
   * integer.
   */
  static async fromNode(node: BIP44Node, coin_type: number) {
    if (!(node instanceof BIP44Node)) {
      throw new Error('Invalid node: Expected an instance of BIP44Node.');
    }

    validateCoinType(coin_type);
    validateCoinTypeNodeDepth(node.depth);

    return new BIP44CoinTypeNode(node, coin_type);
  }

  readonly #node: BIP44Node;

  public readonly path: CoinTypeHDPathString;

  public readonly coin_type: number;

  private constructor(node: BIP44Node, coin_type: number) {
    this.#node = node;
    this.coin_type = coin_type;
    this.path = getBIP44CoinTypePathString(coin_type);

    Object.freeze(this);
  }

  public get depth(): BIP44Depth {
    return this.#node.depth;
  }

  public get privateKeyBuffer(): Buffer | undefined {
    return this.#node.privateKeyBuffer;
  }

  public get publicKeyBuffer(): Buffer {
    return this.#node.publicKeyBuffer;
  }

  public get chainCodeBuffer(): Buffer {
    return this.#node.chainCodeBuffer;
  }

  public get privateKey(): string | undefined {
    return this.#node.privateKey;
  }

  public get publicKey(): string {
    return this.#node.publicKey;
  }

  public get chainCode(): string {
    return this.#node.chainCode;
  }

  public get address(): string {
    return this.#node.address;
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
  }: CoinTypeToAddressIndices): Promise<ChildNode> {
    const childKey = await this.#node.derive(
      getBIP44CoinTypeToAddressPathTuple({ account, change, address_index }),
    );

    return {
      privateKey: childKey.privateKeyBuffer,
      publicKey: childKey.publicKeyBuffer,
      chainCode: childKey.chainCodeBuffer,
      depth: childKey.depth,
    };
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
 * Validates that the coin type is a non-negative integer number. An error is
 * thrown if validation fails.
 *
 * @param coin_type - The coin type to validate.
 */
function validateCoinType(coin_type: unknown): asserts coin_type is number {
  if (
    typeof coin_type !== 'number' ||
    !Number.isInteger(coin_type) ||
    coin_type < 0
  ) {
    throw new Error(
      'Invalid coin type: The specified coin type must be a non-negative integer number.',
    );
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
  // TODO: Support xpubs and xprvs as part of a separate PR.
  parentKeyOrNode: BIP44CoinTypeNode | JsonBIP44CoinTypeNode,
  { account = 0, change = 0, address_index }: CoinTypeToAddressIndices,
): Promise<ChildNode> {
  validateCoinTypeNodeDepth(parentKeyOrNode.depth);

  const options = {
    depth: BIP_44_COIN_TYPE_DEPTH,
    path: getBIP44CoinTypeToAddressPathTuple({
      account,
      change,
      address_index,
    }),
    curve: secp256k1,
  };

  if (parentKeyOrNode instanceof BIP44CoinTypeNode) {
    return await deriveChildNode({
      privateKey: parentKeyOrNode.privateKeyBuffer,
      publicKey: parentKeyOrNode.publicKeyBuffer,
      chainCode: parentKeyOrNode.chainCodeBuffer,
      ...options,
    });
  }

  return await deriveChildNode({
    privateKey: nullableHexStringToBuffer(parentKeyOrNode.privateKey),
    publicKey: hexStringToBuffer(parentKeyOrNode.publicKey),
    chainCode: hexStringToBuffer(parentKeyOrNode.chainCode),
    ...options,
  });
}

type BIP44AddressKeyDeriver = {
  /**
   * @param address_index - The `address_index` value.
   * @param isHardened - Whether the derived index is hardened.
   * @returns The key corresponding to the path of this deriver and the
   * specified `address_index` value.
   */
  (address_index: number, isHardened?: boolean): Promise<ChildNode>;

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

  validateCoinTypeNodeDepth(node.depth);

  const parentKeyBuffer =
    node instanceof BIP44CoinTypeNode
      ? node.privateKeyBuffer
      : nullableHexStringToBuffer(node.privateKey);

  const parentPublicKeyBuffer =
    node instanceof BIP44CoinTypeNode
      ? node.publicKeyBuffer
      : hexStringToBuffer(node.publicKey);

  const parentChainCodeBuffer =
    node instanceof BIP44CoinTypeNode
      ? node.chainCodeBuffer
      : hexStringToBuffer(node.chainCode);

  const accountNode = getHardenedBIP32NodeToken(account);
  const changeNode = getBIP32NodeToken(change);

  const bip44AddressKeyDeriver: BIP44AddressKeyDeriver = async (
    address_index: number,
    isHardened = false,
  ): Promise<ChildNode> => {
    return await deriveChildNode({
      privateKey: parentKeyBuffer,
      publicKey: parentPublicKeyBuffer,
      chainCode: parentChainCodeBuffer,
      depth: BIP_44_COIN_TYPE_DEPTH,
      path: [
        accountNode,
        changeNode,
        isHardened
          ? getHardenedBIP32NodeToken(address_index)
          : getUnhardenedBIP32NodeToken(address_index),
      ],
      curve: secp256k1,
    });
  };

  bip44AddressKeyDeriver.coin_type = node.coin_type;
  bip44AddressKeyDeriver.path = getBIP44ChangePathString(node.path, {
    account,
    change,
  });

  Object.freeze(bip44AddressKeyDeriver);

  return bip44AddressKeyDeriver;
}
