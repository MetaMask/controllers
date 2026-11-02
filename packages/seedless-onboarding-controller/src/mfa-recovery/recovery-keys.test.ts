import { bytesToBase64, bytesToString, stringToBytes } from '@metamask/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { describe, expect, it } from 'vitest';

import { SeedlessOnboardingControllerErrorMessage } from '../constants.js';
import { SecretMetadata } from '../SecretMetadata.js';
import {
  derivePubKey,
  isRecoveryKeysItem,
  isWrapCurrent,
  parseRecoveryKeys,
  parseRecoveryKeysItem,
  parseWrappedKeys,
  pubKeysEqual,
  RECOVERY_KEYS_PREFIX,
  RECOVERY_KEYS_SECRET_TYPE,
  serializeRecoveryKeys,
  serializeRecoveryKeysItem,
  serializeWrappedKeys,
  TOPRF_RECOVERY_VERIFIER,
  WRAPPED_KEYS_PREFIX,
} from './recovery-keys.js';
import type { RecoveryKeys, WrappedKeySet } from './recovery-keys.js';

const INVALID_ITEM_ERROR =
  SeedlessOnboardingControllerErrorMessage.InvalidRecoveryKeysItem;

const MOCK_RECOVERY_KEYS: RecoveryKeys = {
  recoveryEncKey: new Uint8Array(32).fill(7),
  recoveryAuthKeyPair: {
    sk: 123456789n,
    pk: derivePubKey(123456789n),
  },
};

const MOCK_WRAPPED_KEY_SETS: WrappedKeySet[] = [
  {
    encKey: new Uint8Array([1, 2, 3]),
    pwEncKey: new Uint8Array([4, 5, 6]),
    authKeyPair: {
      sk: 42n,
      pk: derivePubKey(42n),
    },
  },
  {
    encKey: new Uint8Array([7, 8, 9]),
    pwEncKey: new Uint8Array([10, 11, 12]),
    authKeyPair: {
      sk: 99n,
      pk: derivePubKey(99n),
    },
  },
];

/**
 * Build raw item data from a prefix and a raw body string.
 *
 * @param prefix - The item prefix.
 * @param body - The raw body string following the prefix.
 * @returns The encoded item data.
 */
function rawItem(prefix: string, body: string): Uint8Array {
  return stringToBytes(`${prefix}${body}`);
}

describe('recovery-keys', () => {
  describe('constants', () => {
    it('uses the toprf-recovery verifier for the recovery TOPRF instance', () => {
      expect(TOPRF_RECOVERY_VERIFIER).toBe('toprf-recovery');
    });

    it('exposes the expected prefixes and recovery-keys item type', () => {
      expect(RECOVERY_KEYS_PREFIX).toBe('MFA_RECOVERY_KEYS_V1');
      expect(WRAPPED_KEYS_PREFIX).toBe('MFA_WRAPPED_KEYS_V1');
      expect(RECOVERY_KEYS_SECRET_TYPE).toBe('mfaRecoveryKeys');
    });
  });

  describe('serializeRecoveryKeys / parseRecoveryKeys', () => {
    it('round trips recovery keys', () => {
      const serialized = serializeRecoveryKeys(MOCK_RECOVERY_KEYS);

      expect(parseRecoveryKeys(serialized)).toStrictEqual(MOCK_RECOVERY_KEYS);
    });

    it('prefixes the serialized data with the recovery keys prefix', () => {
      const serialized = serializeRecoveryKeys(MOCK_RECOVERY_KEYS);

      expect(bytesToString(serialized).startsWith(RECOVERY_KEYS_PREFIX)).toBe(
        true,
      );
    });

    it('does not produce valid JSON as plaintext', () => {
      const serialized = serializeRecoveryKeys(MOCK_RECOVERY_KEYS);

      expect(() => {
        JSON.parse(bytesToString(serialized));
      }).toThrow(SyntaxError);
    });

    it('throws when the prefix is wrong', () => {
      const serialized = serializeWrappedKeys(MOCK_WRAPPED_KEY_SETS);

      expect(() => parseRecoveryKeys(serialized)).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when the body is not valid JSON', () => {
      expect(() =>
        parseRecoveryKeys(rawItem(RECOVERY_KEYS_PREFIX, '{not json')),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it.each([
      ['null body', 'null'],
      ['array body', '[]'],
      ['string body', '"text"'],
    ])('throws for a %s', (_label, body) => {
      expect(() =>
        parseRecoveryKeys(rawItem(RECOVERY_KEYS_PREFIX, body)),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when recoveryAuthKeyPair is not an object', () => {
      expect(() =>
        parseRecoveryKeys(
          rawItem(
            RECOVERY_KEYS_PREFIX,
            '{"recoveryEncKey":"AQ==","recoveryAuthKeyPair":"nope"}',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when recoveryEncKey is not a string', () => {
      expect(() =>
        parseRecoveryKeys(
          rawItem(
            RECOVERY_KEYS_PREFIX,
            '{"recoveryEncKey":1,"recoveryAuthKeyPair":{"sk":"0x1","pk":"AQ=="}}',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when the key pair sk is not a string', () => {
      expect(() =>
        parseRecoveryKeys(
          rawItem(
            RECOVERY_KEYS_PREFIX,
            '{"recoveryEncKey":"AQ==","recoveryAuthKeyPair":{"sk":1,"pk":"AQ=="}}',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when the key pair pk is not a string', () => {
      expect(() =>
        parseRecoveryKeys(
          rawItem(
            RECOVERY_KEYS_PREFIX,
            '{"recoveryEncKey":"AQ==","recoveryAuthKeyPair":{"sk":"0x1","pk":1}}',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when the sk hex is malformed', () => {
      expect(() =>
        parseRecoveryKeys(
          rawItem(
            RECOVERY_KEYS_PREFIX,
            '{"recoveryEncKey":"AQ==","recoveryAuthKeyPair":{"sk":"0xzz","pk":"AQ=="}}',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when the base64 encoding is malformed', () => {
      expect(() =>
        parseRecoveryKeys(
          rawItem(
            RECOVERY_KEYS_PREFIX,
            '{"recoveryEncKey":"!!!","recoveryAuthKeyPair":{"sk":"0x1","pk":"AQ=="}}',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });
  });

  describe('serializeWrappedKeys / parseWrappedKeys', () => {
    it('round trips wrapped key sets', () => {
      const serialized = serializeWrappedKeys(MOCK_WRAPPED_KEY_SETS);

      expect(parseWrappedKeys(serialized)).toStrictEqual(MOCK_WRAPPED_KEY_SETS);
    });

    it('prefixes the serialized data with the wrapped keys prefix', () => {
      const serialized = serializeWrappedKeys(MOCK_WRAPPED_KEY_SETS);

      expect(bytesToString(serialized).startsWith(WRAPPED_KEYS_PREFIX)).toBe(
        true,
      );
    });

    it('does not produce valid JSON as plaintext', () => {
      const serialized = serializeWrappedKeys(MOCK_WRAPPED_KEY_SETS);

      expect(() => {
        JSON.parse(bytesToString(serialized));
      }).toThrow(SyntaxError);
    });

    it('throws when the prefix is wrong', () => {
      const serialized = serializeRecoveryKeys(MOCK_RECOVERY_KEYS);

      expect(() => parseWrappedKeys(serialized)).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when the body is not valid JSON', () => {
      expect(() => parseWrappedKeys(rawItem(WRAPPED_KEYS_PREFIX, '['))).toThrow(
        INVALID_ITEM_ERROR,
      );
    });

    it('throws when the body is not an array', () => {
      expect(() =>
        parseWrappedKeys(rawItem(WRAPPED_KEYS_PREFIX, '{}')),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when the array is empty', () => {
      expect(() => parseWrappedKeys(serializeWrappedKeys([]))).toThrow(
        INVALID_ITEM_ERROR,
      );
    });

    it('throws when an entry is not an object', () => {
      expect(() =>
        parseWrappedKeys(rawItem(WRAPPED_KEYS_PREFIX, '[null]')),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when an entry authKeyPair is not an object', () => {
      expect(() =>
        parseWrappedKeys(
          rawItem(
            WRAPPED_KEYS_PREFIX,
            '[{"encKey":"AQ==","pwEncKey":"AQ==","authKeyPair":"nope"}]',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when an entry encKey is not a string', () => {
      expect(() =>
        parseWrappedKeys(
          rawItem(
            WRAPPED_KEYS_PREFIX,
            '[{"encKey":1,"pwEncKey":"AQ==","authKeyPair":{"sk":"0x1","pk":"AQ=="}}]',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when an entry pwEncKey is malformed', () => {
      expect(() =>
        parseWrappedKeys(
          rawItem(
            WRAPPED_KEYS_PREFIX,
            '[{"encKey":"AQ==","pwEncKey":"!!!","authKeyPair":{"sk":"0x1","pk":"AQ=="}}]',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });

    it('throws when an entry key pair fields are invalid', () => {
      expect(() =>
        parseWrappedKeys(
          rawItem(
            WRAPPED_KEYS_PREFIX,
            '[{"encKey":"AQ==","pwEncKey":"AQ==","authKeyPair":{"sk":"0x1","pk":null}}]',
          ),
        ),
      ).toThrow(INVALID_ITEM_ERROR);
    });
  });

  describe('serializeRecoveryKeysItem / parseRecoveryKeysItem', () => {
    /**
     * Build raw item data from a JSON value.
     *
     * @param value - The value to encode.
     * @returns The encoded item data.
     */
    function jsonItem(value: unknown): Uint8Array {
      return stringToBytes(JSON.stringify(value));
    }

    it('round trips recovery keys and the timestamp', () => {
      const item = serializeRecoveryKeysItem(MOCK_RECOVERY_KEYS, 1234);

      expect(parseRecoveryKeysItem(item)).toStrictEqual({
        recoveryKeys: MOCK_RECOVERY_KEYS,
        timestamp: 1234,
      });
    });

    it('defaults the timestamp to the current time', () => {
      const before = Date.now();
      const { timestamp } = parseRecoveryKeysItem(
        serializeRecoveryKeysItem(MOCK_RECOVERY_KEYS),
      );

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('serializes an item that parses as secret metadata', () => {
      const item = serializeRecoveryKeysItem(MOCK_RECOVERY_KEYS, 1234);

      const secretMetadata = SecretMetadata.fromRawMetadata<Uint8Array>(
        item,
        {},
      );

      expect(secretMetadata.timestamp).toBe(1234);
      expect(secretMetadata.type as string).toBe(RECOVERY_KEYS_SECRET_TYPE);
      expect(secretMetadata.data).toStrictEqual(
        serializeRecoveryKeys(MOCK_RECOVERY_KEYS),
      );
    });

    it.each([
      ['not JSON', stringToBytes('garbage')],
      ['not an object', jsonItem(['mfaRecoveryKeys'])],
      [
        'of another type',
        jsonItem({ data: 'AA==', timestamp: 1, type: 'mnemonic' }),
      ],
      [
        'missing the timestamp',
        jsonItem({ data: 'AA==', type: RECOVERY_KEYS_SECRET_TYPE }),
      ],
      [
        'with non-string data',
        jsonItem({ data: 1, timestamp: 1, type: RECOVERY_KEYS_SECRET_TYPE }),
      ],
      [
        'with data that is not recovery keys',
        jsonItem({
          data: bytesToBase64(stringToBytes('garbage')),
          timestamp: 1,
          type: RECOVERY_KEYS_SECRET_TYPE,
        }),
      ],
    ])('rejects an item %s', (_name, item) => {
      expect(() => parseRecoveryKeysItem(item)).toThrow(INVALID_ITEM_ERROR);
    });

    it('rejects an item whose data is not base64', () => {
      const item = jsonItem({
        data: 'not base64!',
        timestamp: 1,
        type: RECOVERY_KEYS_SECRET_TYPE,
      });

      expect(() => parseRecoveryKeysItem(item)).toThrow(INVALID_ITEM_ERROR);
    });
  });

  describe('isRecoveryKeysItem', () => {
    it('recognizes a recovery-keys item', () => {
      expect(
        isRecoveryKeysItem(serializeRecoveryKeysItem(MOCK_RECOVERY_KEYS)),
      ).toBe(true);
    });

    it('recognizes a malformed item of the recovery-keys type', () => {
      expect(
        isRecoveryKeysItem(
          stringToBytes(JSON.stringify({ type: RECOVERY_KEYS_SECRET_TYPE })),
        ),
      ).toBe(true);
    });

    it.each([
      [
        'a user secret',
        new SecretMetadata(stringToBytes('seed phrase')).toBytes(),
      ],
      ['a non-JSON item', serializeRecoveryKeys(MOCK_RECOVERY_KEYS)],
      ['a JSON value that is not an object', stringToBytes('null')],
    ])('does not recognize %s', (_name, item) => {
      expect(isRecoveryKeysItem(item)).toBe(false);
    });
  });

  describe('derivePubKey', () => {
    it('matches the uncompressed secp256k1 public key', () => {
      const sk = 987654321n;

      expect(derivePubKey(sk)).toStrictEqual(secp256k1.getPublicKey(sk, false));
    });

    it('returns an uncompressed SEC1 key', () => {
      const pk = derivePubKey(5n);

      expect(pk).toHaveLength(65);
      expect(pk[0]).toBe(0x04);
    });
  });

  describe('pubKeysEqual', () => {
    it('returns true for compressed and uncompressed encodings of the same point', () => {
      const sk = 31337n;
      const compressed = secp256k1.getPublicKey(sk, true);
      const uncompressed = derivePubKey(sk);

      expect(pubKeysEqual(compressed, uncompressed)).toBe(true);
      expect(pubKeysEqual(uncompressed, compressed)).toBe(true);
    });

    it('returns true for identical encodings', () => {
      const pk = derivePubKey(77n);

      expect(pubKeysEqual(pk, pk)).toBe(true);
    });

    it('returns false for different keys', () => {
      expect(pubKeysEqual(derivePubKey(2n), derivePubKey(3n))).toBe(false);
    });
  });

  describe('isWrapCurrent', () => {
    it('returns true when a key set auth key matches the auth public key', () => {
      expect(isWrapCurrent(MOCK_WRAPPED_KEY_SETS, derivePubKey(99n))).toBe(
        true,
      );
    });

    it('matches a compressed auth public key against an uncompressed key set', () => {
      expect(
        isWrapCurrent(MOCK_WRAPPED_KEY_SETS, secp256k1.getPublicKey(42n, true)),
      ).toBe(true);
    });

    it('returns false when no key set auth key matches', () => {
      expect(isWrapCurrent(MOCK_WRAPPED_KEY_SETS, derivePubKey(1000n))).toBe(
        false,
      );
    });

    it('returns false for an empty key set list', () => {
      expect(isWrapCurrent([], derivePubKey(42n))).toBe(false);
    });
  });
});
