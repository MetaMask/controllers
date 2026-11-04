import type { AccountsControllerGetSelectedAccountAction } from '@metamask/accounts-controller';
import type { ApprovalControllerAddRequestAction } from '@metamask/approval-controller';
import { BaseController } from '@metamask/base-controller';
import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkClient, NetworkControllerFindNetworkClientIdByChainIdAction, NetworkControllerGetNetworkClientByIdAction, NetworkControllerGetStateAction, NetworkControllerStateChangeEvent } from '@metamask/network-controller';
import type { PreferencesControllerGetStateAction, PreferencesControllerStateChangeEvent } from '@metamask/preferences-controller';
import type { Hex } from '@metamask/utils';
import { Source } from './constants.js';
import type { NftController, NftControllerState } from './NftController.js';
import type { NftDetectionControllerMethodActions } from './NftDetectionController-method-action-types.js';
declare const controllerName = "NftDetectionController";
export type NFTDetectionControllerState = Record<never, never>;
export type NftDetectionControllerActions = ControllerGetStateAction<typeof controllerName, NFTDetectionControllerState> | NftDetectionControllerMethodActions;
export type AllowedActions = ApprovalControllerAddRequestAction | NetworkControllerGetStateAction | NetworkControllerGetNetworkClientByIdAction | PreferencesControllerGetStateAction | AccountsControllerGetSelectedAccountAction | NetworkControllerFindNetworkClientIdByChainIdAction;
export type AllowedEvents = ControllerStateChangeEvent<typeof controllerName, NFTDetectionControllerState> | PreferencesControllerStateChangeEvent | NetworkControllerStateChangeEvent;
export type NftDetectionControllerMessenger = Messenger<typeof controllerName, NftDetectionControllerActions | AllowedActions, AllowedEvents>;
/**
 * @type ApiNft
 *
 * NFT object coming from OpenSea api
 *
 * @property token_id - The NFT identifier
 * @property num_sales - Number of sales
 * @property background_color - The background color to be displayed with the item
 * @property image_url - URI of an image associated with this NFT
 *
 * @property image_preview_url - URI of a smaller image associated with this NFT
 * @property image_thumbnail_url - URI of a thumbnail image associated with this NFT
 * @property image_original_url - URI of the original image associated with this NFT
 * @property animation_url - URI of a animation associated with this NFT
 * @property animation_original_url - URI of the original animation associated with this NFT
 * @property name - The NFT name
 * @property description - The NFT description
 * @property external_link - External link containing additional information
 * @property assetContract - The NFT contract information object
 * @property creator - The NFT owner information object
 * @property lastSale - When this item was last sold
 */
export type ApiNft = {
    token_id: string;
    num_sales: number | null;
    background_color: string | null;
    image_url: string | null;
    image_preview_url: string | null;
    image_thumbnail_url: string | null;
    image_original_url: string | null;
    animation_url: string | null;
    animation_original_url: string | null;
    name: string | null;
    description: string | null;
    external_link: string | null;
    asset_contract: ApiNftContract;
    creator: ApiNftCreator;
    last_sale: ApiNftLastSale | null;
};
/**
 * @type ApiNftContract
 *
 * NFT contract object coming from OpenSea api
 *
 * @property address - Address of the NFT contract
 * @property asset_contract_type - The NFT type, it could be `semi-fungible` or `non-fungible`
 * @property created_date - Creation date
 * @property collection - Object containing the contract name and URI of an image associated
 * @property schema_name - The schema followed by the contract, it could be `ERC721` or `ERC1155`
 * @property symbol - The NFT contract symbol
 * @property total_supply - Total supply of NFTs
 * @property description - The NFT contract description
 * @property external_link - External link containing additional information
 */
export type ApiNftContract = {
    address: string;
    asset_contract_type: string | null;
    created_date: string | null;
    schema_name: string | null;
    symbol: string | null;
    total_supply: string | null;
    description: string | null;
    external_link: string | null;
    collection: {
        name: string | null;
        image_url?: string | null;
        tokenCount?: string | null;
    };
};
/**
 * @type ApiNftLastSale
 *
 * NFT sale object coming from OpenSea api
 *
 * @property event_timestamp - Object containing a `username`
 * @property total_price - URI of NFT image associated with this owner
 * @property transaction - Object containing transaction_hash and block_hash
 */
export type ApiNftLastSale = {
    event_timestamp: string;
    total_price: string;
    transaction: {
        transaction_hash: string;
        block_hash: string;
    };
};
/**
 * @type ApiNftCreator
 *
 * NFT creator object coming from OpenSea api
 *
 * @property user - Object containing a `username`
 * @property profile_img_url - URI of NFT image associated with this owner
 * @property address - The owner address
 */
export type ApiNftCreator = {
    user: {
        username: string;
    };
    profile_img_url: string;
    address: string;
};
export type ReservoirResponse = {
    tokens: TokensResponse[];
    continuation?: string | null;
};
export type TokensResponse = {
    token: TokenResponse;
    ownership: Ownership;
    market?: Market;
    blockaidResult?: Blockaid;
};
export declare enum BlockaidResultType {
    Benign = "Benign",
    Spam = "Spam",
    Warning = "Warning",
    Malicious = "Malicious"
}
export type Blockaid = {
    contract: string;
    chainId: number;
    result_type: BlockaidResultType;
    malicious_score: string;
    attack_types: object;
};
export type Market = {
    floorAsk?: FloorAsk;
    topBid?: TopBid;
};
export type TokenResponse = {
    chainId: number;
    contract: string;
    tokenId: string;
    kind?: string;
    name?: string;
    image?: string;
    imageSmall?: string;
    imageLarge?: string;
    metadata?: Metadata;
    description?: string;
    supply?: number;
    remainingSupply?: number;
    rarityScore?: number;
    rarity?: number;
    rarityRank?: number;
    media?: string;
    isFlagged?: boolean;
    isSpam?: boolean;
    isNsfw?: boolean;
    metadataDisabled?: boolean;
    lastFlagUpdate?: string;
    lastFlagChange?: string;
    collection?: Collection;
    lastSale?: LastSale;
    topBid?: TopBid;
    lastAppraisalValue?: number;
    attributes?: Attributes[];
};
export type TopBid = {
    id?: string;
    price?: Price;
    source?: {
        id?: string;
        domain?: string;
        name?: string;
        icon?: string;
        url?: string;
    };
};
export type LastSale = {
    saleId?: string;
    token?: {
        contract?: string;
        tokenId?: string;
        name?: string;
        image?: string;
        collection?: {
            id?: string;
            name?: string;
        };
    };
    orderSource?: string;
    orderSide?: 'ask' | 'bid';
    orderKind?: string;
    orderId?: string;
    from?: string;
    to?: string;
    amount?: string;
    fillSource?: string;
    block?: number;
    txHash?: string;
    logIndex?: number;
    batchIndex?: number;
    timestamp?: number;
    price?: Price;
    washTradingScore?: number;
    royaltyFeeBps?: number;
    marketplaceFeeBps?: number;
    paidFullRoyalty?: boolean;
    feeBreakdown?: FeeBreakdown[];
    isDeleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
};
export type FeeBreakdown = {
    kind?: string;
    bps?: number;
    recipient?: string;
    source?: string;
    rawAmount?: string;
};
export type Attributes = {
    key?: string;
    kind?: string;
    value: string;
    tokenCount?: number;
    onSaleCount?: number;
    floorAskPrice?: Price | null;
    topBidValue?: number | null;
    createdAt?: string;
};
export type GetCollectionsResponse = {
    collections: CollectionResponse[];
};
export type CollectionResponse = {
    id?: string;
    chainId?: number;
    openseaVerificationStatus?: string;
    contractDeployedAt?: string;
    creator?: string;
    ownerCount?: string;
    topBid?: TopBid & {
        sourceDomain?: string;
    };
};
export type FloorAskCollection = {
    id?: string;
    price?: Price;
    maker?: string;
    kind?: string;
    validFrom?: number;
    validUntil?: number;
    source?: SourceCollection;
    rawData?: Metadata;
    isNativeOffChainCancellable?: boolean;
};
export type SourceCollection = {
    id: string;
    domain: string;
    name: string;
    icon: string;
    url: string;
};
export type TokenCollection = {
    id?: string;
    name?: string;
    slug?: string;
    symbol?: string;
    imageUrl?: string;
    image?: string;
    isSpam?: boolean;
    isNsfw?: boolean;
    creator?: string;
    tokenCount?: string;
    metadataDisabled?: boolean;
    openseaVerificationStatus?: string;
    floorAskPrice?: Price;
    royaltiesBps?: number;
    royalties?: Royalties[];
    floorAsk?: FloorAskCollection;
};
export type Collection = TokenCollection & CollectionResponse;
export type Royalties = {
    bps?: number;
    recipient?: string;
};
export type Ownership = {
    tokenCount?: string;
    onSaleCount?: string;
    floorAsk?: FloorAsk;
    acquiredAt?: string;
};
export type FloorAsk = {
    id?: string;
    price?: Price;
    maker?: string;
    kind?: string;
    validFrom?: number;
    validUntil?: number;
    source?: Source;
    rawData?: Metadata;
    isNativeOffChainCancellable?: boolean;
};
export type Price = {
    currency?: {
        contract?: string;
        name?: string;
        symbol?: string;
        decimals?: number;
        chainId?: number;
    };
    amount?: {
        raw?: string;
        decimal?: number;
        usd?: number;
        native?: number;
    };
    netAmount?: {
        raw?: string;
        decimal?: number;
        usd?: number;
        native?: number;
    };
};
export type Metadata = {
    imageOriginal?: string;
    tokenURI?: string;
};
/**
 * Controller that passively detects nfts for a user address
 */
export declare class NftDetectionController extends BaseController<typeof controllerName, NFTDetectionControllerState, NftDetectionControllerMessenger> {
    #private;
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
    constructor({ messenger, disabled, addNfts, removeNft, getNftState, }: {
        messenger: NftDetectionControllerMessenger;
        disabled: boolean;
        addNfts: NftController['addNfts'];
        removeNft: NftController['removeNft'];
        getNftState: () => NftControllerState;
    });
    /**
     * Checks whether network is mainnet or not.
     *
     * @returns Whether current network is mainnet.
     */
    isMainnet(): boolean;
    isMainnetByNetworkClientId(networkClient: NetworkClient): boolean;
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
    detectNfts(chainIds: Hex[], options?: {
        userAddress?: string;
        firstPageOnly?: boolean;
        signal?: AbortSignal;
    }): Promise<void>;
}
export default NftDetectionController;
