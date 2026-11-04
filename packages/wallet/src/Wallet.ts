import type { StateMetadataConstraint } from '@metamask/base-controller';
import type { GeolocationControllerState } from '@metamask/geolocation-controller';
import { Messenger } from '@metamask/messenger';
import { hasProperty } from '@metamask/utils';

import type {
  DefaultActions,
  DefaultEvents,
  DefaultInstances,
  DefaultState,
  RootMessenger,
} from './initialization/defaults.js';
import { initialize } from './initialization/initialization.js';
import { WalletOptions } from './types.js';

export class Wallet {
  // TODO: Expand default types when passing additionalConfigurations.
  readonly #messenger: RootMessenger<DefaultActions, DefaultEvents>;

  readonly #instances: DefaultInstances;

  readonly #controllerMetadata: Readonly<
    Record<string, Readonly<StateMetadataConstraint>>
  >;

  #isDestroyed = false;

  #geolocationFailoverSubscribed = false;

  /**
   * Keeps Infura failover aligned with the latest completed geolocation.
   * A failed or in-flight refresh does not change the mode.
   *
   * @param state - The latest geolocation controller state.
   */
  readonly #onGeolocationStateChange = (
    state: GeolocationControllerState,
  ): void => {
    if (state.status !== 'complete') {
      return;
    }
    const network = this.#instances.NetworkController;
    if (state.country === 'CN') {
      network.setRpcFailoverMode('forced');
      return;
    }
    if (
      typeof state.country === 'string' &&
      /^[A-Z]{2}$/u.test(state.country)
    ) {
      network.setRpcFailoverMode(null);
    }
  };

  /**
   * Creates a `Wallet` instance, initializing all instances as specified by the passed options.
   *
   * @param options - Options bag.
   * @param options.messenger - An optional messenger to override the default one.
   * @param options.state - An optional state blob.
   * @param options.initializationConfigurations - An optional list of additional initialization configurations
   * required beyond the ones included by default.
   * @param options.instanceOptions - An optional object containing options that should be passed
   * to specific instances for additional customization.
   */
  constructor(options: WalletOptions) {
    this.#messenger =
      options.messenger ??
      new Messenger({
        namespace: 'Root',
      });

    this.#instances = initialize({
      ...options,
      messenger: this.#messenger,
    });

    this.#controllerMetadata = Object.fromEntries(
      Object.entries(this.#instances)
        .filter(([_, instance]) => hasProperty(instance, 'metadata'))
        .map(([name, instance]) => [
          name,
          (instance as { metadata: StateMetadataConstraint }).metadata,
        ]),
    );
  }

  /**
   * @returns The root messenger of the wallet.
   */
  get messenger(): Readonly<RootMessenger<DefaultActions, DefaultEvents>> {
    return this.#messenger;
  }

  set messenger(_) {
    throw new Error('The messenger cannot be directly mutated.');
  }

  /**
   * @returns The combined state of the wallet.
   */
  get state(): DefaultState {
    return Object.entries(this.#instances).reduce<Record<string, unknown>>(
      (totalState, [name, instance]) => {
        // We do actually want to check the prototype here.
        // eslint-disable-next-line no-restricted-syntax
        if ('state' in instance && instance.state) {
          totalState[name] = instance.state;
        }
        return totalState;
      },
      {},
    ) as DefaultState;
  }

  set state(_) {
    throw new Error('Wallet state cannot be directly mutated.');
  }

  /**
   * @returns The controller metadata; containing per-controller information about what properties to persist etc.
   */
  get controllerMetadata(): Readonly<
    Record<string, Readonly<StateMetadataConstraint>>
  > {
    return this.#controllerMetadata;
  }

  set controllerMetadata(_) {
    throw new Error('The controller metadata cannot be directly mutated.');
  }

  getInstance<Name extends keyof DefaultInstances>(
    name: Name,
  ): DefaultInstances[Name];

  getInstance(
    name: string,
  ): DefaultInstances[keyof DefaultInstances] | undefined;

  /**
   * Get an instantiated controller or service.
   *
   * @param name - The name.
   * @returns The instance, if it exists.
   * @deprecated - Please use the messenger instead of direct access.
   */
  getInstance(
    name: string,
  ): DefaultInstances[keyof DefaultInstances] | undefined {
    return this.#instances[name as keyof DefaultInstances];
  }

  /**
   * Complete additional initialization of instantiated controllers or services after instantiating `Wallet`.
   *
   * A persisted mainland China geolocation forces Infura failover before
   * network clients are created. Otherwise failover follows the geolocation
   * response when it arrives. This method does not wait on that request.
   *
   * @returns The results of all initialization calls.
   */
  async init(): Promise<PromiseSettledResult<unknown>[]> {
    this.#armGeolocationRpcFailover();
    return Promise.allSettled(
      Object.values(this.#instances)
        .filter(
          (instance): instance is Extract<typeof instance, { init: unknown }> =>
            // We do actually want to check the prototype here.
            // eslint-disable-next-line no-restricted-syntax
            'init' in instance && typeof instance.init === 'function',
        )
        .map(async (instance) => instance.init()),
    );
  }

  /**
   * Destroy the wallet instance.
   */
  async destroy(): Promise<void> {
    if (this.#isDestroyed) {
      return;
    }

    this.#isDestroyed = true;
    if (this.#geolocationFailoverSubscribed) {
      this.#messenger.unsubscribe(
        'GeolocationController:stateChange',
        this.#onGeolocationStateChange,
      );
      this.#geolocationFailoverSubscribed = false;
    }

    await Promise.allSettled(
      Object.values(this.#instances).map(async (instance) => {
        // @ts-expect-error Accessing protected property.
        if (typeof instance.destroy === 'function') {
          // @ts-expect-error Accessing protected property.
          return await instance.destroy();
        }
        /* istanbul ignore next */
        return;
      }),
    );
  }

  /**
   * Follow geolocation without delaying controller init.
   *
   * A persisted `CN` country forces failover before network clients are
   * created. The refresh itself is not awaited. When it completes, the state
   * subscription applies `CN` or clears a previous forced mode.
   */
  #armGeolocationRpcFailover(): void {
    if (this.#geolocationFailoverSubscribed) {
      return;
    }
    this.#messenger.subscribe(
      'GeolocationController:stateChange',
      this.#onGeolocationStateChange,
    );
    this.#geolocationFailoverSubscribed = true;

    const geolocation = this.#instances.GeolocationController;
    if (geolocation.state.country === 'CN') {
      this.#instances.NetworkController.setRpcFailoverMode('forced');
    }

    geolocation.refreshGeolocation().catch(() => {
      // A failed lookup leaves failover on the feature-flag mode.
    });
  }
}
