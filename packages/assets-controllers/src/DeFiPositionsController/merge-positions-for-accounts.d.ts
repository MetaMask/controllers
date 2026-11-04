import type { DeFiPositionsByAccount, DeFiProtocolPositionGroup } from './group-defi-positions-v6.js';
/**
 * Merges the protocol groups of every account in the selected group into a
 * single flat list, combining groups that share the same chain and protocol.
 *
 * The controller stores DeFi positions keyed per internal account, but every
 * client surface consumes the selected account group as a single merged list.
 * This helper is exported so both clients share one implementation rather than
 * each maintaining a copy.
 *
 * @param positionsByAccount - DeFi positions keyed by internal account ID.
 * @param accountIds - Internal account IDs in the selected account group.
 * @returns The merged protocol groups.
 */
export declare function mergePositionsForAccounts(positionsByAccount: DeFiPositionsByAccount, accountIds: string[]): DeFiProtocolPositionGroup[];
