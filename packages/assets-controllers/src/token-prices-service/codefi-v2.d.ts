import type { ServicePolicy } from '@metamask/controller-utils';
import type { CaipAssetType, Hex } from '@metamask/utils';
import type { AbstractTokenPricesService, EvmAssetAddressWithChain, EvmAssetWithMarketData, ExchangeRatesByCurrency, NativeAssetIdentifiersMap } from './abstract-token-prices-service.js';
/**
 * The list of currencies that can be supplied as the `vsCurrency` parameter to
 * the `/spot-prices` endpoint, in lowercase form.
 * This is the fallback list used when the API is unavailable.
 */
export declare const SUPPORTED_CURRENCIES_FALLBACK: readonly ['btc', 'eth', 'ltc', 'bch', 'bnb', 'eos', 'xrp', 'xlm', 'link', 'dot', 'yfi', 'usd', 'aed', 'ars', 'aud', 'bdt', 'bhd', 'bmd', 'brl', 'cad', 'chf', 'clp', 'cny', 'czk', 'dkk', 'eur', 'gbp', 'gel', 'hkd', 'huf', 'idr', 'ils', 'inr', 'jpy', 'krw', 'kwd', 'lkr', 'mmk', 'mxn', 'myr', 'mon', 'ngn', 'nok', 'nzd', 'php', 'pkr', 'pln', 'rub', 'sar', 'sek', 'sgd', 'thb', 'try', 'twd', 'uah', 'vef', 'vnd', 'zar', 'xdr', 'xag', 'xau', 'bits', 'sats', 'cop', 'kes', 'ron', 'dop', 'crc', 'hnl', 'zmw', 'svc', 'bam', 'pen', 'gtq', 'lbp', 'amd', 'sol', 'sei', 'sonic', 'trx', 'taiko', 'pepu', 'pol', 'mnt', 'nom', 'avax', 'ape'];
/**
 * @deprecated Use `getSupportedCurrencies()` or `fetchSupportedCurrencies()` instead.
 * This is an alias for backward compatibility.
 */
export declare const SUPPORTED_CURRENCIES: readonly ["btc", "eth", "ltc", "bch", "bnb", "eos", "xrp", "xlm", "link", "dot", "yfi", "usd", "aed", "ars", "aud", "bdt", "bhd", "bmd", "brl", "cad", "chf", "clp", "cny", "czk", "dkk", "eur", "gbp", "gel", "hkd", "huf", "idr", "ils", "inr", "jpy", "krw", "kwd", "lkr", "mmk", "mxn", "myr", "mon", "ngn", "nok", "nzd", "php", "pkr", "pln", "rub", "sar", "sek", "sgd", "thb", "try", "twd", "uah", "vef", "vnd", "zar", "xdr", "xag", "xau", "bits", "sats", "cop", "kes", "ron", "dop", "crc", "hnl", "zmw", "svc", "bam", "pen", "gtq", "lbp", "amd", "sol", "sei", "sonic", "trx", "taiko", "pepu", "pol", "mnt", "nom", "avax", "ape"];
/**
 * Represents the zero address, commonly used as a placeholder in blockchain transactions.
 * In the context of fetching market data, the zero address is utilized to retrieve information
 * specifically for native currencies. This allows for a standardized approach to query market
 * data for blockchain-native assets without a specific contract address.
 */
export declare const ZERO_ADDRESS: Hex;
/**
 * Returns the address that should be used to query the price api for the
 * chain's native token. On most chains, this is signified by the zero address.
 * But on some chains, the native token has a specific address.
 *
 * @param chainId - The hexadecimal chain id.
 * @returns The address of the chain's native token.
 */
export declare const getNativeTokenAddress: (chainId: Hex) => Hex;
export declare const SPOT_PRICES_SUPPORT_INFO: {
    readonly '0x1': 'eip155:1/slip44:60';
    readonly '0xa': 'eip155:10/slip44:60';
    readonly '0x19': 'eip155:25/slip44:394';
    readonly '0x1e': 'eip155:30/slip44:137';
    readonly '0x2a': 'eip155:42/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x32': 'eip155:50/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x38': 'eip155:56/slip44:714';
    readonly '0x39': 'eip155:57/slip44:57';
    readonly '0x52': 'eip155:82/slip44:18000';
    readonly '0x58': 'eip155:88/slip44:889';
    readonly '0x64': 'eip155:100/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x6a': 'eip155:106/slip44:5655640';
    readonly '0x7a': 'eip155:122/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x80': 'eip155:128/slip44:1010';
    readonly '0x89': 'eip155:137/slip44:966';
    readonly '0x8f': 'eip155:143/slip44:268435779';
    readonly '0x92': 'eip155:146/slip44:10007';
    readonly '0xc4': 'eip155:196/erc20:0x0000000000000000000000000000000000000000';
    readonly '0xe8': 'eip155:232/erc20:0x0000000000000000000000000000000000000000';
    readonly '0xfa': 'eip155:250/slip44:1007';
    readonly '0xfc': 'eip155:252/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x120': 'eip155:288/slip44:60';
    readonly '0x141': 'eip155:321/slip44:641';
    readonly '0x144': 'eip155:324/slip44:60';
    readonly '0x150': 'eip155:336/slip44:809';
    readonly '0x169': 'eip155:361/slip44:589';
    readonly '0x2eb': 'eip155:747/slip44:539';
    readonly '0x3dc': 'eip155:988/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x3e7': 'eip155:999/slip44:2457';
    readonly '0x440': 'eip155:1088/erc20:0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000';
    readonly '0x44d': 'eip155:1101/slip44:60';
    readonly '0x504': 'eip155:1284/slip44:1284';
    readonly '0x505': 'eip155:1285/slip44:1285';
    readonly '0x531': 'eip155:1329/slip44:19000118';
    readonly '0x6f0': 'eip155:1776/slip44:22000119';
    readonly '0x74c': 'eip155:1868/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x9dd': 'eip155:2525/erc20:0x0000000000000000000000000000000000000000';
    readonly '0xab5': 'eip155:2741/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x1079': 'eip155:4217/slip44:60';
    readonly '0x10e6': 'eip155:4326/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x1388': 'eip155:5000/erc20:0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000';
    readonly '0x13a7': 'eip155:5031/slip44:5031';
    readonly '0x13b2': 'eip155:5042/slip44:5042';
    readonly '0x1b58': 'eip155:7000/slip44:7000';
    readonly '0x2105': 'eip155:8453/slip44:60';
    readonly '0x1237': 'eip155:4663/slip44:60';
    readonly '0x2611': 'eip155:9745/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x2710': 'eip155:10000/slip44:145';
    readonly '0x8173': 'eip155:33139/erc20:0x0000000000000000000000000000000000000000';
    readonly '0xa3c3': 'eip155:41923/erc20:0x0000000000000000000000000000000000000000';
    readonly '0xa4b1': 'eip155:42161/slip44:60';
    readonly '0xa4ec': 'eip155:42220/slip44:52752';
    readonly '0xa516': 'eip155:42262/slip44:474';
    readonly '0xa5bf': 'eip155:42431/slip44:60';
    readonly '0xa729': 'eip155:42793/erc20:0x0000000000000000000000000000000000000000';
    readonly '0xa867': 'eip155:43111/erc20:0x0000000000000000000000000000000000000000';
    readonly '0xa86a': 'eip155:43114/slip44:9005';
    readonly '0xdef1': 'eip155:57073/slip44:60';
    readonly '0xe708': 'eip155:59144/slip44:60';
    readonly '0xed88': 'eip155:60808/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x10b3e': 'eip155:68414/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x11d9b': 'eip155:73115/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x138de': 'eip155:80094/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x13e31': 'eip155:81457/slip44:60';
    readonly '0x15b38': 'eip155:88888/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x17dcd': 'eip155:97741/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x18232': 'eip155:98866/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x28c58': 'eip155:167000/slip44:60';
    readonly '0x518af': 'eip155:333999/slip44:1997';
    readonly '0x82750': 'eip155:534352/slip44:60';
    readonly '0xb67d2': 'eip155:747474/erc20:0x0000000000000000000000000000000000000000';
    readonly '0xf043a': 'eip155:984122/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x15f900': 'eip155:1440000/erc20:0x0000000000000000000000000000000000000000';
    readonly '0x4e454152': 'eip155:1313161554/slip44:60';
    readonly '0x63564c40': 'eip155:1666600000/slip44:1023';
    readonly '0x4115': 'eip155:16661/slip44:16661';
};
/**
 * A currency that can be supplied as the `vsCurrency` parameter to
 * the `/spot-prices` endpoint. Covers both uppercase and lowercase versions.
 */
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES_FALLBACK)[number] | Uppercase<(typeof SUPPORTED_CURRENCIES_FALLBACK)[number]>;
/**
 * The list of chain IDs that can be supplied in the URL for the `/spot-prices`
 * endpoint, but in hexadecimal form (for consistency with how we represent
 * chain IDs in other places).
 *
 * @see Used by {@link CodefiTokenPricesServiceV2} to validate that a given chain ID is supported by V2 of the Codefi Price API.
 */
export declare const SUPPORTED_CHAIN_IDS: (keyof typeof SPOT_PRICES_SUPPORT_INFO)[];
/**
 * A chain ID that can be supplied in the URL for the `/spot-prices` endpoint,
 * but in hexadecimal form (for consistency with how we represent chain IDs in
 * other places).
 */
type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];
/**
 * Response type for the /v2/supportedNetworks endpoint.
 */
type SupportedNetworksResponse = {
    fullSupport: string[];
    partialSupport: {
        spotPricesV2: string[];
        spotPricesV3: string[];
    };
};
/**
 * Fetches the list of supported networks from the API.
 * Falls back to the hardcoded list if the fetch fails.
 * Deduplicates concurrent requests by returning the same promise if a fetch is already in progress.
 *
 * @returns The supported networks response.
 */
export declare function fetchSupportedNetworks(): Promise<SupportedNetworksResponse>;
/**
 * Synchronously gets the list of supported networks.
 * Returns the last fetched value if available, otherwise returns the fallback list.
 *
 * @returns The supported networks response.
 */
export declare function getSupportedNetworks(): SupportedNetworksResponse;
/**
 * Resets the supported networks cache.
 * This is primarily intended for testing purposes.
 */
export declare function resetSupportedNetworksCache(): void;
/**
 * Fetches the list of supported currencies from the API.
 * Falls back to the hardcoded list if the fetch fails.
 *
 * @returns The list of supported currencies in lowercase.
 */
export declare function fetchSupportedCurrencies(): Promise<string[]>;
/**
 * Synchronously gets the list of supported currencies.
 * Returns the last fetched value if available, otherwise returns the fallback list.
 *
 * @returns The list of supported currencies in lowercase.
 */
export declare function getSupportedCurrencies(): readonly string[];
/**
 * Resets the supported currencies cache.
 * This is primarily intended for testing purposes.
 */
export declare function resetSupportedCurrenciesCache(): void;
/**
 * Derives the CAIP-19 asset ID used to query the Price API for a token on a
 * given chain.
 *
 * For native tokens, uses the hardcoded {@link SPOT_PRICES_SUPPORT_INFO} entry
 * when defined, otherwise falls back to the provided native asset identifiers
 * (sourced from NetworkEnablementController). For ERC20 tokens, constructs the
 * CAIP-19 ID dynamically.
 *
 * @param args - The arguments to this function.
 * @param args.chainId - The hexadecimal chain ID the token lives on.
 * @param args.tokenAddress - The token's address.
 * @param args.nativeAssetIdentifiers - Map of CAIP-2 chain IDs to native asset
 * identifiers, used as a fallback for native tokens.
 * @returns The CAIP-19 asset ID, or undefined if it cannot be determined.
 */
export declare function getAssetId({ chainId, tokenAddress, nativeAssetIdentifiers, }: {
    chainId: Hex;
    tokenAddress: string;
    nativeAssetIdentifiers?: NativeAssetIdentifiersMap;
}): CaipAssetType | undefined;
/**
 * This version of the token prices service uses V2 of the Codefi Price API to
 * fetch token prices.
 */
export declare class CodefiTokenPricesServiceV2 implements AbstractTokenPricesService<SupportedChainId, SupportedCurrency> {
    #private;
    /**
     * Construct a Codefi Token Price Service.
     *
     * @param args - The arguments.
     * @param args.degradedThreshold - The length of time (in milliseconds)
     * that governs when the service is regarded as degraded (affecting when
     * `onDegraded` is called). Defaults to 5 seconds.
     * @param args.retries - Number of retry attempts for each fetch request.
     * @param args.maximumConsecutiveFailures - The maximum number of consecutive
     * failures allowed before breaking the circuit and pausing further updates.
     * @param args.circuitBreakDuration - The amount of time to wait when the
     * circuit breaks from too many consecutive failures.
     */
    constructor(args?: {
        degradedThreshold?: number;
        retries?: number;
        maximumConsecutiveFailures?: number;
        circuitBreakDuration?: number;
    });
    /**
     * Construct a Codefi Token Price Service.
     *
     * @deprecated This signature is deprecated; please use the `onBreak` and
     * `onDegraded` methods instead.
     * @param args - The arguments.
     * @param args.degradedThreshold - The length of time (in milliseconds)
     * that governs when the service is regarded as degraded (affecting when
     * `onDegraded` is called). Defaults to 5 seconds.
     * @param args.retries - Number of retry attempts for each fetch request.
     * @param args.maximumConsecutiveFailures - The maximum number of consecutive
     * failures allowed before breaking the circuit and pausing further updates.
     * @param args.onBreak - Callback for when the circuit breaks, useful
     * for capturing metrics about network failures.
     * @param args.onDegraded - Callback for when the API responds successfully
     * but takes too long to respond (5 seconds or more).
     * @param args.circuitBreakDuration - The amount of time to wait when the
     * circuit breaks from too many consecutive failures.
     */
    constructor(args?: {
        degradedThreshold?: number;
        retries?: number;
        maximumConsecutiveFailures?: number;
        onBreak?: () => void;
        onDegraded?: () => void;
        circuitBreakDuration?: number;
    });
    /**
     * Listens for when the request to the API fails too many times in a row.
     *
     * @param args - The same arguments that {@link ServicePolicy.onBreak}
     * takes.
     * @returns What {@link ServicePolicy.onBreak} returns.
     */
    onBreak(...args: Parameters<ServicePolicy['onBreak']>): ReturnType<ServicePolicy['onBreak']>;
    /**
     * Listens for when the API is degraded.
     *
     * @param args - The same arguments that {@link ServicePolicy.onDegraded}
     * takes.
     * @returns What {@link ServicePolicy.onDegraded} returns.
     */
    onDegraded(...args: Parameters<ServicePolicy['onDegraded']>): ReturnType<ServicePolicy['onDegraded']>;
    /**
     * Sets the native asset identifiers map for resolving native token CAIP-19 IDs.
     * This should be called with data from NetworkEnablementController.state.nativeAssetIdentifiers.
     *
     * @param nativeAssetIdentifiers - Map of CAIP-2 chain IDs to native asset identifiers.
     */
    setNativeAssetIdentifiers(nativeAssetIdentifiers: NativeAssetIdentifiersMap): void;
    /**
     * Updates the supported networks cache by fetching from the API.
     * This should be called periodically to keep the supported networks list fresh.
     *
     * @returns The updated supported networks response.
     */
    updateSupportedNetworks(): Promise<SupportedNetworksResponse>;
    /**
     * Retrieves prices in the given currency for the tokens identified by the
     * given addresses which are expected to live on the given chain.
     *
     * @param args - The arguments to function.
     * @param args.assets - The assets to get prices for.
     * @param args.currency - The desired currency of the token prices.
     * @returns The prices for the requested tokens.
     */
    fetchTokenPrices({ assets, currency, }: {
        assets: EvmAssetAddressWithChain<SupportedChainId>[];
        currency: SupportedCurrency;
    }): Promise<EvmAssetWithMarketData<SupportedChainId, SupportedCurrency>[]>;
    /**
     * Retrieves exchange rates in the given base currency.
     *
     * @param args - The arguments to this function.
     * @param args.baseCurrency - The desired base currency of the exchange rates.
     * @param args.includeUsdRate - Whether to include the USD rate in the response.
     * @param args.cryptocurrencies - The cryptocurrencies to get exchange rates for.
     * @returns The exchange rates for the requested base currency.
     */
    fetchExchangeRates({ baseCurrency, includeUsdRate, cryptocurrencies, }: {
        baseCurrency: SupportedCurrency;
        includeUsdRate: boolean;
        cryptocurrencies: string[];
    }): Promise<ExchangeRatesByCurrency<SupportedCurrency>>;
    /**
     * Type guard for whether the API can return token prices for the given chain
     * ID.
     *
     * @param chainId - The chain ID to check.
     * @returns True if the API supports the chain ID, false otherwise.
     */
    validateChainIdSupported(chainId: unknown): chainId is SupportedChainId;
    /**
     * Type guard for whether the API can return token prices in the given
     * currency.
     *
     * @param currency - The currency to check. If a string, can be either
     * lowercase or uppercase.
     * @returns True if the API supports the currency, false otherwise.
     */
    validateCurrencySupported(currency: unknown): currency is SupportedCurrency;
    /**
     * Fetches the list of supported currencies from the API.
     *
     * @returns The list of supported currencies.
     */
    updateSupportedCurrencies(): Promise<string[]>;
}
export {};
