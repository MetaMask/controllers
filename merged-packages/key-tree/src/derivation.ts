import {
  HDPathTuple,
  BIP44Depth,
  MAX_BIP_44_DEPTH,
  MIN_BIP_44_DEPTH,
  BIP_39_PATH_REGEX,
  BIP_32_PATH_REGEX,
} from './constants';
import { derivers, Deriver } from './derivers';

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
 * - If the path starts with a BIP-32 node, a parent key must be provided.
 * - If the path starts with a BIP-39 node, a parent key must NOT be provided.
 * - The path cannot exceed 5 BIP-32 nodes in length, optionally preceded by
 *   a single BIP-39 node.
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
  pathSegment: HDPathTuple,
  parentKey?: Buffer,
  depth?: BIP44Depth,
): Buffer {
  if (parentKey && !Buffer.isBuffer(parentKey)) {
    throw new Error('Parent key must be a Buffer if specified.');
  }
  validatePathSegment(pathSegment, Boolean(parentKey), depth);

  let key = parentKey;

  // derive through each part of path
  pathSegment.forEach((node) => {
    const [pathType, pathValue] = node.split(':');
    /* istanbul ignore if: should be impossible */
    if (!hasDeriver(pathType)) {
      throw new Error(`Unknown derivation type: "${pathType}"`);
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
 * The path segment must be one of the following:
 * - A lone BIP-32 path node
 * - A lone BIP-39 path node
 * - A multipath
 *
 * @param pathSegment - The path segment string to validate.
 */
export function validatePathSegment(
  pathSegment: HDPathTuple,
  hasKey: boolean,
  depth?: BIP44Depth,
) {
  if ((pathSegment as any).length === 0) {
    throw new Error(`Invalid HD path segment: The segment must not be empty.`);
  }

  if (pathSegment.length - 1 > MAX_BIP_44_DEPTH) {
    throw new Error(
      `Invalid HD path segment: The segment cannot exceed a 0-indexed depth of 5.`,
    );
  }

  let startsWithBip39 = false;
  pathSegment.forEach((node, index) => {
    if (index === 0) {
      startsWithBip39 = BIP_39_PATH_REGEX.test(node);
      if (!startsWithBip39 && !BIP_32_PATH_REGEX.test(node)) {
        throw getMalformedError();
      }
    } else if (!BIP_32_PATH_REGEX.test(node)) {
      throw getMalformedError();
    }
  });

  if (
    depth === MIN_BIP_44_DEPTH &&
    (!startsWithBip39 || pathSegment.length !== 1)
  ) {
    throw new Error(
      `Invalid HD path segment: The segment must consist of a single BIP-39 node for depths of ${MIN_BIP_44_DEPTH}. Received: "${pathSegment}"`,
    );
  }

  if (!hasKey && !startsWithBip39) {
    throw new Error(
      'Invalid derivation parameters: Must specify parent key if the first node of the path segment is not a BIP-39 node.',
    );
  }

  if (hasKey && startsWithBip39) {
    throw new Error(
      'Invalid derivation parameters: May not specify parent key if the path segment starts with a BIP-39 node.',
    );
  }
}

function getMalformedError() {
  throw new Error('Invalid HD path segment: The path segment is malformed.');
}
