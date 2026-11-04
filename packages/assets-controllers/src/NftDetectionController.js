import { BaseController } from '@metamask/base-controller';
import { toChecksumHexAddress, ChainId, NFT_API_BASE_URL, NFT_API_VERSION, convertHexToDecimal, handleFetch, toHex, } from '@metamask/controller-utils';
import { createDeferredPromise } from '@metamask/utils';
import { Source } from './constants.js';
const controllerName = 'NftDetectionController';
const MESSENGER_EXPOSED_METHODS = ['detectNfts'];
export var BlockaidResultType;
(function (BlockaidResultType) {
    BlockaidResultType["Benign"] = "Benign";
    BlockaidResultType["Spam"] = "Spam";
    BlockaidResultType["Warning"] = "Warning";
    BlockaidResultType["Malicious"] = "Malicious";
})(BlockaidResultType || (BlockaidResultType = {}));
/**
 * Controller that passively detects nfts for a user address
 */
export class NftDetectionController extends BaseController {
    #disabled;
    #addNfts;
    #removeNft;
    #getNftState;
    #inProcessNftFetchingUpdates;
    /**
     * The controller options
     *
     * @param options - The controller options.
     * @param options.messenger - A reference to the messaging system.
     * @param options.disabled - Represents previous value of useNftDetection. Used to detect changes of useNftDetection. Default value is true.
     * @param options.addNfts - Add multiple NFTs.
     * @param options.removeNft - Remove a single NFT.
     * @param options.getNftState - Gets the current state of the Assets controller.
     */
    constructor({ messenger, disabled = false, addNfts, removeNft, getNftState, }) {
        super({
            name: controllerName,
            messenger,
            metadata: {},
            state: {},
        });
        this.#disabled = disabled;
        this.#inProcessNftFetchingUpdates = {};
        this.#getNftState = getNftState;
        this.#addNfts = addNfts;
        this.#removeNft = removeNft;
        this.messenger.registerMethodActionHandlers(this, MESSENGER_EXPOSED_METHODS);
        this.messenger.subscribe('PreferencesController:stateChange', this.#onPreferencesControllerStateChange.bind(this));
    }
    /**
     * Checks whether network is mainnet or not.
     *
     * @returns Whether current network is mainnet.
     */
    isMainnet() {
        const { selectedNetworkClientId } = this.messenger.call('NetworkController:getState');
        const { configuration: { chainId }, } = this.messenger.call('NetworkController:getNetworkClientById', selectedNetworkClientId);
        return chainId === ChainId.mainnet;
    }
    isMainnetByNetworkClientId(networkClient) {
        return networkClient.configuration.chainId === ChainId.mainnet;
    }
    /**
     * Handles the state change of the preference controller.
     *
     * @param preferencesState - The new state of the preference controller.
     * @param preferencesState.useNftDetection - Boolean indicating user preference on NFT detection.
     */
    #onPreferencesControllerStateChange({ useNftDetection, }) {
        if (!useNftDetection !== this.#disabled) {
            this.#disabled = !useNftDetection;
        }
    }
    #getOwnerNftApi({ chainIds, address, next, }) {
        // from chainIds construct a string of chainIds that can be used like chainIds=1&chainIds=56
        const chainIdsString = chainIds.join('&chainIds=');
        return `${NFT_API_BASE_URL}/users/${address}/tokens?chainIds=${chainIdsString}&limit=50&includeTopBid=true&continuation=${next ?? ''}`;
    }
    async #getOwnerNfts(address, chainIds, cursor) {
        // Convert hex chainId to number
        const convertedChainIds = chainIds.map((chainId) => convertHexToDecimal(chainId).toString());
        const filteredChainIds = convertedChainIds.filter((chainId) => chainId !== '0');
        // Avoid making the API call for non-EVM chains
        if (filteredChainIds.length === 0) {
            return {
                tokens: [],
                continuation: null,
            };
        }
        const url = this.#getOwnerNftApi({
            chainIds: filteredChainIds,
            address,
            next: cursor,
        });
        const nftApiResponse = await handleFetch(url, {
            headers: {
                Version: NFT_API_VERSION,
            },
        });
        return nftApiResponse;
    }
    /**
     * Triggers asset ERC721 token auto detection on mainnet. Any newly detected NFTs are
     * added.
     *
     * @param chainIds - The chain IDs to detect NFTs on.
     * @param options - Options bag.
     * @param options.userAddress - The address to detect NFTs for.
     * @param options.firstPageOnly - Whether to only detect the first page of NFTs.
     * @param options.signal - An optional abort signal to cancel the operation.
     */
    async detectNfts(chainIds, options) {
        const userAddress = options?.userAddress ??
            this.messenger.call('AccountsController:getSelectedAccount').address;
        /* istanbul ignore if */
        if (chainIds.length === 0 || this.#disabled) {
            return;
        }
        /* istanbul ignore else */
        if (!userAddress) {
            return;
        }
        // create a string of all chainIds
        const chainIdsString = chainIds.join(',');
        const updateKey = `${chainIdsString}:${userAddress}`;
        if (updateKey in this.#inProcessNftFetchingUpdates) {
            // This prevents redundant updates
            // This promise is resolved after the in-progress update has finished,
            // and state has been updated.
            await this.#inProcessNftFetchingUpdates[updateKey];
            return;
        }
        const { promise: inProgressUpdate, resolve: updateSucceeded, reject: updateFailed, } = createDeferredPromise({ suppressUnhandledRejection: true });
        this.#inProcessNftFetchingUpdates[updateKey] = inProgressUpdate;
        let next;
        let apiNfts = [];
        let resultNftApi;
        try {
            do {
                resultNftApi = await this.#getOwnerNfts(userAddress, chainIds, next);
                apiNfts = resultNftApi.tokens.filter((elm) => elm.token.isSpam === false &&
                    (elm.blockaidResult?.result_type
                        ? elm.blockaidResult?.result_type === BlockaidResultType.Benign
                        : true));
                // Remove NFTs that the API now marks as spam but are still in state
                const spamNfts = resultNftApi.tokens.filter((elm) => elm.token.isSpam === true);
                for (const { token } of spamNfts) {
                    const { contract, tokenId, chainId } = token;
                    if (!chainId) {
                        continue;
                    }
                    const hexChainId = toHex(chainId);
                    const { allNfts } = this.#getNftState();
                    const nftsForChain = allNfts[userAddress]?.[hexChainId] ?? [];
                    const checksumAddress = toChecksumHexAddress(contract);
                    const existingNft = nftsForChain.find((nft) => nft.address.toLowerCase() === checksumAddress.toLowerCase() &&
                        nft.tokenId === tokenId);
                    // NFTs the user added (manually or by approving a dapp suggestion)
                    // are never auto-removed. NFTs without a stored source were added
                    // before sources were recorded and can still be removed.
                    if (existingNft &&
                        (!existingNft.source || existingNft.source === Source.Detected)) {
                        try {
                            const networkClientId = this.messenger.call('NetworkController:findNetworkClientIdByChainId', hexChainId);
                            this.#removeNft(contract, tokenId, networkClientId, {
                                userAddress,
                            });
                        }
                        catch {
                            // Network may not be configured; skip this NFT
                        }
                    }
                }
                // Proceed to add NFTs
                const nftsToAdd = apiNfts
                    .map((nft) => {
                    const { tokenId, contract, kind, image: imageUrl, imageSmall: imageThumbnailUrl, metadata, name, description, attributes, topBid, lastSale, rarityRank, rarityScore, collection, chainId, } = nft.token;
                    // Use a fallback if metadata is null
                    const { imageOriginal: imageOriginalUrl } = metadata ?? {};
                    let ignored;
                    /* istanbul ignore else */
                    const { ignoredNfts } = this.#getNftState();
                    if (ignoredNfts.length) {
                        ignored = ignoredNfts.find((ignoredNft) => {
                            /* istanbul ignore next */
                            return (ignoredNft.address === toChecksumHexAddress(contract) &&
                                ignoredNft.tokenId === tokenId);
                        });
                    }
                    /* istanbul ignore else */
                    if (!ignored) {
                        /* istanbul ignore next */
                        const nftMetadata = Object.assign({}, { name }, description && { description }, imageUrl && { image: imageUrl }, imageThumbnailUrl && { imageThumbnail: imageThumbnailUrl }, imageOriginalUrl && { imageOriginal: imageOriginalUrl }, kind && { standard: kind.toUpperCase() }, lastSale && { lastSale }, attributes && { attributes }, topBid && { topBid }, rarityRank && { rarityRank }, rarityScore && { rarityScore }, collection && { collection }, chainId && { chainId });
                        return {
                            tokenAddress: contract,
                            tokenId,
                            nftMetadata,
                        };
                    }
                    return;
                })
                    .filter((nft) => nft !== undefined);
                await this.#addNfts(nftsToAdd, userAddress, Source.Detected);
            } while ((next = resultNftApi.continuation) &&
                !options?.firstPageOnly &&
                !options?.signal?.aborted);
            updateSucceeded();
        }
        catch (error) {
            updateFailed(error);
            throw error;
        }
        finally {
            delete this.#inProcessNftFetchingUpdates[updateKey];
        }
    }
}
export default NftDetectionController;
