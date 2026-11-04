import type { AccountsControllerGetAccountAction, AccountsControllerGetSelectedAccountAction, AccountsControllerListAccountsAction, AccountsControllerSelectedEvmAccountChangeEvent } from '@metamask/accounts-controller';
import type { ApprovalControllerAddRequestAction } from '@metamask/approval-controller';
import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type { KeyringControllerAccountRemovedEvent } from '@metamask/keyring-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkClientId, NetworkControllerGetNetworkClientByIdAction, NetworkControllerNetworkDidChangeEvent, NetworkControllerStateChangeEvent, Provider } from '@metamask/network-controller';
import type { Hex, Json } from '@metamask/utils';
import { TokenRwaData } from './token-service.js';
import type { TokenListService } from './TokenListService.js';
import type { Token } from './TokenRatesController.js';
import type { TokensControllerMethodActions } from './TokensController-method-action-types.js';
type WatchAssetRequestMetadata = {
    origin?: string;
    pageMeta?: Record<string, Json>;
};
/**
 * @type TokensControllerState
 *
 * Assets controller state
 *
 * @property allTokens - Object containing tokens by network and account
 * @property allIgnoredTokens - Object containing hidden/ignored tokens by network and account
 * @property allDetectedTokens - Object containing tokens detected with non-zero balances
 */
export type TokensControllerState = {
    allTokens: {
        [chainId: Hex]: {
            [key: string]: Token[];
        };
    };
    allIgnoredTokens: {
        [chainId: Hex]: {
            [key: string]: string[];
        };
    };
    allDetectedTokens: {
        [chainId: Hex]: {
            [key: string]: Token[];
        };
    };
};
declare const controllerName = "TokensController";
export type TokensControllerGetStateAction = ControllerGetStateAction<typeof controllerName, TokensControllerState>;
export type TokensControllerActions = TokensControllerGetStateAction | TokensControllerMethodActions;
/**
 * The external actions available to the {@link TokensController}.
 */
export type AllowedActions = ApprovalControllerAddRequestAction | NetworkControllerGetNetworkClientByIdAction | AccountsControllerGetAccountAction | AccountsControllerGetSelectedAccountAction | AccountsControllerListAccountsAction;
export type TokensControllerStateChangeEvent = ControllerStateChangeEvent<typeof controllerName, TokensControllerState>;
export type TokensControllerEvents = TokensControllerStateChangeEvent;
export type AllowedEvents = NetworkControllerStateChangeEvent | NetworkControllerNetworkDidChangeEvent | AccountsControllerSelectedEvmAccountChangeEvent | KeyringControllerAccountRemovedEvent;
/**
 * The messenger of the {@link TokensController}.
 */
export type TokensControllerMessenger = Messenger<typeof controllerName, TokensControllerActions | AllowedActions, TokensControllerEvents | AllowedEvents>;
export declare const getDefaultTokensState: () => TokensControllerState;
/**
 * Controller that stores assets and exposes convenience methods
 */
export declare class TokensController extends BaseController<typeof controllerName, TokensControllerState, TokensControllerMessenger> {
    #private;
    /**
     * Tokens controller options
     *
     * @param options - Constructor options.
     * @param options.chainId - The chain ID of the current network.
     * @param options.provider - Network provider.
     * @param options.state - Initial state to set on this controller.
     * @param options.messenger - The messenger.
     * @param options.tokenListService - Shared service for fetching token metadata per chain.
     * @param options.isDeprecated - Optional function that returns true to completely
     * disable this controller (no requests, no state updates). When it returns
     * `true`, `allTokens`, `allIgnoredTokens`, and `allDetectedTokens` are reset to
     * `{}` at construction and at every entry point, so no stale token data remains
     * in state. The function is evaluated dynamically on each entry point so it can
     * be toggled at runtime. Intended for use when a higher-level controller
     * (e.g. AssetsController) supersedes this one.
     */
    constructor({ provider, state, messenger, tokenListService, isDeprecated, }: {
        chainId: Hex;
        provider: Provider;
        state?: Partial<TokensControllerState>;
        messenger: TokensControllerMessenger;
        tokenListService: TokenListService;
        isDeprecated?: () => boolean;
    });
    /**
     * Adds a token to the stored token list.
     *
     * @param options - The method argument object.
     * @param options.address - Hex address of the token contract.
     * @param options.symbol - Symbol of the token.
     * @param options.decimals - Number of decimals the token uses.
     * @param options.name - Name of the token.
     * @param options.image - Image of the token.
     * @param options.interactingAddress - The address of the account to add a token to.
     * @param options.networkClientId - Network Client ID.
     * @param options.rwaData - Optional RWA data for the token.
     * @returns Current token list.
     */
    addToken({ address, symbol, decimals, name, image, interactingAddress, networkClientId, rwaData, }: {
        address: string;
        symbol: string;
        decimals: number;
        name?: string;
        image?: string;
        interactingAddress?: string;
        networkClientId: NetworkClientId;
        rwaData?: TokenRwaData;
    }): Promise<Token[]>;
    /**
     * Add a batch of tokens.
     *
     * @param tokensToImport - Array of tokens to import.
     * @param networkClientId - Optional network client ID used to determine interacting chain ID.
     */
    addTokens(tokensToImport: Token[], networkClientId: NetworkClientId): Promise<void>;
    /**
     * Ignore a batch of tokens.
     *
     * @param tokenAddressesToIgnore - Array of token addresses to ignore.
     * @param networkClientId - Optional network client ID used to determine interacting chain ID.
     */
    ignoreTokens(tokenAddressesToIgnore: string[], networkClientId: NetworkClientId): void;
    /**
     * Adds a batch of detected tokens to the stored token list.
     *
     * @param incomingDetectedTokens - Array of detected tokens to be added or updated.
     * @param detectionDetails - An object containing the chain ID and address of the currently selected network on which the incomingDetectedTokens were detected.
     * @param detectionDetails.selectedAddress - the account address on which the incomingDetectedTokens were detected.
     * @param detectionDetails.chainId - the chainId on which the incomingDetectedTokens were detected.
     */
    addDetectedTokens(incomingDetectedTokens: Token[], detectionDetails: {
        selectedAddress?: string;
        chainId: Hex;
    }): Promise<void>;
    /**
     * Adds isERC721 field to token object. This is called when a user attempts to add tokens that
     * were previously added which do not yet had isERC721 field.
     *
     * @param tokenAddress - The contract address of the token requiring the isERC721 field added.
     * @param networkClientId - The network client ID of the network on which the token is detected.
     * @returns The new token object with the added isERC721 field.
     */
    updateTokenType(tokenAddress: string, networkClientId: NetworkClientId): Promise<Token>;
    /**
     * Adds a new suggestedAsset to the list of watched assets.
     * Parameters will be validated according to the asset type being watched.
     *
     * @param options - The method options.
     * @param options.asset - The asset to be watched. For now only ERC20 tokens are accepted.
     * @param options.type - The asset type.
     * @param options.interactingAddress - The address of the account that is requesting to watch the asset.
     * @param options.networkClientId - Network Client ID.
     * @param options.origin - The origin to set on the approval request.
     * @param options.pageMeta - The metadata for the page initiating the request.
     * @param options.requestMetadata - Metadata for the request, including pageMeta and origin.
     * @returns A promise that resolves if the asset was watched successfully, and rejects otherwise.
     */
    watchAsset({ asset, type, interactingAddress, networkClientId, origin, pageMeta, requestMetadata, }: {
        asset: Token;
        type: string;
        interactingAddress?: string;
        networkClientId: NetworkClientId;
        origin?: string;
        pageMeta?: Record<string, Json>;
        requestMetadata?: WatchAssetRequestMetadata;
    }): Promise<void>;
    /**
     * Removes all tokens from the ignored list.
     */
    clearIgnoredTokens(): void;
    /**
     * Reset the controller state to the default state.
     */
    resetState(): void;
}
export default TokensController;
