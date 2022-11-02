import { createDataView } from '@metamask/utils';
import { decodeBase58check, encodeBase58check, isValidBytesKey } from './utils';
import { validateBIP44Depth } from './BIP44Node';
import { compressPublicKey, decompressPublicKey } from './curves/secp256k1';

// https://github.com/bitcoin/bips/blob/274fa400d630ba757bec0c03b35ebe2345197108/bip-0032.mediawiki#Serialization_format
export const PUBLIC_KEY_VERSION = 0x0488b21e;
export const PRIVATE_KEY_VERSION = 0x0488ade4;

export type ExtendedKeyVersion =
  | typeof PUBLIC_KEY_VERSION
  | typeof PRIVATE_KEY_VERSION;

/**
 * An extended public or private key. Contains either a public or private key,
 * depending on the version.
 */
type ExtendedKeyLike = {
  version: ExtendedKeyVersion;
  depth: number;
  parentFingerprint: number;
  index: number;
  chainCode: Uint8Array;
};

type ExtendedPublicKey = ExtendedKeyLike & {
  version: typeof PUBLIC_KEY_VERSION;
  publicKey: Uint8Array;
};

type ExtendedPrivateKey = ExtendedKeyLike & {
  version: typeof PRIVATE_KEY_VERSION;
  privateKey: Uint8Array;
};

export type ExtendedKey = ExtendedPublicKey | ExtendedPrivateKey;

/**
 * Decodes an extended public or private key. In the case of an extended public key, the public key
 * is returned in the uncompressed form.
 *
 * Throws an error if the extended key is invalid.
 *
 * @param extendedKey - The extended key string to attempt to decode.
 */
export const decodeExtendedKey = (extendedKey: string): ExtendedKey => {
  const bytes = decodeBase58check(extendedKey);

  if (bytes.length !== 78) {
    throw new Error(
      `Invalid extended key: Expected a length of 78, got ${bytes.length}.`,
    );
  }

  const view = createDataView(bytes);

  const version = view.getUint32(0, false);
  const depth = view.getUint8(4);
  validateBIP44Depth(depth);

  const parentFingerprint = view.getUint32(5, false);
  const index = view.getUint32(9, false);

  const chainCode = bytes.slice(13, 45);
  if (!isValidBytesKey(chainCode, 32)) {
    throw new Error(
      `Invalid extended key: Chain code must be a 32-byte non-zero byte array.`,
    );
  }

  const key = bytes.slice(45, 78);
  if (!isValidBytesKey(key, 33)) {
    throw new Error(
      `Invalid extended key: Key must be a 33-byte non-zero byte array.`,
    );
  }

  const keyView = createDataView(key);

  if (version === PUBLIC_KEY_VERSION) {
    if (keyView.getUint8(0) !== 0x02 && keyView.getUint8(0) !== 0x03) {
      throw new Error(
        `Invalid extended key: Public key must start with 0x02 or 0x03.`,
      );
    }

    return {
      version,
      depth,
      parentFingerprint,
      index,
      chainCode,
      publicKey: decompressPublicKey(key),
    };
  }

  if (version === PRIVATE_KEY_VERSION) {
    if (keyView.getUint8(0) !== 0x00) {
      throw new Error(
        `Invalid extended key: Private key must start with 0x00.`,
      );
    }

    return {
      version,
      depth,
      parentFingerprint,
      index,
      chainCode,
      privateKey: key.slice(1),
    };
  }

  throw new Error(
    `Invalid extended key: Expected a public (xpub) or private key (xprv) version.`,
  );
};

/**
 * Encodes an extended public or private key. Assumes that all the inputs are verified beforehand.
 *
 * @param extendedKey - The extended key data to encode.
 */
export const encodeExtendedKey = (extendedKey: ExtendedKey): string => {
  const { version, depth, parentFingerprint, index, chainCode } = extendedKey;

  const bytes = new Uint8Array(78);

  const view = createDataView(bytes);

  view.setUint32(0, version, false);
  view.setUint8(4, depth);
  view.setUint32(5, parentFingerprint, false);
  view.setUint32(9, index, false);

  bytes.set(chainCode, 13);

  if (extendedKey.version === PUBLIC_KEY_VERSION) {
    const { publicKey } = extendedKey;
    const compressedPublicKey = compressPublicKey(publicKey);

    bytes.set(compressedPublicKey, 45);
  }

  if (extendedKey.version === PRIVATE_KEY_VERSION) {
    const { privateKey } = extendedKey;
    bytes.set(privateKey, 46);
  }

  return encodeBase58check(bytes);
};
