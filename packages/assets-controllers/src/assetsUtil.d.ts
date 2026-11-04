import type { BigNumber } from '@ethersproject/bignumber';
import type { Hex } from '@metamask/utils';
import BN from 'bn.js';
import type { Nft, NftMetadata } from './NftController.js';
import type { AbstractTokenPricesService } from './token-prices-service/index.js';
import type { ContractExchangeRates, ContractMarketData } from './TokenRatesController.js';
/**
 * The maximum number of token addresses that should be sent to the Price API in
 * a single request.
 */
export declare const TOKEN_PRICES_BATCH_SIZE = 30;
/**
 * Compares nft metadata entries to any nft entry.
 * We need this method when comparing a new fetched nft metadata, in case a entry changed to a defined value,
 * there's a need to update the nft in state.
 *
 * @param newNftMetadata - Nft metadata object.
 * @param nft - Nft object to compare with.
 * @returns Whether there are differences.
 */
export declare function compareNftMetadata(newNftMetadata: NftMetadata, nft: Nft): boolean;
/**
 * Checks whether the existing nft object has all the keys of the new incoming nft metadata object
 *
 * @param newNftMetadata - New nft metadata object
 * @param nft - Existing nft object to compare with
 * @returns Whether the existing nft object has all the new keys from the new Nft metadata object
 */
export declare function hasNewCollectionFields(newNftMetadata: NftMetadata, nft: Nft): boolean;
/**
 * Formats aggregator names to presentable format.
 *
 * @param aggregators - List of token list names in camelcase.
 * @returns Formatted aggregator names.
 */
export declare const formatAggregatorNames: (aggregators: string[]) => string[];
/**
 * Format token list assets to use image proxy from Codefi.
 *
 * @param params - Object that contains chainID and tokenAddress.
 * @param params.chainId - ChainID of network in 0x-prefixed hexadecimal format.
 * @param params.tokenAddress - Address of token in mixed or lowercase.
 * @returns Formatted image url
 */
export declare const formatIconUrlWithProxy: ({ chainId, tokenAddress, }: {
    chainId: Hex;
    tokenAddress: string;
}) => string;
/**
 * Networks where token detection is supported - Values are in hex format
 */
export declare enum SupportedTokenDetectionNetworks {
    Mainnet = "0x1",// decimal: 1
    Bsc = "0x38",// decimal: 56
    Polygon = "0x89",// decimal: 137
    Avax = "0xa86a",// decimal: 43114
    Aurora = "0x4e454152",// decimal: 1313161554
    LineaGoerli = "0xe704",// decimal: 59140
    LineaMainnet = "0xe708",// decimal: 59144
    Arbitrum = "0xa4b1",// decimal: 42161
    Optimism = "0xa",// decimal: 10
    Base = "0x2105",// decimal: 8453
    Zksync = "0x144",// decimal: 324
    Cronos = "0x19",// decimal: 25
    Celo = "0xa4ec",// decimal: 42220
    Gnosis = "0x64",// decimal: 100
    Fantom = "0xfa",// decimal: 250
    PolygonZkevm = "0x44d",// decimal: 1101
    Moonbeam = "0x504",// decimal: 1284
    Moonriver = "0x505",// decimal: 1285
    Sei = "0x531",// decimal: 1329
    MonadMainnet = "0x8f",// decimal: 143
    Hyperevm = "0x3e7",// decimal: 999
    Arc = "0x13b2",// decimal: 5042
    Robinhood = "0x1237"
}
/**
 * Networks where staked balance is supported - Values are in hex format
 */
export declare enum SupportedStakedBalanceNetworks {
    Mainnet = "0x1",// decimal: 1
    Hoodi = "0x88bb0"
}
/**
 * Check if token detection is enabled for certain networks.
 *
 * @param chainId - ChainID of network
 * @returns Whether the current network supports token detection
 */
export declare function isTokenDetectionSupportedForNetwork(chainId: Hex): boolean;
/**
 * Check if token list polling is enabled for a given network.
 * Currently this method is used to support e2e testing for consumers of this package.
 *
 * @param chainId - ChainID of network
 * @returns Whether the current network supports tokenlists
 */
export declare function isTokenListSupportedForNetwork(chainId: Hex): boolean;
/**
 * Removes IPFS protocol prefix from input string.
 *
 * @param ipfsUrl - An IPFS url (e.g. ipfs://{content id})
 * @returns IPFS content identifier and (possibly) path in a string
 * @throws Will throw if the url passed is not IPFS.
 */
export declare function removeIpfsProtocolPrefix(ipfsUrl: string): string;
/**
 * Extracts content identifier and path from an input string.
 *
 * @param ipfsUrl - An IPFS URL minus the IPFS protocol prefix
 * @returns IFPS content identifier (cid) and sub path as string.
 * @throws Will throw if the url passed is not ipfs.
 */
export declare function getIpfsCIDv1AndPath(ipfsUrl: string): Promise<{
    cid: string;
    path?: string;
}>;
/**
 * Formats URL correctly for use retrieving assets hosted on IPFS.
 *
 * @param ipfsGateway - The users preferred IPFS gateway (full URL or just host).
 * @param ipfsUrl - The IFPS URL pointed at the asset.
 * @param subdomainSupported - Boolean indicating whether the URL should be formatted with subdomains or not.
 * @returns A formatted URL, with the user's preferred IPFS gateway and format (subdomain or not), pointing to an asset hosted on IPFS.
 */
export declare function getFormattedIpfsUrl(ipfsGateway: string, ipfsUrl: string, subdomainSupported: boolean): Promise<string>;
/**
 * Adds URL protocol prefix to input URL string if missing.
 *
 * @param urlString - An IPFS URL.
 * @returns A URL with a https:// prepended.
 */
export declare function addUrlProtocolPrefix(urlString: string): string;
/**
 * Converts an Ethers BigNumber to a BN.
 *
 * @param bigNumber - An Ethers BigNumber instance.
 * @returns A BN object.
 */
export declare function ethersBigNumberToBN(bigNumber: BigNumber): BN;
/**
 * Partitions a list of values into groups that are at most `batchSize` in
 * length.
 *
 * @param values - The list of values.
 * @param args - The remaining arguments.
 * @param args.batchSize - The desired maximum number of values per batch.
 * @returns The list of batches.
 */
export declare function divideIntoBatches<Value>(values: Value[], { batchSize }: {
    batchSize: number;
}): Value[][];
/**
 * Constructs a result from processing batches of the given values
 * sequentially.
 *
 * @param args - The arguments to this function.
 * @param args.values - A list of values to iterate over.
 * @param args.batchSize - The maximum number of values in each batch.
 * @param args.eachBatch - A function to call for each batch. This function is
 * similar to the function that `Array.prototype.reduce` takes, in that it
 * receives the object that is being built, each batch in the list of batches
 * and the index, and should return an updated version of the object.
 * @param args.initialResult - The initial value of the final data structure,
 * i.e., the value that will be fed into the first call of `eachBatch`.
 * @returns The built result.
 */
export declare function reduceInBatchesSerially<Value, Result>({ values, batchSize, eachBatch, initialResult, }: {
    values: Value[];
    batchSize: number;
    eachBatch: (workingResult: Partial<Result>, batch: Value[], index: number) => Partial<Result> | Promise<Partial<Result>>;
    initialResult: Partial<Result>;
}): Promise<Result>;
type FetchTokenContractExchangeRatesArgs = {
    tokenPricesService: AbstractTokenPricesService;
    nativeCurrency: string;
    tokenAddresses: Hex[];
    chainId: Hex;
};
/**
 * Retrieves token prices for a set of contract addresses in a specific currency and chainId.
 *
 * @param args - The arguments to function.
 * @param args.tokenPricesService - An object in charge of retrieving token prices.
 * @param args.nativeCurrency - The native currency to request price in.
 * @param args.tokenAddresses - The list of contract addresses.
 * @param args.chainId - The chainId of the tokens.
 * @param args.includeMarketData - When true, returns full market data (price,
 * percentage changes, market cap, etc.) per token instead of just the price.
 * @returns The prices (or full market data) for the requested tokens.
 */
export declare function fetchTokenContractExchangeRates(args: FetchTokenContractExchangeRatesArgs & {
    includeMarketData: true;
}): Promise<ContractMarketData>;
export declare function fetchTokenContractExchangeRates(args: FetchTokenContractExchangeRatesArgs & {
    includeMarketData?: false;
}): Promise<ContractExchangeRates>;
/**
 * Function to search for a specific value in a given map and return the key
 *
 * @param map - map input to search value
 * @param value - the value to search for
 * @returns returns key that corresponds to the value
 */
export declare function getKeyByValue(map: Map<string, string>, value: string): string | null;
/**
 * Converts a hex chainId and account address to a CAIP account reference.
 *
 * @param chainId - The hex chain ID
 * @param accountAddress - The account address
 * @returns The CAIP account reference in format "namespace:reference:address"
 */
export declare function accountAddressToCaipReference(chainId: Hex, accountAddress: string): string;
export {};
