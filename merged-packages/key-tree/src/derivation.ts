import {
  BIP_32_PATH_REGEX,
  BIP_39_PATH_REGEX,
  MAX_BIP_44_DEPTH,
  MIN_BIP_44_DEPTH,
  SLIP10Path,
} from './constants';
import { Deriver, derivers } from './derivers';
import { Curve } from './curves';

/**
 * Ethereum default seed path: "m/44'/60'/0'/0/{account_index}"
 * Multipath: "bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:{account_index}"
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
 * @param parentPublicKey - The parent public key of the given path segment, if any.
 * @param parentChainCode - The chain code of the given path segment, if any.
 * @param depth - The depth of the segment.
 * @param curve - The curve to use.
 * @returns The derived key.
 */
export async function deriveKeyFromPath(
  pathSegment: SLIP10Path,
  parentKey?: Buffer,
  parentPublicKey?: Buffer,
  parentChainCode?: Buffer,
  depth?: number,
  curve?: Curve,
): Promise<[privateKey: Buffer, publicKey: Buffer, chainCode: Buffer]> {
  if (parentKey && !Buffer.isBuffer(parentKey)) {
    throw new Error('Parent key must be a Buffer if specified.');
  }

  validatePathSegment(pathSegment, Boolean(parentKey), depth);

  // derive through each part of path
  // `pathSegment` needs to be cast to `string[]` because `HDPathTuple.reduce()` doesn't work
  return await (pathSegment as readonly string[]).reduce<
    Promise<[Buffer, Buffer, Buffer]>
  >(async (promise, node) => {
    const [privateKey, publicKey, chainCode] = await promise;

    const [pathType, pathValue] = node.split(':');
    /* istanbul ignore if: should be impossible */
    if (!hasDeriver(pathType)) {
      throw new Error(`Unknown derivation type: "${pathType}"`);
    }

    const deriver = derivers[pathType] as Deriver;
    return await deriver.deriveChildKey(
      pathValue,
      privateKey,
      publicKey,
      chainCode,
      curve,
    );
  }, Promise.resolve([parentKey as Buffer, parentPublicKey as Buffer, parentChainCode as Buffer]));
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
 * @param hasKey
 * @param depth
 */
export function validatePathSegment(
  pathSegment: SLIP10Path,
  hasKey: boolean,
  depth?: number,
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
      `Invalid HD path segment: The segment must consist of a single BIP-39 node for depths of ${MIN_BIP_44_DEPTH}. Received: "${pathSegment}".`,
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
