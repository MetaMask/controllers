import { Curve } from '../curves';
import { SLIP10Node } from '../SLIP10Node';
import * as bip32 from './bip32';
import * as bip39 from './bip39';

export type DerivedKeys = {
  /**
   * The derived private key, can be undefined if public key derivation was used.
   */
  privateKey?: Buffer;
  publicKey: Buffer;
  chainCode: Buffer;
};

export type DeriveChildKeyArgs = {
  path: string;
  curve?: Curve;
  node?: SLIP10Node;
};

export type Deriver = {
  deriveChildKey: (args: DeriveChildKeyArgs) => Promise<SLIP10Node>;
};

export const derivers = {
  bip32,
  bip39,
};
