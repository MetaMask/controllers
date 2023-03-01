import { assert, stringToBytes } from '@metamask/utils';
import {
  getPublicKey as getSecp256k1PublicKey,
  Point,
  utils,
} from '@noble/secp256k1';

import { isValidBytesKey } from '../utils';

export { CURVE as curve } from '@noble/secp256k1';

export const name = 'secp256k1';

// Secret is defined in BIP-32 and SLIP-10:
// https://github.com/bitcoin/bips/blob/274fa400d630ba757bec0c03b35ebe2345197108/bip-0032.mediawiki#master-key-generation
// https://github.com/satoshilabs/slips/blob/133ea52a8e43d338b98be208907e144277e44c0e/slip-0010.md#master-key-generation
export const secret = stringToBytes('Bitcoin seed');

export const deriveUnhardenedKeys = true;

export const publicKeyLength = 65;

export const isValidPrivateKey = (privateKey: Uint8Array) => {
  return utils.isValidPrivateKey(privateKey);
};

export const getPublicKey = (
  privateKey: Uint8Array,
  compressed?: boolean,
): Uint8Array => getSecp256k1PublicKey(privateKey, compressed);

export const publicAdd = (
  publicKey: Uint8Array,
  tweak: Uint8Array,
): Uint8Array => {
  assert(
    isValidBytesKey(tweak, 32),
    'Invalid tweak: Tweak must be a non-zero 32-byte Uint8Array.',
  );

  const point = Point.fromHex(publicKey);

  // The returned child key Ki is point(parse256(IL)) + Kpar.
  // This multiplies the tweak with the base point of the curve (Gx, Gy).
  // https://github.com/bitcoin/bips/blob/274fa400d630ba757bec0c03b35ebe2345197108/bip-0032.mediawiki#public-parent-key--public-child-key
  const newPoint = point.add(Point.fromPrivateKey(tweak));
  newPoint.assertValidity();

  return newPoint.toRawBytes(false);
};

export const compressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  const point = Point.fromHex(publicKey);
  return point.toRawBytes(true);
};

export const decompressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  // This calculates a point on the elliptic curve from a compressed public key. We can then use
  // this to get the uncompressed version of the public key.
  const point = Point.fromHex(publicKey);
  return point.toRawBytes(false);
};
