import { deriveKeyFromPath } from './derivation';
import {
  MIN_BIP_44_DEPTH,
  MAX_BIP_44_DEPTH,
  BIP44Depth,
  PartialHDPathTuple,
  RootedHDPathTuple,
  HDPathTuple,
  BIP_39_PATH_REGEX,
  BIP_32_PATH_REGEX,
  BIP44PurposeNodeToken,
} from './constants';
import {
  bufferToBase64String,
  base64StringToBuffer,
  hexStringToBuffer,
  isValidHexStringKey,
  isValidBase64StringKey,
  isValidBufferKey,
  isHardened,
} from './utils';

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

type BIP44NodeOptions = {
  readonly depth?: BIP44Depth;
  readonly key?: Buffer | string;
  readonly derivationPath?: RootedHDPathTuple;
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
  public readonly depth: BIP44Depth;

  public get key(): string {
    return bufferToBase64String(this.keyBuffer);
  }

  public readonly keyBuffer: Buffer;

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
  constructor({ depth, key, derivationPath }: BIP44NodeOptions) {
    const _key = BIP44Node._parseKey(key);

    if (derivationPath) {
      if (_key) {
        throw new Error(
          'Invalid parameters: May not specify a derivation path if a key is specified. Initialize the node with just the parent key and its depth, then call BIP44Node.derive() with your desired path.',
        );
      }

      if (depth) {
        throw new Error(
          'Invalid parameters: May not specify a depth if a derivation path is specified. The depth will be calculated from the path.',
        );
      }

      if ((derivationPath as any).length === 0) {
        throw new Error(
          'Invalid derivation path: May not specify an empty derivation path.',
        );
      }

      const _depth = derivationPath.length - 1;
      validateBIP44Depth(_depth);
      this.depth = _depth as BIP44Depth;

      validateBIP44DerivationPath(derivationPath, MIN_BIP_44_DEPTH);
      this.keyBuffer = deriveKeyFromPath(derivationPath, undefined, this.depth);
    } else if (_key) {
      validateBIP44Depth(depth);
      this.depth = depth as BIP44Depth;

      this.keyBuffer = _key;
    } else {
      throw new Error(
        'Invalid parameters: Must specify either key or derivation path.',
      );
    }

    Object.freeze(this);
  }

  /**
   * Constructor helper for validating and parsing the `key` parameter. An error
   * is thrown if validation fails.
   *
   * @param key - The key to parse.
   * @returns A {@link Buffer}, or `undefined` if no key parameter was
   * specified.
   */
  private static _parseKey(key: unknown): Buffer | undefined {
    if (key === undefined || key === null) {
      return undefined;
    }

    let bufferKey: Buffer;
    if (Buffer.isBuffer(key)) {
      if (!isValidBufferKey(key)) {
        throw new Error(
          'Invalid buffer key: Must be a 64-byte, non-empty Buffer.',
        );
      }

      bufferKey = key;
    } else if (typeof key === 'string') {
      if (isValidHexStringKey(key)) {
        bufferKey = hexStringToBuffer(key);
      } else if (isValidBase64StringKey(key)) {
        bufferKey = base64StringToBuffer(key);
      } else {
        throw new Error(
          'Invalid string key: Must be a 64-byte hexadecimal or Base64 string.',
        );
      }
    } else {
      throw new Error(
        `Invalid key: Must be a Buffer or string if specified. Received: "${typeof key}"`,
      );
    }

    return bufferKey;
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
  public derive(path: PartialHDPathTuple): BIP44Node {
    if (this.depth === MAX_BIP_44_DEPTH) {
      throw new Error(
        'Illegal operation: This HD tree node is already a leaf node.',
      );
    }

    return deriveChildNode(this.keyBuffer, this.depth, path);
  }

  // This is documented in the interface of this class.
  toJSON(): JsonBIP44Node {
    return {
      depth: this.depth,
      key: this.key,
    };
  }
}

/**
 * Derives a child key from the given parent key, as a {@link BIP44Node}.
 * @param parentKey - The parent key to derive from.
 * @param parentDepth - The depth of the parent key.
 * @param pathToChild - The path to the child node / key.
 * @returns The {@link BIP44Node} corresponding to the derived child key.
 */
export function deriveChildNode(
  parentKey: Buffer,
  parentDepth: BIP44Depth,
  pathToChild: PartialHDPathTuple,
) {
  if ((pathToChild as any).length === 0) {
    throw new Error(
      'Invalid HD tree derivation path: Deriving a path of length 0 is not defined',
    );
  }

  // Note that we do not subtract 1 from the length of the path to the child,
  // unlike when we calculate the depth of a rooted path.
  const newDepth = (parentDepth + pathToChild.length) as BIP44Depth;
  validateBIP44Depth(newDepth);
  validateBIP44DerivationPath(pathToChild, (parentDepth + 1) as BIP44Depth);

  return new BIP44Node({
    depth: newDepth,
    key: deriveKeyFromPath(pathToChild, parentKey),
  });
}

/**
 * Validates a BIP-44 path depth. Effectively, asserts that the depth is an
 * integer `number` N such that 0 <= N <= 5. Throws an error if validation
 * fails.
 *
 * @param depth - The depth to validate.
 */
function validateBIP44Depth(depth: unknown) {
  if (
    typeof depth !== 'number' ||
    !Number.isInteger(depth) ||
    depth < MIN_BIP_44_DEPTH ||
    depth > MAX_BIP_44_DEPTH
  ) {
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
  path: HDPathTuple,
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
            `Invalid derivation path: The "purpose" node node (depth 1) must be the string "${BIP44PurposeNodeToken}".`,
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
        if (!BIP_32_PATH_REGEX.test(nodeToken) || isHardened(nodeToken)) {
          throw new Error(
            'Invalid derivation path: The "change" node (depth 4) must be an unhardened BIP-32 node.',
          );
        }
        break;

      case MAX_BIP_44_DEPTH: // 5
        if (!BIP_32_PATH_REGEX.test(nodeToken) || isHardened(nodeToken)) {
          throw new Error(
            'Invalid derivation path: The "address_index" node (depth 5) must be an unhardened BIP-32 node.',
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
