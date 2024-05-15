import { mnemonicToEntropy, mnemonicToSeed } from '@metamask/scure-bip39';
import { wordlist as englishWordlist } from '@metamask/scure-bip39/dist/wordlists/english';
import { assert } from '@metamask/utils';
import { hmac } from '@noble/hashes/hmac';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha512 } from '@noble/hashes/sha512';

import type { DeriveChildKeyArgs } from '.';
import type { BIP39StringNode } from '../constants';
import { BYTES_KEY_LENGTH } from '../constants';
import type { Curve } from '../curves';
import { SLIP10Node } from '../SLIP10Node';
import { getFingerprint } from '../utils';

/**
 * Convert a BIP-39 mnemonic phrase to a multi path.
 *
 * @param mnemonic - The BIP-39 mnemonic phrase to convert.
 * @returns The multi path.
 */
export function bip39MnemonicToMultipath(mnemonic: string): BIP39StringNode {
  return `bip39:${mnemonic.toLowerCase().trim()}`;
}

/**
 * Create a {@link SLIP10Node} from a BIP-39 mnemonic phrase.
 *
 * @param options - The options for creating the node.
 * @param options.path - The multi path.
 * @param options.curve - The curve to use for derivation.
 * @returns The node.
 */
export async function deriveChildKey({
  path,
  curve,
}: DeriveChildKeyArgs): Promise<SLIP10Node> {
  switch (curve.masterNodeGenerationSpec) {
    case 'slip10':
      return createBip39KeyFromSeed(
        await mnemonicToSeed(path, englishWordlist),
        curve,
      );
    case 'cip3':
      return entropyToCip3MasterNode(
        mnemonicToEntropy(path, englishWordlist),
        curve,
      );
    default:
      throw new Error('Unsupported master node generation spec.');
  }
}

/**
 * Create a {@link SLIP10Node} from a BIP-39 seed.
 *
 * @param seed - The cryptographic seed bytes.
 * @param curve - The curve to use.
 * @returns An object containing the corresponding BIP-39 master key and chain
 * code.
 */
export async function createBip39KeyFromSeed(
  seed: Uint8Array,
  curve: Extract<Curve, { masterNodeGenerationSpec: 'slip10' }>,
): Promise<SLIP10Node> {
  assert(
    seed.length >= 16 && seed.length <= 64,
    'Invalid seed: The seed must be between 16 and 64 bytes long.',
  );

  const key = hmac(sha512, curve.secret, seed);
  const privateKey = key.slice(0, BYTES_KEY_LENGTH);
  const chainCode = key.slice(BYTES_KEY_LENGTH);

  assert(
    curve.isValidPrivateKey(privateKey),
    'Invalid private key: The private key must greater than 0 and less than the curve order.',
  );

  const masterFingerprint = getFingerprint(
    await curve.getPublicKey(privateKey, true),
    curve.compressedPublicKeyLength,
  );

  return SLIP10Node.fromExtendedKey({
    privateKey,
    chainCode,
    masterFingerprint,
    depth: 0,
    parentFingerprint: 0,
    index: 0,
    curve: curve.name,
  });
}

/**
 * Create a {@link SLIP10Node} from BIP-39 entropy.
 * This function is consistent with the Icarus derivation scheme.
 * Icarus root key derivation scheme: https://github.com/cardano-foundation/CIPs/blob/09d7d8ee1bd64f7e6b20b5a6cae088039dce00cb/CIP-0003/Icarus.md.
 * CIP3: https://github.com/cardano-foundation/CIPs/blob/09d7d8ee1bd64f7e6b20b5a6cae088039dce00cb/CIP-0003/CIP-0003.md#master-key-generation.
 *
 * @param entropy - The entropy value.
 * @param curve - The curve to use.
 * @returns The root key pair consisting of 64-byte private key and 32-byte chain code.
 */
export async function entropyToCip3MasterNode(
  entropy: Uint8Array,
  curve: Extract<Curve, { masterNodeGenerationSpec: 'cip3' }>,
): Promise<SLIP10Node> {
  assert(
    entropy.length >= 16 && entropy.length <= 64,
    'Invalid entropy: The entropy must be between 16 and 64 bytes long.',
  );

  const rootNode = pbkdf2(sha512, curve.secret, entropy, {
    c: 4096,
    dkLen: 96,
  });

  // Consistent with the Icarus derivation scheme.
  // https://github.com/cardano-foundation/CIPs/blob/09d7d8ee1bd64f7e6b20b5a6cae088039dce00cb/CIP-0003/Icarus.md
  /* eslint-disable no-bitwise */
  rootNode[0] &= 0b1111_1000;
  rootNode[31] &= 0b0001_1111;
  rootNode[31] |= 0b0100_0000;
  /* eslint-enable no-bitwise */

  const privateKey = rootNode.slice(0, curve.privateKeyLength);
  const chainCode = rootNode.slice(curve.privateKeyLength);

  assert(curve.isValidPrivateKey(privateKey), 'Invalid private key.');

  const masterFingerprint = getFingerprint(
    await curve.getPublicKey(privateKey),
    curve.compressedPublicKeyLength,
  );

  return SLIP10Node.fromExtendedKey({
    privateKey,
    chainCode,
    masterFingerprint,
    depth: 0,
    parentFingerprint: 0,
    index: 0,
    curve: curve.name,
  });
}
