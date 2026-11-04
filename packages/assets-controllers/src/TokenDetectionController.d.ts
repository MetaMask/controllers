import type { AccountsControllerGetSelectedAccountAction, AccountsControllerGetAccountAction, AccountsControllerSelectedEvmAccountChangeEvent } from '@metamask/accounts-controller';
import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { KeyringControllerGetStateAction, KeyringControllerLockEvent, KeyringControllerUnlockEvent } from '@metamask/keyring-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkControllerFindNetworkClientIdByChainIdAction, NetworkControllerGetNetworkClientByIdAction, NetworkControllerGetNetworkConfigurationByNetworkClientIdAction, NetworkControllerGetStateAction, NetworkControllerNetworkDidChangeEvent } from '@metamask/network-controller';
import type { PreferencesControllerGetStateAction, PreferencesControllerStateChangeEvent } from '@metamask/preferences-controller';
import type { AuthenticationController } from '@metamask/profile-sync-controller';
import type { TransactionControllerTransactionConfirmedEvent } from '@metamask/transaction-controller';
import type { Hex } from '@metamask/utils';
import type { AssetsContractController } from './AssetsContractController.js';
import type { TokenDetectionControllerMethodActions } from './TokenDetectionController-method-action-types.js';
import type { TokenListMap } from './TokenListController.js';
import type { TokenListService } from './TokenListService.js';
import type { TokensControllerAddDetectedTokensAction, TokensControllerAddTokensAction } from './TokensController-method-action-types.js';
import type { TokensControllerGetStateAction } from './TokensController.js';
type TokenDetectionMap = {
    [P in keyof TokenListMap]: Omit<TokenListMap[P], 'occurrences'>;
};
export declare const STATIC_MAINNET_TOKEN_LIST: TokenDetectionMap;
export declare const controllerName = "TokenDetectionController";
export type TokenDetectionState = Record<never, never>;
export type TokenDetectionControllerGetStateAction = ControllerGetStateAction<typeof controllerName, TokenDetectionState>;
export type TokenDetectionControllerActions = TokenDetectionControllerGetStateAction | TokenDetectionControllerMethodActions;
export type AllowedActions = AccountsControllerGetSelectedAccountAction | AccountsControllerGetAccountAction | NetworkControllerGetNetworkClientByIdAction | NetworkControllerGetNetworkConfigurationByNetworkClientIdAction | NetworkControllerGetStateAction | KeyringControllerGetStateAction | PreferencesControllerGetStateAction | TokensControllerGetStateAction | TokensControllerAddDetectedTokensAction | TokensControllerAddTokensAction | NetworkControllerFindNetworkClientIdByChainIdAction | AuthenticationController.AuthenticationControllerGetBearerTokenAction;
export type TokenDetectionControllerStateChangeEvent = ControllerStateChangeEvent<typeof controllerName, TokenDetectionState>;
export type TokenDetectionControllerEvents = TokenDetectionControllerStateChangeEvent;
export type AllowedEvents = AccountsControllerSelectedEvmAccountChangeEvent | NetworkControllerNetworkDidChangeEvent | KeyringControllerLockEvent | KeyringControllerUnlockEvent | PreferencesControllerStateChangeEvent | TransactionControllerTransactionConfirmedEvent;
export type TokenDetectionControllerMessenger = Messenger<typeof controllerName, TokenDetectionControllerActions | AllowedActions, TokenDetectionControllerEvents | AllowedEvents>;
/** The input to start polling for the {@link TokenDetectionController} */
type TokenDetectionPollingInput = {
    chainIds: Hex[];
    address: string;
};
declare const TokenDetectionController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: TokenDetectionPollingInput) => void>>;
    _executePoll(input: TokenDetectionPollingInput): Promise<void>;
    startPolling(input: TokenDetectionPollingInput): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: TokenDetectionPollingInput): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: TokenDetectionPollingInput, callback: (input: TokenDetectionPollingInput) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
/**
 * Controller that passively polls on a set interval for Tokens auto detection
 *
 * intervalId - Polling interval used to fetch new token rates
 *
 * selectedAddress - Vault selected address
 *
 * networkClientId - The network client ID of the current selected network
 *
 * disabled - Boolean to track if network requests are blocked
 *
 * isUnlocked - Boolean to track if the keyring state is unlocked
 *
 * isDetectionEnabledFromPreferences - Boolean to track if detection is enabled from PreferencesController
 *
 */
export declare class TokenDetectionController extends TokenDetectionController_base<typeof controllerName, TokenDetectionState, TokenDetectionControllerMessenger> {
    #private;
    /**
     * Creates a TokenDetectionController instance.
     *
     * @param options - The controller options.
     * @param options.messenger - The controller messenger.
     * @param options.tokenListService - Shared service for fetching the token list per chain.
     * @param options.disabled - If set to true, all network requests are blocked.
     * @param options.interval - Polling interval used to fetch new token rates
     * @param options.getBalancesInSingleCall - Gets the balances of a list of tokens for the given address.
     * @param options.trackMetaMetricsEvent - Sets options for MetaMetrics event tracking.
     * @param options.useTokenDetection - Feature Switch for using token detection (default: true)
     * @param options.useExternalServices - Feature Switch for using external services (default: false)
     * @param options.isDeprecated - Optional callback that disables token detection when it returns true.
     */
    constructor({ interval, disabled, getBalancesInSingleCall, trackMetaMetricsEvent, messenger, tokenListService, useTokenDetection, useExternalServices, isDeprecated, }: {
        interval?: number;
        disabled?: boolean;
        getBalancesInSingleCall: AssetsContractController['getBalancesInSingleCall'];
        trackMetaMetricsEvent: (options: {
            event: string;
            category: string;
            properties: {
                tokens: string[];
                token_standard: string;
                asset_type: string;
            };
        }) => void;
        messenger: TokenDetectionControllerMessenger;
        tokenListService: TokenListService;
        useTokenDetection?: () => boolean;
        useExternalServices?: () => boolean;
        isDeprecated?: () => boolean;
    });
    /**
     * Allows controller to make active and passive polling requests
     */
    enable(): void;
    /**
     * Blocks controller from making network calls
     */
    disable(): void;
    /**
     * Internal isActive state
     *
     * @returns Whether the controller is active (not disabled and keyring is unlocked)
     */
    get isActive(): boolean;
    /**
     * Start polling for detected tokens.
     */
    start(): Promise<void>;
    /**
     * Stop polling for detected tokens.
     */
    stop(): void;
    _executePoll({ chainIds, address, }: TokenDetectionPollingInput): Promise<void>;
    /**
     * For each token in the token list provided by the TokenListService, checks the token's balance for the selected account address on the active network.
     * On mainnet, if token detection is disabled in preferences, ERC20 token auto detection will be triggered for each contract address in the legacy token list from the @metamask/contract-metadata repo.
     *
     * @param options - Options for token detection.
     * @param options.chainIds - The chain IDs of the network client to use.
     * @param options.selectedAddress - the selectedAddress against which to detect for token balances.
     * @param options.forceRpc - Force RPC-based token detection for all specified chains,
     * bypassing external services check and ensuring RPC is used even for chains
     * that might otherwise be handled by the Accounts API.
     */
    detectTokens({ chainIds, selectedAddress, forceRpc, }?: {
        chainIds?: Hex[];
        selectedAddress?: string;
        forceRpc?: boolean;
    }): Promise<void>;
    /**
     * Add tokens detected from websocket balance updates
     * This method:
     * - Checks if useTokenDetection preference is enabled (skips if disabled)
     * - Checks if external services are enabled (skips if disabled)
     * - Tokens are expected to be in the tokensChainsCache with full metadata
     * - Balance fetching is skipped since balances are provided by the websocket
     * - Ignored tokens have been filtered out by the caller
     *
     * @param options - The options object
     * @param options.tokensSlice - Array of token addresses detected from websocket (already filtered to exclude ignored tokens)
     * @param options.chainId - Hex chain ID
     * @returns Promise that resolves when tokens are added
     */
    addDetectedTokensViaWs({ tokensSlice, chainId, }: {
        tokensSlice: string[];
        chainId: Hex;
    }): Promise<void>;
    /**
     * Add tokens detected from polling balance updates
     * This method:
     * - Checks if useTokenDetection preference is enabled (skips if disabled)
     * - Checks if external services are enabled (skips if disabled)
     * - Filters out tokens already in allTokens or allIgnoredTokens
     * - Tokens are expected to be in the tokensChainsCache with full metadata
     * - Balance fetching is skipped since balances are provided by the caller
     *
     * @param options - The options object
     * @param options.tokensSlice - Array of token addresses detected from polling
     * @param options.chainId - Hex chain ID
     * @returns Promise that resolves when tokens are added
     */
    addDetectedTokensViaPolling({ tokensSlice, chainId, }: {
        tokensSlice: string[];
        chainId: Hex;
    }): Promise<void>;
}
export default TokenDetectionController;
