import type { Encapsulation } from '../types.js';

/**
 * Parameters that distinguish the ML-KEM variants from each other.
 * https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf
 */
export type MlKemParameters = {
  /**
   * The WebCrypto algorithm name.
   */
  name: 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024';

  /**
   * The length of the encapsulation key (public key) in bytes.
   */
  publicKeyLength: number;

  /**
   * The length of the ciphertext in bytes.
   */
  ciphertextLength: number;
};

// FIPS 203, Section 3.3: The seed is `d || z`, from which the full
// decapsulation key is deterministically expanded.
const ML_KEM_SEED_LENGTH = 64;

/**
 * Generate a shared secret and a ciphertext that encapsulates it for the
 * holder of the seed matching the given public key.
 *
 * @param parameters - The ML-KEM variant parameters.
 * @param publicKey - The ML-KEM encapsulation key of the recipient.
 * @returns The ciphertext and the 32-byte shared secret.
 */
export async function encapsulate(
  parameters: MlKemParameters,
  publicKey: BufferSource,
): Promise<Encapsulation> {
  if (publicKey.byteLength !== parameters.publicKeyLength) {
    throw new Error(
      `Invalid public key length: Public key must be exactly ${parameters.publicKeyLength} bytes for ${parameters.name}.`,
    );
  }

  const subtlePublicKey = await globalThis.crypto.subtle.importKey(
    'raw-public',
    publicKey,
    { name: parameters.name },
    false,
    ['encapsulateBits'],
  );

  const { ciphertext, sharedKey } =
    await globalThis.crypto.subtle.encapsulateBits(
      { name: parameters.name },
      subtlePublicKey,
    );

  return {
    ciphertext: new Uint8Array(ciphertext),
    sharedSecret: new Uint8Array(sharedKey),
  };
}

/**
 * Recover the shared secret from a ciphertext using the seed.
 *
 * Per FIPS 203, a ciphertext of the correct length that was not produced for
 * this key does not cause an error. Instead, a pseudorandom shared secret is
 * returned ("implicit rejection"), so a mismatch only surfaces when the two
 * parties' secrets differ.
 *
 * @param parameters - The ML-KEM variant parameters.
 * @param seed - The 64-byte ML-KEM seed (`d || z`).
 * @param ciphertext - The ciphertext produced by `encapsulate`.
 * @returns The 32-byte shared secret.
 */
export async function decapsulate(
  parameters: MlKemParameters,
  seed: BufferSource,
  ciphertext: BufferSource,
): Promise<Uint8Array<ArrayBuffer>> {
  if (seed.byteLength !== ML_KEM_SEED_LENGTH) {
    throw new Error(
      `Invalid seed length: Seed must be exactly ${ML_KEM_SEED_LENGTH} bytes for ${parameters.name}.`,
    );
  }

  if (ciphertext.byteLength !== parameters.ciphertextLength) {
    throw new Error(
      `Invalid ciphertext length: Ciphertext must be exactly ${parameters.ciphertextLength} bytes for ${parameters.name}.`,
    );
  }

  const subtleKey = await globalThis.crypto.subtle.importKey(
    'raw-seed',
    seed,
    { name: parameters.name },
    false,
    ['decapsulateBits'],
  );

  const sharedSecret = await globalThis.crypto.subtle.decapsulateBits(
    { name: parameters.name },
    subtleKey,
    ciphertext,
  );

  return new Uint8Array(sharedSecret);
}
