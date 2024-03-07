import type { Curve } from '../curves';
import type { SLIP10Node } from '../SLIP10Node';
import * as bip32 from './bip32';
import * as bip39 from './bip39';
import * as cip3 from './cip3';
import * as slip10 from './slip10';

export type DerivedKeys = {
  /**
   * The derived private key, can be undefined if public key derivation was used.
   */
  privateKey?: Uint8Array;
  publicKey: Uint8Array;
  chainCode: Uint8Array;
};

export type DeriveChildKeyArgs = {
  path: Uint8Array | string;
  curve: Curve;
  node?: SLIP10Node;
};

export type Deriver = {
  deriveChildKey: (args: DeriveChildKeyArgs) => Promise<SLIP10Node>;
};

export const derivers = {
  bip32,
  bip39,
  slip10,
  cip3,
};

export { createBip39KeyFromSeed } from './bip39';
