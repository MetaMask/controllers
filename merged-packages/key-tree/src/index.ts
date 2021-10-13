import bip39 from 'bip39';
import { derivers, Deriver } from './derivers';

/**
 * Converts the given BIP-39 mnemonic to a cryptographic seed.
 *
 * @param mnemonic - The BIP-39 mnemonic.
 * @returns The cryptographic seed corresponding to the given mnemonic.
 */
export function mnemonicToSeed(mnemonic: string): Buffer {
  return bip39.mnemonicToSeed(mnemonic);
}

/**
 * ethereum default seed path: "m/44'/60'/0'/0/{account_index}"
 * multipath: "bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:{account_index}"
 *
 * m: { privateKey, chainCode } = sha512Hmac("Bitcoin seed", masterSeed)
 * 44': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
 * 60': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
 * 0': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
 * 0: { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [parentKey.publicKey, index])
 * 0: { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [parentKey.publicKey, index])
 */

/**
 * Takes a full or partial HD path string and returns the key corresponding to
 * the given path, with the following constraints:
 *
 * - If the path starts with a BIP-32 segment, a parent key must be provided.
 * - If the path starts with a BIP-39 segment, a parent key may NOT be provided.
 * - The path cannot exceed 5 BIP-32 segments in length, optionally preceded by
 *   a single BIP-39 segment.
 *
 * WARNING: It is the consumer's responsibility to ensure that the path is valid
 * relative to its parent key.
 *
 * @param pathSegment - A full or partial HD path, e.g.:
 * bip39:SEED_PHRASE/bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:0
 *
 * BIP-39 seed phrases must be lowercase, space-delimited, and 12-24 words long.
 * @param parentKey - The parent key of the given path segment, if any.
 * @returns The derived key.
 */
export function deriveKeyFromPath(
  pathSegment: string,
  parentKey?: Buffer,
): Buffer {
  validateDeriveKeyParams(pathSegment, parentKey);

  let key = parentKey;

  // derive through each part of path
  pathSegment.split('/').forEach((path) => {
    const [pathType, pathValue] = path.split(':');
    if (!hasDeriver(pathType)) {
      throw new Error(`Unknown derivation type "${pathType}"`);
    }
    const deriver = derivers[pathType] as Deriver;
    const childKey = deriver.deriveChildKey(pathValue, key);
    // continue deriving from child key
    key = childKey;
  });

  return key as Buffer;
}

/**
 * @param pathType
 */
function hasDeriver(pathType: string): pathType is keyof typeof derivers {
  return pathType in derivers;
}

/**
 * e.g.
 * -  bip32:0
 * -  bip32:0'
 */
const BIP_32_PATH_REGEX = /^bip32:\d+'?$/u;

/**
 * bip39:<SPACE_DELMITED_SEED_PHRASE>
 *
 * The seed phrase must consist of 12 <= 24 words.
 */
const BIP_39_PATH_REGEX = /^bip39:([a-z]+){1}( [a-z]+){11,23}$/u;

/**
 * e.g.
 * -  bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:0
 * -  bip39:<SPACE_DELMITED_SEED_PHRASE>/bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:0
 */
const MULTI_PATH_REGEX =
  /^(bip39:([a-z]+){1}( [a-z]+){11,23}\/)?(bip32:\d+'?\/){0,4}(bip32:\d+'?)$/u;

/**
 * @param pathSegment
 * @param parentKey
 */
function validateDeriveKeyParams(pathSegment: string, parentKey?: Buffer) {
  // The path segment must be one of the following:
  // - A lone BIP-32 path segment
  // - A lone BIP-39 path segment
  // - A multipath
  if (
    !(
      BIP_32_PATH_REGEX.test(pathSegment) ||
      BIP_39_PATH_REGEX.test(pathSegment) ||
      MULTI_PATH_REGEX.test(pathSegment)
    )
  ) {
    throw new Error(
      'Invalid HD path segment. Ensure that the HD path segment is correctly formatted.',
    );
  }

  // BIP-39 segments can only initiate HD paths
  if (BIP_39_PATH_REGEX.test(pathSegment) && parentKey) {
    throw new Error('May not specify parent key and BIP-39 path segment.');
  }

  // BIP-32 segments cannot initiate HD paths
  if (!pathSegment.startsWith('bip39') && !parentKey) {
    throw new Error(
      'Must specify parent key if the first path of the path segment is not BIP-39.',
    );
  }

  // The parent key must be a Buffer
  if (parentKey && !Buffer.isBuffer(parentKey)) {
    throw new Error('Parent key must be a Buffer if specified.');
  }
}
