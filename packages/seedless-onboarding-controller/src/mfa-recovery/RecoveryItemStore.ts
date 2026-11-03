import type {
  FetchedSecretDataItem,
  KeyPair,
  SEC1EncodedPublicKey,
  ToprfSecureBackup,
} from '@metamask/toprf-secure-backup';
import {
  EncAccountDataType,
  WrappedKeysItemId,
} from '@metamask/toprf-secure-backup';

import {
  controllerName,
  SeedlessOnboardingControllerErrorMessage,
} from '../constants.js';
import { SeedlessOnboardingError } from '../errors.js';
import { createModuleLogger, projectLogger } from '../logger.js';
import {
  isAuthTokenError,
  parseRecoveryKeysItem,
  parseWrappedKeys,
  serializeRecoveryKeysItem,
  serializeWrappedKeys,
} from '../utils/index.js';
import type { RecoveryKeys, WrappedKeySet } from '../utils/index.js';
import type { RecoveryRequest } from './recovery-session.js';

const log = createModuleLogger(projectLogger, controllerName);

/**
 * Reads and writes the recovery-related secret data items: the recovery-keys
 * item (TOPRF1 namespace, next to the user's secrets), the wrapped-keys item
 * (TOPRF2 namespace), and the recovery verifier auth public key.
 *
 * Both items are `WrappedKeys` items under a fixed item ID, which the metadata
 * store overwrites in place, so each namespace holds at most one of each.
 */
export class RecoveryItemStore {
  readonly #getToprfClient: () => ToprfSecureBackup;

  /**
   * @param options - The options.
   * @param options.getToprfClient - Returns the current TOPRF client. A getter
   * is used so the client is resolved at call time.
   */
  constructor({ getToprfClient }: { getToprfClient: () => ToprfSecureBackup }) {
    this.#getToprfClient = getToprfClient;
  }

  /**
   * Read the recovery-keys item from the TOPRF1 namespace.
   *
   * @param params - The function parameters.
   * @param params.encKey - The TOPRF1 encryption key.
   * @param params.authKeyPair - The TOPRF1 auth key pair.
   * @returns The TOPRF2 keys, or undefined when there is no well-formed item.
   */
  async fetchRecoveryKeys({
    encKey,
    authKeyPair,
  }: {
    encKey: Uint8Array;
    authKeyPair: KeyPair;
  }): Promise<RecoveryKeys | undefined> {
    const item = await this.#fetchWrappedKeysItem(
      encKey,
      authKeyPair,
      WrappedKeysItemId.WrappedRecovery,
    );
    if (!item) {
      return undefined;
    }
    try {
      return parseRecoveryKeysItem(item.data).recoveryKeys;
    } catch (error) {
      log('Ignoring malformed recovery-keys item', error);
      return undefined;
    }
  }

  /**
   * Read the TOPRF1 key sets from the wrapped-keys item in the TOPRF2
   * namespace.
   *
   * @param recoveryKeys - The TOPRF2 keys.
   * @returns The wrapped key sets, or an empty array when there is no
   * well-formed item.
   */
  async fetchWrappedKeys(recoveryKeys: RecoveryKeys): Promise<WrappedKeySet[]> {
    const item = await this.#fetchWrappedKeysItem(
      recoveryKeys.recoveryEncKey,
      recoveryKeys.recoveryAuthKeyPair,
      WrappedKeysItemId.WrappedSeedless,
    );
    if (!item) {
      return [];
    }
    try {
      return parseWrappedKeys(item.data);
    } catch (error) {
      log('Ignoring malformed wrapped-keys item', error);
      return [];
    }
  }

  /**
   * Write the wrapped-keys item to the TOPRF2 namespace, replacing any
   * existing one.
   *
   * @param recoveryKeys - The TOPRF2 keys.
   * @param keySets - The TOPRF1 key sets to wrap.
   */
  async writeWrappedKeys(
    recoveryKeys: RecoveryKeys,
    keySets: WrappedKeySet[],
  ): Promise<void> {
    await this.#getToprfClient().addSecretDataItem({
      encKey: recoveryKeys.recoveryEncKey,
      authKeyPair: recoveryKeys.recoveryAuthKeyPair,
      secretData: serializeWrappedKeys(keySets),
      itemId: WrappedKeysItemId.WrappedSeedless,
      dataType: EncAccountDataType.WrappedKeys,
    });
  }

  /**
   * Write the recovery-keys item to the TOPRF1 namespace, replacing any
   * existing one.
   *
   * @param params - The function parameters.
   * @param params.recoveryKeys - The TOPRF2 keys to store.
   * @param params.encKey - The TOPRF1 encryption key.
   * @param params.authKeyPair - The TOPRF1 auth key pair.
   */
  async writeRecoveryKeys({
    recoveryKeys,
    encKey,
    authKeyPair,
  }: {
    recoveryKeys: RecoveryKeys;
    encKey: Uint8Array;
    authKeyPair: KeyPair;
  }): Promise<void> {
    await this.#getToprfClient().addSecretDataItem({
      encKey,
      authKeyPair,
      secretData: serializeRecoveryKeysItem(recoveryKeys),
      itemId: WrappedKeysItemId.WrappedRecovery,
      dataType: EncAccountDataType.WrappedKeys,
    });
  }

  /**
   * Fetch the recovery verifier auth public key with the aal2 set.
   *
   * @param request - The recovery verifier request params.
   * @returns The auth public key.
   * @throws The auth token error as-is, or `FailedToFetchAuthPubKey`.
   */
  async fetchRecoveryAuthPubKey(
    request: RecoveryRequest,
  ): Promise<SEC1EncodedPublicKey> {
    try {
      const { authPubKey } =
        await this.#getToprfClient().fetchAuthPubKey(request);
      return authPubKey;
    } catch (error) {
      if (isAuthTokenError(error)) {
        throw error;
      }
      log('Error fetching recovery auth pub key', error);
      throw new SeedlessOnboardingError(
        SeedlessOnboardingControllerErrorMessage.FailedToFetchAuthPubKey,
        { cause: error },
      );
    }
  }

  /**
   * Fetch the `WrappedKeys` item with the given item ID from a namespace.
   *
   * @param decKey - The decryption key of the namespace.
   * @param authKeyPair - The auth key pair of the namespace.
   * @param itemId - The fixed item ID of the item.
   * @returns The item, or undefined when the namespace has none.
   */
  async #fetchWrappedKeysItem(
    decKey: Uint8Array,
    authKeyPair: KeyPair,
    itemId: WrappedKeysItemId,
  ): Promise<FetchedSecretDataItem | undefined> {
    const items = await this.#fetchSecretDataItems(decKey, authKeyPair);
    return items.find(
      (item) =>
        item.itemId === itemId &&
        item.dataType === EncAccountDataType.WrappedKeys,
    );
  }

  /**
   * Fetch and decrypt all secret data items in a namespace.
   *
   * @param decKey - The decryption key of the namespace.
   * @param authKeyPair - The auth key pair of the namespace.
   * @returns The fetched secret data items.
   * @throws The auth token error as-is, or `FailedToFetchSecretMetadata`.
   */
  async #fetchSecretDataItems(
    decKey: Uint8Array,
    authKeyPair: KeyPair,
  ): Promise<FetchedSecretDataItem[]> {
    try {
      return await this.#getToprfClient().fetchAllSecretDataItems({
        decKey,
        authKeyPair,
      });
    } catch (error) {
      log('Error fetching secret data', error);
      if (isAuthTokenError(error)) {
        throw error;
      }
      throw new SeedlessOnboardingError(
        SeedlessOnboardingControllerErrorMessage.FailedToFetchSecretMetadata,
        { cause: error },
      );
    }
  }
}
