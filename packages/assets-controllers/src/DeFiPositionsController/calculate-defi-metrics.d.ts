import type { GroupedDeFiPositionsPerChain, TrackingEventPayload } from './DeFiPositionsController.js';
/**
 * Calculates the total market value and total positions for a given account
 * and returns a breakdown of the market value per protocol.
 *
 * @param accountPositionsPerChain - The account positions per chain.
 * @returns An object containing the total market value, total positions, and a breakdown of the market value per protocol.
 */
export declare function calculateDeFiPositionMetrics(accountPositionsPerChain: GroupedDeFiPositionsPerChain): TrackingEventPayload;
