import {
  BUFFER_KEY_LENGTH,
  RootedSLIP10PathTuple,
  SLIP10PathTuple,
} from './constants';
import { Curve, curves, SupportedCurve } from './curves';
import { deriveKeyFromPath } from './derivation';
import { publicKeyToEthAddress } from './derivers/bip32';
import { getBuffer } from './utils';

/**
 * A wrapper for SLIP-10 Hierarchical Deterministic (HD) tree nodes, i.e.
 * cryptographic keys used to generate key pairs and addresses for cryptocurrency
 * protocols.
 */
export type JsonSLIP10Node = {
  /**
   * The 0-indexed path depth of this node.
   */
  readonly depth: number;

  /**
   * The (optional) private key of this node.
   */
  readonly privateKey?: string;

  /**
   * The public key of this node.
   */
  readonly publicKey: string;

  /**
   * The chain code of this node.
   */
  readonly chainCode: string;

  /**
   * The name of the curve used by the node.
   */
  readonly curve: SupportedCurve;
};

export type SLIP10NodeInterface = JsonSLIP10Node & {
  chainCodeBuffer: Buffer;

  /**
   * The private key for this node, as a Node.js Buffer or browser-equivalent.
   * May be undefined if this node is a public key only node.
   */
  privateKeyBuffer?: Buffer;

  /**
   * The public key for this node, as a Node.js Buffer or browser-equivalent.
   */
  publicKeyBuffer: Buffer;

  /**
   * @returns A JSON-compatible representation of this node's data fields.
   */
  toJSON(): JsonSLIP10Node;
};

type SLIP10NodeConstructorOptions = {
  readonly depth: number;
  readonly chainCode: Buffer;
  readonly privateKey?: Buffer;
  readonly publicKey: Buffer;
  readonly curve: SupportedCurve;
};

type SLIP10ExtendedKeyOptions = {
  readonly depth: number;
  readonly chainCode: string | Buffer;
  readonly privateKey?: string | Buffer;
  readonly publicKey?: string | Buffer;
  readonly curve: SupportedCurve;
};

type SLIP10DerivationPathOptions = {
  readonly derivationPath: RootedSLIP10PathTuple;
  readonly curve: SupportedCurve;
};

export class SLIP10Node implements SLIP10NodeInterface {
  /**
   * Wrapper of the {@link fromExtendedKey} function. Refer to that function
   * for documentation.
   *
   * @param json - The JSON representation of a SLIP-10 node.
   */
  static async fromJSON(json: JsonSLIP10Node): Promise<SLIP10Node> {
    return SLIP10Node.fromExtendedKey(json);
  }

  /**
   * Create a new SLIP-10 node from a key and chain code. You must specify
   * either a private key or a public key. When specifying a private key,
   * the public key will be derived from the private key.
   *
   * All parameters are stringently validated, and an error is thrown if
   * validation fails.
   *
   * @param depth The depth of the node.
   * @param privateKey The private key for the node.
   * @param publicKey The public key for the node. If a private key is
   * specified, this parameter is ignored.
   * @param chainCode The chain code for the node.
   * @param curve The curve used by the node.
   */
  static async fromExtendedKey({
    depth,
    privateKey,
    publicKey,
    chainCode,
    curve,
  }: SLIP10ExtendedKeyOptions) {
    const chainCodeBuffer = getBuffer(chainCode, BUFFER_KEY_LENGTH);

    validateCurve(curve);
    validateBIP32Depth(depth);

    if (privateKey) {
      const privateKeyBuffer = getBuffer(privateKey, BUFFER_KEY_LENGTH);

      return new SLIP10Node({
        depth,
        chainCode: chainCodeBuffer,
        privateKey: privateKeyBuffer,
        publicKey: await getCurveByName(curve).getPublicKey(privateKey),
        curve,
      });
    }

    if (publicKey) {
      const publicKeyBuffer = getBuffer(
        publicKey,
        getCurveByName(curve).publicKeyLength,
      );

      return new SLIP10Node({
        depth,
        chainCode: chainCodeBuffer,
        publicKey: publicKeyBuffer,
        curve,
      });
    }

    throw new Error(
      'Invalid options: Must provide either a private key or a public key.',
    );
  }

  /**
   * Create a new SLIP-10 node from a derivation path. The derivation path
   * must be rooted, i.e. it must begin with a BIP-39 node, given as a string of
   * the form `bip39:MNEMONIC`, where `MNEMONIC` is a space-separated list of
   * BIP-39 seed phrase words.
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
   * @param derivationPath The rooted HD tree path that will be used
   * to derive the key of this node.
   * @param curve The curve used by the node.
   */
  static async fromDerivationPath({
    derivationPath,
    curve,
  }: SLIP10DerivationPathOptions) {
    validateCurve(curve);

    if (derivationPath) {
      const [privateKey, , chainCode] = await createKeyFromPath({
        derivationPath,
        curve,
      });

      const publicKey = await getCurveByName(curve).getPublicKey(privateKey);

      return new SLIP10Node({
        depth: derivationPath.length - 1,
        chainCode,
        privateKey,
        publicKey,
        curve,
      });
    }

    throw new Error('Invalid options: Must provide a derivation path.');
  }

  public readonly curve: SupportedCurve;

  public readonly depth: number;

  public readonly chainCodeBuffer: Buffer;

  public readonly privateKeyBuffer?: Buffer;

  public readonly publicKeyBuffer: Buffer;

  constructor({
    depth,
    chainCode,
    privateKey,
    publicKey,
    curve,
  }: SLIP10NodeConstructorOptions) {
    this.depth = depth;
    this.chainCodeBuffer = chainCode;
    this.privateKeyBuffer = privateKey;
    this.publicKeyBuffer = publicKey;
    this.curve = curve;

    Object.freeze(this);
  }

  public get chainCode() {
    return this.chainCodeBuffer.toString('hex');
  }

  public get privateKey(): string | undefined {
    return this.privateKeyBuffer?.toString('hex');
  }

  public get publicKey(): string {
    return this.publicKeyBuffer.toString('hex');
  }

  public get address(): string {
    if (this.curve !== 'secp256k1') {
      throw new Error(
        'Unable to get address for this node: Only secp256k1 is supported.',
      );
    }

    return publicKeyToEthAddress(this.publicKeyBuffer).toString('hex');
  }

  /**
   * Returns a neutered version of this node, i.e. a node without a private key.
   */
  public neuter(): SLIP10Node {
    return new SLIP10Node({
      depth: this.depth,
      chainCode: this.chainCodeBuffer,
      publicKey: this.publicKeyBuffer,
      curve: this.curve,
    });
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
    // TODO: Support deriving from a public key
    if (!this.privateKeyBuffer) {
      throw new Error('Unable to derive child key: No private key.');
    }

    const { privateKey, publicKey, chainCode, depth } = await deriveChildNode(
      this.privateKeyBuffer,
      this.publicKeyBuffer,
      this.chainCodeBuffer,
      this.depth,
      path,
      getCurveByName(this.curve),
    );

    return SLIP10Node.fromExtendedKey({
      depth,
      privateKey,
      publicKey,
      chainCode,
      curve: this.curve,
    });
  }

  // This is documented in the interface of this class.
  public toJSON(): JsonSLIP10Node {
    return {
      depth: this.depth,
      curve: this.curve,
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      chainCode: this.chainCode,
    };
  }
}

async function createKeyFromPath({
  derivationPath,
  curve: curveName,
}: SLIP10DerivationPathOptions) {
  if (derivationPath.length === 0) {
    throw new Error(
      'Invalid derivation path: May not specify an empty derivation path.',
    );
  }

  validateCurve(curveName);
  const curve = getCurveByName(curveName);

  const _depth = derivationPath.length - 1;
  validateBIP32Depth(_depth);

  return await deriveKeyFromPath(
    derivationPath,
    undefined,
    undefined,
    undefined,
    _depth,
    curve,
  );
}

/**
 * Validates the curve name.
 *
 * @param curveName - The name of the curve to validate.
 */
function validateCurve(
  curveName: unknown,
): asserts curveName is SupportedCurve {
  if (!curveName || typeof curveName !== 'string') {
    throw new Error('Invalid curve: Must specify a curve.');
  }

  if (!Object.keys(curves).includes(curveName)) {
    throw new Error(
      `Invalid curve: Only the following curves are supported: ${Object.keys(
        curves,
      ).join(', ')}.`,
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

export type ChildNode = {
  privateKey?: Buffer;
  publicKey: Buffer;
  chainCode: Buffer;
  depth: number;
};

/**
 * Derives a child key from the given parent key.
 * @param privateKey - The parent key to derive from.
 * @param publicKey - The parent public key to derive from.
 * @param chainCode - The chain code of the parent node.
 * @param depth - The depth of the parent key.
 * @param pathToChild - The path to the child node / key.
 * @param curve - The curve to use.
 * @returns The derived key and depth.
 */
export async function deriveChildNode(
  privateKey: Buffer | undefined,
  publicKey: Buffer,
  chainCode: Buffer,
  depth: number,
  pathToChild: SLIP10PathTuple,
  curve: Curve,
): Promise<ChildNode> {
  if (pathToChild.length === 0) {
    throw new Error(
      'Invalid HD tree derivation path: Deriving a path of length 0 is not defined.',
    );
  }

  // Note that we do not subtract 1 from the length of the path to the child,
  // unlike when we calculate the depth of a rooted path.
  const newDepth = depth + pathToChild.length;
  validateBIP32Depth(newDepth);

  const [childKey, childPublicKey, childChainCode] = await deriveKeyFromPath(
    pathToChild,
    privateKey,
    publicKey,
    chainCode,
    newDepth,
    curve,
  );

  return {
    privateKey: childKey,
    publicKey: childPublicKey,
    chainCode: childChainCode,
    depth: newDepth,
  };
}

/**
 * Get a curve by name.
 *
 * @param curveName - The name of the curve to get.
 */
function getCurveByName(curveName: SupportedCurve): Curve {
  return curves[curveName];
}
