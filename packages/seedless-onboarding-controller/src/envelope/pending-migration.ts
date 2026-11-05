import { decrypt, encrypt, IV_LENGTH } from '@metamask/cryptography/aes-gcm';
import {
  base64ToBytes,
  bigIntToHex,
  bytesToBase64,
  bytesToString,
  concatBytes,
  hexToBigInt,
  stringToBytes,
} from '@metamask/utils';

import { derivePubKey } from './envelope-keys.js';
import type {
  ControlRecord,
  Envelope,
  EnvelopeKeys,
  EnvelopePath,
} from './envelope-keys.js';

/** An envelope and the keys of the partition it is written to. */
export type SealedEnvelope = {
  keys: EnvelopeKeys;
  envelope: Envelope;
};

/**
 * The checkpoint of an envelope migration whose envelopes are sealed but not
 * yet confirmed at the Metadata Service. It is persisted before the first
 * remote write, so a retry writes the same bytes.
 */
export type PendingEnvelopeMigration = {
  v: 1;
  /** Hex encoded Recovery Secret the `rbek` was sealed for. */
  recoverySecret: string;
  /** base64 auth public key of the password OPRF key at seal time. */
  passwordAuthPubKey: string;
  envelopes: Record<EnvelopePath, SealedEnvelope>;
  control: ControlRecord;
};

type SerializedSealedEnvelope = {
  envAuthSk: string;
  wrapKey: string;
  envelope: Envelope;
};

type SerializedPendingEnvelopeMigration = Omit<
  PendingEnvelopeMigration,
  'envelopes'
> & {
  envelopes: Record<EnvelopePath, SerializedSealedEnvelope>;
};

/**
 * @param sealed - The sealed envelope.
 * @returns The JSON-compatible representation.
 */
function serializeSealedEnvelope(
  sealed: SealedEnvelope,
): SerializedSealedEnvelope {
  return {
    envAuthSk: bigIntToHex(sealed.keys.envAuth.sk),
    wrapKey: bytesToBase64(sealed.keys.wrapKey),
    envelope: sealed.envelope,
  };
}

/**
 * @param value - The JSON-compatible representation.
 * @returns The sealed envelope.
 */
function parseSealedEnvelope(value: SerializedSealedEnvelope): SealedEnvelope {
  const sk = hexToBigInt(value.envAuthSk);
  return {
    keys: {
      envAuth: { sk, pk: derivePubKey(sk) },
      wrapKey: base64ToBytes(value.wrapKey),
    },
    envelope: value.envelope,
  };
}

/**
 * Encrypt a pending migration checkpoint for storage in state.
 *
 * @param pending - The checkpoint.
 * @param localWrapKey - The local wrap key of the vault key set.
 * @returns base64(iv || ciphertext).
 */
export async function encryptPendingMigration(
  pending: PendingEnvelopeMigration,
  localWrapKey: Uint8Array,
): Promise<string> {
  const body: SerializedPendingEnvelopeMigration = {
    ...pending,
    envelopes: {
      password: serializeSealedEnvelope(pending.envelopes.password),
      'recovery-secret': serializeSealedEnvelope(
        pending.envelopes['recovery-secret'],
      ),
    },
  };
  const { iv, ciphertext } = await encrypt(
    localWrapKey as Uint8Array<ArrayBuffer>,
    stringToBytes(JSON.stringify(body)),
  );
  return bytesToBase64(concatBytes([iv, ciphertext]));
}

/**
 * Decrypt a pending migration checkpoint from state.
 *
 * @param encrypted - base64(iv || ciphertext).
 * @param localWrapKey - The local wrap key of the vault key set.
 * @returns The checkpoint, or undefined when it does not decrypt under this
 * key set or has an unknown version.
 */
export async function decryptPendingMigration(
  encrypted: string,
  localWrapKey: Uint8Array,
): Promise<PendingEnvelopeMigration | undefined> {
  try {
    const bytes = base64ToBytes(encrypted);
    const plaintext = await decrypt(
      localWrapKey as Uint8Array<ArrayBuffer>,
      bytes.slice(0, IV_LENGTH),
      bytes.slice(IV_LENGTH),
    );
    const body = JSON.parse(
      bytesToString(plaintext),
    ) as SerializedPendingEnvelopeMigration;
    if (body.v !== 1) {
      return undefined;
    }
    return {
      ...body,
      envelopes: {
        password: parseSealedEnvelope(body.envelopes.password),
        'recovery-secret': parseSealedEnvelope(
          body.envelopes['recovery-secret'],
        ),
      },
    };
  } catch {
    return undefined;
  }
}
