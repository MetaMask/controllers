import {
  BUFFER_KEY_LENGTH,
  RootedSLIP10PathTuple,
  SLIP10PathTuple,
} from './constants';
import { curves, getCurveByName, SupportedCurve } from './curves';
import { deriveKeyFromPath } from './derivation';
import { publicKeyToEthAddress } from './derivers/bip32';
import {
  getBuffer,
  getFingerprint,
  isValidInteger,
  validateBIP32Index,
} from './utils';
import { BIP44Node } from './BIP44Node';
import { BIP44CoinTypeNode } from './BIP44CoinTypeNode';

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
   * The fingerprint of the master node, i.e., the node at depth 0. May be
   * undefined if this node was created from an extended key.
   */
  readonly masterFingerprint?: number;

  /**
   * The fingerprint of the parent key, or 0 if this is a master node.
   */
  readonly parentFingerprint: number;

  /**
   * The index of the node, or 0 if this is a master node.
   */
  readonly index: number;

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
  readonly masterFingerprint?: number;
  readonly parentFingerprint: number;
  readonly index: number;
  readonly chainCode: Buffer;
  readonly privateKey?: Buffer;
  readonly publicKey: Buffer;
  readonly curve: SupportedCurve;
};

type SLIP10ExtendedKeyOptions = {
  readonly depth: number;
  readonly masterFingerprint?: number;
  readonly parentFingerprint: number;
  readonly index: number;
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
   * @param depth - The depth of the node.
   * @param parentFingerprint - The fingerprint of the parent key, or 0 if
   * the node is a master node.
   * @param index - The index of the node, or 0 if the node is a master node.
   * @param privateKey - The private key for the node.
   * @param publicKey - The public key for the node. If a private key is
   * specified, this parameter is ignored.
   * @param chainCode - The chain code for the node.
   * @param curve - The curve used by the node.
   */
  static async fromExtendedKey({
    depth,
    masterFingerprint,
    parentFingerprint,
    index,
    privateKey,
    publicKey,
    chainCode,
    curve,
  }: SLIP10ExtendedKeyOptions) {
    const chainCodeBuffer = getBuffer(chainCode, BUFFER_KEY_LENGTH);

    validateCurve(curve);
    validateBIP32Depth(depth);
    validateBIP32Index(index);
    validateParentFingerprint(parentFingerprint);

    if (privateKey) {
      const privateKeyBuffer = getBuffer(privateKey, BUFFER_KEY_LENGTH);

      return new SLIP10Node({
        depth,
        masterFingerprint,
        parentFingerprint,
        index,
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
        masterFingerprint,
        parentFingerprint,
        index,
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
   * @param derivationPath - The rooted HD tree path that will be used
   * to derive the key of this node.
   * @param curve - The curve used by the node.
   */
  static async fromDerivationPath({
    derivationPath,
    curve,
  }: SLIP10DerivationPathOptions) {
    validateCurve(curve);

    if (!derivationPath) {
      throw new Error('Invalid options: Must provide a derivation path.');
    }

    if (derivationPath.length === 0) {
      throw new Error(
        'Invalid derivation path: May not specify an empty derivation path.',
      );
    }

    return await deriveKeyFromPath({
      path: derivationPath,
      depth: derivationPath.length - 1,
      curve,
    });
  }

  public readonly curve: SupportedCurve;

  public readonly depth: number;

  public readonly masterFingerprint?: number;

  public readonly parentFingerprint: number;

  public readonly index: number;

  public readonly chainCodeBuffer: Buffer;

  public readonly privateKeyBuffer?: Buffer;

  public readonly publicKeyBuffer: Buffer;

  constructor({
    depth,
    masterFingerprint,
    parentFingerprint,
    index,
    chainCode,
    privateKey,
    publicKey,
    curve,
  }: SLIP10NodeConstructorOptions) {
    this.depth = depth;
    this.masterFingerprint = masterFingerprint;
    this.parentFingerprint = parentFingerprint;
    this.index = index;
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

  public get compressedPublicKeyBuffer(): Buffer {
    return getCurveByName(this.curve).compressPublicKey(this.publicKeyBuffer);
  }

  public get address(): string {
    if (this.curve !== 'secp256k1') {
      throw new Error(
        'Unable to get address for this node: Only secp256k1 is supported.',
      );
    }

    return `0x${publicKeyToEthAddress(this.publicKeyBuffer).toString('hex')}`;
  }

  public get fingerprint(): number {
    return getFingerprint(this.compressedPublicKeyBuffer);
  }

  /**
   * Returns a neutered version of this node, i.e. a node without a private key.
   */
  public neuter(): SLIP10Node {
    return new SLIP10Node({
      depth: this.depth,
      masterFingerprint: this.masterFingerprint,
      parentFingerprint: this.parentFingerprint,
      index: this.index,
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
    return await deriveChildNode({
      path,
      node: this,
    });
  }

  // This is documented in the interface of this class.
  public toJSON(): JsonSLIP10Node {
    return {
      depth: this.depth,
      masterFingerprint: this.masterFingerprint,
      parentFingerprint: this.parentFingerprint,
      index: this.index,
      curve: this.curve,
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      chainCode: this.chainCode,
    };
  }
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
  if (!isValidInteger(depth)) {
    throw new Error(
      `Invalid HD tree path depth: The depth must be a positive integer. Received: "${depth}".`,
    );
  }
}

/**
 * Validates a BIP-32 parent fingerprint. Effectively, asserts that the fingerprint is an
 * integer `number`. Throws an error if validation fails.
 *
 * @param parentFingerprint - The parent fingerprint to validate.
 */
export function validateParentFingerprint(
  parentFingerprint: unknown,
): asserts parentFingerprint is number {
  if (!isValidInteger(parentFingerprint)) {
    throw new Error(
      `Invalid parent fingerprint: The fingerprint must be a positive integer. Received: "${parentFingerprint}".`,
    );
  }
}

type DeriveChildNodeArgs = {
  path: SLIP10PathTuple;
  node: SLIP10Node | BIP44Node | BIP44CoinTypeNode;
};

/**
 * Derives a child key from the given parent key.
 *
 * @param node - The node to derive from.
 * @param path - The path to the child node / key.
 * @returns The derived key and depth.
 */
export async function deriveChildNode({
  path,
  node,
}: DeriveChildNodeArgs): Promise<SLIP10Node> {
  if (path.length === 0) {
    throw new Error(
      'Invalid HD tree derivation path: Deriving a path of length 0 is not defined.',
    );
  }

  // Note that we do not subtract 1 from the length of the path to the child,
  // unlike when we calculate the depth of a rooted path.
  const newDepth = node.depth + path.length;
  validateBIP32Depth(newDepth);

  return await deriveKeyFromPath({
    path,
    node,
    depth: newDepth,
  });
}
