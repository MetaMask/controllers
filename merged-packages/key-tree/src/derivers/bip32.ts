// node
import crypto from 'crypto';
import assert from 'assert';
// npm
import secp256k1 from 'secp256k1';
import createKeccakHash from 'keccak';

const HARDENED_OFFSET = 0x80000000;

type KeccakBits = '224' | '256' | '384' | '512';

export function privateKeyToEthAddress(keyBuffer: Buffer) {
  const privateKey = keyBuffer.slice(0, 32);
  const publicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1);
  return keccak(publicKey as Buffer).slice(-20);
}

function keccak(a: string | Buffer, bits: KeccakBits = '256'): Buffer {
  return createKeccakHash(`keccak${bits}` as any).update(a).digest();
}

export function bip32PathToMultipath(bip32Path: string): string {
  let pathParts = bip32Path.trim().split('/');
  // strip "m" noop
  if (pathParts[0].toLowerCase() === 'm') {
    pathParts = pathParts.slice(1);
  }
  const multipath = pathParts.map((part) => `bip32:${part}`).join('/');
  return multipath;
}

export function deriveChildKey(parentKey: Buffer, pathPart: string): Buffer {
  const isHardened = pathPart.includes(`'`);
  const indexPart = pathPart.split(`'`)[0];
  const childIndex = parseInt(indexPart, 10);
  assert(childIndex < HARDENED_OFFSET, 'Invalid index');
  assert(parentKey.length === 64, 'Parent key invalid length');

  const parentPrivateKey = parentKey.slice(0, 32);
  const parentExtraEntropy = parentKey.slice(32);
  const secretExtension = deriveSecretExtension({ parentPrivateKey, childIndex, isHardened });

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
function deriveSecretExtension({ parentPrivateKey, childIndex, isHardened }: DeriveSecretExtensionArgs) {
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
  const parentPublicKey = secp256k1.publicKeyCreate(parentPrivateKey, true);
  return Buffer.concat([parentPublicKey, indexBuffer]);
}

interface GenerateKeyArgs {
  parentPrivateKey: Buffer;
  parentExtraEntropy: string | Buffer;
  secretExtension: string | Buffer;
}

function generateKey({ parentPrivateKey, parentExtraEntropy, secretExtension }: GenerateKeyArgs) {
  const entropy = crypto.createHmac('sha512', parentExtraEntropy).update(secretExtension).digest();
  const keyMaterial = entropy.slice(0, 32);
  // extraEntropy is also called "chaincode"
  const extraEntropy = entropy.slice(32);
  const privateKey = secp256k1.privateKeyTweakAdd(parentPrivateKey, keyMaterial);
  return { privateKey, extraEntropy };
}
