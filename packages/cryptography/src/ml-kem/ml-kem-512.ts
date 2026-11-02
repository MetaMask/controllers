import type { Encapsulation } from '../types.js';
import {
  decapsulate as mlKemDecapsulate,
  encapsulate as mlKemEncapsulate,
} from './shared.js';

const ALGORITHM = 'ML-KEM-512';

/**
 * Generate a shared secret and a ciphertext that encapsulates it for the
 * holder of the seed matching the given public key.
 *
 * @param publicKey - The 800-byte ML-KEM-512 encapsulation key.
 * @returns The 768-byte ciphertext and the 32-byte shared secret.
 */
export async function encapsulate(
  publicKey: BufferSource,
): Promise<Encapsulation> {
  return mlKemEncapsulate(ALGORITHM, publicKey);
}

/**
 * Recover the shared secret from a ciphertext using the seed. A
 * well-formed ciphertext that was not produced for this seed yields a
 * pseudorandom secret rather than an error (implicit rejection, FIPS 203).
 *
 * @param seed - The 64-byte ML-KEM-512 seed (`d || z`).
 * @param ciphertext - The 768-byte ciphertext.
 * @returns The 32-byte shared secret.
 */
export async function decapsulate(
  seed: BufferSource,
  ciphertext: BufferSource,
): Promise<Uint8Array<ArrayBuffer>> {
  return mlKemDecapsulate(ALGORITHM, seed, ciphertext);
}
