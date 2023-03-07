import {
  assert,
  assertExhaustive,
  bytesToBigInt,
  concatBytes,
  hexToBytes,
} from '@metamask/utils';
import { hmac } from '@noble/hashes/hmac';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3';
import { sha512 } from '@noble/hashes/sha512';

import { DeriveChildKeyArgs, DerivedKeys, Specification } from '.';
import { BIP_32_HARDENED_OFFSET, BYTES_KEY_LENGTH } from '../constants';
import { Curve, mod, secp256k1 } from '../curves';
import { SLIP10Node } from '../SLIP10Node';
import {
  isValidBytesKey,
  numberToUint32,
  validateBIP32Index,
  validateSpecification,
} from '../utils';

/**
 * Converts a BIP-32 private key to an Ethereum address.
 *
 * **WARNING:** Only validates that the key is non-zero and of the correct
 * length. It is the consumer's responsibility to ensure that the specified
 * key is a valid BIP-44 Ethereum `address_index` key.
 *
 * @param key - The `address_index` private key bytes to convert to an Ethereum
 * address.
 * @returns The Ethereum address corresponding to the given key.
 */
export function privateKeyToEthAddress(key: Uint8Array) {
  assert(
    key instanceof Uint8Array && isValidBytesKey(key, BYTES_KEY_LENGTH),
    'Invalid key: The key must be a 32-byte, non-zero Uint8Array.',
  );

  const publicKey = secp256k1.getPublicKey(key, false);
  return publicKeyToEthAddress(publicKey);
}

/**
 * Converts a BIP-32 public key to an Ethereum address.
 *
 * **WARNING:** Only validates that the key is non-zero and of the correct
 * length. It is the consumer's responsibility to ensure that the specified
 * key is a valid BIP-44 Ethereum `address_index` key.
 *
 * @param key - The `address_index` public key bytes to convert to an Ethereum
 * address.
 * @returns The Ethereum address corresponding to the given key.
 */
export function publicKeyToEthAddress(key: Uint8Array) {
  assert(
    key instanceof Uint8Array &&
      isValidBytesKey(key, secp256k1.publicKeyLength),
    'Invalid key: The key must be a 65-byte, non-zero Uint8Array.',
  );

  return keccak256(key.slice(1)).slice(-20);
}

/**
 * Derive a BIP-32 child key with a given path from a parent key.
 *
 * @param options - The options for deriving a child key.
 * @param options.path - The derivation path part to derive.
 * @param options.node - The node to derive from.
 * @param options.curve - The curve to use for derivation.
 * @param options.specification - The specification to use for derivation.
 * @returns A tuple containing the derived private key, public key and chain
 * code.
 */
export async function deriveChildKey({
  path,
  node,
  curve,
  specification,
}: DeriveChildKeyArgs): Promise<SLIP10Node> {
  assert(typeof path === 'string', 'Invalid path: Must be a string.');
  validateSpecification(specification);
  assert(
    curve.name !== 'ed25519' || specification === 'slip10',
    'Invalid specification: The ed25519 curve only supports "slip10".',
  );

  const isHardened = path.includes(`'`);
  if (!isHardened && !curve.deriveUnhardenedKeys) {
    throw new Error(
      `Invalid path: Cannot derive unhardened child keys with ${curve.name}.`,
    );
  }

  if (!node) {
    throw new Error('Invalid parameters: Must specify a node to derive from.');
  }

  if (isHardened && !node.privateKey) {
    throw new Error(
      'Invalid parameters: Cannot derive hardened child keys without a private key.',
    );
  }

  const indexPart = path.split(`'`)[0];
  const childIndex = parseInt(indexPart, 10);

  if (
    !/^\d+$/u.test(indexPart) ||
    !Number.isInteger(childIndex) ||
    childIndex < 0 ||
    childIndex >= BIP_32_HARDENED_OFFSET
  ) {
    throw new Error(
      `Invalid BIP-32 index: The index must be a non-negative decimal integer less than ${BIP_32_HARDENED_OFFSET}.`,
    );
  }

  if (node.privateKeyBytes) {
    const secretExtension = await deriveSecretExtension({
      privateKey: node.privateKeyBytes,
      childIndex,
      isHardened,
      curve,
    });

    const entropy = generateEntropy({
      chainCode: node.chainCodeBytes,
      extension: secretExtension,
    });

    return derivePrivateChildKey({
      entropy,
      privateKey: node.privateKeyBytes,
      chainCode: node.chainCodeBytes,
      depth: node.depth,
      masterFingerprint: node.masterFingerprint,
      parentFingerprint: node.fingerprint,
      childIndex,
      isHardened,
      curve,
      specification,
    });
  }

  const publicExtension = derivePublicExtension({
    parentPublicKey: node.compressedPublicKeyBytes,
    childIndex,
  });

  const entropy = generateEntropy({
    chainCode: node.chainCodeBytes,
    extension: publicExtension,
  });

  return derivePublicChildKey({
    entropy,
    publicKey: node.compressedPublicKeyBytes,
    chainCode: node.chainCodeBytes,
    depth: node.depth,
    masterFingerprint: node.masterFingerprint,
    parentFingerprint: node.fingerprint,
    childIndex,
    curve,
    specification,
  });
}

type DerivePrivateChildKeyArgs = {
  entropy: Uint8Array;
  privateKey: Uint8Array;
  chainCode: Uint8Array;
  depth: number;
  masterFingerprint?: number;
  parentFingerprint: number;
  childIndex: number;
  isHardened: boolean;
  curve: Curve;
  specification: Specification;
};

/**
 * Derive a BIP-32 private child key with a given path from a parent key.
 *
 * @param args - The arguments for deriving a private child key.
 * @param args.entropy - The entropy to use for derivation.
 * @param args.privateKey - The parent private key to use for derivation.
 * @param args.chainCode - The parent chain code to use for derivation.
 * @param args.depth - The depth of the parent node.
 * @param args.masterFingerprint - The fingerprint of the master node.
 * @param args.parentFingerprint - The fingerprint of the parent node.
 * @param args.childIndex - The child index to derive.
 * @param args.isHardened - Whether the child index is hardened.
 * @param args.curve - The curve to use for derivation.
 * @param args.specification - The specification to use for derivation.
 * @returns The derived {@link SLIP10Node}.
 */
async function derivePrivateChildKey({
  entropy,
  privateKey,
  chainCode,
  depth,
  masterFingerprint,
  parentFingerprint,
  childIndex,
  isHardened,
  curve,
  specification,
}: DerivePrivateChildKeyArgs): Promise<SLIP10Node> {
  const actualChildIndex =
    childIndex + (isHardened ? BIP_32_HARDENED_OFFSET : 0);

  try {
    const { privateKey: childPrivateKey, chainCode: childChainCode } =
      await generateKey({
        privateKey,
        entropy,
        curve,
      });

    return await SLIP10Node.fromExtendedKey({
      privateKey: childPrivateKey,
      chainCode: childChainCode,
      depth: depth + 1,
      masterFingerprint,
      parentFingerprint,
      index: actualChildIndex,
      curve: curve.name,
      specification,
    });
  } catch (error) {
    // `ed25519` keys are always valid, so this error should never be thrown.
    if (curve.name === 'ed25519') {
      throw error;
    }

    // In the case of an invalid key being generated, BIP-32 and SLIP-10 specify
    // a different method for handling it. BIP-32 specifies that the child index
    // should be incremented by one and the derivation should be attempted
    // again. SLIP-10 specifies that the generated chain code should be used
    // instead of the parent chain code.

    switch (specification) {
      case 'bip32': {
        validateBIP32Index(childIndex + 1);

        const secretExtension = await deriveSecretExtension({
          privateKey,
          childIndex: childIndex + 1,
          isHardened,
          curve,
        });

        const newEntropy = generateEntropy({
          chainCode,
          extension: secretExtension,
        });

        // As per BIP-32, if the resulting key is invalid, the key is generated
        // from the next child index instead.
        return await derivePrivateChildKey({
          entropy: newEntropy,
          privateKey,
          chainCode,
          depth,
          masterFingerprint,
          parentFingerprint,
          childIndex: childIndex + 1,
          isHardened,
          curve,
          specification,
        });
      }

      case 'slip10': {
        // As per SLIP-10, if the resulting key is invalid, the new entropy is
        // generated as follows:
        // Key material (32 bytes), child chain code (32 bytes) =
        //   HMAC-SHA512(parent chain code, 0x01 || chain code from invalid key || index).
        const newEntropy = generateEntropy({
          chainCode,
          extension: concatBytes([
            0x01,
            entropy.slice(32, 64),
            numberToUint32(actualChildIndex),
          ]),
        });

        return await derivePrivateChildKey({
          entropy: newEntropy,
          privateKey,
          chainCode,
          depth,
          masterFingerprint,
          parentFingerprint,
          childIndex,
          isHardened,
          curve,
          specification,
        });
      }

      /* c8 ignore next 2 */
      default:
        return assertExhaustive(specification);
    }
  }
}

type DerivePublicChildKeyArgs = {
  entropy: Uint8Array;
  publicKey: Uint8Array;
  chainCode: Uint8Array;
  depth: number;
  masterFingerprint?: number;
  parentFingerprint: number;
  childIndex: number;
  curve: Curve;
  specification: Specification;
};

/**
 * Derive a BIP-32 public child key with a given path from a parent key.
 *
 * @param args - The arguments for deriving a public child key.
 * @param args.entropy - The entropy to use for derivation.
 * @param args.publicKey - The parent public key to use for derivation.
 * @param args.chainCode - The parent chain code to use for derivation.
 * @param args.depth - The depth of the parent node.
 * @param args.masterFingerprint - The fingerprint of the master node.
 * @param args.parentFingerprint - The fingerprint of the parent node.
 * @param args.childIndex - The child index to derive.
 * @param args.curve - The curve to use for derivation.
 * @param args.specification - The specification to use for derivation.
 * @returns The derived {@link SLIP10Node}.
 */
async function derivePublicChildKey({
  entropy,
  publicKey,
  chainCode,
  depth,
  masterFingerprint,
  parentFingerprint,
  childIndex,
  curve,
  specification,
}: DerivePublicChildKeyArgs): Promise<SLIP10Node> {
  try {
    const { publicKey: childPublicKey, chainCode: childChainCode } =
      generatePublicKey({
        publicKey,
        entropy,
        curve,
      });

    return await SLIP10Node.fromExtendedKey({
      publicKey: childPublicKey,
      chainCode: childChainCode,
      depth: depth + 1,
      masterFingerprint,
      parentFingerprint,
      index: childIndex,
      curve: curve.name,
      specification,
    });
  } catch (error) {
    // In the case of an invalid key being generated, BIP-32 and SLIP-10 specify
    // a different method for handling it. BIP-32 specifies that the child index
    // should be incremented by one and the derivation should be attempted
    // again. SLIP-10 specifies that the generated chain code should be used
    // instead of the parent chain code.

    switch (specification) {
      case 'bip32': {
        validateBIP32Index(childIndex + 1);

        const publicExtension = derivePublicExtension({
          parentPublicKey: publicKey,
          childIndex: childIndex + 1,
        });

        const newEntropy = generateEntropy({
          chainCode,
          extension: publicExtension,
        });

        // As per BIP-32, if the resulting key is invalid, the key is generated
        // from the next child index instead.
        return await derivePublicChildKey({
          entropy: newEntropy,
          publicKey,
          chainCode,
          depth,
          masterFingerprint,
          parentFingerprint,
          childIndex: childIndex + 1,
          curve,
          specification,
        });
      }

      case 'slip10': {
        // As per SLIP-10, if the resulting key is invalid, the new entropy is
        // generated as follows:
        // Key material (32 bytes), child chain code (32 bytes) =
        //   HMAC-SHA512(parent chain code, 0x01 || chain code from invalid key || index).
        const newEntropy = generateEntropy({
          chainCode,
          extension: concatBytes([
            0x01,
            entropy.slice(32, 64),
            numberToUint32(childIndex),
          ]),
        });

        return await derivePublicChildKey({
          entropy: newEntropy,
          publicKey,
          chainCode,
          depth,
          masterFingerprint,
          parentFingerprint,
          childIndex,
          curve,
          specification,
        });
      }

      /* c8 ignore next 2 */
      default:
        return assertExhaustive(specification);
    }
  }
}

type DeriveSecretExtensionArgs = {
  privateKey: Uint8Array;
  childIndex: number;
  isHardened: boolean;
  curve: Curve;
};

/**
 * Derive a BIP-32 secret extension from a parent key and child index.
 *
 * @param options - The options for deriving a secret extension.
 * @param options.privateKey - The parent private key bytes.
 * @param options.childIndex - The child index to derive.
 * @param options.isHardened - Whether the child index is hardened.
 * @param options.curve - The curve to use for derivation.
 * @returns The secret extension bytes.
 */
async function deriveSecretExtension({
  privateKey,
  childIndex,
  isHardened,
  curve,
}: DeriveSecretExtensionArgs) {
  if (isHardened) {
    // Hardened child
    return concatBytes([
      new Uint8Array([0]),
      privateKey,
      numberToUint32(childIndex + BIP_32_HARDENED_OFFSET),
    ]);
  }

  // Normal child
  const parentPublicKey = await curve.getPublicKey(privateKey, true);
  return derivePublicExtension({ parentPublicKey, childIndex });
}

type DerivePublicExtensionArgs = {
  parentPublicKey: Uint8Array;
  childIndex: number;
};

/**
 * Derive a BIP-32 public extension from a parent key and child index.
 *
 * @param options - The options for deriving a public extension.
 * @param options.parentPublicKey - The parent public key bytes.
 * @param options.childIndex - The child index to derive.
 * @returns The public extension bytes.
 */
function derivePublicExtension({
  parentPublicKey,
  childIndex,
}: DerivePublicExtensionArgs) {
  const indexBytes = new Uint8Array(4);
  const view = new DataView(indexBytes.buffer);

  view.setUint32(0, childIndex, false);
  return concatBytes([parentPublicKey, indexBytes]);
}

/**
 * Add a tweak to the private key: `(privateKey + tweak) % n`.
 *
 * @param privateKeyBytes - The private key as 32 byte Uint8Array.
 * @param tweakBytes - The tweak as 32 byte Uint8Array.
 * @param curve - The curve to use.
 * @throws If the private key or tweak is invalid.
 * @returns The private key with the tweak added to it.
 */
export function privateAdd(
  privateKeyBytes: Uint8Array,
  tweakBytes: Uint8Array,
  curve: Curve,
): Uint8Array {
  assert(
    isValidBytesKey(tweakBytes, 32),
    'Invalid tweak: Tweak must be a non-zero 32-byte Uint8Array.',
  );

  const privateKey = bytesToBigInt(privateKeyBytes);
  const tweak = bytesToBigInt(tweakBytes);

  if (tweak >= curve.curve.n) {
    throw new Error('Invalid tweak: Tweak is larger than the curve order.');
  }

  const added = mod(privateKey + tweak, curve.curve.n);
  const bytes = hexToBytes(added.toString(16).padStart(64, '0'));

  if (!curve.isValidPrivateKey(bytes)) {
    throw new Error(
      'Invalid private key or tweak: The resulting private key is invalid.',
    );
  }

  return bytes;
}

type GenerateEntropyArgs = {
  chainCode: Uint8Array;
  extension: Uint8Array;
};

/**
 * Generate 64 bytes of (deterministic) entropy from a chain code and secret
 * extension.
 *
 * @param args - The arguments for generating entropy.
 * @param args.chainCode - The parent chain code bytes.
 * @param args.extension - The extension bytes.
 * @returns The generated entropy bytes.
 */
function generateEntropy({ chainCode, extension }: GenerateEntropyArgs) {
  return hmac(sha512, chainCode, extension);
}

type GenerateKeyArgs = {
  privateKey: Uint8Array;
  entropy: Uint8Array;
  curve: Curve;
};

/**
 * Derive a BIP-32 key from a parent key and secret extension.
 *
 * @param options - The options for deriving a key.
 * @param options.privateKey - The parent private key bytes.
 * @param options.entropy - The entropy bytes.
 * @param options.curve - The curve to use for derivation.
 * @returns The derived key.
 */
async function generateKey({
  privateKey,
  entropy,
  curve,
}: GenerateKeyArgs): Promise<DerivedKeys & { privateKey: Uint8Array }> {
  const keyMaterial = entropy.slice(0, 32);
  const childChainCode = entropy.slice(32);

  // If curve is ed25519: The returned child key ki is parse256(IL).
  // https://github.com/satoshilabs/slips/blob/133ea52a8e43d338b98be208907e144277e44c0e/slip-0010.md#private-parent-key--private-child-key
  if (curve.name === 'ed25519') {
    const publicKey = await curve.getPublicKey(keyMaterial);
    return { privateKey: keyMaterial, publicKey, chainCode: childChainCode };
  }

  const childPrivateKey = privateAdd(privateKey, keyMaterial, curve);
  const publicKey = await curve.getPublicKey(childPrivateKey);

  return { privateKey: childPrivateKey, publicKey, chainCode: childChainCode };
}

type GeneratePublicKeyArgs = {
  publicKey: Uint8Array;
  entropy: Uint8Array;
  curve: Curve;
};

/**
 * Derive a BIP-32 public key from a parent key and public extension.
 *
 * @param options - The options for deriving a public key.
 * @param options.publicKey - The parent public key bytes.
 * @param options.entropy - The entropy bytes.
 * @param options.curve - The curve to use for derivation.
 * @returns The derived public key.
 */
function generatePublicKey({
  publicKey,
  entropy,
  curve,
}: GeneratePublicKeyArgs): DerivedKeys {
  const keyMaterial = entropy.slice(0, 32);
  const childChainCode = entropy.slice(32);

  // This function may fail if the resulting key is invalid.
  const childPublicKey = curve.publicAdd(publicKey, keyMaterial);

  return {
    publicKey: childPublicKey,
    chainCode: childChainCode,
  };
}
