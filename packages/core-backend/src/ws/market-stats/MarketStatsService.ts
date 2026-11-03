/**
 * Market-stats service for real-time spot prices via WebSocket.
 *
 * Subscribes per asset and currency (`market-stats.v1.<assetId>.<currency>`).
 * A list of assets is one WebSocket subscribe frame. The gateway batches
 * price changes onto the top-level `market-stats.v1` channel, about every
 * 30 seconds, and reports chain health on
 * `system-notifications.v1.market-stats.v1`.
 *
 * Subscription lifecycle (reference counting, grace-period unsubscribe) is
 * delegated to {@link ChannelSubscriptionManager}. When the socket connects,
 * this service sends the channels it was asked to watch.
 */

import type {
  TraceCallback,
  TraceContext,
  TraceRequest,
} from '@metamask/controller-utils';
import type { Messenger } from '@metamask/messenger';

import { projectLogger, createModuleLogger } from '../../logger.js';
import type { BackendWebSocketServiceMethodActions } from '../BackendWebSocketService-method-action-types.js';
import type {
  WebSocketConnectionInfo,
  BackendWebSocketServiceConnectionStateChangedEvent,
  ServerNotificationMessage,
} from '../BackendWebSocketService.js';
import { WebSocketState } from '../BackendWebSocketService.js';
import {
  ChannelSubscriptionManager,
  CHANNEL_SUBSCRIPTION_MANAGER_ALLOWED_ACTIONS,
  CHANNEL_SUBSCRIPTION_MANAGER_ALLOWED_EVENTS,
} from '../ChannelSubscriptionManager.js';
import type { MarketStatsServiceMethodActions } from './MarketStatsService-method-action-types.js';
import { buildMarketStatsChannel, parseMarketStatsBatch } from './normalize.js';
import type {
  MarketStatsPriceUpdate,
  MarketStatsSubscriptionOptions,
} from './types.js';
import {
  MARKET_STATS_BATCH_CHANNEL,
  MARKET_STATS_NAMESPACE,
  MARKET_STATS_SYSTEM_NOTIFICATIONS_CHANNEL,
} from './types.js';

const SERVICE_NAME = 'MarketStatsService';

const log = createModuleLogger(projectLogger, SERVICE_NAME);

const MESSENGER_EXPOSED_METHODS = ['subscribe', 'unsubscribe'] as const;

/**
 * One or more market-stats subscribes failed after the socket accepted the
 * rest. `failedAssets` are the ones that were not opened.
 */
export class MarketStatsSubscribeError extends Error {
  readonly failedAssets: readonly MarketStatsSubscriptionOptions[];

  constructor(
    failedAssets: readonly {
      assetId: string;
      currency: string;
      message: string;
    }[],
  ) {
    super(failedAssets.map((asset) => asset.message).join('; '));
    this.name = 'MarketStatsSubscribeError';
    this.failedAssets = failedAssets.map(({ assetId, currency }) => ({
      assetId,
      currency,
    }));
  }
}

/**
 * System notification data for chain status on market-stats channels.
 */
export type MarketStatsSystemNotificationData = {
  chainIds: string[];
  status: 'down' | 'up';
  timestamp?: number;
};

/**
 * Configuration options for the market-stats service.
 */
export type MarketStatsServiceOptions = {
  /** Optional callback to trace market-stats operations (default: no-op). */
  traceFn?: TraceCallback;
};

export type MarketStatsServiceActions = MarketStatsServiceMethodActions;

export const MARKET_STATS_SERVICE_ALLOWED_ACTIONS = [
  ...CHANNEL_SUBSCRIPTION_MANAGER_ALLOWED_ACTIONS,
] as const;

export const MARKET_STATS_SERVICE_ALLOWED_EVENTS = [
  ...CHANNEL_SUBSCRIPTION_MANAGER_ALLOWED_EVENTS,
] as const;

export type AllowedActions = BackendWebSocketServiceMethodActions;

export type MarketStatsServicePricesUpdatedEvent = {
  type: `MarketStatsService:pricesUpdated`;
  payload: [{ updates: MarketStatsPriceUpdate[]; timestamp?: number }];
};

export type MarketStatsServiceChainStatusChangedEvent = {
  type: `MarketStatsService:chainStatusChanged`;
  payload: [{ chainIds: string[]; status: 'up' | 'down'; timestamp?: number }];
};

export type MarketStatsServiceSubscriptionErrorEvent = {
  type: `MarketStatsService:subscriptionError`;
  payload: [{ channel: string; error: string; operation: string }];
};

export type MarketStatsServiceEvents =
  | MarketStatsServicePricesUpdatedEvent
  | MarketStatsServiceChainStatusChangedEvent
  | MarketStatsServiceSubscriptionErrorEvent;

export type AllowedEvents = BackendWebSocketServiceConnectionStateChangedEvent;

export type MarketStatsServiceMessenger = Messenger<
  typeof SERVICE_NAME,
  MarketStatsServiceActions | AllowedActions,
  MarketStatsServiceEvents | AllowedEvents
>;

/**
 * Real-time spot prices over the shared backend WebSocket.
 *
 * Call {@link MarketStatsService.init} after construction so batch and
 * chain-status callbacks are registered. A session may subscribe to at most
 * 200 market-stats channels; callers decide which assets keep that slot.
 */
export class MarketStatsService {
  readonly name = SERVICE_NAME;

  readonly #messenger: MarketStatsServiceMessenger;

  readonly #trace: TraceCallback;

  readonly #manager: ChannelSubscriptionManager;

  readonly #chainsUp = new Set<string>();

  /**
   * Channels callers asked for, with a reference count. Kept when the socket
   * subscribe has to wait for the bearer token, so CONNECTED can send them.
   */
  readonly #channels = new Map<string, number>();

  /** Subscribe failures reported by the manager for the in-flight subscribe. */
  readonly #subscribeErrors = new Map<string, string>();

  /** True after batch and chain-status callbacks are registered. */
  #callbacksReady = false;

  constructor(
    options: MarketStatsServiceOptions & {
      messenger: MarketStatsServiceMessenger;
    },
  ) {
    this.#messenger = options.messenger;

    this.#trace =
      options.traceFn ??
      ((<Result>(
        _request: TraceRequest,
        fn?: (context?: TraceContext) => Result,
      ) => fn?.()) as TraceCallback);

    this.#manager = new ChannelSubscriptionManager({
      messenger: this.#messenger,
      channelType: MARKET_STATS_NAMESPACE,
      logPrefix: 'MarketStats-WS',
      onMessage: (_channel, notification): void =>
        this.#publishBatch(notification),
      onSubscriptionError: (channel, error, operation): void => {
        if (operation === 'subscribe') {
          this.#subscribeErrors.set(channel, error);
        }
        this.#messenger.publish('MarketStatsService:subscriptionError', {
          channel,
          error,
          operation,
        });
      },
      systemNotificationsChannel: MARKET_STATS_SYSTEM_NOTIFICATIONS_CHANNEL,
      onSystemNotification: (notification): void =>
        this.#handleSystemNotification(notification),
      onConnectionStateChange: (connectionInfo): void =>
        this.#handleConnectionStateChange(connectionInfo),
      // This service subscribes from the CONNECTED handler below.
      resubscribeOnConnect: false,
      // A rejected market-stats channel falls back to the price poll.
      // Reconnecting would drop every other consumer of this socket.
      forceReconnectOnUnsubscribeFailure: false,
    });

    this.#messenger.registerMethodActionHandlers(
      this,
      MESSENGER_EXPOSED_METHODS,
    );
  }

  /**
   * Register the batch channel and the system-notifications callback.
   *
   * Safe to call more than once. A call made before
   * `BackendWebSocketService` has registered its actions returns without
   * throwing; call `init` again once that service exists.
   */
  init(): void {
    if (this.#callbacksReady) {
      return;
    }

    try {
      this.#manager.init();
      this.#messenger.call('BackendWebSocketService:addChannelCallback', {
        channelName: MARKET_STATS_BATCH_CHANNEL,
        callback: (notification: ServerNotificationMessage) =>
          this.#publishBatch(notification),
      });
    } catch (error) {
      if (isMissingActionHandler(error)) {
        return;
      }
      throw error;
    }

    this.#callbacksReady = true;
  }

  /**
   * Subscribe to one asset, or to many assets in one WebSocket frame.
   *
   * Each asset uses `market-stats.v1.<assetId>.<currency>`. The first
   * subscriber opens the channel. Further calls for the same channel only
   * bump the reference count. A list is sent as one `subscribe` frame.
   *
   * Price changes arrive later as a batch on `MarketStatsService:pricesUpdated`,
   * not on this channel.
   *
   * @param options - One asset, or the assets to subscribe together.
   * @returns A promise that resolves once the subscription is recorded.
   * When the socket is still waiting on the bearer token, the subscribe frame
   * is sent from the CONNECTED handler. Rejects when a channel fails for
   * another reason. A list rejects with {@link MarketStatsSubscribeError}
   * listing only the assets that were not opened.
   */
  async subscribe(
    options:
      | MarketStatsSubscriptionOptions
      | readonly MarketStatsSubscriptionOptions[],
  ): Promise<void> {
    const requested: readonly MarketStatsSubscriptionOptions[] = Array.isArray(
      options,
    )
      ? options
      : [options];
    const seen = new Set<string>();
    const subscriptions: {
      assetId: string;
      currency: string;
      channel: string;
    }[] = [];
    for (const subscription of requested) {
      const channel = buildMarketStatsChannel(subscription);
      if (seen.has(channel)) {
        continue;
      }
      seen.add(channel);
      subscriptions.push({ ...subscription, channel });
    }
    if (subscriptions.length === 0) {
      return;
    }

    for (const subscription of subscriptions) {
      this.#channels.set(
        subscription.channel,
        (this.#channels.get(subscription.channel) ?? 0) + 1,
      );
      this.#subscribeErrors.delete(subscription.channel);
    }

    await this.#manager.subscribe(
      subscriptions.map((subscription) => subscription.channel),
    );

    const failed: {
      assetId: string;
      currency: string;
      message: string;
    }[] = [];
    for (const subscription of subscriptions) {
      const message = this.#subscribeErrors.get(subscription.channel);
      if (!message) {
        continue;
      }
      this.#subscribeErrors.delete(subscription.channel);
      this.#releaseChannel(subscription.channel);
      failed.push({
        assetId: subscription.assetId,
        currency: subscription.currency,
        message,
      });
    }
    if (failed.length > 0) {
      throw new MarketStatsSubscribeError(failed);
    }
  }

  /**
   * Unsubscribe from one asset's market-stats channel. Decrements the reference
   * count and, when it reaches zero, starts a grace-period timer before actually
   * unsubscribing from the WebSocket.
   *
   * @param options - Asset and currency to unsubscribe.
   * @returns A promise that resolves once the unsubscription is processed.
   */
  async unsubscribe(options: MarketStatsSubscriptionOptions): Promise<void> {
    const channel = buildMarketStatsChannel(options);
    this.#releaseChannel(channel);
    await this.#manager.unsubscribe(channel);
  }

  #releaseChannel(channel: string): void {
    const next = (this.#channels.get(channel) ?? 1) - 1;
    if (next > 0) {
      this.#channels.set(channel, next);
      return;
    }
    this.#channels.delete(channel);
  }

  #publishBatch(notification: ServerNotificationMessage): void {
    const updates = parseMarketStatsBatch(notification.data);
    if (updates.length === 0) {
      return;
    }

    const { timestamp } = notification;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.#trace(
      {
        name: `${SERVICE_NAME} Price Batch`,
        data: { count: updates.length, timestamp },
        tags: { service: SERVICE_NAME },
      },
      () => {
        this.#messenger.publish('MarketStatsService:pricesUpdated', {
          updates,
          timestamp,
        });
      },
    );
  }

  #handleSystemNotification(notification: ServerNotificationMessage): void {
    const data = notification.data as MarketStatsSystemNotificationData;
    const { timestamp } = notification;

    if (!data.chainIds || !Array.isArray(data.chainIds) || !data.status) {
      throw new Error(
        'Invalid system notification data: missing chainIds or status',
      );
    }

    if (data.status === 'up') {
      for (const chainId of data.chainIds) {
        this.#chainsUp.add(chainId);
      }
    } else {
      for (const chainId of data.chainIds) {
        this.#chainsUp.delete(chainId);
      }
    }

    this.#messenger.publish('MarketStatsService:chainStatusChanged', {
      chainIds: data.chainIds,
      status: data.status,
      timestamp,
    });

    log(`MarketStats-WS: Chain status change: ${data.status}`, {
      chains: data.chainIds,
      status: data.status,
    });
  }

  #handleConnectionStateChange(connectionInfo: WebSocketConnectionInfo): void {
    if (connectionInfo.state === WebSocketState.CONNECTED) {
      this.#subscribeTrackedChannels().catch((error: unknown) => {
        log('MarketStats-WS: subscribe on connect failed', { error });
      });
      return;
    }

    if (connectionInfo.state !== WebSocketState.DISCONNECTED) {
      return;
    }

    const chainsToMarkDown = Array.from(this.#chainsUp);
    if (chainsToMarkDown.length === 0) {
      return;
    }

    this.#messenger.publish('MarketStatsService:chainStatusChanged', {
      chainIds: chainsToMarkDown,
      status: 'down',
      timestamp: Date.now(),
    });

    log(
      'MarketStats-WS: WebSocket disconnection — marked tracked chains as down',
      {
        count: chainsToMarkDown.length,
        chains: chainsToMarkDown,
      },
    );

    this.#chainsUp.clear();
  }

  /**
   * Send every channel callers asked for. Channels already on the server are
   * left alone. Reference counts stay as they were.
   */
  async #subscribeTrackedChannels(): Promise<void> {
    const channels = [...this.#channels.keys()];
    if (channels.length === 0) {
      return;
    }

    log('MarketStats-WS: socket connected — subscribing tracked channels', {
      count: channels.length,
      channels,
    });

    await this.#manager.ensureSubscribedChannels(channels);

    for (const channel of channels) {
      const error = this.#subscribeErrors.get(channel);
      if (!error) {
        continue;
      }
      // The server rejected this channel. Drop it so the next connect
      // does not send it again. The caller polls that asset instead.
      this.#subscribeErrors.delete(channel);
      this.#channels.delete(channel);
      log('MarketStats-WS: failed to subscribe channel on connect', {
        channel,
        error,
      });
    }
  }

  /**
   * Tear down channel timers and remove the batch and system-notification callbacks.
   */
  destroy(): void {
    this.#chainsUp.clear();
    this.#channels.clear();
    this.#subscribeErrors.clear();
    this.#messenger.call(
      'BackendWebSocketService:removeChannelCallback',
      MARKET_STATS_BATCH_CHANNEL,
    );
    this.#manager.destroy();
  }
}

/**
 * True when a messenger action has no handler yet.
 *
 * Wallet construction runs `init` before `BackendWebSocketService` exists.
 *
 * @param error - Failure from a messenger call.
 * @returns Whether the caller should retry `init` later.
 */
function isMissingActionHandler(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('has not been registered');
}
