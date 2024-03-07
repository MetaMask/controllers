import { bytesToHex } from '@metamask/utils';
// eslint-disable-next-line import/no-nodejs-modules
import { randomInt, randomBytes } from 'crypto';

import type { BIP32Node, SLIP10Node } from '../src';
import {
  BIP_32_HARDENED_OFFSET,
  ed25519,
  MAX_BIP_32_INDEX,
  secp256k1,
  ed25519Bip32,
} from '../src';
import { type Curve } from '../src/curves';
import { deriveChildKey } from '../src/derivers/bip39';

/**
 * Get a random boolean value.
 *
 * @returns A random boolean value.
 */
function getRandomBoolean() {
  return randomInt(2) === 0;
}

/**
 * Get a random BIP-32 index.
 *
 * @param hardened - Whether the index should be hardened. Defaults to a random
 * boolean value.
 * @returns A random BIP-32 index.
 */
function getRandomIndex(hardened: boolean = getRandomBoolean()) {
  if (hardened) {
    return randomInt(BIP_32_HARDENED_OFFSET, MAX_BIP_32_INDEX);
  }

  return randomInt(0, BIP_32_HARDENED_OFFSET);
}

/**
 * Get a random seed.
 *
 * @param length - The length of the seed. Defaults to a random integer between
 * 16 and 64 bytes.
 * @returns A random seed.
 */
function getRandomSeed(length = randomInt(16, 64)) {
  return randomBytes(length);
}

/**
 * Get a random BIP-32 path, with the given length.
 *
 * @param spec - The path specification.
 * @param length - The length of the path. Defaults to a random integer between
 * 1 and 20.
 * @param hardened - Whether the path should be hardened. Defaults to a random
 * boolean value.
 * @returns A random BIP-32 path.
 */
function getRandomPath(
  spec: 'bip32' | 'slip10' | 'cip3',
  length = randomInt(1, 20),
  hardened?: boolean,
) {
  return new Array(length).fill(0).map(() => {
    const index = getRandomIndex(hardened);
    const formattedIndex =
      index >= BIP_32_HARDENED_OFFSET
        ? `${index - BIP_32_HARDENED_OFFSET}'`
        : index;

    return `${spec}:${formattedIndex}` as BIP32Node;
  });
}

/**
 * Get a random key vector.
 *
 * @param node - The node to derive the keys from.
 * @param spec - The path specification.
 * @param hardened - Whether the keys should be hardened. Defaults to a random
 * boolean value.
 * @returns A random key vector.
 */
async function getRandomKeyVector(
  node: SLIP10Node,
  spec: 'bip32' | 'slip10' | 'cip3',
  hardened?: boolean,
) {
  const path = getRandomPath(spec, undefined, hardened);
  const child = await node.derive(path);

  return {
    path: {
      tuple: path,
      string: path.join(' / '),
    },
    privateKey: child.privateKey,
    publicKey: child.compressedPublicKey,
    chainCode: child.chainCode,
    parentFingerprint: child.parentFingerprint,
    masterFingerprint: child.masterFingerprint,
    index: child.index,
    depth: child.depth,
  };
}

/**
 * Generate a random vector.
 *
 * @param spec - The path specification.
 * @param amount - The amount of vectors to generate for the seed. Defaults to
 * 10.
 * @param hardened - Whether the keys should be hardened. Defaults to a random
 * boolean value.
 * @param curve - The curve to use. Defaults to secp256k1.
 */
async function getRandomVector(
  spec: 'bip32' | 'slip10' | 'cip3',
  amount = 10,
  hardened?: boolean,
  curve: Curve = secp256k1,
) {
  const seed = getRandomSeed();
  const node = await deriveChildKey({ path: seed, curve });

  return {
    hexSeed: bytesToHex(seed),
    privateKey: node.privateKey,
    publicKey: node.compressedPublicKey,
    chainCode: node.chainCode,
    parentFingerprint: node.parentFingerprint,
    masterFingerprint: node.masterFingerprint,
    index: node.index,
    depth: node.depth,
    keys: await Promise.all(
      new Array(amount)
        .fill(0)
        .map(async () => getRandomKeyVector(node, spec, hardened)),
    ),
  };
}

/**
 * Generate random vectors.
 *
 * @param spec - The path specification.
 * @param amount - The amount of vectors to generate for the seed. Defaults to
 * 10.
 * @param hardened - Whether the keys should be hardened. Defaults to a random
 * boolean value.
 * @param curve - The curve to use. Defaults to secp256k1.
 * @returns The random vectors.
 */
async function getRandomVectors(
  spec: 'bip32' | 'slip10' | 'cip3',
  amount = 10,
  hardened?: boolean,
  curve: Curve = secp256k1,
) {
  return Promise.all(
    new Array(amount)
      .fill(0)
      .map(async () => getRandomVector(spec, undefined, hardened, curve)),
  );
}

/**
 * Get the output for the vectors.
 *
 * @returns The output for the vectors.
 */
async function getOutput() {
  return {
    bip32: {
      hardened: await getRandomVectors('bip32', 50, true),
      unhardened: await getRandomVectors('bip32', 50, false),
      mixed: await getRandomVectors('bip32', 50),
    },
    slip10: {
      hardened: {
        secp256k1: await getRandomVectors('slip10', 50, true),
        ed25519: await getRandomVectors('slip10', 50, true, ed25519),
      },
      unhardened: await getRandomVectors('slip10', 50, false),
      mixed: await getRandomVectors('bip32', 50),
    },
    cip3: {
      hardened: await getRandomVectors('cip3', 50, true, ed25519Bip32),
      unhardened: await getRandomVectors('cip3', 50, false, ed25519Bip32),
      mixed: await getRandomVectors('cip3', 50, undefined, ed25519Bip32),
    },
  };
}

getOutput()
  .then((output) => {
    console.log(JSON.stringify(output, undefined, 2));
  })
  .catch(console.error);
