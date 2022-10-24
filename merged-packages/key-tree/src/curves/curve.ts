import { utils } from '@noble/secp256k1';
import * as secp256k1 from './secp256k1';
import * as ed25519 from './ed25519';

export type SupportedCurve = keyof typeof curves;

export const curves = {
  secp256k1,
  ed25519,
};

export type Curve = {
  name: SupportedCurve;
  secret: Uint8Array;
  deriveUnhardenedKeys: boolean;
  publicKeyLength: number;
  curve: {
    n: bigint;
  };
  getPublicKey: (
    privateKey: Uint8Array,
    compressed?: boolean,
  ) => Uint8Array | Promise<Uint8Array>;
  isValidPrivateKey: (privateKey: Uint8Array) => boolean;
  publicAdd: (publicKey: Uint8Array, tweak: Uint8Array) => Uint8Array;
  compressPublicKey: (publicKey: Uint8Array) => Uint8Array;
  decompressPublicKey: (publicKey: Uint8Array) => Uint8Array;
};

/**
 * Get a curve by name.
 *
 * @param curveName - The name of the curve to get.
 */
export function getCurveByName(curveName: SupportedCurve): Curve {
  return curves[curveName];
}

// As long as both parameters are specified, this function is the same for all curves.
export const { mod } = utils;
