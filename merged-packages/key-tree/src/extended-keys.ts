import {
  decodeBase58check,
  encodeBase58check,
  isValidBufferKey,
} from './utils';
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
  chainCode: Buffer;
};

type ExtendedPublicKey = ExtendedKeyLike & {
  version: typeof PUBLIC_KEY_VERSION;
  publicKey: Buffer;
};

type ExtendedPrivateKey = ExtendedKeyLike & {
  version: typeof PRIVATE_KEY_VERSION;
  privateKey: Buffer;
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
  const buffer = decodeBase58check(extendedKey);

  if (buffer.length !== 78) {
    throw new Error(
      `Invalid extended key: Expected a length of 78, got ${buffer.length}.`,
    );
  }

  const version = buffer.readUInt32BE(0);
  const depth = buffer.readUInt8(4);
  validateBIP44Depth(depth);

  const parentFingerprint = buffer.readUInt32BE(5);
  const index = buffer.readUInt32BE(9);

  const chainCode = buffer.slice(13, 45);
  if (!isValidBufferKey(chainCode, 32)) {
    throw new Error(
      `Invalid extended key: Chain code must be a 32-byte non-zero Buffer.`,
    );
  }

  const key = buffer.slice(45, 78);
  if (!isValidBufferKey(key, 33)) {
    throw new Error(
      `Invalid extended key: Key must be a 33-byte non-zero Buffer.`,
    );
  }

  if (version === PUBLIC_KEY_VERSION) {
    if (key.readUInt8(0) !== 0x02 && key.readUInt8(0) !== 0x03) {
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
    if (key.readUInt8(0) !== 0x00) {
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
  const buffer = Buffer.alloc(78);

  buffer.writeUInt32BE(version, 0);
  buffer.writeUInt8(depth, 4);
  buffer.writeUInt32BE(parentFingerprint, 5);
  buffer.writeUInt32BE(index, 9);

  chainCode.copy(buffer, 13);

  if (extendedKey.version === PUBLIC_KEY_VERSION) {
    const { publicKey } = extendedKey;
    const compressedPublicKey = compressPublicKey(publicKey);

    compressedPublicKey.copy(buffer, 45);
  }

  if (extendedKey.version === PRIVATE_KEY_VERSION) {
    const { privateKey } = extendedKey;
    privateKey.copy(buffer, 46);
  }

  return encodeBase58check(buffer);
};
