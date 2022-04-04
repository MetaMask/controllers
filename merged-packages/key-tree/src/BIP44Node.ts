import {
  BIP44Depth,
  BIP44PurposeNodeToken,
  BIP_32_PATH_REGEX,
  BIP_39_PATH_REGEX,
  MAX_BIP_44_DEPTH,
  MIN_BIP_44_DEPTH,
  PartialHDPathTuple,
  SLIP10Path,
} from './constants';
import { isHardened } from './utils';
import {
  SLIP10Node,
  SLIP10NodeOptions,
  validateBIP32Depth,
} from './SLIP10Node';

/**
 * A wrapper for BIP-44 Hierarchical Deterministic (HD) tree nodes, i.e.
 * cryptographic keys used to generate keypairs and addresses for cryptocurrency
 * protocols.
 */
export type JsonBIP44Node = {
  /**
   * The 0-indexed BIP-44 path depth of this node.
   *
   * A BIP-44 path is of the form:
   *
   * `m / 44' / coin_type' / account' / change / address_index`
   *
   * With the following depths:
   *
   * `0 / 1 / 2 / 3 / 4 / 5`
   */
  readonly depth: BIP44Depth;

  /**
   * The Base64 string representation of the key material for this node.
   */
  readonly key: string;
};

export type BIP44NodeInterface = JsonBIP44Node & {
  /**
   * The raw bytes of the key material for this node, as a Node.js Buffer or
   * browser-equivalent.
   */
  keyBuffer: Buffer;

  /**
   * @returns A JSON-compatible representation of this node's data fields.
   */
  toJSON(): JsonBIP44Node;
};

/**
 * A wrapper for BIP-44 Hierarchical Deterministic (HD) tree nodes, i.e.
 * cryptographic keys used to generate keypairs and addresses for cryptocurrency
 * protocols.
 *
 * This class contains methods and fields that may not serialize well. Use
 * {@link BIP44Node.toJSON} to get a JSON-compatible representation.
 */
export class BIP44Node implements BIP44NodeInterface {
  /**
   * Initializes a BIP-44 node. Accepts either:
   * - An existing 64-byte BIP-44 key, and its **0-indexed** BIP-44 path depth.
   *   - The key may be in the form of a hexadecimal string, Base64 string, or a
   *     {@link Buffer}.
   * - A BIP-44 derivation path starting with an `m` node.
   *   - At present, the `m` node must be a BIP-39 node, given as a string of
   *     the form `bip39:MNEMONIC`, where `MNEMONIC` is a space-separated list
   *     of BIP-39 seed phrase words.
   *
   * All parameters are stringently validated, and an error is thrown if
   * validation fails.
   *
   * Recall that a BIP-44 HD tree path consists of the following nodes:
   *
   * `m / 44' / coin_type' / account' / change / address_index`
   *
   * With the following depths:
   *
   * `0 / 1 / 2 / 3 / 4 / 5`
   *
   * @param options - Options bag.
   * @param options.depth - The 0-indexed BIP-44 tree depth of the `key`, if
   * specified.
   * @param options.key - The key of this node. Mutually exclusive with
   * `derivationPath`, and requires a `depth` to be specified.
   * @param options.derivationPath - The rooted HD tree path that will be used
   * to derive the key of this node. Mutually exclusive with `key`.
   */
  static async create({
    depth,
    key,
    derivationPath,
  }: Omit<SLIP10NodeOptions, 'curve'>): Promise<BIP44Node> {
    if (derivationPath) {
      if (key) {
        throw new Error(
          'Invalid parameters: May not specify a derivation path if a key is specified. Initialize the node with just the parent key and its depth, then call node.derive() with your desired path.',
        );
      }

      if (depth) {
        throw new Error(
          'Invalid parameters: May not specify a depth if a derivation path is specified. The depth will be calculated from the path.',
        );
      }

      const _depth = derivationPath.length - 1;

      validateBIP44Depth(_depth);
      validateBIP44DerivationPath(derivationPath, MIN_BIP_44_DEPTH);

      const node = await SLIP10Node.create({
        derivationPath,
        curve: 'secp256k1',
      });

      return new BIP44Node(node);
    }

    if (key) {
      validateBIP44Depth(depth);

      const node = await SLIP10Node.create({
        key,
        depth,
        curve: 'secp256k1',
      });

      return new BIP44Node(node);
    }

    throw new Error(
      'Invalid parameters: Must specify either key or derivation path.',
    );
  }

  #node: SLIP10Node;

  public get depth(): BIP44Depth {
    return this.#node.depth as BIP44Depth;
  }

  public get key(): string {
    return this.#node.key;
  }

  public get keyBuffer(): Buffer {
    return this.#node.keyBuffer;
  }

  constructor(node: SLIP10Node) {
    this.#node = node;

    Object.freeze(this);
  }

  /**
   * Derives a child of the key contains be this node and returns a new
   * {@link BIP44Node} containing the child key.
   *
   * The specified path must be a valid HD path from this node, per BIP-44.
   * At present, this means that the path must consist of no more than 5 BIP-32
   * nodes, depending on the depth of this node.
   *
   * Recall that a BIP-44 HD tree path consists of the following nodes:
   *
   * `m / 44' / coin_type' / account' / change / address_index`
   *
   * With the following depths:
   *
   * `0 / 1 / 2 / 3 / 4 / 5`
   *
   * @param path - The partial (non-rooted) BIP-44 HD tree path will be used
   * to derive a child key from the parent key contained within this node.
   * @returns The {@link BIP44Node} corresponding to the derived child key.
   */
  public async derive(path: PartialHDPathTuple): Promise<BIP44Node> {
    if (this.depth === MAX_BIP_44_DEPTH) {
      throw new Error(
        'Illegal operation: This HD tree node is already a leaf node.',
      );
    }

    const newDepth = this.depth + path.length;

    validateBIP44Depth(newDepth);
    validateBIP44DerivationPath(path, (this.depth + 1) as BIP44Depth);

    const node = await this.#node.derive(path);
    return new BIP44Node(node);
  }

  public getPublicKey(compressed?: boolean) {
    return this.#node.getPublicKey(compressed);
  }

  public getAddress() {
    return this.#node.getAddress();
  }

  // This is documented in the interface of this class.
  public toJSON(): JsonBIP44Node {
    return {
      depth: this.depth,
      key: this.key,
    };
  }
}

/**
 * Validates a BIP-44 path depth. Effectively, asserts that the depth is an
 * integer `number` N such that 0 <= N <= 5. Throws an error if validation
 * fails.
 *
 * @param depth - The depth to validate.
 */
function validateBIP44Depth(depth: unknown): asserts depth is BIP44Depth {
  validateBIP32Depth(depth);

  if (depth < MIN_BIP_44_DEPTH || depth > MAX_BIP_44_DEPTH) {
    throw new Error(
      `Invalid HD tree path depth: The depth must be a positive integer N such that 0 <= N <= 5. Received: "${depth}"`,
    );
  }
}

/**
 * Ensures that the given derivation is valid by BIP-44.
 *
 * Recall that a BIP-44 HD tree path consists of the following nodes:
 *
 * `m / 44' / coin_type' / account' / change / address_index`
 *
 * With the following depths:
 *
 * `0 / 1 / 2 / 3 / 4 / 5`
 *
 * @param path - The path to validate.
 * @param startingDepth - The depth of the first node of the derivation path.
 */
function validateBIP44DerivationPath(
  path: SLIP10Path,
  startingDepth: BIP44Depth,
) {
  path.forEach((nodeToken, index) => {
    const currentDepth = startingDepth + index;

    switch (currentDepth) {
      case MIN_BIP_44_DEPTH:
        if (!BIP_39_PATH_REGEX.test(nodeToken)) {
          throw new Error(
            'Invalid derivation path: The "m" / seed node (depth 0) must be a BIP-39 node.',
          );
        }
        break;

      case 1:
        if (nodeToken !== BIP44PurposeNodeToken) {
          throw new Error(
            `Invalid derivation path: The "purpose" node (depth 1) must be the string "${BIP44PurposeNodeToken}".`,
          );
        }
        break;

      case 2:
        if (!BIP_32_PATH_REGEX.test(nodeToken) || !isHardened(nodeToken)) {
          throw new Error(
            'Invalid derivation path: The "coin_type" node (depth 2) must be a hardened BIP-32 node.',
          );
        }
        break;

      case 3:
        if (!BIP_32_PATH_REGEX.test(nodeToken) || !isHardened(nodeToken)) {
          throw new Error(
            'Invalid derivation path: The "account" node (depth 3) must be a hardened BIP-32 node.',
          );
        }
        break;

      case 4:
        if (!BIP_32_PATH_REGEX.test(nodeToken)) {
          throw new Error(
            'Invalid derivation path: The "change" node (depth 4) must be a BIP-32 node.',
          );
        }
        break;

      case MAX_BIP_44_DEPTH: // 5
        if (!BIP_32_PATH_REGEX.test(nodeToken)) {
          throw new Error(
            'Invalid derivation path: The "address_index" node (depth 5) must be a BIP-32 node.',
          );
        }
        break;

      /* istanbul ignore next: should be impossible in our usage */
      default:
        throw new Error(
          `Invalid derivation path: The path exceeds the maximum BIP-44 depth.`,
        );
    }
  });
}
