import {
  stringToBytes,
  bytesToHex,
  hexToBigInt,
  remove0x,
} from '@metamask/utils';
import { mod } from '@noble/curves/abstract/modular';
import { ed25519 } from '@noble/curves/ed25519';

export const curve = ed25519.CURVE;

/**
 * Named after whitepaper: BIP32-Ed25519 Hierarchical Deterministic Keys over a Non-linear Keyspace
 * https://input-output-hk.github.io/adrestia/static/Ed25519_BIP.pdf
 * "vanilla" "ed25519" curve follows SLIP10: https://tezos.stackexchange.com/questions/2837/can-i-use-bip32-hd-key-pairs-to-derive-ed25519-addresses
 * note that that the important difference of the "bip32" version is that it allows unhardened key derivation
 */
export const name = 'ed25519Bip32';

// Secret is empty string if not provided by user
export const secret = stringToBytes('');

/**
 * Always returns true.
 * For root node derivation, https://github.com/cardano-foundation/CIPs/blob/09d7d8ee1bd64f7e6b20b5a6cae088039dce00cb/CIP-0003/Icarus.md does not mention any cases when the private key is invalid.
 * For child node derivation, https://input-output-hk.github.io/adrestia/static/Ed25519_BIP.pdf does not mention any cases when the private key is invalid.
 *
 * @param _privateKey - The private key to check.
 * @returns True.
 */
export const isValidPrivateKey = (_privateKey: Uint8Array | string | bigint) =>
  true;

export const deriveUnhardenedKeys = true;

export const publicKeyLength = 32;

/**
 * Converts a Uint8Array of bytes to a bigint in little-endian format.
 *
 * @param bytes - The Uint8Array of bytes to convert.
 * @returns The converted bigint value.
 */
export const bytesToNumberLE = (bytes: Uint8Array): bigint => {
  return hexToBigInt(bytesToHex(Uint8Array.from(bytes).reverse()));
};

/**
 * Multiplies the given key with the base point on the Edwards curve.
 * equivalent to https://github.com/jedisct1/libsodium/blob/93a6e79750a31bc0b946bf483b2ba1c77f9e94ce/src/libsodium/crypto_scalarmult/ed25519/ref10/scalarmult_ed25519_ref10.c#L105 .
 * which is used by cardano-js-sdk/crypto https://github.com/input-output-hk/cardano-js-sdk/blob/8a6db2a251cd1c956f52730a0d35de2b7fc67404/packages/crypto/src/Bip32/Bip32PrivateKey.ts#L161 .
 *
 * @param key - The key to multiply with the base point.
 * @returns The resulting point on the Edwards curve.
 */
export const multiplyWithBase = (key: Uint8Array): Uint8Array => {
  // Little-endian SHA512 with modulo n
  const scalar = mod(bytesToNumberLE(key), curve.n); // The actual scalar
  const point = ed25519.ExtendedPoint.BASE.multiply(scalar); // Point on Edwards curve aka public key
  return point.toRawBytes(); // Uint8Array representation
};

/**
 * Calculates the public key corresponding to a given private key.
 *
 * @param privateKey - The private key.
 * @param _compressed - Optional parameter to indicate if the public key should be compressed.
 * @returns The public key.
 */
export const getPublicKey = async (
  privateKey: Uint8Array,
  _compressed?: boolean,
): Promise<Uint8Array> => {
  return multiplyWithBase(privateKey.slice(0, 32));
};

/**
 * Adds a tweak to a public key.
 *
 * @param publicKey - The public key.
 * @param tweak - The tweak to add.
 * @returns The resulting public key.
 */
export const publicAdd = (
  publicKey: Uint8Array,
  tweak: Uint8Array,
): Uint8Array => {
  return ed25519.ExtendedPoint.fromHex(remove0x(bytesToHex(publicKey)))
    .add(ed25519.ExtendedPoint.fromHex(remove0x(bytesToHex(tweak))))
    .toRawBytes();
};

/**
 * Compresses an Ed25519 public key.
 *
 * @param publicKey - The public key to compress.
 * @returns The compressed public key.
 */
export const compressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  // Ed25519 public keys don't have a compressed form.
  return publicKey;
};

/**
 * Decompresses a compressed Ed25519Bip32 public key.
 *
 * @param publicKey - The compressed public key.
 * @returns The decompressed public key.
 */
export const decompressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  // Ed25519 public keys don't have a compressed form.
  return publicKey;
};

export const privateKeyLength = 64;

export const masterNodeGenerationSpec = 'cip3';

export const compressedPublicKeyLength = 32;
