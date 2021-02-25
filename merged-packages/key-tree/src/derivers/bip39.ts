import crypto from 'crypto';
import bip39 from 'bip39';

const ROOT_BASE_SECRET = Buffer.from('Bitcoin seed', 'utf8');

export function bip39MnemonicToMultipath(mnemonic: string): string {
  return `bip39:${mnemonic.trim()}`;
}

// this creates a child key using bip39, ignoring the parent key
export function deriveChildKey(_parentKey: unknown, pathPart: string): Buffer {
  const mnemonic = pathPart;
  const seedBuffer = bip39.mnemonicToSeed(mnemonic);
  const entropy = crypto.createHmac('sha512', ROOT_BASE_SECRET).update(seedBuffer).digest();

  return entropy;
}
