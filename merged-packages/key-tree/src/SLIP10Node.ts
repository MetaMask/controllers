import { assert, bytesToHex } from '@metamask/utils';

import type { BIP44CoinTypeNode } from './BIP44CoinTypeNode';
import type { BIP44Node } from './BIP44Node';
import type { RootedSLIP10PathTuple, SLIP10PathTuple } from './constants';
import { BYTES_KEY_LENGTH } from './constants';
import type { SupportedCurve } from './curves';
import { getCurveByName } from './curves';
import { deriveKeyFromPath } from './derivation';
import { publicKeyToEthAddress } from './derivers/bip32';
import {
  getBytes,
  getBytesUnsafe,
  getFingerprint,
  isValidInteger,
  validateBIP32Index,
  validateCurve,
} from './utils';

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
  readonly masterFingerprint?: number | undefined;

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
  readonly privateKey?: string | undefined;

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
  chainCodeBytes: Uint8Array;

  /**
   * The private key for this node, as a {@link Uint8Array}.
   * May be undefined if this node is a public key only node.
   */
  privateKeyBytes?: Uint8Array | undefined;

  /**
   * The public key for this node, as a {@link Uint8Array}.
   */
  publicKeyBytes: Uint8Array;

  /**
   * @returns A JSON-compatible representation of this node's data fields.
   */
  toJSON(): JsonSLIP10Node;
};

export type SLIP10NodeConstructorOptions = {
  readonly depth: number;
  readonly masterFingerprint?: number | undefined;
  readonly parentFingerprint: number;
  readonly index: number;
  readonly chainCode: Uint8Array;
  readonly privateKey?: Uint8Array | undefined;
  readonly publicKey: Uint8Array;
  readonly curve: SupportedCurve;
};

export type SLIP10ExtendedKeyOptions = {
  readonly depth: number;
  readonly masterFingerprint?: number | undefined;
  readonly parentFingerprint: number;
  readonly index: number;
  readonly chainCode: string | Uint8Array;
  readonly privateKey?: string | Uint8Array | undefined;
  readonly publicKey?: string | Uint8Array | undefined;
  readonly curve: SupportedCurve;
};

export type SLIP10DerivationPathOptions = {
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
   * @param options - The options for the new node.
   * @param options.depth - The depth of the node.
   * @param options.masterFingerprint - The fingerprint of the master node, i.e., the
   * node at depth 0. May be undefined if this node was created from an extended
   * key.
   * @param options.parentFingerprint - The fingerprint of the parent key, or 0 if
   * the node is a master node.
   * @param options.index - The index of the node, or 0 if the node is a master node.
   * @param options.privateKey - The private key for the node.
   * @param options.publicKey - The public key for the node. If a private key is
   * specified, this parameter is ignored.
   * @param options.chainCode - The chain code for the node.
   * @param options.curve - The curve used by the node.
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
    const chainCodeBytes = getBytes(chainCode, BYTES_KEY_LENGTH);

    validateCurve(curve);
    validateBIP32Depth(depth);
    validateBIP32Index(index);
    validateRootIndex(index, depth);
    validateParentFingerprint(parentFingerprint, depth);
    validateMasterParentFingerprint(
      masterFingerprint,
      parentFingerprint,
      depth,
    );

    const curveObject = getCurveByName(curve);

    if (privateKey) {
      const privateKeyBytes = getBytesUnsafe(privateKey, BYTES_KEY_LENGTH);
      assert(
        curveObject.isValidPrivateKey(privateKeyBytes),
        `Invalid private key: Value is not a valid ${curve} private key.`,
      );

      return new SLIP10Node(
        {
          depth,
          masterFingerprint,
          parentFingerprint,
          index,
          chainCode: chainCodeBytes,
          privateKey: privateKeyBytes,
          publicKey: await curveObject.getPublicKey(privateKeyBytes),
          curve,
        },
        this.#constructorGuard,
      );
    }

    if (publicKey) {
      const publicKeyBytes = getBytes(publicKey, curveObject.publicKeyLength);

      return new SLIP10Node(
        {
          depth,
          masterFingerprint,
          parentFingerprint,
          index,
          chainCode: chainCodeBytes,
          publicKey: publicKeyBytes,
          curve,
        },
        this.#constructorGuard,
      );
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
   * @param options - The options for the new node.
   * @param options.derivationPath - The rooted HD tree path that will be used
   * to derive the key of this node.
   * @param options.curve - The curve used by the node.
   * @returns A new SLIP-10 node.
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

  static #constructorGuard = Symbol('SLIP10Node.constructor');

  public readonly curve: SupportedCurve;

  public readonly depth: number;

  public readonly masterFingerprint?: number | undefined;

  public readonly parentFingerprint: number;

  public readonly index: number;

  public readonly chainCodeBytes: Uint8Array;

  public readonly privateKeyBytes?: Uint8Array | undefined;

  public readonly publicKeyBytes: Uint8Array;

  // eslint-disable-next-line no-restricted-syntax
  private constructor(
    {
      depth,
      masterFingerprint,
      parentFingerprint,
      index,
      chainCode,
      privateKey,
      publicKey,
      curve,
    }: SLIP10NodeConstructorOptions,
    constructorGuard?: symbol,
  ) {
    assert(
      constructorGuard === SLIP10Node.#constructorGuard,
      'SLIP10Node can only be constructed using `SLIP10Node.fromJSON`, `SLIP10Node.fromExtendedKey`, or `SLIP10Node.fromDerivationPath`.',
    );

    this.depth = depth;
    this.masterFingerprint = masterFingerprint;
    this.parentFingerprint = parentFingerprint;
    this.index = index;
    this.chainCodeBytes = chainCode;
    this.privateKeyBytes = privateKey;
    this.publicKeyBytes = publicKey;
    this.curve = curve;

    Object.freeze(this);
  }

  public get chainCode() {
    return bytesToHex(this.chainCodeBytes);
  }

  public get privateKey(): string | undefined {
    if (this.privateKeyBytes) {
      return bytesToHex(this.privateKeyBytes);
    }

    return undefined;
  }

  public get publicKey(): string {
    return bytesToHex(this.publicKeyBytes);
  }

  public get compressedPublicKeyBytes(): Uint8Array {
    return getCurveByName(this.curve).compressPublicKey(this.publicKeyBytes);
  }

  public get compressedPublicKey(): string {
    return bytesToHex(this.compressedPublicKeyBytes);
  }

  public get address(): string {
    if (this.curve !== 'secp256k1') {
      throw new Error(
        'Unable to get address for this node: Only secp256k1 is supported.',
      );
    }

    return bytesToHex(publicKeyToEthAddress(this.publicKeyBytes));
  }

  public get fingerprint(): number {
    return getFingerprint(this.compressedPublicKeyBytes);
  }

  /**
   * Get a neutered version of this node, i.e. a node without a private key.
   *
   * @returns A neutered version of this node.
   */
  public neuter(): SLIP10Node {
    return new SLIP10Node(
      {
        depth: this.depth,
        masterFingerprint: this.masterFingerprint,
        parentFingerprint: this.parentFingerprint,
        index: this.index,
        chainCode: this.chainCodeBytes,
        publicKey: this.publicKeyBytes,
        curve: this.curve,
      },
      SLIP10Node.#constructorGuard,
    );
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
 * Validates a BIP-32 path depth. Effectively, asserts that the depth is an
 * integer `number`. Throws an error if validation fails.
 *
 * @param depth - The depth to validate.
 */
export function validateBIP32Depth(depth: unknown): asserts depth is number {
  if (!isValidInteger(depth)) {
    throw new Error(
      `Invalid HD tree path depth: The depth must be a positive integer. Received: "${String(
        depth,
      )}".`,
    );
  }
}

/**
 * Validates a BIP-32 parent fingerprint. Effectively, asserts that the fingerprint is an
 * integer `number`. Throws an error if validation fails.
 *
 * @param parentFingerprint - The parent fingerprint to validate.
 * @param depth - The depth of the node to validate.
 * @throws If the parent fingerprint is not a positive integer, or invalid for
 * the current depth.
 */
export function validateParentFingerprint(
  parentFingerprint: unknown,
  depth: number,
): asserts parentFingerprint is number {
  if (!isValidInteger(parentFingerprint)) {
    throw new Error(
      `Invalid parent fingerprint: The fingerprint must be a positive integer. Received: "${String(
        parentFingerprint,
      )}".`,
    );
  }

  if (depth === 0 && parentFingerprint !== 0) {
    throw new Error(
      `Invalid parent fingerprint: The fingerprint of the root node must be 0. Received: "${String(
        parentFingerprint,
      )}".`,
    );
  }

  if (depth > 0 && parentFingerprint === 0) {
    throw new Error(
      `Invalid parent fingerprint: The fingerprint of a child node must not be 0. Received: "${String(
        parentFingerprint,
      )}".`,
    );
  }
}

/**
 * Validate that a given combination of master fingerprint and parent
 * fingerprint is valid for the given depth.
 *
 * @param masterFingerprint - The master fingerprint to validate.
 * @param parentFingerprint - The parent fingerprint to validate.
 * @param depth - The depth of the node to validate.
 * @throws If the combination of master fingerprint and parent fingerprint is
 * invalid for the given depth.
 */
export function validateMasterParentFingerprint(
  masterFingerprint: number | undefined,
  parentFingerprint: number,
  depth: number,
) {
  // The master fingerprint is optional.
  if (!masterFingerprint) {
    return;
  }

  if (depth >= 2 && masterFingerprint === parentFingerprint) {
    throw new Error(
      `Invalid parent fingerprint: The fingerprint of a child node cannot be equal to the master fingerprint. Received: "${String(
        parentFingerprint,
      )}".`,
    );
  }
}

/**
 * Validate that the index is zero for the root node.
 *
 * @param index - The index to validate.
 * @param depth - The depth of the node to validate.
 * @throws If the index is not zero for the root node.
 */
export function validateRootIndex(index: number, depth: number) {
  if (depth === 0 && index !== 0) {
    throw new Error(
      `Invalid index: The index of the root node must be 0. Received: "${String(
        index,
      )}".`,
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
 * @param options - The options to use when deriving the child key.
 * @param options.node - The node to derive from.
 * @param options.path - The path to the child node / key.
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
