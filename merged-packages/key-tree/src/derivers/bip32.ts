import crypto from 'crypto';
import secp256k1 from 'secp256k1';
import createKeccakHash from 'keccak';
import { BUFFER_KEY_LENGTH } from '../constants';
import { isValidBufferKey } from '../utils';

const HARDENED_OFFSET = 0x80000000;

type KeccakBits = '224' | '256' | '384' | '512';

/**
 * Converts a BIP-32 private key to an Ethereum address.
 *
 * **WARNING:** Only validates that the key is non-zero and of the correct
 * length. It is the consumer's responsibility to ensure that the specified
 * key is a valid BIP-44 Ethereum `address_index` key.
 *
 * @param key - The `address_index` key buffer to convert to an Ethereum
 * address.
 * @returns The Ethereum address corresponding to the given key.
 */
export function privateKeyToEthAddress(key: Buffer) {
  if (!Buffer.isBuffer(key) || !isValidBufferKey(key)) {
    throw new Error('Invalid key: The key must be a 64-byte, non-zero Buffer.');
  }

  const privateKey = key.slice(0, 32);
  const publicKey = secp256k1
    .publicKeyCreate(new Uint8Array(privateKey), false)
    .slice(1);
  return keccak(Buffer.from(publicKey)).slice(-20);
}

/**
 * @param data
 * @param keccakBits
 */
function keccak(data: string | Buffer, keccakBits: KeccakBits = '256'): Buffer {
  return createKeccakHash(`keccak${keccakBits}`).update(data).digest();
}

/**
 * @param pathPart
 * @param parentKey
 */
export function deriveChildKey(pathPart: string, parentKey: Buffer): Buffer {
  if (!parentKey) {
    throw new Error('Invalid parameters: Must specify a parent key.');
  }

  if (parentKey.length !== BUFFER_KEY_LENGTH) {
    throw new Error('Invalid parent key: Must be 64 bytes long.');
  }

  const isHardened = pathPart.includes(`'`);
  const indexPart = pathPart.split(`'`)[0];
  const childIndex = parseInt(indexPart, 10);

  if (
    !/^\d+$/u.test(indexPart) ||
    !Number.isInteger(childIndex) ||
    childIndex < 0 ||
    childIndex >= HARDENED_OFFSET
  ) {
    throw new Error(
      `Invalid BIP-32 index: The index must be a non-negative decimal integer less than ${HARDENED_OFFSET}.`,
    );
  }

  const parentPrivateKey = parentKey.slice(0, 32);
  const parentExtraEntropy = parentKey.slice(32);
  const secretExtension = deriveSecretExtension({
    parentPrivateKey,
    childIndex,
    isHardened,
  });

  const { privateKey, extraEntropy } = generateKey({
    parentPrivateKey,
    parentExtraEntropy,
    secretExtension,
  });

  return Buffer.concat([privateKey, extraEntropy]);
}

interface DeriveSecretExtensionArgs {
  parentPrivateKey: Buffer;
  childIndex: number;
  isHardened: boolean;
}

// the bip32 secret extension is created from the parent private or public key and the child index
/**
 * @param options
 * @param options.parentPrivateKey
 * @param options.childIndex
 * @param options.isHardened
 */
function deriveSecretExtension({
  parentPrivateKey,
  childIndex,
  isHardened,
}: DeriveSecretExtensionArgs) {
  if (isHardened) {
    // Hardened child
    const indexBuffer = Buffer.allocUnsafe(4);
    indexBuffer.writeUInt32BE(childIndex + HARDENED_OFFSET, 0);
    const pk = parentPrivateKey;
    const zb = Buffer.alloc(1, 0);
    return Buffer.concat([zb, pk, indexBuffer]);
  }

  // Normal child
  const indexBuffer = Buffer.allocUnsafe(4);
  indexBuffer.writeUInt32BE(childIndex, 0);
  const parentPublicKey = secp256k1.publicKeyCreate(
    new Uint8Array(parentPrivateKey),
    true,
  );
  return Buffer.concat([parentPublicKey, indexBuffer]);
}

interface GenerateKeyArgs {
  parentPrivateKey: Buffer;
  parentExtraEntropy: string | Buffer;
  secretExtension: string | Buffer;
}

/**
 * @param options
 * @param options.parentPrivateKey
 * @param options.parentExtraEntropy
 * @param options.secretExtension
 */
function generateKey({
  parentPrivateKey,
  parentExtraEntropy,
  secretExtension,
}: GenerateKeyArgs) {
  const entropy = crypto
    .createHmac('sha512', parentExtraEntropy)
    .update(secretExtension)
    .digest();
  const keyMaterial = entropy.slice(0, 32);
  // extraEntropy is also called "chaincode"
  const extraEntropy = entropy.slice(32);
  const privateKey = secp256k1.privateKeyTweakAdd(
    new Uint8Array(parentPrivateKey),
    new Uint8Array(keyMaterial),
  );
  return { privateKey, extraEntropy };
}
