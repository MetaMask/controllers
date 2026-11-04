import type { AccountsControllerGetSelectedAccountAction, AccountsControllerListAccountsAction, AccountsControllerSelectedEvmAccountChangeEvent } from '@metamask/accounts-controller';
import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { AccountActivityServiceBalanceUpdatedEvent, AccountActivityServiceStatusChangedEvent } from '@metamask/core-backend';
import type { KeyringControllerAccountRemovedEvent, KeyringControllerGetStateAction, KeyringControllerLockEvent, KeyringControllerUnlockEvent } from '@metamask/keyring-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkControllerGetNetworkClientByIdAction, NetworkControllerGetStateAction, NetworkControllerStateChangeEvent } from '@metamask/network-controller';
import type { PreferencesControllerGetStateAction, PreferencesControllerStateChangeEvent } from '@metamask/preferences-controller';
import type { AuthenticationController } from '@metamask/profile-sync-controller';
import type { TransactionControllerTransactionConfirmedEvent } from '@metamask/transaction-controller';
import type { Hex } from '@metamask/utils';
import type { AccountTrackerControllerUpdateNativeBalancesAction, AccountTrackerControllerUpdateStakedBalancesAction } from './AccountTrackerController-method-action-types.js';
import type { AccountTrackerControllerGetStateAction } from './AccountTrackerController.js';
import type { TokenBalancesControllerMethodActions } from './TokenBalancesController-method-action-types.js';
import type { TokenDetectionControllerAddDetectedTokensViaPollingAction, TokenDetectionControllerAddDetectedTokensViaWsAction, TokenDetectionControllerDetectTokensAction } from './TokenDetectionController-method-action-types.js';
import type { TokensControllerGetStateAction, TokensControllerStateChangeEvent } from './TokensController.js';
export type ChainIdHex = Hex;
export type ChecksumAddress = Hex;
declare const CONTROLLER: 'TokenBalancesController';
/** Debounce wait (ms) for coalescing rapid updateBalances calls before flush */
export declare const UPDATE_BALANCES_BATCH_MS = 200;
export type UpdateBalancesOptions = {
    chainIds?: ChainIdHex[];
    tokenAddresses?: string[];
    queryAllAccounts?: boolean;
};
/**
 * Merges two UpdateBalancesOptions per queue-and-merge rules:
 * - chainIds: union of both lists when each option includes `chainIds`; if either omits `chainIds`, the merged field is undefined (all chains).
 * - tokenAddresses: union of both lists when each option includes `tokenAddresses`; if either omits `tokenAddresses`, the merged field is undefined (all tokens).
 * - queryAllAccounts: true if either is true.
 * Exported for tests.
 *
 * @param a - First options (e.g. accumulated).
 * @param b - Second options to merge in.
 * @returns New merged options.
 */
export declare function mergeUpdateBalancesOptions(a: UpdateBalancesOptions, b: UpdateBalancesOptions): UpdateBalancesOptions;
export type TokenBalances = Record<ChecksumAddress, Record<ChainIdHex, Record<ChecksumAddress, Hex>>>;
export type TokenBalancesControllerState = {
    tokenBalances: TokenBalances;
};
export type TokenBalancesControllerGetStateAction = ControllerGetStateAction<typeof CONTROLLER, TokenBalancesControllerState>;
export type TokenBalancesControllerActions = TokenBalancesControllerGetStateAction | TokenBalancesControllerMethodActions;
export type TokenBalancesControllerStateChangeEvent = ControllerStateChangeEvent<typeof CONTROLLER, TokenBalancesControllerState>;
export type NativeBalanceEvent = {
    type: `${typeof CONTROLLER}:updatedNativeBalance`;
    payload: unknown[];
};
export type TokenBalancesControllerEvents = TokenBalancesControllerStateChangeEvent | NativeBalanceEvent;
export type AllowedActions = NetworkControllerGetNetworkClientByIdAction | NetworkControllerGetStateAction | TokensControllerGetStateAction | TokenDetectionControllerAddDetectedTokensViaPollingAction | TokenDetectionControllerAddDetectedTokensViaWsAction | TokenDetectionControllerDetectTokensAction | PreferencesControllerGetStateAction | AccountsControllerGetSelectedAccountAction | AccountsControllerListAccountsAction | AccountTrackerControllerGetStateAction | AccountTrackerControllerUpdateNativeBalancesAction | AccountTrackerControllerUpdateStakedBalancesAction | KeyringControllerGetStateAction | AuthenticationController.AuthenticationControllerGetBearerTokenAction;
export type AllowedEvents = TokensControllerStateChangeEvent | PreferencesControllerStateChangeEvent | NetworkControllerStateChangeEvent | KeyringControllerAccountRemovedEvent | KeyringControllerLockEvent | KeyringControllerUnlockEvent | AccountActivityServiceBalanceUpdatedEvent | AccountActivityServiceStatusChangedEvent | AccountsControllerSelectedEvmAccountChangeEvent | TransactionControllerTransactionConfirmedEvent;
export type TokenBalancesControllerMessenger = Messenger<typeof CONTROLLER, TokenBalancesControllerActions | AllowedActions, TokenBalancesControllerEvents | AllowedEvents>;
export type ChainPollingConfig = {
    /** Polling interval in milliseconds for this chain */
    interval: number;
};
export type UpdateChainPollingConfigsOptions = {
    /** Whether to immediately fetch balances after updating configs (default: true) */
    immediateUpdate?: boolean;
};
export type TokenBalancesControllerOptions = {
    messenger: TokenBalancesControllerMessenger;
    /** Default interval for chains not specified in chainPollingIntervals */
    interval?: number;
    /** Per-chain polling configuration */
    chainPollingIntervals?: Record<ChainIdHex, ChainPollingConfig>;
    state?: Partial<TokenBalancesControllerState>;
    /** When `true`, balances for *all* known accounts are queried. */
    queryMultipleAccounts?: boolean;
    /** Array of chainIds that should use Accounts-API strategy (if supported by API). */
    accountsApiChainIds?: () => ChainIdHex[];
    /** Disable external HTTP calls (privacy / offline mode). */
    allowExternalServices?: () => boolean;
    /** Custom logger. */
    log?: (...args: unknown[]) => void;
    platform?: 'extension' | 'mobile';
    /** Polling interval when WebSocket is active and providing real-time updates */
    websocketActivePollingInterval?: number;
    /** Whether the user has completed onboarding. If false, balance updates are skipped. */
    isOnboarded?: () => boolean;
    /**
     * Optional function that returns true to completely disable this controller
     * (no requests, no state updates). When it returns `true`, `tokenBalances` is
     * reset to `{}` at construction and at every entry point, so no stale balances
     * remain in state. The function is evaluated dynamically on each entry point so
     * it can be toggled at runtime. Intended for use when a higher-level controller
     * (e.g. AssetsController) supersedes this one.
     */
    isDeprecated?: () => boolean;
};
/**
 * Convert CAIP chain ID or hex chain ID to hex chain ID.
 *
 * @param chainId - CAIP chain ID or hex chain ID.
 * @returns Hex chain ID.
 */
export declare const caipChainIdToHex: (chainId: string) => ChainIdHex;
/**
 * Extract token address from asset type.
 *
 * @param assetType - Asset type string.
 * @returns Tuple of [tokenAddress, isNativeToken] or null if invalid.
 */
export declare const parseAssetType: (assetType: string) => [string, boolean] | null;
declare const TokenBalancesController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: {
        chainIds: ChainIdHex[];
    }) => void>>;
    _executePoll(input: {
        chainIds: ChainIdHex[];
    }): Promise<void>;
    startPolling(input: {
        chainIds: ChainIdHex[];
    }): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: {
        chainIds: ChainIdHex[];
    }): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: {
        chainIds: ChainIdHex[];
    }, callback: (input: {
        chainIds: ChainIdHex[];
    }) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
export declare class TokenBalancesController extends TokenBalancesController_base<typeof CONTROLLER, TokenBalancesControllerState, TokenBalancesControllerMessenger> {
    #private;
    constructor({ messenger, interval, websocketActivePollingInterval, chainPollingIntervals, state, queryMultipleAccounts, accountsApiChainIds, allowExternalServices, platform, isOnboarded, isDeprecated, }: TokenBalancesControllerOptions);
    /**
     * Whether the controller is active (keyring is unlocked and user is onboarded).
     * When locked or not onboarded, balance updates should be skipped.
     *
     * @returns Whether the controller should perform balance updates.
     */
    get isActive(): boolean;
    _startPolling({ chainIds }: {
        chainIds: ChainIdHex[];
    }): void;
    _stopPollingByPollingTokenSetId(tokenSetId: string): void;
    getChainPollingConfig(chainId: ChainIdHex): ChainPollingConfig;
    _executePoll({ chainIds, queryAllAccounts, }: {
        chainIds: ChainIdHex[];
        queryAllAccounts?: boolean;
    }): Promise<void>;
    updateChainPollingConfigs(configs: Record<ChainIdHex, ChainPollingConfig>, options?: UpdateChainPollingConfigsOptions): void;
    updateBalances(options?: UpdateBalancesOptions): Promise<void>;
    resetState(): void;
    destroy(): void;
}
export default TokenBalancesController;
