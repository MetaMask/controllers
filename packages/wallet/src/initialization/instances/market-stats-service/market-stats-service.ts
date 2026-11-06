import {
  MARKET_STATS_SERVICE_ALLOWED_ACTIONS,
  MARKET_STATS_SERVICE_ALLOWED_EVENTS,
  MarketStatsService,
} from '@metamask/core-backend';
import type { MarketStatsServiceMessenger } from '@metamask/core-backend';
import { Messenger } from '@metamask/messenger';

import type { InitializationConfiguration } from '../../types.js';

export type { MarketStatsServiceInstanceOptions } from './types.js';

/**
 * Real-time spot prices over the shared backend WebSocket.
 *
 * `Wallet` does not construct `BackendWebSocketService`. The host registers
 * that service's actions on the root messenger. `MarketStatsService.init()`
 * registers price callbacks and returns without throwing when those actions
 * are not registered yet.
 */
export const marketStatsService: InitializationConfiguration<
  MarketStatsService,
  MarketStatsServiceMessenger
> = {
  name: 'MarketStatsService',
  init: ({ messenger, options }) =>
    new MarketStatsService({
      messenger,
      traceFn: options.traceFn,
    }),
  getMessenger: (parent) => {
    const messenger: MarketStatsServiceMessenger = new Messenger({
      namespace: 'MarketStatsService',
      parent,
    });

    parent.delegate({
      messenger,
      actions: [...MARKET_STATS_SERVICE_ALLOWED_ACTIONS],
      events: [...MARKET_STATS_SERVICE_ALLOWED_EVENTS],
    });

    return messenger;
  },
};
