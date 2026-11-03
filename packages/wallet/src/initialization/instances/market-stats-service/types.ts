import type { MarketStatsServiceOptions } from '@metamask/core-backend';

/**
 * Per-instance options for the wallet's `MarketStatsService`.
 *
 * `traceFn` is optional. The service uses a no-op when it is omitted.
 */
export type MarketStatsServiceInstanceOptions = MarketStatsServiceOptions;
