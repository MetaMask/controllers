import { decrypt, encrypt, IV_LENGTH } from '@metamask/cryptography/aes-gcm';
import type {
  KeyPair,
  SEC1EncodedPublicKey,
} from '@metamask/toprf-secure-backup';
import {
  base64ToBytes,
  bigIntToHex,
  bytesToBase64,
  bytesToHex,
  bytesToString,
  concatBytes,
  hexToBigInt,
  hexToBytes,
  stringToBytes,
} from '@metamask/utils';
import { bytesToNumberBE } from '@noble/curves/abstract/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';

import { SeedlessOnboardingControllerErrorMessage } from '../constants.js';
import { SeedlessOnboardingError } from '../errors.js';

const ENV_AUTH = 'mm-envelope-v1/auth';
const ENV_WRAP = 'mm-envelope-v1/wrap';
const CTRL_AUTH = 'mm-envelope-v1/control-auth';
const CTRL_ENC = 'mm-envelope-v1/control-enc';

/**
 * The number of control records kept in the control item. The metadata store
 * overwrites the item in place, so older records are kept inside it for the
 * case where a key change wrote its record but never reached the nodes.
 */
export const MAX_CONTROL_RECORDS = 3;

/**
 * The vault key set `K_v`. It addresses and encrypts the backend vault and
 * does not change on password change.
 */
export type VaultKeySet = {
  authKeyPair: KeyPair;
  encKey: Uint8Array;
  /** The key of the local wraps, stored in the vault as `toprfPwEncryptionKey`. */
  localWrapKey: Uint8Array;
};

export type EnvelopePath = 'password' | 'recovery-secret';

/** The keys of an envelope partition, derived from a TOPRF seed. */
export type EnvelopeKeys = {
  /** Signs the requests to the envelope partition. */
  envAuth: KeyPair;
  /** Encrypts the envelope. */
  wrapKey: Uint8Array;
};

/** The keys of the control record partition, derived from `K_v`. */
export type ControlKeys = {
  ctrlAuth: KeyPair;
  ctrlKey: Uint8Array;
};

export type EnvelopeHeader = {
  v: 1;
  path: EnvelopePath;
  /** Hex encoded uncompressed SEC1 public key of `K_v.authKeyPair`. */
  vaultAuthPubKey: string;
};

export type Envelope = EnvelopeHeader & {
  /** base64(iv || AES-256-GCM(wrapKey, serialize(K_v), aad = header)). */
  ct: string;
};

export type ControlRecord = {
  v: 1;
  /** Monotonically increasing. Breaks ties between matching records. */
  seq: number;
  passwordNamespace: {
    verifier: string;
    verifierId: string;
    /** Hex encoded auth private key registered with the password OPRF key. */
    authSk: string;
    keyIndex: number;
    /** `false` once the password OPRF key is a discarded random key. */
    enabled: boolean;
  };
  migratedAt: number;
};

export type ControlItem = {
  v: 1;
  /** Newest last, at most {@link MAX_CONTROL_RECORDS}. */
  records: ControlRecord[];
};

type SerializedVaultKeySet = {
  authSk: string;
  encKey: string;
  localWrapKey: string;
};

/**
 * @returns The error thrown for any malformed envelope or control item.
 */
function createInvalidEnvelopeError(): SeedlessOnboardingError {
  return new SeedlessOnboardingError(
    SeedlessOnboardingControllerErrorMessage.InvalidEnvelope,
  );
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
 * Parse JSON bytes, throwing an invalid envelope error on failure.
 *
 * @param data - The JSON bytes.
 * @returns The parsed value.
 */
function parseJsonBytes(data: Uint8Array): unknown {
  try {
    return JSON.parse(bytesToString(data));
  } catch {
    throw createInvalidEnvelopeError();
  }
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
export function pubKeysEqual(
  a: SEC1EncodedPublicKey,
  b: SEC1EncodedPublicKey,
): boolean {
  return secp256k1.ProjectivePoint.fromHex(a).equals(
    secp256k1.ProjectivePoint.fromHex(b),
  );
}

/**
 * Derive a secp256k1 key pair from 32 bytes, the way the TOPRF SDK derives
 * its authentication key pair.
 *
 * @param bytes - The 32 input bytes.
 * @returns The key pair.
 */
export function deriveKeyPair(bytes: Uint8Array): KeyPair {
  const sk = bytesToNumberBE(bytes) % secp256k1.CURVE.n;
  return { sk, pk: derivePubKey(sk) };
}

/**
 * Derive the envelope keys `E(S)` of a TOPRF seed.
 *
 * @param seed - The TOPRF seed.
 * @returns The envelope keys.
 */
export function deriveEnvelopeKeys(seed: Uint8Array): EnvelopeKeys {
  return {
    envAuth: deriveKeyPair(hkdf(sha256, seed, undefined, ENV_AUTH, 32)),
    wrapKey: hkdf(sha256, seed, undefined, ENV_WRAP, 32),
  };
}

/**
 * Derive the control record keys `C(K_v)` of a vault key set.
 *
 * @param vaultKeySet - The vault key set.
 * @returns The control keys.
 */
export function deriveControlKeys(vaultKeySet: VaultKeySet): ControlKeys {
  const { encKey } = vaultKeySet;
  return {
    ctrlAuth: deriveKeyPair(hkdf(sha256, encKey, undefined, CTRL_AUTH, 32)),
    ctrlKey: hkdf(sha256, encKey, undefined, CTRL_ENC, 32),
  };
}

/**
 * Serialize an envelope header with a fixed key order, so the same header
 * always yields the same associated data.
 *
 * @param header - The envelope header.
 * @returns The associated data.
 */
function headerToAad(header: EnvelopeHeader): Uint8Array<ArrayBuffer> {
  const { v, path, vaultAuthPubKey } = header;
  return stringToBytes(JSON.stringify({ v, path, vaultAuthPubKey }));
}

/**
 * Seal a vault key set into an envelope.
 *
 * @param wrapKey - The envelope wrap key.
 * @param path - The path the wrap key was derived on.
 * @param vaultKeySet - The vault key set to seal.
 * @returns The envelope.
 */
export async function sealEnvelope(
  wrapKey: Uint8Array,
  path: EnvelopePath,
  vaultKeySet: VaultKeySet,
): Promise<Envelope> {
  const header: EnvelopeHeader = {
    v: 1,
    path,
    vaultAuthPubKey: bytesToHex(vaultKeySet.authKeyPair.pk),
  };
  const body: SerializedVaultKeySet = {
    authSk: bigIntToHex(vaultKeySet.authKeyPair.sk),
    encKey: bytesToBase64(vaultKeySet.encKey),
    localWrapKey: bytesToBase64(vaultKeySet.localWrapKey),
  };
  const { iv, ciphertext } = await encrypt(
    wrapKey as Uint8Array<ArrayBuffer>,
    stringToBytes(JSON.stringify(body)),
    { additionalData: headerToAad(header) },
  );
  return { ...header, ct: bytesToBase64(concatBytes([iv, ciphertext])) };
}

/**
 * Open an envelope: decrypt it with the header as associated data, check
 * that the sealed auth key matches the header, and check the path.
 *
 * @param envelope - The envelope.
 * @param wrapKey - The envelope wrap key.
 * @param path - The path the wrap key was derived on.
 * @returns The vault key set.
 * @throws `InvalidEnvelope` if the envelope does not open or does not match.
 */
export async function openEnvelope(
  envelope: Envelope,
  wrapKey: Uint8Array,
  path: EnvelopePath,
): Promise<VaultKeySet> {
  if (envelope.path !== path) {
    throw createInvalidEnvelopeError();
  }
  const ct = base64ToBytes(envelope.ct);
  let plaintext: Uint8Array;
  try {
    plaintext = await decrypt(
      wrapKey as Uint8Array<ArrayBuffer>,
      ct.slice(0, IV_LENGTH),
      ct.slice(IV_LENGTH),
      { additionalData: headerToAad(envelope) },
    );
  } catch {
    throw createInvalidEnvelopeError();
  }
  const body = parseJsonBytes(plaintext);
  if (
    !isObject(body) ||
    typeof body.authSk !== 'string' ||
    typeof body.encKey !== 'string' ||
    typeof body.localWrapKey !== 'string'
  ) {
    throw createInvalidEnvelopeError();
  }
  const sk = hexToBigInt(body.authSk);
  const pk = derivePubKey(sk);
  if (!pubKeysEqual(pk, hexToBytes(envelope.vaultAuthPubKey))) {
    throw createInvalidEnvelopeError();
  }
  return {
    authKeyPair: { sk, pk },
    encKey: base64ToBytes(body.encKey),
    localWrapKey: base64ToBytes(body.localWrapKey),
  };
}

/**
 * @param envelope - The envelope.
 * @returns The envelope as item data.
 */
export function serializeEnvelope(envelope: Envelope): Uint8Array {
  return stringToBytes(JSON.stringify(envelope));
}

/**
 * @param data - The item data.
 * @returns The envelope.
 * @throws `InvalidEnvelope` if the data is not an envelope.
 */
export function parseEnvelope(data: Uint8Array): Envelope {
  const value = parseJsonBytes(data);
  if (
    !isObject(value) ||
    value.v !== 1 ||
    (value.path !== 'password' && value.path !== 'recovery-secret') ||
    typeof value.vaultAuthPubKey !== 'string' ||
    typeof value.ct !== 'string'
  ) {
    throw createInvalidEnvelopeError();
  }
  return {
    v: 1,
    path: value.path,
    vaultAuthPubKey: value.vaultAuthPubKey,
    ct: value.ct,
  };
}

/**
 * @param item - The control item.
 * @returns The control item as item data.
 */
export function serializeControlItem(item: ControlItem): Uint8Array {
  return stringToBytes(JSON.stringify(item));
}

/**
 * Check that a value is a control record.
 *
 * @param value - The value to check.
 * @returns Whether the value is a control record.
 */
function isControlRecord(value: unknown): value is ControlRecord {
  if (!isObject(value) || !isObject(value.passwordNamespace)) {
    return false;
  }
  const { passwordNamespace: ns } = value;
  return (
    value.v === 1 &&
    typeof value.seq === 'number' &&
    typeof value.migratedAt === 'number' &&
    typeof ns.verifier === 'string' &&
    typeof ns.verifierId === 'string' &&
    typeof ns.authSk === 'string' &&
    typeof ns.keyIndex === 'number' &&
    typeof ns.enabled === 'boolean'
  );
}

/**
 * @param data - The item data.
 * @returns The control item.
 * @throws `InvalidEnvelope` if the data is not a control item.
 */
export function parseControlItem(data: Uint8Array): ControlItem {
  const value = parseJsonBytes(data);
  if (
    !isObject(value) ||
    value.v !== 1 ||
    !Array.isArray(value.records) ||
    value.records.length === 0 ||
    !value.records.every(isControlRecord)
  ) {
    throw createInvalidEnvelopeError();
  }
  return { v: 1, records: value.records };
}

/**
 * Select the control record of the live password OPRF key: the one whose auth
 * key matches the nodes' `pub_key`, highest `seq` first.
 *
 * @param item - The control item.
 * @param passwordAuthPubKey - The auth public key the nodes return.
 * @returns The matching record, or undefined when none matches.
 */
export function selectControlRecord(
  item: ControlItem,
  passwordAuthPubKey: SEC1EncodedPublicKey,
): ControlRecord | undefined {
  return [...item.records]
    .sort((a, b) => b.seq - a.seq)
    .find((record) =>
      pubKeysEqual(
        derivePubKey(hexToBigInt(record.passwordNamespace.authSk)),
        passwordAuthPubKey,
      ),
    );
}

/**
 * Append a control record, keeping the newest {@link MAX_CONTROL_RECORDS}.
 *
 * @param item - The current control item, if any.
 * @param record - The record to append.
 * @returns The new control item.
 */
export function appendControlRecord(
  item: ControlItem | undefined,
  record: ControlRecord,
): ControlItem {
  const records = [...(item?.records ?? []), record];
  return { v: 1, records: records.slice(-MAX_CONTROL_RECORDS) };
}

/**
 * @param record - The control record.
 * @returns The auth key pair registered with the password OPRF key.
 */
export function getPasswordNamespaceAuthKeyPair(
  record: ControlRecord,
): KeyPair {
  const sk = hexToBigInt(record.passwordNamespace.authSk);
  return { sk, pk: derivePubKey(sk) };
}
