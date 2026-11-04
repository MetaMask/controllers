import type { KeyPair, ToprfSecureBackup } from '@metamask/toprf-secure-backup';
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
import { isAuthTokenError } from '../utils/index.js';
import {
  parseControlItem,
  parseEnvelope,
  serializeControlItem,
  serializeEnvelope,
} from './envelope-keys.js';
import type {
  ControlItem,
  ControlKeys,
  Envelope,
  EnvelopeKeys,
  EnvelopePath,
} from './envelope-keys.js';

const log = createModuleLogger(projectLogger, controllerName);

/**
 * The fixed item ids of the envelope items. Each kind lives in its own
 * partition, so the ids only need to be accepted `WrappedKeys` item ids.
 */
export const EnvelopeItemId = {
  password: WrappedKeysItemId.WrappedPasswordKeys,
  'recovery-secret': WrappedKeysItemId.WrappedRecoveryKeys,
  control: WrappedKeysItemId.WrappedSeedKeys,
} as const;

/**
 * Reads and writes the envelope items (`pbek`, `rbek`) and the control item
 * at the Metadata Service. Each sits alone in its own partition, under a fixed
 * `WrappedKeys` item id that the metadata store overwrites in place.
 *
 * Fetch errors are thrown, never reported as "absent" (I6).
 */
export class EnvelopeStore {
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
   * Fetch the envelope in a partition.
   *
   * @param keys - The envelope keys of the partition.
   * @param path - The path of the envelope.
   * @returns The envelope, or undefined when the partition has none.
   * @throws The auth token error as-is, `FailedToFetchSecretMetadata`, or
   * `InvalidEnvelope`.
   */
  async fetchEnvelope(
    keys: EnvelopeKeys,
    path: EnvelopePath,
  ): Promise<Envelope | undefined> {
    const data = await this.#fetchItem(
      keys.wrapKey,
      keys.envAuth,
      EnvelopeItemId[path],
    );
    return data ? parseEnvelope(data) : undefined;
  }

  /**
   * Write the envelope of a partition, replacing any existing one.
   *
   * @param keys - The envelope keys of the partition.
   * @param envelope - The envelope.
   */
  async writeEnvelope(keys: EnvelopeKeys, envelope: Envelope): Promise<void> {
    await this.#getToprfClient().addSecretDataItem({
      encKey: keys.wrapKey,
      authKeyPair: keys.envAuth,
      secretData: serializeEnvelope(envelope),
      itemId: EnvelopeItemId[envelope.path],
      dataType: EncAccountDataType.WrappedKeys,
    });
  }

  /**
   * Fetch the control item of a vault.
   *
   * @param keys - The control keys of the vault.
   * @returns The control item, or undefined when the vault has none.
   * @throws The auth token error as-is, `FailedToFetchSecretMetadata`, or
   * `InvalidEnvelope`.
   */
  async fetchControlItem(keys: ControlKeys): Promise<ControlItem | undefined> {
    const data = await this.#fetchItem(
      keys.ctrlKey,
      keys.ctrlAuth,
      EnvelopeItemId.control,
    );
    return data ? parseControlItem(data) : undefined;
  }

  /**
   * Write the control item of a vault, replacing any existing one.
   *
   * @param keys - The control keys of the vault.
   * @param item - The control item.
   */
  async writeControlItem(keys: ControlKeys, item: ControlItem): Promise<void> {
    await this.#getToprfClient().addSecretDataItem({
      encKey: keys.ctrlKey,
      authKeyPair: keys.ctrlAuth,
      secretData: serializeControlItem(item),
      itemId: EnvelopeItemId.control,
      dataType: EncAccountDataType.WrappedKeys,
    });
  }

  /**
   * Fetch the data of the `WrappedKeys` item with the given id.
   *
   * @param decKey - The decryption key of the partition.
   * @param authKeyPair - The auth key pair of the partition.
   * @param itemId - The fixed item id.
   * @returns The item data, or undefined when the partition has no such item.
   * @throws The auth token error as-is, or `FailedToFetchSecretMetadata`.
   */
  async #fetchItem(
    decKey: Uint8Array,
    authKeyPair: KeyPair,
    itemId: WrappedKeysItemId,
  ): Promise<Uint8Array | undefined> {
    try {
      const items = await this.#getToprfClient().fetchAllSecretDataItems({
        decKey,
        authKeyPair,
      });
      return items.find(
        (item) =>
          item.itemId === itemId &&
          item.dataType === EncAccountDataType.WrappedKeys,
      )?.data;
    } catch (error) {
      log('Error fetching envelope item', error);
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
