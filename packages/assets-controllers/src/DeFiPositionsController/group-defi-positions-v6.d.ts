import type { V6BalancesResponse, V6DeFiPositionType } from '@metamask/core-backend';
import type { CaipAssetType, CaipChainId } from '@metamask/utils';
/**
 * Possible `positionType` values from Accounts API v6 DeFi metadata.
 * Re-export of {@link V6_DEFI_POSITION_TYPES} from `@metamask/core-backend`.
 */
export declare const DEFI_POSITION_TYPES: readonly ["deposit", "loan", "locked", "staked", "reward", "wallet", "investment"];
/**
 * The specific module or functionality within a DeFi protocol where a position
 * is held. Alias of {@link V6DeFiPositionType} from `@metamask/core-backend`.
 */
export type DeFiPositionType = V6DeFiPositionType;
/**
 * Position types whose fiat value is a liability and is subtracted from the
 * protocol group's aggregated `marketValue`.
 */
export declare const DEFI_POSITION_LIABILITY_TYPES: ReadonlySet<DeFiPositionType>;
/**
 * An icon-group entry shown next to a protocol in the DeFi tab list.
 */
export type DeFiPositionIconGroupItem = {
    /** Token icon URL, when one can be built for the asset. */
    avatarValue?: string;
    symbol: string;
};
/**
 * A single underlying position row shown on the DeFi details page.
 */
export type DeFiUnderlyingPosition = {
    assetId: CaipAssetType;
    chainId: CaipChainId;
    symbol: string;
    name: string;
    decimals: number;
    /** Raw balance string as returned by the API. */
    balance: string;
    /** Fiat market value in the requested currency, when a price is available. */
    marketValue?: number;
    /** Position type from protocol metadata. */
    positionType: DeFiPositionType;
    /** Address of the pool this position belongs to. */
    poolAddress: string;
    /**
     * Upstream grouping id from the API. Rows that share a `productName` can
     * still carry distinct `groupId`s (e.g. multiple Pendle YT markets).
     */
    groupId: string;
    /** Token icon URL, when one can be built for the asset. */
    tokenImage?: string;
};
/**
 * A section of the details page, grouping positions that share the same
 * API `productName`. A single `protocolId` can have multiple products
 * (different pools/markets under one protocol), so a group may contain
 * several sections.
 */
export type DeFiPositionDetailsSection = {
    /** Section label from the API (`metadata.productName`). */
    productName: string;
    positions: DeFiUnderlyingPosition[];
};
/**
 * One row in the DeFi tab list (a protocol on a given chain), with the details
 * needed to render the details page embedded directly inside it.
 */
export type DeFiProtocolPositionGroup = {
    protocolId: string;
    /**
     * Product name from the first position seen for this protocol. Prefer
     * `protocolId` for the list-row title; use section `productName`s for
     * per-product detail headings.
     */
    productName: string;
    protocolIconUrl: string;
    chainId: CaipChainId;
    /**
     * Aggregated fiat market value across all positions in the group.
     * `lending` positions are subtracted; all other types are added.
     */
    marketValue: number;
    /** Icon-group entries for the list row. */
    iconGroup: DeFiPositionIconGroupItem[];
    /**
     * Detail sections consumed by the details page, one per distinct API
     * `productName` under this `protocolId`.
     */
    sections: DeFiPositionDetailsSection[];
};
/**
 * DeFi positions for every queried account, keyed by the internal MetaMask
 * account ID (`InternalAccount.id` UUID), the same key AssetsController uses.
 * Each account maps to a flat list of protocol groups; filter by each group's
 * `chainId` rather than digging through a nested chain map.
 */
export type DeFiPositionsByAccount = {
    [accountId: string]: DeFiProtocolPositionGroup[];
};
/**
 * Transforms a v6 multiaccount balances response into the stored DeFi state:
 * positions keyed by internal account ID, each mapping to a flat list of
 * protocol groups. Every group carries its own `chainId` (so the client can
 * filter without a nested chain map) plus both the DeFi-tab summary and the
 * details-page sections. When the request-account map is provided, every
 * requested account is included with an empty list so stale data is cleared
 * even when the flat response contains no rows for that account.
 *
 * When `internalAccountIdByCaip` is provided, response account IDs are matched
 * to internal MetaMask account IDs via namespace + address (ignoring chain
 * reference and EVM case). Unmatched accounts are skipped. When omitted, the
 * response account ID is used as-is (handy for unit tests).
 *
 * @param response - The v6 multiaccount balances response.
 * @param internalAccountIdByCaip - Optional map of request CAIP-10 account IDs
 * to internal MetaMask account IDs.
 * @returns DeFi positions keyed by internal account ID.
 */
export declare function groupDeFiPositionsV6(response: V6BalancesResponse, internalAccountIdByCaip?: Map<string, string>): DeFiPositionsByAccount;
