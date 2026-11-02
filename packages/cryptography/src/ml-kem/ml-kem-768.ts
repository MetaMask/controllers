import type { Encapsulation } from '../types.js';
import {
  decapsulate as mlKemDecapsulate,
  encapsulate as mlKemEncapsulate,
} from './shared.js';
import type { MlKemParameters } from './shared.js';

// https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf, Table 3
const ML_KEM_768: MlKemParameters = {
  name: 'ML-KEM-768',
  publicKeyLength: 1184,
  ciphertextLength: 1088,
};

/**
 * Generate a shared secret and a ciphertext that encapsulates it for the
 * holder of the seed matching the given public key.
 *
 * @param publicKey - The 1184-byte ML-KEM-768 encapsulation key.
 * @returns The 1088-byte ciphertext and the 32-byte shared secret.
 */
export async function encapsulate(
  publicKey: BufferSource,
): Promise<Encapsulation> {
  return mlKemEncapsulate(ML_KEM_768, publicKey);
}

/**
 * Recover the shared secret from a ciphertext using the seed. A
 * well-formed ciphertext that was not produced for this seed yields a
 * pseudorandom secret rather than an error (implicit rejection, FIPS 203).
 *
 * @param seed - The 64-byte ML-KEM-768 seed (`d || z`).
 * @param ciphertext - The 1088-byte ciphertext.
 * @returns The 32-byte shared secret.
 */
export async function decapsulate(
  seed: BufferSource,
  ciphertext: BufferSource,
): Promise<Uint8Array<ArrayBuffer>> {
  return mlKemDecapsulate(ML_KEM_768, seed, ciphertext);
}
