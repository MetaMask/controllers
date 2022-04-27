import { keccak_256 as keccak256 } from '@noble/hashes/sha3';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { BIP_32_HARDENED_OFFSET, BUFFER_KEY_LENGTH } from '../constants';
import { bytesToNumber, hexStringToBuffer, isValidBufferKey } from '../utils';
import { Curve, mod, secp256k1 } from '../curves';
import { SLIP10Node } from '../SLIP10Node';
import { DeriveChildKeyArgs, DerivedKeys } from '.';

/**
 * Converts a BIP-32 private key to an Ethereum address.
 *
 * **WARNING:** Only validates that the key is non-zero and of the correct
 * length. It is the consumer's responsibility to ensure that the specified
 * key is a valid BIP-44 Ethereum `address_index` key.
 *
 * @param key - The `address_index` private key buffer to convert to an Ethereum
 * address.
 * @returns The Ethereum address corresponding to the given key.
 */
export function privateKeyToEthAddress(key: Buffer) {
  if (!Buffer.isBuffer(key) || !isValidBufferKey(key, BUFFER_KEY_LENGTH)) {
    throw new Error('Invalid key: The key must be a 32-byte, non-zero Buffer.');
  }

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
 * @param key - The `address_index` public key buffer to convert to an Ethereum
 * address.
 * @returns The Ethereum address corresponding to the given key.
 */
export function publicKeyToEthAddress(key: Buffer) {
  if (
    !Buffer.isBuffer(key) ||
    !isValidBufferKey(key, secp256k1.publicKeyLength)
  ) {
    throw new Error('Invalid key: The key must be a 65-byte, non-zero Buffer.');
  }

  return Buffer.from(keccak256(key.slice(1)).slice(-20));
}

/**
 * Derive a BIP-32 child key with a given path from a parent key.
 *
 * @param path - The derivation path part to derive.
 * @param node - The node to derive from.
 * @param curve - The curve to use for derivation.
 * @returns A tuple containing the derived private key, public key and chain
 * code.
 */
export async function deriveChildKey({
  path,
  node,
  curve = secp256k1,
}: DeriveChildKeyArgs): Promise<SLIP10Node> {
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

  if (node.privateKeyBuffer) {
    const secretExtension = await deriveSecretExtension({
      privateKey: node.privateKeyBuffer,
      childIndex,
      isHardened,
      curve,
    });

    const { privateKey, chainCode } = await generateKey({
      privateKey: node.privateKeyBuffer,
      chainCode: node.chainCodeBuffer,
      secretExtension,
      curve,
    });

    return SLIP10Node.fromExtendedKey({
      privateKey,
      chainCode,
      depth: node.depth + 1,
      parentFingerprint: node.fingerprint,
      index: childIndex + (isHardened ? BIP_32_HARDENED_OFFSET : 0),
      curve: curve.name,
    });
  }

  const publicExtension = await derivePublicExtension({
    parentPublicKey: node.compressedPublicKeyBuffer,
    childIndex,
    curve,
  });

  const { publicKey, chainCode } = generatePublicKey({
    publicKey: node.compressedPublicKeyBuffer,
    chainCode: node.chainCodeBuffer,
    publicExtension,
    curve,
  });

  return SLIP10Node.fromExtendedKey({
    publicKey,
    chainCode,
    depth: node.depth + 1,
    parentFingerprint: node.fingerprint,
    index: childIndex,
    curve: curve.name,
  });
}

type DeriveSecretExtensionArgs = {
  privateKey: Buffer;
  childIndex: number;
  isHardened: boolean;
  curve: Curve;
};

// the bip32 secret extension is created from the parent private or public key and the child index
/**
 * @param options
 * @param options.privateKey
 * @param options.childIndex
 * @param options.isHardened
 */
async function deriveSecretExtension({
  privateKey,
  childIndex,
  isHardened,
  curve,
}: DeriveSecretExtensionArgs) {
  if (isHardened) {
    // Hardened child
    const indexBuffer = Buffer.allocUnsafe(4);
    indexBuffer.writeUInt32BE(childIndex + BIP_32_HARDENED_OFFSET, 0);
    const pk = privateKey;
    const zb = Buffer.alloc(1, 0);
    return Buffer.concat([zb, pk, indexBuffer]);
  }

  // Normal child
  const indexBuffer = Buffer.allocUnsafe(4);
  indexBuffer.writeUInt32BE(childIndex, 0);
  const parentPublicKey = await curve.getPublicKey(privateKey, true);
  return Buffer.concat([parentPublicKey, indexBuffer]);
}

type DerivePublicExtensionArgs = {
  parentPublicKey: Buffer;
  childIndex: number;
  curve: Curve;
};

async function derivePublicExtension({
  parentPublicKey,
  childIndex,
}: DerivePublicExtensionArgs) {
  const indexBuffer = Buffer.alloc(4);
  indexBuffer.writeUInt32BE(childIndex, 0);
  return Buffer.concat([parentPublicKey, indexBuffer]);
}

/**
 * Add a tweak to the private key: `(privateKey + tweak) % n`.
 *
 * @param privateKeyBuffer - The private key as 32 byte Uint8Array.
 * @param tweakBuffer - The tweak as 32 byte Uint8Array.
 * @param curve - The curve to use.
 * @throws If the private key or tweak is invalid.
 * @returns The private key with the tweak added to it.
 */
export function privateAdd(
  privateKeyBuffer: Uint8Array,
  tweakBuffer: Uint8Array,
  curve: Curve,
): Buffer {
  const privateKey = bytesToNumber(privateKeyBuffer);
  const tweak = bytesToNumber(tweakBuffer);

  if (tweak >= curve.curve.n) {
    throw new Error('Invalid tweak: Tweak is larger than the curve order.');
  }

  const added = mod(privateKey + tweak, curve.curve.n);
  if (!curve.isValidPrivateKey(added)) {
    throw new Error(
      'Invalid private key or tweak: The resulting private key is invalid.',
    );
  }

  return hexStringToBuffer(added.toString(16).padStart(64, '0'));
}

type GenerateKeyArgs = {
  privateKey: Buffer;
  chainCode: Buffer;
  secretExtension: Buffer;
  curve: Curve;
};

/**
 * @param options
 * @param options.privateKey
 * @param options.chainCode
 * @param options.secretExtension
 */
async function generateKey({
  privateKey,
  chainCode,
  secretExtension,
  curve,
}: GenerateKeyArgs): Promise<DerivedKeys & { privateKey: Buffer }> {
  const entropy = hmac(sha512, chainCode, secretExtension);
  const keyMaterial = Buffer.from(entropy.slice(0, 32));
  const childChainCode = Buffer.from(entropy.slice(32));

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
  publicKey: Buffer;
  chainCode: Buffer;
  publicExtension: Buffer;
  curve: Curve;
};

function generatePublicKey({
  publicKey,
  chainCode,
  publicExtension,
  curve,
}: GeneratePublicKeyArgs): DerivedKeys {
  const entropy = hmac(sha512, chainCode, publicExtension);
  const keyMaterial = entropy.slice(0, 32);
  const childChainCode = entropy.slice(32);

  // This function may fail if the resulting key is invalid.
  const childPublicKey = curve.publicAdd(publicKey, Buffer.from(keyMaterial));

  return {
    publicKey: Buffer.from(childPublicKey),
    chainCode: Buffer.from(childChainCode),
  };
}
