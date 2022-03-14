import { mnemonicToSeedSync } from '@scure/bip39';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { BIP39Node } from '../constants';

// This magic constant is analogous to a salt, and is consistent across all
// major BIP-32 implementations.
const ROOT_BASE_SECRET = Buffer.from('Bitcoin seed', 'utf8');

/**
 * @param mnemonic
 */
export function bip39MnemonicToMultipath(mnemonic: string): BIP39Node {
  return `bip39:${mnemonic.toLowerCase().trim()}`;
}

// this creates a child key using bip39, ignoring the parent key
/**
 * @param pathPart
 * @param _parentKey
 */
export function deriveChildKey(pathPart: string, _parentKey?: never): Buffer {
  return createBip39KeyFromSeed(Buffer.from(mnemonicToSeedSync(pathPart)));
}

/**
 * @param seed - The cryptographic seed bytes.
 * @returns The bytes of the corresponding BIP-39 master key.
 */
export function createBip39KeyFromSeed(seed: Buffer): Buffer {
  return Buffer.from(hmac(sha512, ROOT_BASE_SECRET, seed));
}
