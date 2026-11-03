import { Messenger, MOCK_ANY_NAMESPACE } from '@metamask/messenger';
import type {
  MessengerActions,
  MessengerEvents,
  MockAnyNamespace,
} from '@metamask/messenger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { flushPromises } from '../../../../../tests/vitest/helpers.js';
import type { ServerNotificationMessage } from '../BackendWebSocketService.js';
import { WebSocketState } from '../BackendWebSocketService.js';
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
  const mockSubscribe = vi.fn(async (options: { channels: string[] }) => {
    for (const channel of options.channels) {
      subscribedChannels.add(channel);
    }
  });
  const mockAddChannelCallback = vi.fn();
  const mockRemoveChannelCallback = vi.fn();
  const mockForceReconnection = vi.fn().mockResolvedValue(undefined);

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
    (channel: string) => subscribedChannels.has(channel),
  );
  rootMessenger.registerActionHandler(
    'BackendWebSocketService:getSubscriptionsByChannel',
    vi.fn().mockReturnValue([]),
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
});
