export declare enum Source {
    Custom = "custom",
    Dapp = "dapp",
    Detected = "detected"
}
export declare const SUPPORTED_NETWORKS_ACCOUNTS_API_V4: string[];
/** Lowercase ERC-20 address for MetaMask USD (mUSD), same contract on listed chains. */
export declare const MUSD_ERC20_ADDRESS_LOWER = "0xaca92e438df0b2401ff60da7e4337b687a2435da";
/**
 * EVM chains where mUSD is always merged into the token-detection candidate list.
 * Metadata matches `GET /v3/assets` on `tokens.api.cx.metamask.io` (assetIds CAIP-19).
 */
export declare const MUSD_TOKEN_DETECTION_CHAIN_IDS: readonly ["0x1", "0xe708", "0x8f"];
/** Raw `aggregators` keys from the Tokens API (same shape as token list cache). */
export type MusdTokenDetectionMetadata = {
    name: string;
    symbol: string;
    decimals: number;
    aggregators: string[];
};
export declare const MUSD_TOKEN_METADATA_BY_CHAIN: Record<(typeof MUSD_TOKEN_DETECTION_CHAIN_IDS)[number], MusdTokenDetectionMetadata>;
/**
 * Determines if native token fetching should be included for the given chain.
 * Returns false for chains that return arbitrary large numbers (e.g., Tempo networks).
 *
 * @param chainId - Chain ID in hex format (e.g., "0xa5bf") or CAIP-2 format (e.g., "eip155:42431").
 * @returns True if native token should be included, false if it should be skipped.
 */
export declare function shouldIncludeNativeToken(chainId: string): boolean;
