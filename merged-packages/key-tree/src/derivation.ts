import {
  BIP_32_PATH_REGEX,
  BIP_39_PATH_REGEX,
  MAX_BIP_44_DEPTH,
  MIN_BIP_44_DEPTH,
  SLIP10Path,
} from './constants';
import { Deriver, derivers } from './derivers';
import { SLIP10Node } from './SLIP10Node';
import { BIP44Node } from './BIP44Node';
import { BIP44CoinTypeNode } from './BIP44CoinTypeNode';
import { getCurveByName, SupportedCurve } from './curves';

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

type BaseDeriveKeyFromPathArgs = {
  path: SLIP10Path;
  depth?: number;
};

type DeriveKeyFromPathNodeArgs = BaseDeriveKeyFromPathArgs & {
  node?: SLIP10Node | BIP44Node | BIP44CoinTypeNode;
};

type DeriveKeyFromPathCurveArgs = BaseDeriveKeyFromPathArgs & {
  curve: SupportedCurve;
};

type DeriveKeyFromPathArgs =
  | DeriveKeyFromPathNodeArgs
  | DeriveKeyFromPathCurveArgs;

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
 * @param args
 * @param args.path - A full or partial HD path, e.g.:
 * bip39:SEED_PHRASE/bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:0
 *
 * BIP-39 seed phrases must be lowercase, space-delimited, and 12-24 words long.
 * @param args.node - The node to derive from.
 * @param args.depth - The depth of the segment.
 * @returns The derived key.
 */
export async function deriveKeyFromPath(
  args: DeriveKeyFromPathArgs,
): Promise<SLIP10Node> {
  const { path, depth = path.length } = args;

  const node = 'node' in args ? args.node : undefined;
  const curve = 'curve' in args ? args.curve : node?.curve;

  if (
    node &&
    !(node instanceof SLIP10Node) &&
    !(node instanceof BIP44Node) &&
    !(node instanceof BIP44CoinTypeNode)
  ) {
    throw new Error(
      'Invalid arguments: Node must be a SLIP-10 node or a BIP-44 node when provided.',
    );
  }

  if (!curve) {
    throw new Error(
      'Invalid arguments: Must specify either a parent node or curve.',
    );
  }

  validatePathSegment(
    path,
    Boolean(node?.privateKey) || Boolean(node?.publicKey),
    depth,
  );

  // derive through each part of path
  // `pathSegment` needs to be cast to `string[]` because `HDPathTuple.reduce()` doesn't work
  return await (path as readonly string[]).reduce<Promise<SLIP10Node>>(
    async (promise, pathNode) => {
      const derivedNode = await promise;

      const [pathType, pathPart] = pathNode.split(':');
      /* istanbul ignore if: should be impossible */
      if (!hasDeriver(pathType)) {
        throw new Error(`Unknown derivation type: "${pathType}"`);
      }

      const deriver = derivers[pathType] as Deriver;
      return await deriver.deriveChildKey({
        path: pathPart,
        node: derivedNode,
        curve: getCurveByName(curve),
      });
    },
    Promise.resolve(node as SLIP10Node),
  );
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
 * @param path - The path segment string to validate.
 * @param hasKey
 * @param depth
 */
export function validatePathSegment(
  path: SLIP10Path,
  hasKey: boolean,
  depth?: number,
) {
  if ((path as any).length === 0) {
    throw new Error(`Invalid HD path segment: The segment must not be empty.`);
  }

  if (path.length - 1 > MAX_BIP_44_DEPTH) {
    throw new Error(
      `Invalid HD path segment: The segment cannot exceed a 0-indexed depth of 5.`,
    );
  }

  let startsWithBip39 = false;
  path.forEach((node, index) => {
    if (index === 0) {
      startsWithBip39 = BIP_39_PATH_REGEX.test(node);
      if (!startsWithBip39 && !BIP_32_PATH_REGEX.test(node)) {
        throw getMalformedError();
      }
    } else if (!BIP_32_PATH_REGEX.test(node)) {
      throw getMalformedError();
    }
  });

  if (depth === MIN_BIP_44_DEPTH && (!startsWithBip39 || path.length !== 1)) {
    throw new Error(
      `Invalid HD path segment: The segment must consist of a single BIP-39 node for depths of ${MIN_BIP_44_DEPTH}. Received: "${path}".`,
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
