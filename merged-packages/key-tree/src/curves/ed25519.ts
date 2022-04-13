import { getPublicKey as getEd25519PublicKey } from '@noble/ed25519';

export { CURVE as curve } from '@noble/ed25519';

export const name = 'ed25519';

// Secret is defined in SLIP-10:
// https://github.com/satoshilabs/slips/blob/133ea52a8e43d338b98be208907e144277e44c0e/slip-0010.md#master-key-generation
export const secret = Buffer.from('ed25519 seed', 'utf8');

// All private keys are valid for ed25519:
// https://github.com/satoshilabs/slips/blob/133ea52a8e43d338b98be208907e144277e44c0e/slip-0010.md#master-key-generation
export const isValidPrivateKey = (_privateKey: Uint8Array | string | bigint) =>
  true;

export const deriveUnhardenedKeys = false;

export const publicKeyLength = 33;

export const getPublicKey = async (
  privateKey: Uint8Array | string | bigint,
  _compressed?: boolean,
): Promise<Buffer> => {
  const publicKey = await getEd25519PublicKey(privateKey);
  return Buffer.concat([Buffer.alloc(1, 0), publicKey]);
};

export const publicAdd = (_publicKey: Buffer, _tweak: Buffer): Buffer => {
  throw new Error('Ed25519 does not support public key derivation.');
};

export const compressPublicKey = (publicKey: Buffer): Buffer => {
  // Ed25519 public keys don't have a compressed form.
  return publicKey;
};
