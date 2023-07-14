import { assert } from '@metamask/utils';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3';

import type { DeriveChildKeyArgs } from '.';
import { BYTES_KEY_LENGTH } from '../constants';
import { secp256k1 } from '../curves';
import type { SLIP10Node } from '../SLIP10Node';
import { isValidBytesKey, validateBIP32Index } from '../utils';
import type { DeriveNodeArgs } from './shared';
import {
  deriveChildKey as sharedDeriveChildKey,
  deriveSecretExtension,
  generateEntropy,
  derivePublicExtension,
} from './shared';

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
 * @returns The derived child key as a {@link SLIP10Node}.
 */
export async function deriveChildKey(
  options: DeriveChildKeyArgs,
): Promise<SLIP10Node> {
  assert(
    options.curve.name === 'secp256k1',
    'Invalid curve: Only secp256k1 is supported by BIP-32.',
  );

  return sharedDeriveChildKey(options, handleError);
}

/**
 * Handles an error thrown during derivation by incrementing the child index
 * and retrying.
 *
 * @param _ - The error that was thrown.
 * @param options - The options for deriving a child key.
 * @returns The options for deriving a child key with the child index
 * incremented by one.
 */
async function handleError(
  _: unknown,
  options: DeriveNodeArgs,
): Promise<DeriveNodeArgs> {
  const { childIndex, privateKey, publicKey, isHardened, curve, chainCode } =
    options;

  validateBIP32Index(childIndex + 1);

  if (privateKey) {
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

    return {
      ...options,
      childIndex: childIndex + 1,
      entropy: newEntropy,
    };
  }

  const publicExtension = derivePublicExtension({
    parentPublicKey: publicKey,
    childIndex: childIndex + 1,
  });

  const newEntropy = generateEntropy({
    chainCode,
    extension: publicExtension,
  });

  return {
    ...options,
    childIndex: childIndex + 1,
    entropy: newEntropy,
  };
}
