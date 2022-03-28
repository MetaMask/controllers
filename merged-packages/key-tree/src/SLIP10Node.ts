import { RootedSLIP10PathTuple, SLIP10PathTuple } from './constants';
import { Curve } from './curves';
import {
  base64StringToBuffer,
  bufferToBase64String,
  hexStringToBuffer,
  isValidBase64StringKey,
  isValidBufferKey,
  isValidHexStringKey,
} from './utils';
import { deriveKeyFromPath } from './derivation';

/**
 * A wrapper for SLIP-10 Hierarchical Deterministic (HD) tree nodes, i.e.
 * cryptographic keys used to generate keypairs and addresses for cryptocurrency
 * protocols.
 */
export type JsonSLIP10Node = {
  /**
   * The 0-indexed path depth of this node.
   */
  readonly depth: number;

  /**
   * The Base64 string representation of the key material for this node.
   */
  readonly key: string;
};

export type SLIP10NodeInterface = JsonSLIP10Node & {
  /**
   * The raw bytes of the key material for this node, as a Node.js Buffer or
   * browser-equivalent.
   */
  keyBuffer: Buffer;

  /**
   * @returns A JSON-compatible representation of this node's data fields.
   */
  toJSON(): JsonSLIP10Node;
};

type SLIP10NodeKeyDepthOptions = {
  readonly depth: number;
  readonly key: Buffer | string;
  readonly derivationPath?: never;
  readonly curve: Curve;
};

type SLIP10NodeDerivationPathOptions = {
  readonly derivationPath: RootedSLIP10PathTuple;
  readonly depth?: never;
  readonly key?: never;
  readonly curve: Curve;
};

export type SLIP10NodeOptions =
  | SLIP10NodeKeyDepthOptions
  | SLIP10NodeDerivationPathOptions;

type SLIP10NodeConstructorOptions = {
  readonly depth: number;
  readonly key: Buffer;
  readonly curve: Curve;
};

const SUPPORTED_CURVES = ['secp256k1', 'ed25519'];

export class SLIP10Node implements SLIP10NodeInterface {
  static async create({
    depth,
    key,
    derivationPath,
    curve,
  }: SLIP10NodeOptions): Promise<SLIP10Node> {
    validateCurve(curve);

    const _key = SLIP10Node.#parseKey(key);

    if (derivationPath) {
      const keyBuffer = await createKeyFromPath({
        derivationPath,
        depth,
        key,
        curve,
      });

      return new SLIP10Node({
        depth: derivationPath.length - 1,
        key: keyBuffer,
        curve,
      });
    } else if (_key) {
      validateBIP32Depth(depth);

      return new SLIP10Node({ depth, key: _key, curve });
    }

    throw new Error(
      'Invalid parameters: Must specify either key or derivation path.',
    );
  }

  /**
   * Constructor helper for validating and parsing the `key` parameter. An error
   * is thrown if validation fails.
   *
   * @param key - The key to parse.
   * @returns A {@link Buffer}, or `undefined` if no key parameter was
   * specified.
   */
  static #parseKey(key: unknown): Buffer | undefined {
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
        `Invalid key: Must be a Buffer or string if specified. Received: "${typeof key}".`,
      );
    }

    return bufferKey;
  }

  private readonly curve: Curve;

  public readonly depth: number;

  public readonly keyBuffer: Buffer;

  public get key(): string {
    return bufferToBase64String(this.keyBuffer);
  }

  constructor({ depth, key, curve }: SLIP10NodeConstructorOptions) {
    this.depth = depth;
    this.keyBuffer = key;
    this.curve = curve;

    Object.freeze(this);
  }

  /**
   * Derives a child of the key contains be this node and returns a new
   * {@link SLIP10Node} containing the child key.
   *
   * The specified path must be a valid HD path from this node, per SLIP-10.
   *
   * @param path - The partial (non-rooted) SLIP-10 HD tree path will be used
   * to derive a child key from the parent key contained within this node.
   * @returns The {@link SLIP10Node} corresponding to the derived child key.
   */
  public async derive(path: SLIP10PathTuple): Promise<SLIP10Node> {
    const { key, depth } = await deriveChildNode(
      this.keyBuffer,
      this.depth,
      path,
      this.curve,
    );

    return new SLIP10Node({
      key,
      depth,
      curve: this.curve,
    });
  }

  // This is documented in the interface of this class.
  toJSON(): JsonSLIP10Node {
    return {
      depth: this.depth,
      key: this.key,
    };
  }
}

async function createKeyFromPath({
  derivationPath,
  depth,
  key,
  curve,
}: Required<Pick<SLIP10NodeOptions, 'derivationPath'>> &
  Omit<SLIP10NodeOptions, 'derivationPath'>) {
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

  if (derivationPath.length === 0) {
    throw new Error(
      'Invalid derivation path: May not specify an empty derivation path.',
    );
  }

  const _depth = derivationPath.length - 1;
  validateBIP32Depth(_depth);

  return await deriveKeyFromPath(derivationPath, undefined, _depth, curve);
}

/**
 * Validates the curve.
 * @param curve
 */
function validateCurve(curve: Curve): asserts curve is Curve {
  if (!curve) {
    throw new Error('Invalid curve: Must specify a curve.');
  }

  if (!SUPPORTED_CURVES.includes(curve.name)) {
    throw new Error(
      `Invalid curve: Only the following curves are supported: ${SUPPORTED_CURVES.join(
        ', ',
      )}.`,
    );
  }
}

/**
 * Validates a BIP-32 path depth. Effectively, asserts that the depth is an
 * integer `number`. Throws an error if validation fails.
 *
 * @param depth - The depth to validate.
 */
export function validateBIP32Depth(depth: unknown): asserts depth is number {
  if (typeof depth !== 'number' || !Number.isInteger(depth) || depth < 0) {
    throw new Error(
      `Invalid HD tree path depth: The depth must be a positive integer. Received: "${depth}".`,
    );
  }
}

/**
 * Derives a child key from the given parent key.
 * @param parentKey - The parent key to derive from.
 * @param parentDepth - The depth of the parent key.
 * @param pathToChild - The path to the child node / key.
 * @param curve - The curve to use.
 * @returns The derived key and depth.
 */
export async function deriveChildNode(
  parentKey: Buffer,
  parentDepth: number,
  pathToChild: SLIP10PathTuple,
  curve: Curve,
): Promise<{ key: Buffer; depth: number }> {
  if (pathToChild.length === 0) {
    throw new Error(
      'Invalid HD tree derivation path: Deriving a path of length 0 is not defined.',
    );
  }

  // Note that we do not subtract 1 from the length of the path to the child,
  // unlike when we calculate the depth of a rooted path.
  const newDepth = parentDepth + pathToChild.length;
  validateBIP32Depth(newDepth);

  return {
    key: await deriveKeyFromPath(pathToChild, parentKey, newDepth, curve),
    depth: newDepth,
  };
}
