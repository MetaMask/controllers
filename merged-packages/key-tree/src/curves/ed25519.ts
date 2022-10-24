import { getPublicKey as getEd25519PublicKey } from '@noble/ed25519';
import { concatBytes, stringToBytes } from '@metamask/utils';

export { CURVE as curve } from '@noble/ed25519';

export const name = 'ed25519';

// Secret is defined in SLIP-10:
// https://github.com/satoshilabs/slips/blob/133ea52a8e43d338b98be208907e144277e44c0e/slip-0010.md#master-key-generation
export const secret = stringToBytes('ed25519 seed');

// All private keys are valid for ed25519:
// https://github.com/satoshilabs/slips/blob/133ea52a8e43d338b98be208907e144277e44c0e/slip-0010.md#master-key-generation
export const isValidPrivateKey = (_privateKey: Uint8Array | string | bigint) =>
  true;

export const deriveUnhardenedKeys = false;

export const publicKeyLength = 33;

export const getPublicKey = async (
  privateKey: Uint8Array,
  _compressed?: boolean,
): Promise<Uint8Array> => {
  const publicKey = await getEd25519PublicKey(privateKey);
  return concatBytes([new Uint8Array([0]), publicKey]);
};

export const publicAdd = (
  _publicKey: Uint8Array,
  _tweak: Uint8Array,
): Uint8Array => {
  throw new Error('Ed25519 does not support public key derivation.');
};

export const compressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  // Ed25519 public keys don't have a compressed form.
  return publicKey;
};

export const decompressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  // Ed25519 public keys don't have a compressed form.
  return publicKey;
};
