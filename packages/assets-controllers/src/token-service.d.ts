import type { CaipAssetType, CaipChainId, Hex } from '@metamask/utils';
export declare const TOKEN_END_POINT_API = "https://token.api.cx.metamask.io";
export declare const TOKEN_METADATA_NO_SUPPORT_ERROR = "TokenService Error: Network does not support fetchTokenMetadata";
/**
 * Clears the suggested occurrence floors cache. Exported for unit tests only.
 */
export declare function resetSuggestedOccurrenceFloorsCacheForTesting(): void;
/**
 * The sort by field for trending tokens.
 */
export type SortTrendingBy = 'm5_trending' | 'h1_trending' | 'h6_trending' | 'h24_trending';
/**
 * Shared query-parameter type for the v3 trending tokens endpoint.
 *
 * Known parameters are explicitly typed for autocomplete and documentation.
 * The index signature allows new API parameters to pass through without
 * requiring a core release — callers can add any additional key/value and
 * it will be forwarded as a query parameter.
 */
export type TrendingTokensQueryParams = {
    sort?: SortTrendingBy;
    minLiquidity?: number;
    minVolume24hUsd?: number;
    maxVolume24hUsd?: number;
    minMarketCap?: number;
    maxMarketCap?: number;
    excludeLabels?: string[];
    includeRwaData?: boolean;
    usePriceApiData?: boolean;
    includeTokenSecurityData?: boolean;
    [key: string]: string | number | boolean | string[] | undefined;
};
/**
 * Fetch the list of token metadata for a given network. This request is cancellable using the
 * abort signal passed in.
 *
 * @param chainId - The chain ID of the network the requested tokens are on.
 * @param abortSignal - The abort signal used to cancel the request if necessary.
 * @param options - Additional fetch options.
 * @param options.timeout - The fetch timeout.
 * @returns The token list, or `undefined` if the request was cancelled.
 */
export declare function fetchTokenListByChainId(chainId: Hex, abortSignal: AbortSignal, { timeout }?: {
    timeout?: number | undefined;
}): Promise<unknown>;
export type TokenRwaData = {
    market?: {
        nextOpen?: string;
        nextClose?: string;
    };
    nextPause?: {
        start?: string;
        end?: string;
    };
    offhours?: {
        nextOpen?: string;
        nextClose?: string;
    };
    ticker?: string;
    instrumentType?: string;
};
export type RwaMarket = {
    nextOpen?: string;
    nextClose?: string;
};
export type RwaTokenData = {
    price: string;
    priceChange: string;
    marketCap: number;
    aggregatedUsdVolume: number;
    active: boolean;
    ticker: string;
    instrumentType: string;
    custodians: string[];
    industry: string[];
    market?: RwaMarket;
    nextPause?: Record<string, unknown>;
    offhours?: {
        nextOpen?: string;
        nextClose?: string;
    };
    sharesOutstanding?: number;
    restrictedCountries?: string[];
    updatedAt?: string;
    addressType?: string;
};
export type RwaToken = {
    id: string;
    assetId: CaipAssetType;
    symbol: string;
    decimals: number;
    name: string;
    rwaData: RwaTokenData;
    securityData?: TokenSecurityData;
};
export type RwasResponse = {
    data: RwaToken[];
    count: number;
    totalCount: number;
    pageInfo: {
        nextCursor: string | null;
        hasNextPage: boolean;
    };
};
export type RwaSortBy = 'price_change_asc' | 'price_change_desc' | 'volume_asc' | 'volume_desc' | 'market_cap_asc' | 'market_cap_desc';
export type FetchRwasParams = {
    chainIds?: CaipChainId[];
    query?: string;
    sortBy?: RwaSortBy;
    limit?: number;
    after?: string;
    active?: boolean;
    custodian?: 'ondo';
    type?: 'stock' | 'etf';
    industry?: 'industrials' | 'technology' | 'healthcare' | 'consumer discretionary' | 'financials' | 'materials' | 'utilities' | 'energy' | 'real estate';
    includeTokenSecurityData?: boolean;
    [key: string]: string | number | boolean | string[] | undefined;
};
export type TokenSecurityFeature = {
    featureId: string;
    type: string;
    description: string;
};
export type TokenSecurityHolder = {
    label: string;
    name: string | null;
    address: string;
    holdingPercentage: number;
};
export type TokenSecurityMarket = {
    marketType: string;
    marketName: string;
    pairName: string;
    reserveUSD: number;
};
export type TokenSecurityFees = {
    transfer: number;
    transferFeeMaxAmount: number | null;
    buy: number;
    sell: number | null;
};
export type TokenSecurityFinancialStats = {
    supply: number;
    topHolders: TokenSecurityHolder[];
    holdersCount: number;
    tradeVolume24h: number | null;
    lockedLiquidityPct: number | null;
    markets: TokenSecurityMarket[];
};
export type TokenSecurityMetadata = {
    externalLinks: {
        homepage: string | null;
        twitterPage: string | null;
        telegramChannelId: string | null;
    };
};
export type TokenSecurityData = {
    resultType: string;
    maliciousScore: string;
    fees: TokenSecurityFees;
    features: TokenSecurityFeature[];
    financialStats: TokenSecurityFinancialStats;
    metadata: TokenSecurityMetadata;
    created: string;
};
export type TokenSearchItem = {
    assetId: CaipAssetType;
    name: string;
    symbol: string;
    decimals: number;
    /** Optional RWA data for tokens when includeRwaData is true */
    rwaData?: TokenRwaData;
    /** Optional security data for tokens when includeTokenSecurityData is true */
    securityData?: TokenSecurityData;
};
export type PageInfo = {
    hasNextPage: boolean;
    endCursor: string | null;
};
/**
 * Service profiles accepted by the token search API, sent as the
 * `x-mm-service-profile` header. Add new members here as new profiles are
 * registered.
 */
export type TokenSearchServiceProfile = 'assets--trending-search';
type SearchTokenOptions = {
    limit?: number;
    /** Cursor returned by a previous response's `pageInfo.endCursor` to fetch the next page. */
    after?: string;
    includeMarketData?: boolean;
    includeRwaData?: boolean;
    includeTokenSecurityData?: boolean;
    serviceProfile?: TokenSearchServiceProfile;
};
/**
 * Search for tokens across one or more networks by query string using CAIP format chain IDs.
 *
 * @param chainIds - Array of CAIP format chain IDs (e.g., ['eip155:1', 'eip155:137', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp']).
 * @param query - The search query (token name, symbol, or address).
 * @param options - Additional fetch options.
 * @param options.limit - The maximum number of results to return.
 * @param options.after - Cursor from a previous response's `pageInfo.endCursor` to fetch the next page.
 * @param options.includeMarketData - Optional flag to include market data in the results (defaults to false).
 * @param options.includeRwaData - Optional flag to include RWA data in the results (defaults to false).
 * @param options.includeTokenSecurityData - Optional flag to include token security data in the results (defaults to false).
 * @param options.serviceProfile - Service profile sent as the `x-mm-service-profile` header (defaults to `assets--trending-search`).
 * @returns Object containing count, totalCount, data array, optional pageInfo for pagination, and an optional error message if the request failed.
 */
export declare function searchTokens(chainIds: CaipChainId[], query: string, { limit, after, includeMarketData, includeRwaData, includeTokenSecurityData, serviceProfile, }?: SearchTokenOptions): Promise<{
    count: number;
    totalCount?: number;
    data: TokenSearchItem[];
    pageInfo?: PageInfo;
    error?: string;
}>;
/**
 * The trending asset type.
 */
export type TrendingAsset = {
    assetId: string;
    name: string;
    symbol: string;
    decimals: number;
    price: string;
    aggregatedUsdVolume: number;
    marketCap: number;
    priceChangePct?: {
        m5?: string;
        m15?: string;
        m30?: string;
        h1?: string;
        h6?: string;
        h24?: string;
    };
    labels?: string[];
    /** Optional RWA data for tokens when includeRwaData is true */
    rwaData?: TokenRwaData;
    /** Optional security data for tokens when includeTokenSecurityData is true */
    securityData?: TokenSecurityData;
};
/**
 * Get the trending tokens for the given chains.
 *
 * Accepts all known query parameters plus any additional ones via the
 * index signature on {@link TrendingTokensQueryParams}. New API parameters
 * can be passed without updating this function.
 *
 * @param options - Options bag: `chainIds` (required) plus any query params
 *   supported by the v3 trending endpoint.
 * @returns The trending tokens.
 * @throws Will throw if the request fails.
 */
export declare function getTrendingTokens(options: {
    chainIds: CaipChainId[];
} & TrendingTokensQueryParams): Promise<TrendingAsset[]>;
/**
 * The token asset type returned by the /assets endpoint.
 */
export type TokenAsset = {
    assetId: CaipAssetType;
    name: string;
    symbol: string;
    decimals: number;
    /** Aggregator list when includeAggregators is true */
    aggregators?: string[];
    /** CoinGecko ID when includeCoingeckoId is true */
    coingeckoId?: string;
    /** Labels when includeLabels is true */
    labels?: string[];
    /** Occurrence count when includeOccurrences is true */
    occurrences?: number;
    /** RWA data when includeRwaData is true */
    rwaData?: TokenRwaData;
    /** Security data when includeTokenSecurityData is true */
    securityData?: TokenSecurityData;
};
type FetchTokenAssetsOptions = {
    includeAggregators?: boolean;
    includeCoingeckoId?: boolean;
    includeLabels?: boolean;
    includeMarketData?: boolean;
    includeOccurrences?: boolean;
    includeTokenSecurityData?: boolean;
    includeRwaData?: boolean;
};
/**
 * Fetch asset metadata for the given CAIP-19 asset IDs.
 *
 * @param assetIds - Array of CAIP-19 asset IDs (e.g., ['eip155:1/erc20:0x...', 'solana:5eykt.../slip44:501']).
 * @param options - Additional fetch options.
 * @param options.includeAggregators - Optional flag to include aggregator list in the results (defaults to false).
 * @param options.includeCoingeckoId - Optional flag to include CoinGecko ID in the results (defaults to false).
 * @param options.includeLabels - Optional flag to include labels in the results (defaults to false).
 * @param options.includeMarketData - Optional flag to include market data in the results (defaults to false).
 * @param options.includeOccurrences - Optional flag to include occurrence count in the results (defaults to false).
 * @param options.includeTokenSecurityData - Optional flag to include token security data in the results (defaults to false).
 * @param options.includeRwaData - Optional flag to include RWA data in the results (defaults to false).
 * @returns Array of token assets, or empty array if the request failed or no IDs were provided.
 */
export declare function fetchTokenAssets(assetIds: CaipAssetType[], { includeAggregators, includeCoingeckoId, includeLabels, includeMarketData, includeOccurrences, includeTokenSecurityData, includeRwaData, }?: FetchTokenAssetsOptions): Promise<TokenAsset[]>;
/**
 * Fetch real-world asset tokens.
 *
 * @param params - Query params used to filter, sort, and paginate RWAs.
 * @returns The paginated RWA response.
 */
export declare function fetchRwas(params?: FetchRwasParams): Promise<RwasResponse>;
/**
 * Fetch metadata for the token address provided for a given network. This request is cancellable
 * using the abort signal passed in.
 *
 * @param chainId - The chain ID of the network the token is on.
 * @param tokenAddress - The address of the token to fetch metadata for.
 * @param abortSignal - The abort signal used to cancel the request if necessary.
 * @param options - Additional fetch options.
 * @param options.timeout - The fetch timeout.
 * @returns The token metadata, or `undefined` if the request was either aborted or failed.
 */
export declare function fetchTokenMetadata<TReturn>(chainId: Hex, tokenAddress: string, abortSignal: AbortSignal, { timeout }?: {
    timeout?: number | undefined;
}): Promise<TReturn | undefined>;
export {};
