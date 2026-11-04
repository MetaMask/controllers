import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkControllerStateChangeEvent, NetworkState, NetworkControllerGetNetworkClientByIdAction } from '@metamask/network-controller';
import type { StorageServiceSetItemAction, StorageServiceGetItemAction, StorageServiceGetAllKeysAction } from '@metamask/storage-service';
import type { Hex } from '@metamask/utils';
import { TokenRwaData } from './token-service.js';
declare const name = "TokenListController";
export type TokenListToken = {
    name: string;
    symbol: string;
    decimals: number;
    address: string;
    occurrences: number;
    aggregators: string[];
    iconUrl: string;
    rwaData?: TokenRwaData;
};
export type TokenListMap = Record<string, TokenListToken>;
export type DataCache = {
    timestamp: number;
    data: TokenListMap;
};
export type TokensChainsCache = {
    [chainId: Hex]: DataCache;
};
export type TokenListState = {
    tokensChainsCache: TokensChainsCache;
};
export type TokenListStateChange = ControllerStateChangeEvent<typeof name, TokenListState>;
export type TokenListControllerEvents = TokenListStateChange;
export type GetTokenListState = ControllerGetStateAction<typeof name, TokenListState>;
export type TokenListControllerActions = GetTokenListState;
type AllowedActions = NetworkControllerGetNetworkClientByIdAction | StorageServiceSetItemAction | StorageServiceGetItemAction | StorageServiceGetAllKeysAction;
type AllowedEvents = NetworkControllerStateChangeEvent;
export type TokenListControllerMessenger = Messenger<typeof name, TokenListControllerActions | AllowedActions, TokenListControllerEvents | AllowedEvents>;
export declare const getDefaultTokenListState: () => TokenListState;
/** The input to start polling for the {@link TokenListController} */
type TokenListPollingInput = {
    chainId: Hex;
};
declare const TokenListController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: TokenListPollingInput) => void>>;
    _executePoll(input: TokenListPollingInput): Promise<void>;
    startPolling(input: TokenListPollingInput): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: TokenListPollingInput): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: TokenListPollingInput, callback: (input: TokenListPollingInput) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
/**
 * Controller that passively polls on a set interval for the list of tokens from metaswaps api
 */
export declare class TokenListController extends TokenListController_base<typeof name, TokenListState, TokenListControllerMessenger> {
    #private;
    /**
     * Creates a TokenListController instance.
     *
     * @param options - The controller options.
     * @param options.chainId - The chain ID of the current network.
     * @param options.onNetworkStateChange - A function for registering an event handler for network state changes.
     * @param options.interval - The polling interval, in milliseconds.
     * @param options.cacheRefreshThreshold - The token cache expiry time, in milliseconds.
     * @param options.isDeprecated - Optional function returning whether the controller should be disabled.
     * When it returns `true`, `tokensChainsCache` is reset to `{}` at construction and at every
     * polling entry point, no fetches are issued, and persisted storage is cleared on initialize.
     * The function is evaluated dynamically on each entry point so it can be toggled at runtime.
     * @param options.messenger - A restricted messenger.
     * @param options.state - Initial state to set on this controller.
     */
    constructor({ chainId, onNetworkStateChange, interval, cacheRefreshThreshold, isDeprecated, messenger, state, }: {
        chainId: Hex;
        onNetworkStateChange?: (listener: (networkState: NetworkState) => void) => void;
        interval?: number;
        cacheRefreshThreshold?: number;
        isDeprecated?: () => boolean;
        messenger: TokenListControllerMessenger;
        state?: Partial<TokenListState>;
    });
    /**
     * Initialize the controller by loading cache from storage and running migration.
     * This method should be called by clients after construction.
     *
     * @returns A promise that resolves when initialization is complete.
     */
    initialize(): Promise<void>;
    /**
     * Start polling for the token list.
     *
     * @deprecated This method is deprecated and will be removed in the future.
     * Consider using the new polling approach instead
     */
    start(): Promise<void>;
    /**
     * Restart polling for the token list.
     *
     * @deprecated This method is deprecated and will be removed in the future.
     * Consider using the new polling approach instead
     */
    restart(): Promise<void>;
    /**
     * Stop polling for the token list.
     *
     * @deprecated This method is deprecated and will be removed in the future.
     * Consider using the new polling approach instead
     */
    stop(): void;
    /**
     * This stops any active polling.
     *
     * @deprecated This method is deprecated and will be removed in the future.
     * Consider using the new polling approach instead
     */
    destroy(): void;
    /**
     * This starts a new polling loop for any given chain. Under the hood it is deduping polls
     *
     * @param input - The input for the poll.
     * @param input.chainId - The chainId of the chain to trigger the fetch.
     * @returns A promise that resolves when this operation completes.
     */
    _executePoll({ chainId }: TokenListPollingInput): Promise<void>;
    /**
     * Fetching token list from the Token Service API. This will fetch tokens across chains.
     * State changes are automatically persisted via the stateChange subscription.
     *
     * @param chainId - The chainId of the current chain triggering the fetch.
     */
    fetchTokenList(chainId: Hex): Promise<void>;
    isCacheValid(chainId: Hex): boolean;
}
export default TokenListController;
