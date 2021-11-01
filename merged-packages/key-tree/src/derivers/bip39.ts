import crypto from 'crypto';
import bip39 from 'bip39';
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
  return createBip39KeyFromSeed(bip39.mnemonicToSeed(pathPart));
}

/**
 * @param seed - The cryptographic seed bytes.
 * @returns The bytes of the corresponding BIP-39 master key.
 */
export function createBip39KeyFromSeed(seed: Buffer): Buffer {
  return crypto.createHmac('sha512', ROOT_BASE_SECRET).update(seed).digest();
}
