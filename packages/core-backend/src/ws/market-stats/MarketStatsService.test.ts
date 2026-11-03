import { Messenger, MOCK_ANY_NAMESPACE } from '@metamask/messenger';
import type {
  MessengerActions,
  MessengerEvents,
  MockAnyNamespace,
} from '@metamask/messenger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { flushPromises } from '../../../../../tests/vitest/helpers.js';
import { WebSocketState } from '../BackendWebSocketService.js';
import type {
  BackendWebSocketService,
  ServerNotificationMessage,
} from '../BackendWebSocketService.js';
import { MarketStatsService } from './MarketStatsService.js';
import type { MarketStatsServiceMessenger } from './MarketStatsService.js';
import type { MarketStatsSubscriptionOptions } from './types.js';

type AllActions = MessengerActions<MarketStatsServiceMessenger>;
type AllEvents = MessengerEvents<MarketStatsServiceMessenger>;

type RootMessenger = Messenger<MockAnyNamespace, AllActions, AllEvents>;

const completeAsyncOperations = async (): Promise<void> => {
  for (let index = 0; index < 5; index++) {
    await flushPromises();
  }
};

const getMessenger = (): {
  rootMessenger: RootMessenger;
  messenger: MarketStatsServiceMessenger;
  mocks: {
    subscribe: Mock;
    forceReconnection: Mock;
    addChannelCallback: Mock;
    removeChannelCallback: Mock;
    channelHasSubscription: Mock;
    getSubscriptionsByChannel: Mock;
  };
} => {
  const rootMessenger: RootMessenger = new Messenger({
    namespace: MOCK_ANY_NAMESPACE,
  });
  const messenger: MarketStatsServiceMessenger = new Messenger({
    namespace: 'MarketStatsService',
    parent: rootMessenger,
  });

  rootMessenger.delegate({
    actions: [
      'BackendWebSocketService:connect',
      'BackendWebSocketService:forceReconnection',
      'BackendWebSocketService:subscribe',
      'BackendWebSocketService:channelHasSubscription',
      'BackendWebSocketService:getSubscriptionsByChannel',
      'BackendWebSocketService:addChannelCallback',
      'BackendWebSocketService:removeChannelCallback',
    ],
    events: ['BackendWebSocketService:connectionStateChanged'],
    messenger,
  });

  const subscribedChannels = new Set<string>();
  const mockSubscribe = vi.fn(
    async (
      options: Parameters<BackendWebSocketService['subscribe']>[0],
    ): ReturnType<BackendWebSocketService['subscribe']> => {
      for (const channel of options.channels) {
        subscribedChannels.add(channel);
      }
      return {
        subscriptionId: 'market-stats-sub',
        channels: [...options.channels],
        channelType: options.channelType,
        unsubscribe: async () => undefined,
      };
    },
  );
  const mockAddChannelCallback = vi.fn();
  const mockRemoveChannelCallback = vi.fn();
  const mockForceReconnection = vi.fn().mockResolvedValue(undefined);
  const mockChannelHasSubscription = vi.fn((channel: string) =>
    subscribedChannels.has(channel),
  );
  const mockGetSubscriptionsByChannel = vi.fn().mockReturnValue([]);

  rootMessenger.registerActionHandler(
    'BackendWebSocketService:connect',
    vi.fn().mockResolvedValue(undefined),
  );
  rootMessenger.registerActionHandler(
    'BackendWebSocketService:forceReconnection',
    mockForceReconnection,
  );
  rootMessenger.registerActionHandler(
    'BackendWebSocketService:subscribe',
    mockSubscribe,
  );
  rootMessenger.registerActionHandler(
    'BackendWebSocketService:channelHasSubscription',
    mockChannelHasSubscription,
  );
  rootMessenger.registerActionHandler(
    'BackendWebSocketService:getSubscriptionsByChannel',
    mockGetSubscriptionsByChannel,
  );
  rootMessenger.registerActionHandler(
    'BackendWebSocketService:addChannelCallback',
    mockAddChannelCallback,
  );
  rootMessenger.registerActionHandler(
    'BackendWebSocketService:removeChannelCallback',
    mockRemoveChannelCallback,
  );

  return {
    rootMessenger,
    messenger,
    mocks: {
      subscribe: mockSubscribe,
      forceReconnection: mockForceReconnection,
      addChannelCallback: mockAddChannelCallback,
      removeChannelCallback: mockRemoveChannelCallback,
      channelHasSubscription: mockChannelHasSubscription,
      getSubscriptionsByChannel: mockGetSubscriptionsByChannel,
    },
  };
};

const SUB_OPTS: MarketStatsSubscriptionOptions = {
  assetId: 'eip155:1/slip44:60',
  currency: 'eur',
};

const EXPECTED_CHANNEL = 'market-stats.v1.eip155:1/slip44:60.eur';

const CONNECTION_INFO = {
  url: 'ws://test',
  reconnectAttempts: 0,
  timeout: 1000,
  reconnectDelay: 500,
  maxReconnectDelay: 5000,
  requestTimeout: 30000,
};

const publishConnection = (
  rootMessenger: RootMessenger,
  state: WebSocketState,
): void => {
  rootMessenger.publish('BackendWebSocketService:connectionStateChanged', {
    ...CONNECTION_INFO,
    state,
  });
};

const callbackFor = (
  mocks: { addChannelCallback: Mock },
  channelName: string,
): ((notification: ServerNotificationMessage) => void) => {
  const call = mocks.addChannelCallback.mock.calls.find(
    (args: unknown[]) =>
      typeof args[0] === 'object' &&
      args[0] !== null &&
      'channelName' in args[0] &&
      (args[0] as { channelName: string }).channelName === channelName,
  );
  if (!call) {
    throw new Error(`callback not registered for ${channelName}`);
  }
  return (
    call[0] as {
      callback: (notification: ServerNotificationMessage) => void;
    }
  ).callback;
};

describe('MarketStatsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribes to the per-asset currency channel', async () => {
    const { messenger, mocks } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();

    await service.subscribe(SUB_OPTS);

    expect(mocks.subscribe).toHaveBeenCalledWith({
      channels: [EXPECTED_CHANNEL],
      channelType: 'market-stats.v1',
      callback: expect.any(Function),
    });

    service.destroy();
  });

  it('subscribes many assets in one websocket frame', async () => {
    const { messenger, mocks } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();

    await service.subscribe([
      SUB_OPTS,
      { assetId: 'eip155:137/slip44:966', currency: 'eur' },
    ]);

    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).toHaveBeenCalledWith({
      channels: [EXPECTED_CHANNEL, 'market-stats.v1.eip155:137/slip44:966.eur'],
      channelType: 'market-stats.v1',
      callback: expect.any(Function),
    });

    service.destroy();
  });

  it('subscribes tracked channels when the socket connects', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    mocks.subscribe.mockRejectedValueOnce(
      new Error(
        `Cannot create subscription(s) ${EXPECTED_CHANNEL}: WebSocket is DISCONNECTED`,
      ),
    );
    const service = new MarketStatsService({ messenger });
    service.init();

    await service.subscribe(SUB_OPTS);
    mocks.subscribe.mockClear();

    publishConnection(rootMessenger, WebSocketState.CONNECTED);
    await completeAsyncOperations();

    expect(mocks.subscribe).toHaveBeenCalledWith({
      channels: [EXPECTED_CHANNEL],
      channelType: 'market-stats.v1',
      callback: expect.any(Function),
    });

    service.destroy();
  });

  it('subscribes when the first attempt failed before sign-in', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    mocks.subscribe.mockRejectedValueOnce(
      new Error('Authentication required: user not signed in'),
    );
    const service = new MarketStatsService({ messenger });
    service.init();

    await service.subscribe(SUB_OPTS);
    mocks.subscribe.mockClear();

    publishConnection(rootMessenger, WebSocketState.CONNECTED);
    await completeAsyncOperations();

    expect(mocks.subscribe).toHaveBeenCalledWith({
      channels: [EXPECTED_CHANNEL],
      channelType: 'market-stats.v1',
      callback: expect.any(Function),
    });

    service.destroy();
  });

  it('leaves a channel alone when the server already has it', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();

    await service.subscribe(SUB_OPTS);
    mocks.subscribe.mockClear();

    publishConnection(rootMessenger, WebSocketState.CONNECTED);
    await completeAsyncOperations();

    expect(mocks.subscribe).not.toHaveBeenCalled();

    service.destroy();
  });

  it('rejects when the socket subscribe fails', async () => {
    const { messenger, mocks } = getMessenger();
    mocks.subscribe.mockRejectedValueOnce(new Error('socket down'));
    const service = new MarketStatsService({ messenger });
    service.init();

    await expect(service.subscribe(SUB_OPTS)).rejects.toThrow('socket down');
    expect(mocks.forceReconnection).not.toHaveBeenCalled();

    service.destroy();
  });

  it('does not resubscribe a channel the server rejected', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    mocks.subscribe.mockRejectedValueOnce(
      new Error(`Request failed: ${EXPECTED_CHANNEL}`),
    );
    const service = new MarketStatsService({ messenger });
    service.init();

    await expect(service.subscribe(SUB_OPTS)).rejects.toThrow('Request failed');
    mocks.subscribe.mockClear();

    publishConnection(rootMessenger, WebSocketState.CONNECTED);
    await completeAsyncOperations();

    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.forceReconnection).not.toHaveBeenCalled();

    service.destroy();
  });

  it('drops a deferred channel when the server rejects it on connect', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    const errors: unknown[] = [];
    rootMessenger.subscribe(
      'MarketStatsService:subscriptionError',
      (payload) => {
        errors.push(payload);
      },
    );
    mocks.subscribe.mockRejectedValueOnce(
      new Error(
        `Cannot create subscription(s) ${EXPECTED_CHANNEL}: WebSocket is DISCONNECTED`,
      ),
    );
    const service = new MarketStatsService({ messenger });
    service.init();

    await service.subscribe(SUB_OPTS);
    mocks.subscribe.mockRejectedValueOnce(
      new Error(`Request failed: ${EXPECTED_CHANNEL}`),
    );

    publishConnection(rootMessenger, WebSocketState.CONNECTED);
    await completeAsyncOperations();
    mocks.subscribe.mockClear();
    publishConnection(rootMessenger, WebSocketState.CONNECTED);
    await completeAsyncOperations();

    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.forceReconnection).not.toHaveBeenCalled();
    expect(errors).toStrictEqual([
      {
        channel: EXPECTED_CHANNEL,
        error: `Error: Request failed: ${EXPECTED_CHANNEL}`,
        operation: 'subscribe',
      },
    ]);

    service.destroy();
  });

  it('publishes a price batch delivered on the top-level channel', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();

    const prices: unknown[] = [];
    rootMessenger.subscribe('MarketStatsService:pricesUpdated', (payload) => {
      prices.push(payload);
    });

    callbackFor(
      mocks,
      'market-stats.v1',
    )({
      event: 'data',
      channel: 'market-stats.v1',
      timestamp: 1_782_135_139_175,
      // The gateway sends an array. The shared message type types `data` as a record.
      data: [
        {
          assetId: 'eip155:1/slip44:60',
          currency: 'eur',
          price: 1540.38,
          pricePercentChange1d: 2.61,
        },
        { assetId: '', currency: 'eur', price: 1 },
      ] as unknown as ServerNotificationMessage['data'],
    });

    expect(prices).toStrictEqual([
      {
        updates: [
          {
            assetId: 'eip155:1/slip44:60',
            currency: 'eur',
            price: 1540.38,
            pricePercentChange1d: 2.61,
          },
        ],
        timestamp: 1_782_135_139_175,
      },
    ]);

    service.destroy();
  });

  it('publishes chain status and marks tracked chains down on disconnect', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();

    const statuses: unknown[] = [];
    rootMessenger.subscribe(
      'MarketStatsService:chainStatusChanged',
      (payload) => {
        statuses.push(payload);
      },
    );

    callbackFor(
      mocks,
      'system-notifications.v1.market-stats.v1',
    )({
      event: 'system-notification',
      channel: 'system-notifications.v1.market-stats.v1',
      timestamp: 10,
      data: { chainIds: ['eip155:1'], status: 'up' },
    });

    publishConnection(rootMessenger, WebSocketState.DISCONNECTED);
    await completeAsyncOperations();

    expect(statuses).toStrictEqual([
      { chainIds: ['eip155:1'], status: 'up', timestamp: 10 },
      { chainIds: ['eip155:1'], status: 'down', timestamp: expect.any(Number) },
    ]);

    service.destroy();
  });

  it('retries callback registration when the socket service is not ready', () => {
    const { messenger, mocks } = getMessenger();
    mocks.addChannelCallback.mockImplementationOnce(() => {
      throw new Error(
        'A handler for BackendWebSocketService:addChannelCallback has not been registered',
      );
    });
    const service = new MarketStatsService({ messenger });

    expect(() => service.init()).not.toThrow();
    expect(mocks.addChannelCallback).toHaveBeenCalledTimes(1);

    service.init();

    expect(mocks.addChannelCallback).toHaveBeenCalledTimes(3);

    service.destroy();
  });

  it('removes the batch callback on destroy', () => {
    const { messenger, mocks } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();
    service.destroy();

    expect(mocks.removeChannelCallback).toHaveBeenCalledWith('market-stats.v1');
  });

  it('ignores a second init', () => {
    const { messenger, mocks } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();
    const calls = mocks.addChannelCallback.mock.calls.length;

    service.init();

    expect(mocks.addChannelCallback).toHaveBeenCalledTimes(calls);

    service.destroy();
  });

  it('rethrows a callback error that is not a missing handler', () => {
    const { messenger, mocks } = getMessenger();
    mocks.addChannelCallback.mockImplementationOnce(() => {
      throw new Error('callback registry down');
    });
    const service = new MarketStatsService({ messenger });

    expect(() => service.init()).toThrow('callback registry down');

    service.destroy();
  });

  it('subscribes each asset once and ignores an empty list', async () => {
    const { messenger, mocks } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();

    await service.subscribe([]);
    await service.subscribe([SUB_OPTS, { ...SUB_OPTS }]);

    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).toHaveBeenCalledWith({
      channels: [EXPECTED_CHANNEL],
      channelType: 'market-stats.v1',
      callback: expect.any(Function),
    });

    service.destroy();
  });

  it('keeps a channel until every subscriber has left', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();

    await service.unsubscribe({
      assetId: 'eip155:1/erc20:0x0',
      currency: 'usd',
    });
    await service.subscribe(SUB_OPTS);
    await service.subscribe(SUB_OPTS);
    await service.unsubscribe(SUB_OPTS);

    mocks.channelHasSubscription.mockReturnValue(false);
    mocks.subscribe.mockClear();
    publishConnection(rootMessenger, WebSocketState.CONNECTED);
    await completeAsyncOperations();

    expect(mocks.subscribe).toHaveBeenCalledWith({
      channels: [EXPECTED_CHANNEL],
      channelType: 'market-stats.v1',
      callback: expect.any(Function),
    });

    service.destroy();
  });

  it('publishes a price delivered on the per-asset callback and drops empty batches', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();
    await service.subscribe(SUB_OPTS);

    const prices: unknown[] = [];
    rootMessenger.subscribe('MarketStatsService:pricesUpdated', (payload) => {
      prices.push(payload);
    });

    const notify = (data: ServerNotificationMessage['data']): void => {
      (
        mocks.subscribe.mock.calls[0][0] as {
          callback: (notification: ServerNotificationMessage) => void;
        }
      ).callback({
        event: 'data',
        channel: EXPECTED_CHANNEL,
        timestamp: 5,
        data,
      });
    };

    notify({ not: 'a batch' });
    notify([null] as unknown as ServerNotificationMessage['data']);
    notify([
      {
        assetId: 'eip155:1/slip44:60',
        currency: 'eur',
        price: 1,
        pricePercentChange1d: Number.POSITIVE_INFINITY,
      },
    ] as unknown as ServerNotificationMessage['data']);

    expect(prices).toStrictEqual([
      {
        updates: [
          {
            assetId: 'eip155:1/slip44:60',
            currency: 'eur',
            price: 1,
            pricePercentChange1d: null,
          },
        ],
        timestamp: 5,
      },
    ]);

    service.destroy();
  });

  it('rejects a chain-status message that has no chains and clears a down chain', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    const service = new MarketStatsService({ messenger });
    service.init();

    const statuses: unknown[] = [];
    rootMessenger.subscribe(
      'MarketStatsService:chainStatusChanged',
      (payload) => {
        statuses.push(payload);
      },
    );

    const notify = callbackFor(
      mocks,
      'system-notifications.v1.market-stats.v1',
    );

    expect(() =>
      notify({
        event: 'system-notification',
        channel: 'system-notifications.v1.market-stats.v1',
        timestamp: 1,
        data: { status: 'up' },
      }),
    ).toThrow('Invalid system notification data');

    notify({
      event: 'system-notification',
      channel: 'system-notifications.v1.market-stats.v1',
      timestamp: 2,
      data: { chainIds: ['eip155:1'], status: 'down' },
    });
    publishConnection(rootMessenger, WebSocketState.CONNECTING);
    publishConnection(rootMessenger, WebSocketState.DISCONNECTED);
    await completeAsyncOperations();

    expect(statuses).toStrictEqual([
      { chainIds: ['eip155:1'], status: 'down', timestamp: 2 },
    ]);

    service.destroy();
  });

  it('logs a subscribe failure when the socket connects and channel lookup throws', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    mocks.subscribe.mockRejectedValueOnce(
      new Error(
        `Cannot create subscription(s) ${EXPECTED_CHANNEL}: WebSocket is DISCONNECTED`,
      ),
    );
    const service = new MarketStatsService({ messenger });
    service.init();
    await service.subscribe(SUB_OPTS);
    mocks.subscribe.mockClear();
    mocks.channelHasSubscription.mockImplementation(() => {
      throw new Error('lookup failed');
    });

    publishConnection(rootMessenger, WebSocketState.CONNECTED);
    await completeAsyncOperations();

    expect(mocks.subscribe).not.toHaveBeenCalled();

    service.destroy();
  });

  it('publishes an unsubscribe failure without recording it as a subscribe error', async () => {
    const { messenger, mocks, rootMessenger } = getMessenger();
    const errors: unknown[] = [];
    rootMessenger.subscribe(
      'MarketStatsService:subscriptionError',
      (payload) => {
        errors.push(payload);
      },
    );
    const service = new MarketStatsService({ messenger });
    service.init();
    await service.subscribe(SUB_OPTS);
    mocks.getSubscriptionsByChannel.mockImplementation(() => {
      throw new Error('unsubscribe failed');
    });

    await service.unsubscribe(SUB_OPTS);
    vi.advanceTimersByTime(3000);
    await completeAsyncOperations();

    expect(errors).toStrictEqual([
      {
        channel: EXPECTED_CHANNEL,
        error: 'Error: unsubscribe failed',
        operation: 'unsubscribe',
      },
    ]);
    expect(mocks.forceReconnection).not.toHaveBeenCalled();

    service.destroy();
  });
});
