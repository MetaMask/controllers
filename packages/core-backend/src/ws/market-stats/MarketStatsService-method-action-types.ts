/**
 * This file is auto generated.
 * Do not edit manually.
 */

import type { MarketStatsService } from './MarketStatsService.js';

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
export type MarketStatsServiceSubscribeAction = {
  type: `MarketStatsService:subscribe`;
  handler: MarketStatsService['subscribe'];
};

/**
 * Unsubscribe from one asset's market-stats channel. Decrements the reference
 * count and, when it reaches zero, starts a grace-period timer before actually
 * unsubscribing from the WebSocket.
 *
 * @param options - Asset and currency to unsubscribe.
 * @returns A promise that resolves once the unsubscription is processed.
 */
export type MarketStatsServiceUnsubscribeAction = {
  type: `MarketStatsService:unsubscribe`;
  handler: MarketStatsService['unsubscribe'];
};

/**
 * Union of all MarketStatsService action types.
 */
export type MarketStatsServiceMethodActions =
  | MarketStatsServiceSubscribeAction
  | MarketStatsServiceUnsubscribeAction;
