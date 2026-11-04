import type {
  FetchedSecretDataItem,
  KeyPair,
  ToprfSecureBackup,
} from '@metamask/toprf-secure-backup';
import {
  EncAccountDataType,
  TOPRFError,
  TOPRFErrorCode,
  WrappedKeysItemId,
} from '@metamask/toprf-secure-backup';
import { stringToBytes } from '@metamask/utils';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { SeedlessOnboardingControllerErrorMessage } from '../constants.js';
import { SeedlessOnboardingError } from '../errors.js';
import { SecretMetadata } from '../SecretMetadata.js';
import {
  derivePubKey,
  RECOVERY_KEYS_SECRET_TYPE,
  serializeRecoveryKeysItem,
  serializeWrappedKeys,
} from '../utils/index.js';
import type { RecoveryKeys, WrappedKeySet } from '../utils/index.js';
import type { RecoveryRequest } from './recovery-session.js';
import { RecoveryItemStore } from './RecoveryItemStore.js';

const ENC_KEY = new Uint8Array([1, 2, 3]);
const AUTH_KEY_PAIR: KeyPair = { sk: 7n, pk: derivePubKey(7n) };
const VAULT_KEYS = { encKey: ENC_KEY, authKeyPair: AUTH_KEY_PAIR };

const RECOVERY_KEYS: RecoveryKeys = {
  recoveryEncKey: new Uint8Array(32).fill(9),
  recoveryAuthKeyPair: { sk: 123n, pk: derivePubKey(123n) },
};

const OTHER_RECOVERY_KEYS: RecoveryKeys = {
  recoveryEncKey: new Uint8Array(32).fill(8),
  recoveryAuthKeyPair: { sk: 321n, pk: derivePubKey(321n) },
};

const WRAPPED_KEY_SETS: WrappedKeySet[] = [
  {
    encKey: new Uint8Array([4, 5]),
    pwEncKey: new Uint8Array([6, 7]),
    authKeyPair: { sk: 42n, pk: derivePubKey(42n) },
  },
];

const OTHER_WRAPPED_KEY_SETS: WrappedKeySet[] = [
  {
    encKey: new Uint8Array([1, 1]),
    pwEncKey: new Uint8Array([2, 2]),
    authKeyPair: { sk: 43n, pk: derivePubKey(43n) },
  },
];

const REQUEST: RecoveryRequest = {
  nodeAuthTokens: [
    { authToken: 'aal2', nodeIndex: 1, nodePubKey: 'nodePubKey' },
  ],
  authConnectionId: 'mm-recovery-dev-aal2-common',
  groupedAuthConnectionId: 'mm-recovery-aal2-dev',
  userId: 'user-id',
};

/**
 * Build a fetched secret data item.
 *
 * @param itemId - The item ID.
 * @param data - The item data.
 * @returns The fetched item.
 */
function createItem(itemId: string, data: Uint8Array): FetchedSecretDataItem {
  return { itemId, data, version: 'v1' };
}

/**
 * Build a fetched `WrappedKeys` item.
 *
 * @param itemId - The fixed item ID.
 * @param data - The item data.
 * @returns The fetched item.
 */
function createWrappedKeysItem(
  itemId: WrappedKeysItemId,
  data: Uint8Array,
): FetchedSecretDataItem {
  return {
    itemId,
    data,
    version: 'v2',
    dataType: EncAccountDataType.WrappedKeys,
  };
}

type MockToprf = {
  fetchAllSecretDataItems: Mock;
  addSecretDataItem: Mock;
  fetchAuthPubKey: Mock;
};

/**
 * Create a mock TOPRF client with the methods the store uses.
 *
 * @returns The mock spies and the same object typed as the client.
 */
function createMockToprf(): { toprf: MockToprf; client: ToprfSecureBackup } {
  const toprf: MockToprf = {
    fetchAllSecretDataItems: vi.fn(),
    addSecretDataItem: vi.fn(),
    fetchAuthPubKey: vi.fn(),
  };
  return {
    toprf,
    client: toprf as unknown as ToprfSecureBackup,
  };
}

/**
 * Create a store backed by a mock TOPRF client.
 *
 * @returns The store and the mock client spies.
 */
function createStore(): { store: RecoveryItemStore; toprf: MockToprf } {
  const { toprf, client } = createMockToprf();
  const store = new RecoveryItemStore({
    getToprfClient: (): ToprfSecureBackup => client,
  });
  return { store, toprf };
}

describe('RecoveryItemStore', () => {
  describe('fetchRecoveryKeys', () => {
    it('returns undefined when the TOPRF1 namespace has no recovery-keys item', async () => {
      const { store, toprf } = createStore();
      toprf.fetchAllSecretDataItems.mockResolvedValue([
        createItem(
          'srp',
          new SecretMetadata(stringToBytes('seed phrase')).toBytes(),
        ),
        createItem('garbage', stringToBytes('garbage')),
      ]);

      expect(await store.fetchRecoveryKeys(VAULT_KEYS)).toBeUndefined();
      expect(toprf.fetchAllSecretDataItems).toHaveBeenCalledWith({
        decKey: ENC_KEY,
        authKeyPair: AUTH_KEY_PAIR,
      });
    });

    it('returns undefined when the recovery-keys item is malformed', async () => {
      const { store, toprf } = createStore();
      toprf.fetchAllSecretDataItems.mockResolvedValue([
        createWrappedKeysItem(
          WrappedKeysItemId.WrappedRecoveryKeys,
          stringToBytes(JSON.stringify({ type: RECOVERY_KEYS_SECRET_TYPE })),
        ),
      ]);

      expect(await store.fetchRecoveryKeys(VAULT_KEYS)).toBeUndefined();
    });

    it('returns the keys from the wrapped_recovery_keys item', async () => {
      const { store, toprf } = createStore();
      toprf.fetchAllSecretDataItems.mockResolvedValue([
        createItem(
          'srp',
          new SecretMetadata(stringToBytes('seed phrase')).toBytes(),
        ),
        createWrappedKeysItem(
          WrappedKeysItemId.WrappedRecoveryKeys,
          serializeRecoveryKeysItem(RECOVERY_KEYS),
        ),
      ]);

      expect(await store.fetchRecoveryKeys(VAULT_KEYS)).toStrictEqual(
        RECOVERY_KEYS,
      );
    });

    it('ignores recovery-keys data that is not under the wrapped_recovery_keys WrappedKeys item', async () => {
      const { store, toprf } = createStore();
      toprf.fetchAllSecretDataItems.mockResolvedValue([
        createItem('item-1', serializeRecoveryKeysItem(RECOVERY_KEYS)),
        createWrappedKeysItem(
          WrappedKeysItemId.WrappedPasswordKeys,
          serializeRecoveryKeysItem(OTHER_RECOVERY_KEYS),
        ),
      ]);

      expect(await store.fetchRecoveryKeys(VAULT_KEYS)).toBeUndefined();
    });

    it('rethrows auth token errors', async () => {
      const { store, toprf } = createStore();
      const authError = new TOPRFError(
        TOPRFErrorCode.AuthTokenExpired,
        'expired',
      );
      toprf.fetchAllSecretDataItems.mockRejectedValue(authError);

      await expect(store.fetchRecoveryKeys(VAULT_KEYS)).rejects.toBe(authError);
    });

    it('wraps other fetch errors in FailedToFetchSecretMetadata', async () => {
      const { store, toprf } = createStore();
      const cause = new Error('network');
      toprf.fetchAllSecretDataItems.mockRejectedValue(cause);

      const error = await store
        .fetchRecoveryKeys(VAULT_KEYS)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(SeedlessOnboardingError);
      expect((error as SeedlessOnboardingError).message).toBe(
        SeedlessOnboardingControllerErrorMessage.FailedToFetchSecretMetadata,
      );
      expect((error as SeedlessOnboardingError).cause).toBe(cause);
    });
  });

  describe('fetchWrappedKeys', () => {
    it('returns the key sets from the wrapped_seed_keys item', async () => {
      const { store, toprf } = createStore();
      toprf.fetchAllSecretDataItems.mockResolvedValue([
        createItem('item-1', serializeWrappedKeys(OTHER_WRAPPED_KEY_SETS)),
        createWrappedKeysItem(
          WrappedKeysItemId.WrappedPasswordKeys,
          serializeWrappedKeys(WRAPPED_KEY_SETS),
        ),
      ]);

      expect(await store.fetchWrappedKeys(RECOVERY_KEYS)).toStrictEqual(
        WRAPPED_KEY_SETS,
      );
      expect(toprf.fetchAllSecretDataItems).toHaveBeenCalledWith({
        decKey: RECOVERY_KEYS.recoveryEncKey,
        authKeyPair: RECOVERY_KEYS.recoveryAuthKeyPair,
      });
    });

    it('returns an empty array when the wrapped-keys item is malformed', async () => {
      const { store, toprf } = createStore();
      toprf.fetchAllSecretDataItems.mockResolvedValue([
        createWrappedKeysItem(
          WrappedKeysItemId.WrappedPasswordKeys,
          stringToBytes('garbage'),
        ),
      ]);

      expect(await store.fetchWrappedKeys(RECOVERY_KEYS)).toStrictEqual([]);
    });

    it('returns an empty array when there are no wrapped-keys items', async () => {
      const { store, toprf } = createStore();
      toprf.fetchAllSecretDataItems.mockResolvedValue([]);

      expect(await store.fetchWrappedKeys(RECOVERY_KEYS)).toStrictEqual([]);
    });

    it('wraps generic fetch errors in FailedToFetchSecretMetadata', async () => {
      const { store, toprf } = createStore();
      toprf.fetchAllSecretDataItems.mockRejectedValue(new Error('boom'));

      await expect(store.fetchWrappedKeys(RECOVERY_KEYS)).rejects.toThrow(
        SeedlessOnboardingControllerErrorMessage.FailedToFetchSecretMetadata,
      );
    });
  });

  describe('writeWrappedKeys', () => {
    it('writes the wrapped_seed_keys item to the TOPRF2 namespace', async () => {
      const { store, toprf } = createStore();
      toprf.addSecretDataItem.mockResolvedValue(undefined);

      await store.writeWrappedKeys(RECOVERY_KEYS, WRAPPED_KEY_SETS);

      expect(toprf.addSecretDataItem).toHaveBeenCalledWith({
        encKey: RECOVERY_KEYS.recoveryEncKey,
        authKeyPair: RECOVERY_KEYS.recoveryAuthKeyPair,
        secretData: serializeWrappedKeys(WRAPPED_KEY_SETS),
        itemId: WrappedKeysItemId.WrappedPasswordKeys,
        dataType: EncAccountDataType.WrappedKeys,
      });
    });
  });

  describe('writeRecoveryKeys', () => {
    it('writes the wrapped_recovery_keys item to the TOPRF1 namespace', async () => {
      vi.useFakeTimers({ now: 1234 });
      try {
        const { store, toprf } = createStore();
        toprf.addSecretDataItem.mockResolvedValue(undefined);

        await store.writeRecoveryKeys({
          recoveryKeys: RECOVERY_KEYS,
          ...VAULT_KEYS,
        });

        expect(toprf.addSecretDataItem).toHaveBeenCalledWith({
          encKey: ENC_KEY,
          authKeyPair: AUTH_KEY_PAIR,
          secretData: serializeRecoveryKeysItem(RECOVERY_KEYS, 1234),
          itemId: WrappedKeysItemId.WrappedRecoveryKeys,
          dataType: EncAccountDataType.WrappedKeys,
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('fetchRecoveryAuthPubKey', () => {
    it('returns the auth public key', async () => {
      const { store, toprf } = createStore();
      const authPubKey = derivePubKey(55n);
      toprf.fetchAuthPubKey.mockResolvedValue({ authPubKey, keyIndex: 1 });

      expect(await store.fetchRecoveryAuthPubKey(REQUEST)).toBe(authPubKey);
      expect(toprf.fetchAuthPubKey).toHaveBeenCalledWith(REQUEST);
    });

    it('rethrows auth token errors', async () => {
      const { store, toprf } = createStore();
      const authError = new TOPRFError(
        TOPRFErrorCode.InvalidAuthToken,
        'invalid',
      );
      toprf.fetchAuthPubKey.mockRejectedValue(authError);

      await expect(store.fetchRecoveryAuthPubKey(REQUEST)).rejects.toBe(
        authError,
      );
    });

    it('wraps other errors in FailedToFetchAuthPubKey', async () => {
      const { store, toprf } = createStore();
      const cause = new Error('network');
      toprf.fetchAuthPubKey.mockRejectedValue(cause);

      const error = await store
        .fetchRecoveryAuthPubKey(REQUEST)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(SeedlessOnboardingError);
      expect((error as SeedlessOnboardingError).message).toBe(
        SeedlessOnboardingControllerErrorMessage.FailedToFetchAuthPubKey,
      );
      expect((error as SeedlessOnboardingError).cause).toBe(cause);
    });
  });

  it('resolves the TOPRF client at call time through the getter', async () => {
    const first = createMockToprf();
    const second = createMockToprf();
    let current: ToprfSecureBackup = first.client;
    const store = new RecoveryItemStore({
      getToprfClient: (): ToprfSecureBackup => current,
    });
    second.toprf.fetchAllSecretDataItems.mockResolvedValue([]);
    first.toprf.fetchAllSecretDataItems.mockResolvedValue([]);

    current = second.client;
    await store.fetchRecoveryKeys(VAULT_KEYS);

    expect(second.toprf.fetchAllSecretDataItems).toHaveBeenCalledTimes(1);
    expect(first.toprf.fetchAllSecretDataItems).not.toHaveBeenCalled();
  });
});
