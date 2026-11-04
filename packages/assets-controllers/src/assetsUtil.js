import { convertHexToDecimal, toChecksumHexAddress, } from '@metamask/controller-utils';
import { hexToNumber, KnownCaipNamespace, remove0x, toCaipChainId, } from '@metamask/utils';
import BN from 'bn.js';
import { CID } from 'multiformats/cid';
import { getNativeTokenAddress } from './token-prices-service/index.js';
/**
 * The maximum number of token addresses that should be sent to the Price API in
 * a single request.
 */
export const TOKEN_PRICES_BATCH_SIZE = 30;
/**
 * Compares nft metadata entries to any nft entry.
 * We need this method when comparing a new fetched nft metadata, in case a entry changed to a defined value,
 * there's a need to update the nft in state.
 *
 * @param newNftMetadata - Nft metadata object.
 * @param nft - Nft object to compare with.
 * @returns Whether there are differences.
 */
export function compareNftMetadata(newNftMetadata, nft) {
    const keys = [
        'image',
        'backgroundColor',
        'imagePreview',
        'imageThumbnail',
        'imageOriginal',
        'animation',
        'animationOriginal',
        'externalLink',
        'tokenURI',
        'chainId',
    ];
    const differentValues = keys.reduce((value, key) => {
        if (newNftMetadata[key] && newNftMetadata[key] !== nft[key]) {
            return value + 1;
        }
        return value;
    }, 0);
    return differentValues > 0;
}
/**
 * Checks whether the existing nft object has all the keys of the new incoming nft metadata object
 *
 * @param newNftMetadata - New nft metadata object
 * @param nft - Existing nft object to compare with
 * @returns Whether the existing nft object has all the new keys from the new Nft metadata object
 */
export function hasNewCollectionFields(newNftMetadata, nft) {
    const keysNewNftMetadata = Object.keys(newNftMetadata.collection ?? {});
    const keysExistingNft = new Set(Object.keys(nft.collection ?? {}));
    return keysNewNftMetadata.some((key) => !keysExistingNft.has(key));
}
const aggregatorNameByKey = {
    aave: 'Aave',
    bancor: 'Bancor',
    cmc: 'CMC',
    cryptocom: 'Crypto.com',
    coinGecko: 'CoinGecko',
    oneInch: '1inch',
    paraswap: 'Paraswap',
    pmm: 'PMM',
    zapper: 'Zapper',
    zerion: 'Zerion',
    zeroEx: '0x',
    synthetix: 'Synthetix',
    yearn: 'Yearn',
    apeswap: 'ApeSwap',
    binanceDex: 'BinanceDex',
    pancakeTop100: 'PancakeTop100',
    pancakeExtended: 'PancakeExtended',
    balancer: 'Balancer',
    quickswap: 'QuickSwap',
    matcha: 'Matcha',
    pangolinDex: 'PangolinDex',
    pangolinDexStableCoin: 'PangolinDexStableCoin',
    pangolinDexAvaxBridge: 'PangolinDexAvaxBridge',
    traderJoe: 'TraderJoe',
    airswapLight: 'AirswapLight',
    kleros: 'Kleros',
};
/**
 * Formats aggregator names to presentable format.
 *
 * @param aggregators - List of token list names in camelcase.
 * @returns Formatted aggregator names.
 */
export const formatAggregatorNames = (aggregators) => {
    return aggregators.map((key) => aggregatorNameByKey[key] ||
        `${key[0].toUpperCase()}${key.substring(1, key.length)}`);
};
/**
 * Format token list assets to use image proxy from Codefi.
 *
 * @param params - Object that contains chainID and tokenAddress.
 * @param params.chainId - ChainID of network in 0x-prefixed hexadecimal format.
 * @param params.tokenAddress - Address of token in mixed or lowercase.
 * @returns Formatted image url
 */
export const formatIconUrlWithProxy = ({ chainId, tokenAddress, }) => {
    const chainIdDecimal = convertHexToDecimal(chainId).toString();
    return `https://static.cx.metamask.io/api/v1/tokenIcons/${chainIdDecimal}/${tokenAddress.toLowerCase()}.png`;
};
/**
 * Networks where token detection is supported - Values are in hex format
 */
export var SupportedTokenDetectionNetworks;
(function (SupportedTokenDetectionNetworks) {
    SupportedTokenDetectionNetworks["Mainnet"] = "0x1";
    SupportedTokenDetectionNetworks["Bsc"] = "0x38";
    SupportedTokenDetectionNetworks["Polygon"] = "0x89";
    SupportedTokenDetectionNetworks["Avax"] = "0xa86a";
    SupportedTokenDetectionNetworks["Aurora"] = "0x4e454152";
    SupportedTokenDetectionNetworks["LineaGoerli"] = "0xe704";
    SupportedTokenDetectionNetworks["LineaMainnet"] = "0xe708";
    SupportedTokenDetectionNetworks["Arbitrum"] = "0xa4b1";
    SupportedTokenDetectionNetworks["Optimism"] = "0xa";
    SupportedTokenDetectionNetworks["Base"] = "0x2105";
    SupportedTokenDetectionNetworks["Zksync"] = "0x144";
    SupportedTokenDetectionNetworks["Cronos"] = "0x19";
    SupportedTokenDetectionNetworks["Celo"] = "0xa4ec";
    SupportedTokenDetectionNetworks["Gnosis"] = "0x64";
    SupportedTokenDetectionNetworks["Fantom"] = "0xfa";
    SupportedTokenDetectionNetworks["PolygonZkevm"] = "0x44d";
    SupportedTokenDetectionNetworks["Moonbeam"] = "0x504";
    SupportedTokenDetectionNetworks["Moonriver"] = "0x505";
    SupportedTokenDetectionNetworks["Sei"] = "0x531";
    SupportedTokenDetectionNetworks["MonadMainnet"] = "0x8f";
    SupportedTokenDetectionNetworks["Hyperevm"] = "0x3e7";
    SupportedTokenDetectionNetworks["Arc"] = "0x13b2";
    SupportedTokenDetectionNetworks["Robinhood"] = "0x1237";
})(SupportedTokenDetectionNetworks || (SupportedTokenDetectionNetworks = {}));
/**
 * Networks where staked balance is supported - Values are in hex format
 */
export var SupportedStakedBalanceNetworks;
(function (SupportedStakedBalanceNetworks) {
    SupportedStakedBalanceNetworks["Mainnet"] = "0x1";
    SupportedStakedBalanceNetworks["Hoodi"] = "0x88bb0";
})(SupportedStakedBalanceNetworks || (SupportedStakedBalanceNetworks = {}));
/**
 * Check if token detection is enabled for certain networks.
 *
 * @param chainId - ChainID of network
 * @returns Whether the current network supports token detection
 */
export function isTokenDetectionSupportedForNetwork(chainId) {
    return Object.values(SupportedTokenDetectionNetworks).includes(chainId);
}
/**
 * Check if token list polling is enabled for a given network.
 * Currently this method is used to support e2e testing for consumers of this package.
 *
 * @param chainId - ChainID of network
 * @returns Whether the current network supports tokenlists
 */
export function isTokenListSupportedForNetwork(chainId) {
    return isTokenDetectionSupportedForNetwork(chainId);
}
/**
 * Removes IPFS protocol prefix from input string.
 *
 * @param ipfsUrl - An IPFS url (e.g. ipfs://{content id})
 * @returns IPFS content identifier and (possibly) path in a string
 * @throws Will throw if the url passed is not IPFS.
 */
export function removeIpfsProtocolPrefix(ipfsUrl) {
    if (ipfsUrl.startsWith('ipfs://ipfs/')) {
        return ipfsUrl.replace('ipfs://ipfs/', '');
    }
    else if (ipfsUrl.startsWith('ipfs://')) {
        return ipfsUrl.replace('ipfs://', '');
    }
    // this method should not be used with non-ipfs urls (i.e. startsWith('ipfs://') === true)
    throw new Error('this method should not be used with non ipfs urls');
}
/**
 * Extracts content identifier and path from an input string.
 *
 * @param ipfsUrl - An IPFS URL minus the IPFS protocol prefix
 * @returns IFPS content identifier (cid) and sub path as string.
 * @throws Will throw if the url passed is not ipfs.
 */
export async function getIpfsCIDv1AndPath(ipfsUrl) {
    const url = removeIpfsProtocolPrefix(ipfsUrl);
    // check if there is a path
    // (CID is everything preceding first forward slash, path is everything after)
    const index = url.indexOf('/');
    const cid = index === -1 ? url : url.substring(0, index);
    const path = index === -1 ? undefined : url.substring(index);
    // We want to ensure that the CID is v1 (https://docs.ipfs.io/concepts/content-addressing/#identifier-formats)
    // because most cid v0s appear to be incompatible with IPFS subdomains
    return {
        cid: CID.parse(cid).toV1().toString(),
        path,
    };
}
/**
 * Formats URL correctly for use retrieving assets hosted on IPFS.
 *
 * @param ipfsGateway - The users preferred IPFS gateway (full URL or just host).
 * @param ipfsUrl - The IFPS URL pointed at the asset.
 * @param subdomainSupported - Boolean indicating whether the URL should be formatted with subdomains or not.
 * @returns A formatted URL, with the user's preferred IPFS gateway and format (subdomain or not), pointing to an asset hosted on IPFS.
 */
export async function getFormattedIpfsUrl(ipfsGateway, ipfsUrl, subdomainSupported) {
    const { host, protocol, origin } = new URL(addUrlProtocolPrefix(ipfsGateway));
    if (subdomainSupported) {
        const { cid, path } = await getIpfsCIDv1AndPath(ipfsUrl);
        return `${protocol}//${cid}.ipfs.${host}${path ?? ''}`;
    }
    const cidAndPath = removeIpfsProtocolPrefix(ipfsUrl);
    return `${origin}/ipfs/${cidAndPath}`;
}
/**
 * Adds URL protocol prefix to input URL string if missing.
 *
 * @param urlString - An IPFS URL.
 * @returns A URL with a https:// prepended.
 */
export function addUrlProtocolPrefix(urlString) {
    if (!urlString.match(/(^http:\/\/)|(^https:\/\/)/u)) {
        return `https://${urlString}`;
    }
    return urlString;
}
/**
 * Converts an Ethers BigNumber to a BN.
 *
 * @param bigNumber - An Ethers BigNumber instance.
 * @returns A BN object.
 */
export function ethersBigNumberToBN(bigNumber) {
    return new BN(remove0x(bigNumber.toHexString()), 'hex');
}
/**
 * Partitions a list of values into groups that are at most `batchSize` in
 * length.
 *
 * @param values - The list of values.
 * @param args - The remaining arguments.
 * @param args.batchSize - The desired maximum number of values per batch.
 * @returns The list of batches.
 */
export function divideIntoBatches(values, { batchSize }) {
    const batches = [];
    for (let i = 0; i < values.length; i += batchSize) {
        batches.push(values.slice(i, i + batchSize));
    }
    return batches;
}
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
export async function reduceInBatchesSerially({ values, batchSize, eachBatch, initialResult, }) {
    const batches = divideIntoBatches(values, { batchSize });
    let workingResult = initialResult;
    for (const [index, batch] of batches.entries()) {
        workingResult = await eachBatch(workingResult, batch, index);
    }
    // There's no way around this — we have to assume that in the end, the result
    // matches the intended type.
    const finalResult = workingResult;
    return finalResult;
}
export async function fetchTokenContractExchangeRates({ tokenPricesService, nativeCurrency, tokenAddresses, chainId, includeMarketData = false, }) {
    const isChainIdSupported = tokenPricesService.validateChainIdSupported(chainId);
    const isCurrencySupported = tokenPricesService.validateCurrencySupported(nativeCurrency);
    if (!isChainIdSupported || !isCurrencySupported) {
        return {};
    }
    const tokenPricesByTokenAddress = await reduceInBatchesSerially({
        values: [...tokenAddresses, getNativeTokenAddress(chainId)].sort(),
        batchSize: TOKEN_PRICES_BATCH_SIZE,
        eachBatch: async (allTokenPricesByTokenAddress, batch) => {
            const tokenPricesByTokenAddressForBatch = (await tokenPricesService.fetchTokenPrices({
                assets: batch.map((tokenAddress) => ({
                    chainId,
                    tokenAddress,
                })),
                currency: nativeCurrency,
            })).reduce((acc, tokenPrice) => {
                acc[tokenPrice.tokenAddress] = tokenPrice;
                return acc;
            }, {});
            return {
                ...allTokenPricesByTokenAddress,
                ...tokenPricesByTokenAddressForBatch,
            };
        },
        initialResult: {},
    });
    if (includeMarketData) {
        return Object.entries(tokenPricesByTokenAddress).reduce((obj, [tokenAddress, tokenPrice]) => {
            if (tokenPrice) {
                const checksummedAddress = toChecksumHexAddress(tokenAddress);
                return {
                    ...obj,
                    [checksummedAddress]: {
                        ...tokenPrice,
                        tokenAddress: checksummedAddress,
                    },
                };
            }
            return obj;
        }, {});
    }
    return Object.entries(tokenPricesByTokenAddress).reduce((obj, [tokenAddress, tokenPrice]) => {
        return {
            ...obj,
            [toChecksumHexAddress(tokenAddress)]: tokenPrice?.price,
        };
    }, {});
}
/**
 * Function to search for a specific value in a given map and return the key
 *
 * @param map - map input to search value
 * @param value - the value to search for
 * @returns returns key that corresponds to the value
 */
export function getKeyByValue(map, value) {
    for (const [key, val] of map.entries()) {
        if (val === value) {
            return key;
        }
    }
    return null; // Return null if no match is found
}
/**
 * Converts a hex chainId and account address to a CAIP account reference.
 *
 * @param chainId - The hex chain ID
 * @param accountAddress - The account address
 * @returns The CAIP account reference in format "namespace:reference:address"
 */
export function accountAddressToCaipReference(chainId, accountAddress) {
    const caipChainId = toCaipChainId(KnownCaipNamespace.Eip155, hexToNumber(chainId).toString());
    return `${caipChainId}:${accountAddress}`;
}
