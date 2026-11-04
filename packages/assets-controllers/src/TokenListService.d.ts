import type { Hex } from '@metamask/utils';
import type { TokenListMap, TokenListToken } from './TokenListController.js';
/**
 * Shared service for fetching and caching the token list per chain.
 *
 * Callers invoke `fetchTokensByChainId` directly. TanStack Query caches the
 * normalised `TokenListMap` for 4 hours so that multiple controllers share the
 * same in-memory cache without redundant network requests or per-token
 * formatting work on cache hits.
 */
export declare class TokenListService {
    #private;
    constructor();
    /**
     * Fetch the token list for a given chain, normalising the raw API response
     * into a `TokenListMap` keyed by lowercase address.
     *
     * Results are cached in-memory for 4 hours. A second call within the cache
     * window returns the cached value without a network request.
     *
     * @param chainId - The hex chain ID to fetch tokens for.
     * @returns A map of lowercase token address → token metadata.
     */
    fetchTokensByChainId(chainId: Hex): Promise<TokenListMap>;
    /**
     * Abort in-flight requests, clear the query cache, and reset the abort
     * controller so subsequent `fetchTokensByChainId` calls are not stuck with an
     * already-aborted signal (which would cache empty results).
     */
    destroy(): void;
}
/**
 * Normalise a raw token list array (from the token API) into a `TokenListMap`.
 *
 * @param tokens - Raw array of token objects returned by the API.
 * @param chainId - The chain the tokens belong to (used for icon URL proxy).
 * @returns A record keyed by lowercased token address.
 */
export declare function buildTokenListMap(tokens: TokenListToken[], chainId: Hex): TokenListMap;
