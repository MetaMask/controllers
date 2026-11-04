import type { ToprfSecureBackup } from '@metamask/toprf-secure-backup';
import {
  EncAccountDataType,
  TOPRFError,
  TOPRFErrorCode,
  WrappedKeysItemId,
} from '@metamask/toprf-secure-backup';
import { bigIntToHex, stringToBytes } from '@metamask/utils';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { SeedlessOnboardingControllerErrorMessage } from '../constants.js';
import {
  appendControlRecord,
  deriveControlKeys,
  deriveEnvelopeKeys,
  deriveKeyPair,
  sealEnvelope,
  serializeControlItem,
  serializeEnvelope,
} from './envelope-keys.js';
import type { VaultKeySet } from './envelope-keys.js';
import { EnvelopeItemId, EnvelopeStore } from './EnvelopeStore.js';

const vaultKeySet: VaultKeySet = {
  authKeyPair: deriveKeyPair(new Uint8Array(32).fill(1)),
  encKey: new Uint8Array(32).fill(2),
  localWrapKey: new Uint8Array(32).fill(3),
};
const envelopeKeys = deriveEnvelopeKeys(new Uint8Array(32).fill(4));
const controlKeys = deriveControlKeys(vaultKeySet);
const controlItem = appendControlRecord(undefined, {
  v: 1,
  seq: 1,
  passwordNamespace: {
    verifier: 'verifier',
    verifierId: 'user',
    authSk: bigIntToHex(vaultKeySet.authKeyPair.sk),
    keyIndex: 1,
    enabled: true,
  },
  migratedAt: 1,
});

type MockToprfClient = {
  addSecretDataItem: Mock<ToprfSecureBackup['addSecretDataItem']>;
  fetchAllSecretDataItems: Mock<ToprfSecureBackup['fetchAllSecretDataItems']>;
};

/**
 * @returns A store backed by a mock TOPRF client.
 */
function createStore(): {
  store: EnvelopeStore;
  toprfClient: MockToprfClient;
} {
  const toprfClient: MockToprfClient = {
    addSecretDataItem: vi.fn().mockResolvedValue(undefined),
    fetchAllSecretDataItems: vi.fn().mockResolvedValue([]),
  };
  const store = new EnvelopeStore({
    getToprfClient: (): ToprfSecureBackup =>
      toprfClient as unknown as ToprfSecureBackup,
  });
  return { store, toprfClient };
}

describe('EnvelopeStore', () => {
  it('maps each item kind to a fixed WrappedKeys item id', () => {
    expect(EnvelopeItemId).toStrictEqual({
      password: WrappedKeysItemId.WrappedPasswordKeys,
      'recovery-secret': WrappedKeysItemId.WrappedRecoveryKeys,
      control: WrappedKeysItemId.WrappedSeedKeys,
    });
  });

  describe('envelopes', () => {
    it('writes an envelope to its partition under the fixed item id', async () => {
      const { store, toprfClient } = createStore();
      const envelope = await sealEnvelope(
        envelopeKeys.wrapKey,
        'recovery-secret',
        vaultKeySet,
      );

      await store.writeEnvelope(envelopeKeys, envelope);

      expect(toprfClient.addSecretDataItem).toHaveBeenCalledWith({
        encKey: envelopeKeys.wrapKey,
        authKeyPair: envelopeKeys.envAuth,
        secretData: serializeEnvelope(envelope),
        itemId: WrappedKeysItemId.WrappedRecoveryKeys,
        dataType: EncAccountDataType.WrappedKeys,
      });
    });

    it('fetches the envelope of a partition', async () => {
      const { store, toprfClient } = createStore();
      const envelope = await sealEnvelope(
        envelopeKeys.wrapKey,
        'password',
        vaultKeySet,
      );
      toprfClient.fetchAllSecretDataItems.mockResolvedValue([
        {
          itemId: WrappedKeysItemId.WrappedPasswordKeys,
          dataType: EncAccountDataType.WrappedKeys,
          data: serializeEnvelope(envelope),
          version: 'v2',
        },
      ]);

      expect(await store.fetchEnvelope(envelopeKeys, 'password')).toStrictEqual(
        envelope,
      );
      expect(toprfClient.fetchAllSecretDataItems).toHaveBeenCalledWith({
        decKey: envelopeKeys.wrapKey,
        authKeyPair: envelopeKeys.envAuth,
      });
    });

    it('returns undefined for a partition without the item', async () => {
      const { store, toprfClient } = createStore();
      toprfClient.fetchAllSecretDataItems.mockResolvedValue([
        {
          itemId: 'other',
          data: stringToBytes('x'),
          version: 'v1',
        },
      ]);

      expect(
        await store.fetchEnvelope(envelopeKeys, 'password'),
      ).toBeUndefined();
    });

    it('throws for a malformed envelope rather than reporting it absent', async () => {
      const { store, toprfClient } = createStore();
      toprfClient.fetchAllSecretDataItems.mockResolvedValue([
        {
          itemId: WrappedKeysItemId.WrappedPasswordKeys,
          dataType: EncAccountDataType.WrappedKeys,
          data: stringToBytes('garbage'),
          version: 'v2',
        },
      ]);

      await expect(
        store.fetchEnvelope(envelopeKeys, 'password'),
      ).rejects.toThrow(
        SeedlessOnboardingControllerErrorMessage.InvalidEnvelope,
      );
    });

    it('throws fetch errors rather than reporting the envelope absent', async () => {
      const { store, toprfClient } = createStore();
      toprfClient.fetchAllSecretDataItems.mockRejectedValue(
        new Error('network'),
      );

      await expect(
        store.fetchEnvelope(envelopeKeys, 'password'),
      ).rejects.toThrow(
        SeedlessOnboardingControllerErrorMessage.FailedToFetchSecretMetadata,
      );
    });

    it('rethrows auth token errors as-is', async () => {
      const { store, toprfClient } = createStore();
      const error = new TOPRFError(TOPRFErrorCode.AuthTokenExpired, 'expired');
      toprfClient.fetchAllSecretDataItems.mockRejectedValue(error);

      await expect(store.fetchEnvelope(envelopeKeys, 'password')).rejects.toBe(
        error,
      );
    });
  });

  describe('control item', () => {
    it('writes the control item to the control partition', async () => {
      const { store, toprfClient } = createStore();

      await store.writeControlItem(controlKeys, controlItem);

      expect(toprfClient.addSecretDataItem).toHaveBeenCalledWith({
        encKey: controlKeys.ctrlKey,
        authKeyPair: controlKeys.ctrlAuth,
        secretData: serializeControlItem(controlItem),
        itemId: WrappedKeysItemId.WrappedSeedKeys,
        dataType: EncAccountDataType.WrappedKeys,
      });
    });

    it('fetches the control item', async () => {
      const { store, toprfClient } = createStore();
      toprfClient.fetchAllSecretDataItems.mockResolvedValue([
        {
          itemId: WrappedKeysItemId.WrappedSeedKeys,
          dataType: EncAccountDataType.WrappedKeys,
          data: serializeControlItem(controlItem),
          version: 'v2',
        },
      ]);

      expect(await store.fetchControlItem(controlKeys)).toStrictEqual(
        controlItem,
      );
    });

    it('returns undefined when the vault has no control item', async () => {
      const { store } = createStore();

      expect(await store.fetchControlItem(controlKeys)).toBeUndefined();
    });
  });
});
