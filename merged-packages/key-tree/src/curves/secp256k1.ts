import { utils, getPublicKey as getSecp256k1PublicKey } from '@noble/secp256k1';

export { CURVE as curve } from '@noble/secp256k1';
export const { isValidPrivateKey } = utils;

export const name = 'secp256k1';

// Secret is defined in BIP-32 and SLIP-10:
// https://github.com/bitcoin/bips/blob/274fa400d630ba757bec0c03b35ebe2345197108/bip-0032.mediawiki#master-key-generation
// https://github.com/satoshilabs/slips/blob/133ea52a8e43d338b98be208907e144277e44c0e/slip-0010.md#master-key-generation
export const secret = Buffer.from('Bitcoin seed', 'utf8');

export const deriveUnhardenedKeys = true;

export const getPublicKey = (
  privateKey: Uint8Array | string | bigint,
  compressed?: boolean,
): Buffer => Buffer.from(getSecp256k1PublicKey(privateKey, compressed));
