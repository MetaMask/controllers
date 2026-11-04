import type { AccountsControllerSelectedEvmAccountChangeEvent, AccountsControllerGetAccountAction, AccountsControllerGetSelectedAccountAction } from '@metamask/accounts-controller';
import type { ApprovalControllerAddRequestAction } from '@metamask/approval-controller';
import { BaseController } from '@metamask/base-controller';
import type { ControllerStateChangeEvent, ControllerGetStateAction } from '@metamask/base-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkClientId, NetworkControllerFindNetworkClientIdByChainIdAction, NetworkControllerGetNetworkClientByIdAction } from '@metamask/network-controller';
import type { PhishingControllerBulkScanUrlsAction } from '@metamask/phishing-controller';
import type { PreferencesControllerStateChangeEvent } from '@metamask/preferences-controller';
import type { Hex } from '@metamask/utils';
import type { AssetsContractControllerGetERC1155TokenURIAction, AssetsContractControllerGetERC721AssetNameAction, AssetsContractControllerGetERC721AssetSymbolAction, AssetsContractControllerGetERC721TokenURIAction } from './AssetsContractController-method-action-types.js';
import { Source } from './constants.js';
import type { NftControllerMethodActions } from './NftController-method-action-types.js';
import type { Collection, Attributes, LastSale, TopBid } from './NftDetectionController.js';
export type NFTStandardType = 'ERC721' | 'ERC1155';
type SuggestedNftMeta = {
    asset: {
        address: string;
        tokenId: string;
    } & NftMetadata;
    id: string;
    time: number;
    type: NFTStandardType;
    interactingAddress: string;
    origin: string;
};
/**
 * Nft
 *
 * NFT representation
 *
 * address - Hex address of a ERC721 contract
 *
 * description - The NFT description
 *
 * image - URI of custom NFT image associated with this tokenId
 *
 * name - Name associated with this tokenId and contract address
 *
 * tokenId - The NFT identifier
 *
 * numberOfSales - Number of sales
 *
 * backgroundColor - The background color to be displayed with the item
 *
 * imagePreview - URI of a smaller image associated with this NFT
 *
 * imageThumbnail - URI of a thumbnail image associated with this NFT
 *
 * imageOriginal - URI of the original image associated with this NFT
 * animation - URI of a animation associated with this NFT
 * animationOriginal - URI of the original animation associated with this NFT
 * externalLink - External link containing additional information
 * creator - The NFT owner information object
 * isCurrentlyOwned - Boolean indicating whether the address/chainId combination where it's currently stored currently owns this NFT
 * transactionId - Transaction Id associated with the NFT
 * source - How the NFT was added (`custom`, `dapp` or `detected`). Set on creation; auto-detection never overwrites it, a dapp suggestion upgrades `detected`, and a manual import overrides any other source. Unset for NFTs added before this field existed.
 */
export type Nft = {
    tokenId: string;
    address: string;
    isCurrentlyOwned?: boolean;
    source?: Source;
} & NftMetadata;
/**
 * NftContract
 *
 * NFT contract information representation
 *
 * name - Contract name
 *
 * logo - Contract logo
 *
 * address - Contract address
 *
 * symbol - Contract symbol
 *
 * description - Contract description
 *
 * totalSupply - Total supply of NFTs
 *
 * assetContractType - The NFT type, it could be `semi-fungible` or `non-fungible`
 *
 * createdDate - Creation date
 *
 * schemaName - The schema followed by the contract, it could be `ERC721` or `ERC1155`
 *
 * externalLink - External link containing additional information
 */
export type NftContract = {
    name?: string;
    logo?: string;
    address: string;
    symbol?: string;
    description?: string;
    totalSupply?: string;
    assetContractType?: string;
    createdDate?: string;
    schemaName?: string;
    externalLink?: string;
};
/**
 * NftMetadata
 *
 * NFT custom information
 *
 * name - NFT custom name
 *
 * description - The NFT description
 *
 * numberOfSales - Number of sales
 *
 * backgroundColor - The background color to be displayed with the item
 *
 * image - Image custom image URI
 *
 * imagePreview - URI of a smaller image associated with this NFT
 *
 * imageThumbnail - URI of a thumbnail image associated with this NFT
 *
 * imageOriginal - URI of the original image associated with this NFT
 *
 * animation - URI of a animation associated with this NFT
 *
 * animationOriginal - URI of the original animation associated with this NFT
 * externalLink - External link containing additional information
 * creator - The NFT owner information object
 * standard - NFT standard name for the NFT, e.g., ERC-721 or ERC-1155
 */
export type NftMetadata = {
    name: string | null;
    description: string | null;
    image: string | null;
    standard: string | null;
    favorite?: boolean;
    numberOfSales?: number;
    backgroundColor?: string;
    imagePreview?: string;
    imageThumbnail?: string;
    imageOriginal?: string;
    animation?: string;
    animationOriginal?: string;
    externalLink?: string;
    creator?: string;
    transactionId?: string;
    tokenURI?: string | null;
    collection?: Collection;
    address?: string;
    attributes?: Attributes[];
    lastSale?: LastSale;
    rarityRank?: string;
    topBid?: TopBid;
    chainId?: number;
};
/**
 * NftControllerState
 *
 * NFT controller state
 *
 * allNftContracts - Object containing NFT contract information
 *
 * allNfts - Object containing NFTs per account and network
 *
 * ignoredNfts - List of NFTs that should be ignored
 */
export type NftControllerState = {
    allNftContracts: {
        [key: string]: {
            [chainId: Hex]: NftContract[];
        };
    };
    allNfts: {
        [key: string]: {
            [chainId: Hex]: Nft[];
        };
    };
    ignoredNfts: Nft[];
};
type NftAsset = {
    address: string;
    tokenId: string;
};
/**
 * The name of the {@link NftController}.
 */
declare const controllerName = "NftController";
export type NftControllerGetStateAction = ControllerGetStateAction<typeof controllerName, NftControllerState>;
export type NftControllerActions = NftControllerGetStateAction | NftControllerMethodActions;
/**
 * The external actions available to the {@link NftController}.
 */
export type AllowedActions = ApprovalControllerAddRequestAction | AccountsControllerGetAccountAction | AccountsControllerGetSelectedAccountAction | NetworkControllerGetNetworkClientByIdAction | AssetsContractControllerGetERC721AssetNameAction | AssetsContractControllerGetERC721AssetSymbolAction | AssetsContractControllerGetERC721TokenURIAction | AssetsContractControllerGetERC1155TokenURIAction | NetworkControllerFindNetworkClientIdByChainIdAction | PhishingControllerBulkScanUrlsAction;
export type AllowedEvents = PreferencesControllerStateChangeEvent | AccountsControllerSelectedEvmAccountChangeEvent;
export type NftControllerStateChangeEvent = ControllerStateChangeEvent<typeof controllerName, NftControllerState>;
export type NftControllerEvents = NftControllerStateChangeEvent;
/**
 * The messenger of the {@link NftController}.
 */
export type NftControllerMessenger = Messenger<typeof controllerName, NftControllerActions | AllowedActions, NftControllerEvents | AllowedEvents>;
export declare const getDefaultNftControllerState: () => NftControllerState;
/**
 * Controller that stores assets and exposes convenience methods
 */
export declare class NftController extends BaseController<typeof controllerName, NftControllerState, NftControllerMessenger> {
    #private;
    /**
     * Creates an NftController instance.
     *
     * @param options - The controller options.
     * @param options.ipfsGateway - The configured IPFS gateway.
     * @param options.displayNftMedia - Controls whether the NFT API is used.
     * @param options.useIpfsSubdomains - Controls whether IPFS subdomains are used.
     * @param options.isIpfsGatewayEnabled - Controls whether IPFS is enabled or not.
     * @param options.onNftAdded - Callback that is called when an NFT is added. Currently used pass data
     * for tracking the NFT added event.
     * @param options.messenger - The messenger.
     * @param options.state - Initial state to set on this controller.
     */
    constructor({ ipfsGateway, displayNftMedia, useIpfsSubdomains, isIpfsGatewayEnabled, onNftAdded, messenger, state, }: {
        ipfsGateway?: string;
        displayNftMedia?: boolean;
        useIpfsSubdomains?: boolean;
        isIpfsGatewayEnabled?: boolean;
        onNftAdded?: (data: {
            address: string;
            symbol: string | undefined;
            tokenId: string;
            standard: string | null;
            source: string;
        }) => void;
        messenger: NftControllerMessenger;
        state?: Partial<NftControllerState>;
    });
    getNftApi(): string;
    /**
     * Adds a new suggestedAsset to state. Parameters will be validated according to
     * asset type being watched. A `<suggestedNftMeta.id>:pending` hub event will be emitted once added.
     *
     * @param asset - The asset to be watched. For now ERC721 and ERC1155 tokens are accepted.
     * @param asset.address - The address of the asset contract.
     * @param asset.tokenId - The ID of the asset.
     * @param type - The asset type.
     * @param origin - Domain origin to register the asset from.
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param options - Options bag.
     * @param options.userAddress - The address of the account where the NFT is being added.
     * @returns Object containing a Promise resolving to the suggestedAsset address if accepted.
     */
    watchNft(asset: NftAsset, type: NFTStandardType, origin: string, networkClientId: NetworkClientId, { userAddress, }?: {
        userAddress?: string;
    }): Promise<void>;
    /**
     * Checks the ownership of a ERC-721 or ERC-1155 NFT for a given address.
     *
     * @param ownerAddress - User public address.
     * @param nftAddress - NFT contract address.
     * @param tokenId - NFT token ID.
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param options - Optional parameters.
     * @param options.standard - The NFT standard ('ERC721' or 'ERC1155'). When provided, only the
     * relevant ownership check is performed, halving the number of RPC subcalls.
     * @returns Promise resolving the NFT ownership.
     */
    isNftOwner(ownerAddress: string, nftAddress: string, tokenId: string, networkClientId: NetworkClientId, { standard }?: {
        standard?: string | null;
    }): Promise<boolean>;
    /**
     * Verifies currently selected address owns entered NFT address/tokenId combo and
     * adds the NFT and respective NFT contract to the stored NFT and NFT contracts lists.
     *
     * @param address - Hex address of the NFT contract.
     * @param tokenId - The NFT identifier.
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param options - an object of arguments
     * @param options.userAddress - The address of the current user.
     * @param options.source - Whether the NFT was detected, added manually or suggested by a dapp. Defaults to `Source.Custom`; pass `Source.Detected` when refreshing existing NFTs.
     */
    addNftVerifyOwnership(address: string, tokenId: string, networkClientId: NetworkClientId, { userAddress, source, }?: {
        userAddress?: string;
        source?: Source;
    }): Promise<void>;
    /**
     * Adds an NFT and respective NFT contract to the stored NFT and NFT contracts lists.
     *
     * @param tokenAddress - Hex address of the NFT contract.
     * @param tokenId - The NFT identifier.
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param options - an object of arguments
     * @param options.nftMetadata - NFT optional metadata.
     * @param options.userAddress - The address of the current user.
     * @param options.source - Whether the NFT was detected, added manually or suggested by a dapp. Defaults to `Source.Custom`; pass `Source.Detected` when refreshing existing NFTs.
     * @returns Promise resolving to the current NFT list.
     */
    addNft(tokenAddress: string, tokenId: string, networkClientId: NetworkClientId, { nftMetadata, userAddress, source, }?: {
        nftMetadata?: NftMetadata;
        userAddress?: string;
        source?: Source;
    }): Promise<void>;
    /**
     * Adds multiple NFTs and respective NFT contracts to the stored NFT and NFT contracts lists.
     *
     * @param nfts - An array of NFT objects to add.
     * @param nfts[].tokenAddress - Hex address of the NFT contract.
     * @param nfts[].tokenId - The NFT identifier.
     * @param nfts[].nftMetadata - NFT metadata including chainId.
     * @param userAddress - The address of the current user.
     * @param source - Whether the NFT was detected, added manually or suggested by a dapp. Defaults to `Source.Custom`; pass `Source.Detected` when refreshing existing NFTs.
     * @returns Promise resolving to the current NFT list.
     */
    addNfts(nfts: {
        tokenAddress: string;
        tokenId: string;
        nftMetadata: NftMetadata & {
            chainId: number;
        };
    }[], userAddress: string, source?: Source): Promise<void>;
    /**
     * Refetches NFT metadata and updates the state
     *
     * @param options - Options for refetching NFT metadata
     * @param options.nfts - nfts to update metadata for.
     * @param options.userAddress - The current user address
     */
    updateNftMetadata({ nfts, userAddress, }: {
        nfts: Nft[];
        userAddress?: string;
    }): Promise<void>;
    /**
     * Removes an NFT from the stored token list.
     *
     * @param address - Hex address of the NFT contract.
     * @param tokenId - Token identifier of the NFT.
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param options - an object of arguments
     * @param options.userAddress - The address of the account where the NFT is being removed.
     */
    removeNft(address: string, tokenId: string, networkClientId: NetworkClientId, { userAddress }?: {
        userAddress?: string;
    }): void;
    /**
     * Removes an NFT from the stored token list and saves it in ignored NFTs list.
     *
     * @param address - Hex address of the NFT contract.
     * @param tokenId - Token identifier of the NFT.
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param options - an object of arguments
     * @param options.userAddress - The address of the account where the NFT is being removed.
     */
    removeAndIgnoreNft(address: string, tokenId: string, networkClientId: NetworkClientId, { userAddress }?: {
        userAddress?: string;
    }): void;
    /**
     * Removes all NFTs from the ignored list.
     */
    clearIgnoredNfts(): void;
    /**
     * Checks whether input NFT is still owned by the user
     * and updates the isCurrentlyOwned value on the NFT object accordingly.
     *
     * @param nft - The NFT object to check and update.
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param accountParams - The userAddress to check ownership against.
     * @param accountParams.userAddress - the address passed through the confirmed transaction flow to ensure assets are stored to the correct account
     * @returns the NFT with the updated isCurrentlyOwned value
     */
    checkAndUpdateSingleNftOwnershipStatus(nft: Nft, networkClientId: NetworkClientId, { userAddress }?: {
        userAddress?: string;
    }): Promise<Nft>;
    /**
     * Checks whether NFTs associated with current selectedAddress/chainId combination are still owned by the user
     * And updates the isCurrentlyOwned value on each accordingly.
     * Uses Multicall3 to batch all ownership checks into a single RPC request when available.
     *
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param options - an object of arguments
     * @param options.userAddress - The address of the account where the NFT ownership status is checked/updated.
     */
    checkAndUpdateAllNftsOwnershipStatus(networkClientId: NetworkClientId, { userAddress, }?: {
        userAddress?: string;
    }): Promise<void>;
    /**
     * Update NFT favorite status.
     *
     * @param address - Hex address of the NFT contract.
     * @param tokenId - Hex address of the NFT contract.
     * @param favorite - NFT new favorite status.
     * @param networkClientId - The networkClientId that can be used to identify the network client to use for this request.
     * @param options - an object of arguments
     * @param options.userAddress - The address of the account where the NFT is being removed.
     */
    updateNftFavoriteStatus(address: string, tokenId: string, favorite: boolean, networkClientId: NetworkClientId, { userAddress, }?: {
        userAddress?: string;
    }): void;
    /**
     * Returns an NFT by the address and token id.
     *
     * @param address - Hex address of the NFT contract.
     * @param tokenId - Number that represents the id of the token.
     * @param selectedAddress - Hex address of the user account.
     * @param chainId - Id of the current network.
     * @returns Object containing the NFT and its position in the array
     */
    findNftByAddressAndTokenId(address: string, tokenId: string, selectedAddress: string, chainId: Hex): {
        nft: Nft;
        index: number;
    } | null;
    /**
     * Update NFT data.
     *
     * @param nft - NFT object to find the right NFT to updates.
     * @param updates - NFT partial object to update properties of the NFT.
     * @param selectedAddress - Hex address of the user account.
     * @param chainId - Id of the current network.
     */
    updateNft(nft: Nft, updates: Partial<Nft>, selectedAddress: string, chainId: Hex): void;
    /**
     * Resets the transaction status of an NFT.
     *
     * @param transactionId - NFT transaction id.
     * @param selectedAddress - Hex address of the user account.
     * @param chainId - Id of the current network.
     * @returns a boolean indicating if the reset was well succeeded or not
     */
    resetNftTransactionStatusByTransactionId(transactionId: string, selectedAddress: string, chainId: Hex): boolean;
    _requestApproval(suggestedNftMeta: SuggestedNftMeta): Promise<unknown>;
    /**
     * Reset the controller state to the default state.
     */
    resetState(): void;
}
export default NftController;
