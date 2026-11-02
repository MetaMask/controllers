import type {
  KeyPair,
  SEC1EncodedPublicKey,
} from '@metamask/toprf-secure-backup';
import {
  base64ToBytes,
  bigIntToHex,
  bytesToBase64,
  bytesToString,
  hexToBigInt,
  stringToBytes,
} from '@metamask/utils';
import { secp256k1 } from '@noble/curves/secp256k1';

import { SeedlessOnboardingControllerErrorMessage } from '../constants.js';

export const RECOVERY_KEYS_PREFIX = 'MFA_RECOVERY_KEYS_V1';
export const WRAPPED_KEYS_PREFIX = 'MFA_WRAPPED_KEYS_V1';

/**
 * The secret metadata `type` of the recovery-keys item. It is not a
 * `SecretType`: the item is not a user secret and is never returned as one.
 */
export const RECOVERY_KEYS_SECRET_TYPE = 'mfaRecoveryKeys';

/** TOPRF2 keys stored in the recovery-keys item (TOPRF1 namespace). */
export type RecoveryKeys = {
  recoveryEncKey: Uint8Array;
  recoveryAuthKeyPair: KeyPair;
};

/** One TOPRF1 key set stored in the wrapped-keys item (TOPRF2 namespace). */
export type WrappedKeySet = {
  encKey: Uint8Array;
  pwEncKey: Uint8Array;
  authKeyPair: KeyPair;
};

type SerializedKeyPair = { sk: string; pk: string };

type SerializedRecoveryKeys = {
  recoveryEncKey: string;
  recoveryAuthKeyPair: SerializedKeyPair;
};

type SerializedWrappedKeySet = {
  encKey: string;
  pwEncKey: string;
  authKeyPair: SerializedKeyPair;
};

/**
 * Create an invalid recovery keys item error.
 *
 * @returns The error to throw.
 */
function createInvalidItemError(): Error {
  return new Error(
    SeedlessOnboardingControllerErrorMessage.InvalidRecoveryKeysItem,
  );
}

/**
 * Serialize a key pair into its JSON-compatible representation.
 *
 * @param keyPair - The key pair to serialize.
 * @returns The serialized key pair.
 */
function serializeKeyPair(keyPair: KeyPair): SerializedKeyPair {
  return {
    sk: bigIntToHex(keyPair.sk),
    pk: bytesToBase64(keyPair.pk),
  };
}

/**
 * Parse a serialized key pair.
 *
 * @param value - The unknown JSON value to parse.
 * @returns The parsed key pair.
 */
function parseKeyPair(value: unknown): KeyPair {
  const { sk, pk } = value as SerializedKeyPair;
  if (typeof sk !== 'string' || typeof pk !== 'string') {
    throw createInvalidItemError();
  }
  return {
    sk: hexToBigInt(sk),
    pk: base64ToBytes(pk),
  };
}

/**
 * Parse a base64 encoded field.
 *
 * @param value - The unknown JSON value to parse.
 * @returns The decoded bytes.
 */
function parseBase64Field(value: unknown): Uint8Array {
  if (typeof value !== 'string') {
    throw createInvalidItemError();
  }
  return base64ToBytes(value);
}

/**
 * Check that a value is a non-null, non-array object.
 *
 * @param value - The value to check.
 * @returns Whether the value is a plain object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strip the expected prefix from a stored item and parse the remaining JSON body.
 *
 * @param data - The raw item data.
 * @param prefix - The expected prefix.
 * @returns The parsed JSON body.
 */
function parseBody(data: Uint8Array, prefix: string): unknown {
  const text = bytesToString(data);
  if (!text.startsWith(prefix)) {
    throw createInvalidItemError();
  }
  try {
    return JSON.parse(text.slice(prefix.length));
  } catch {
    throw createInvalidItemError();
  }
}

/**
 * Serialize the TOPRF2 recovery keys for storage in the recovery-keys item.
 *
 * @param keys - The recovery keys to serialize.
 * @returns The serialized item data.
 */
export function serializeRecoveryKeys(keys: RecoveryKeys): Uint8Array {
  const body: SerializedRecoveryKeys = {
    recoveryEncKey: bytesToBase64(keys.recoveryEncKey),
    recoveryAuthKeyPair: serializeKeyPair(keys.recoveryAuthKeyPair),
  };
  return stringToBytes(`${RECOVERY_KEYS_PREFIX}${JSON.stringify(body)}`);
}

/**
 * Parse the TOPRF2 recovery keys from the recovery-keys item data.
 *
 * @param data - The decrypted item data.
 * @returns The parsed recovery keys.
 */
export function parseRecoveryKeys(data: Uint8Array): RecoveryKeys {
  const body = parseBody(data, RECOVERY_KEYS_PREFIX);
  try {
    if (!isObject(body) || !isObject(body.recoveryAuthKeyPair)) {
      throw createInvalidItemError();
    }
    return {
      recoveryEncKey: parseBase64Field(body.recoveryEncKey),
      recoveryAuthKeyPair: parseKeyPair(body.recoveryAuthKeyPair),
    };
  } catch {
    throw createInvalidItemError();
  }
}

/**
 * Serialize the TOPRF1 key sets for storage in the wrapped-keys item.
 *
 * @param keySets - The key sets to serialize.
 * @returns The serialized item data.
 */
export function serializeWrappedKeys(keySets: WrappedKeySet[]): Uint8Array {
  const body: SerializedWrappedKeySet[] = keySets.map((keySet) => ({
    encKey: bytesToBase64(keySet.encKey),
    pwEncKey: bytesToBase64(keySet.pwEncKey),
    authKeyPair: serializeKeyPair(keySet.authKeyPair),
  }));
  return stringToBytes(`${WRAPPED_KEYS_PREFIX}${JSON.stringify(body)}`);
}

/**
 * Parse the TOPRF1 key sets from the wrapped-keys item data.
 *
 * @param data - The decrypted item data.
 * @returns The parsed key sets.
 */
export function parseWrappedKeys(data: Uint8Array): WrappedKeySet[] {
  const body = parseBody(data, WRAPPED_KEYS_PREFIX);
  try {
    if (!Array.isArray(body) || body.length === 0) {
      throw createInvalidItemError();
    }
    return body.map((entry: unknown) => {
      if (!isObject(entry) || !isObject(entry.authKeyPair)) {
        throw createInvalidItemError();
      }
      return {
        encKey: parseBase64Field(entry.encKey),
        pwEncKey: parseBase64Field(entry.pwEncKey),
        authKeyPair: parseKeyPair(entry.authKeyPair),
      };
    });
  } catch {
    throw createInvalidItemError();
  }
}

/**
 * Parse an item as JSON.
 *
 * @param data - The raw item data.
 * @returns The parsed JSON, or undefined when the data is not JSON.
 */
function parseJson(data: Uint8Array): unknown {
  try {
    return JSON.parse(bytesToString(data));
  } catch {
    return undefined;
  }
}

/**
 * Serialize the TOPRF2 recovery keys as the recovery-keys item of the TOPRF1
 * namespace.
 *
 * The item has the secret metadata shape (`data`, `timestamp`, `type`) and no
 * storage `dataType`, so clients that parse every TOPRF1 item as secret
 * metadata, and the re-encryption on password change, accept it.
 *
 * @param keys - The recovery keys to serialize.
 * @param timestamp - The item timestamp, used to pick the latest item.
 * @returns The serialized item data.
 */
export function serializeRecoveryKeysItem(
  keys: RecoveryKeys,
  timestamp = Date.now(),
): Uint8Array {
  return stringToBytes(
    JSON.stringify({
      data: bytesToBase64(serializeRecoveryKeys(keys)),
      timestamp,
      type: RECOVERY_KEYS_SECRET_TYPE,
    }),
  );
}

/**
 * Check whether a TOPRF1 item is a recovery-keys item.
 *
 * @param data - The decrypted item data.
 * @returns Whether the item has the recovery-keys `type`.
 */
export function isRecoveryKeysItem(data: Uint8Array): boolean {
  const item = parseJson(data);
  return isObject(item) && item.type === RECOVERY_KEYS_SECRET_TYPE;
}

/**
 * Parse a recovery-keys item of the TOPRF1 namespace.
 *
 * @param data - The decrypted item data.
 * @returns The recovery keys and the item timestamp.
 */
export function parseRecoveryKeysItem(data: Uint8Array): {
  recoveryKeys: RecoveryKeys;
  timestamp: number;
} {
  const item = parseJson(data);
  if (
    !isObject(item) ||
    item.type !== RECOVERY_KEYS_SECRET_TYPE ||
    typeof item.timestamp !== 'number'
  ) {
    throw createInvalidItemError();
  }
  let recoveryKeysData: Uint8Array;
  try {
    recoveryKeysData = parseBase64Field(item.data);
  } catch {
    throw createInvalidItemError();
  }
  return {
    recoveryKeys: parseRecoveryKeys(recoveryKeysData),
    timestamp: item.timestamp,
  };
}

/**
 * Derive the uncompressed SEC1 public key for a secp256k1 private key.
 *
 * @param sk - The private key.
 * @returns The uncompressed public key.
 */
export function derivePubKey(sk: bigint): Uint8Array {
  return secp256k1.getPublicKey(sk, false);
}

/**
 * Check whether two SEC1 encoded public keys represent the same point.
 *
 * @param a - The first public key.
 * @param b - The second public key.
 * @returns `true` if both keys represent the same point.
 */
export function pubKeysEqual(a: Uint8Array, b: Uint8Array): boolean {
  return secp256k1.ProjectivePoint.fromHex(a).equals(
    secp256k1.ProjectivePoint.fromHex(b),
  );
}

/**
 * Check whether a wrapped-keys item still wraps the live TOPRF1 key, i.e. one
 * of its key sets has the same auth public key.
 *
 * @param keySets - The wrapped TOPRF1 key sets.
 * @param authPubKey - The live TOPRF1 auth public key.
 * @returns `true` if one key set's auth key matches `authPubKey`.
 */
export function isWrapCurrent(
  keySets: WrappedKeySet[],
  authPubKey: SEC1EncodedPublicKey,
): boolean {
  return keySets.some(({ authKeyPair }) =>
    pubKeysEqual(derivePubKey(authKeyPair.sk), authPubKey),
  );
}
