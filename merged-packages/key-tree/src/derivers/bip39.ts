import { mnemonicToSeedSync } from '@scure/bip39';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { BIP39Node } from '../constants';
import { Curve, secp256k1 } from '../curves';
import { SLIP10Node } from '../SLIP10Node';
import { getFingerprint } from '../utils';
import { DeriveChildKeyArgs } from '.';

/**
 * @param mnemonic
 */
export function bip39MnemonicToMultipath(mnemonic: string): BIP39Node {
  return `bip39:${mnemonic.toLowerCase().trim()}`;
}

// this creates a child key using bip39, ignoring the parent key
/**
 * @param pathPart
 * @param curve
 */
export async function deriveChildKey({
  path,
  curve,
}: DeriveChildKeyArgs): Promise<SLIP10Node> {
  return createBip39KeyFromSeed(Buffer.from(mnemonicToSeedSync(path)), curve);
}

/**
 * @param seed - The cryptographic seed bytes.
 * @param curve - The curve to use.
 * @returns An object containing the corresponding BIP-39 master key and chain code.
 */
export async function createBip39KeyFromSeed(
  seed: Buffer,
  curve: Curve = secp256k1,
): Promise<SLIP10Node> {
  const key = Buffer.from(hmac(sha512, curve.secret, seed));
  const privateKey = key.slice(0, 32);
  const chainCode = key.slice(32);

  const masterFingerprint = getFingerprint(
    await curve.getPublicKey(privateKey, true),
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
