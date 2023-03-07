import { Curve } from '../curves';
import { SLIP10Node } from '../SLIP10Node';
import * as bip32 from './bip32';
import * as bip39 from './bip39';

export const VALID_SPECIFICATIONS = ['bip32', 'slip10'] as const;
export type Specification = typeof VALID_SPECIFICATIONS[number];

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
  specification?: Specification;
};

export type Deriver = {
  deriveChildKey: (args: DeriveChildKeyArgs) => Promise<SLIP10Node>;
};

export const derivers = {
  bip32,
  bip39,
};
