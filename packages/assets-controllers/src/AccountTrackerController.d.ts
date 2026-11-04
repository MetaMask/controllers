import type { AccountsControllerSelectedEvmAccountChangeEvent, AccountsControllerGetSelectedAccountAction, AccountsControllerListAccountsAction } from '@metamask/accounts-controller';
import type { ControllerStateChangeEvent, ControllerGetStateAction } from '@metamask/base-controller';
import type { KeyringControllerGetStateAction, KeyringControllerLockEvent, KeyringControllerUnlockEvent } from '@metamask/keyring-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkClientId, NetworkControllerGetNetworkClientByIdAction, NetworkControllerGetStateAction, NetworkControllerNetworkAddedEvent } from '@metamask/network-controller';
import type { NetworkEnablementControllerGetStateAction, NetworkEnablementControllerListPopularEvmNetworksAction } from '@metamask/network-enablement-controller';
import type { TransactionControllerTransactionConfirmedEvent, TransactionControllerUnapprovedTransactionAddedEvent } from '@metamask/transaction-controller';
import type { Hex } from '@metamask/utils';
import type { AccountTrackerControllerMethodActions } from './AccountTrackerController-method-action-types.js';
import type { AssetsContractController, StakedBalance } from './AssetsContractController.js';
/**
 * The name of the {@link AccountTrackerController}.
 */
declare const controllerName = "AccountTrackerController";
export type ChainIdHex = Hex;
export type ChecksumAddress = Hex;
/**
 * AccountInformation
 *
 * Account information object
 *
 * balance - Hex string of an account balance in wei
 *
 * stakedBalance - Hex string of an account staked balance in wei
 */
export type AccountInformation = {
    balance: string;
    stakedBalance?: string;
};
/**
 * AccountTrackerControllerState
 *
 * Account tracker controller state
 *
 * accountsByChainId - Map of addresses to account information by chain
 */
export type AccountTrackerControllerState = {
    accountsByChainId: Record<string, {
        [address: string]: AccountInformation;
    }>;
};
/**
 * The action that can be performed to get the state of the {@link AccountTrackerController}.
 */
export type AccountTrackerControllerGetStateAction = ControllerGetStateAction<typeof controllerName, AccountTrackerControllerState>;
/**
 * The actions that can be performed using the {@link AccountTrackerController}.
 */
export type AccountTrackerControllerActions = AccountTrackerControllerGetStateAction | AccountTrackerControllerMethodActions;
/**
 * The messenger of the {@link AccountTrackerController} for communication.
 */
export type AllowedActions = AccountsControllerListAccountsAction | {
    type: 'PreferencesController:getState';
    handler: () => {
        isMultiAccountBalancesEnabled: boolean;
    };
} | AccountsControllerGetSelectedAccountAction | NetworkControllerGetStateAction | NetworkControllerGetNetworkClientByIdAction | NetworkEnablementControllerGetStateAction | NetworkEnablementControllerListPopularEvmNetworksAction | KeyringControllerGetStateAction;
/**
 * The event that {@link AccountTrackerController} can emit.
 */
export type AccountTrackerControllerStateChangeEvent = ControllerStateChangeEvent<typeof controllerName, AccountTrackerControllerState>;
/**
 * The events that {@link AccountTrackerController} can emit.
 */
export type AccountTrackerControllerEvents = AccountTrackerControllerStateChangeEvent;
/**
 * The external events available to the {@link AccountTrackerController}.
 */
export type AllowedEvents = AccountsControllerSelectedEvmAccountChangeEvent | TransactionControllerUnapprovedTransactionAddedEvent | TransactionControllerTransactionConfirmedEvent | NetworkControllerNetworkAddedEvent | KeyringControllerLockEvent | KeyringControllerUnlockEvent;
/**
 * The messenger of the {@link AccountTrackerController}.
 */
export type AccountTrackerControllerMessenger = Messenger<typeof controllerName, AccountTrackerControllerActions | AllowedActions, AccountTrackerControllerEvents | AllowedEvents>;
/** The input to start polling for the {@link AccountTrackerController} */
type AccountTrackerPollingInput = {
    networkClientIds: NetworkClientId[];
    queryAllAccounts?: boolean;
};
declare const AccountTrackerController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: AccountTrackerPollingInput) => void>>;
    _executePoll(input: AccountTrackerPollingInput): Promise<void>;
    startPolling(input: AccountTrackerPollingInput): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: AccountTrackerPollingInput): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: AccountTrackerPollingInput, callback: (input: AccountTrackerPollingInput) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
/**
 * Controller that tracks the network balances for all user accounts.
 */
export declare class AccountTrackerController extends AccountTrackerController_base<typeof controllerName, AccountTrackerControllerState, AccountTrackerControllerMessenger> {
    #private;
    /**
     * Creates an AccountTracker instance.
     *
     * @param options - The controller options.
     * @param options.interval - Polling interval used to fetch new account balances.
     * @param options.state - Initial state to set on this controller.
     * @param options.messenger - The controller messenger.
     * @param options.getStakedBalanceForChain - The function to get the staked native asset balance for a chain.
     * @param options.includeStakedAssets - Whether to include staked assets in the account balances.
     * @param options.accountsApiChainIds - Function that returns array of chainIds that should use Accounts-API strategy (if supported by API).
     * @param options.allowExternalServices - Disable external HTTP calls (privacy / offline mode).
     * @param options.fetchingEnabled - Function that returns whether the controller is fetching enabled.
     * @param options.isOnboarded - Whether the user has completed onboarding. If false, balance updates are skipped.
     * @param options.isHomepageSectionsV1Enabled - Whether the homepage sections v1 is enabled.
     * @param options.isDeprecated - Optional function that returns true to completely
     * disable this controller (no requests, no state updates). When it returns
     * `true`, `accountsByChainId` is reset to `{}` at construction and at every
     * entry point, so no stale balances remain in state. The function is evaluated
     * dynamically on each entry point so it can be toggled at runtime. Intended for
     * use when a higher-level controller (e.g. AssetsController) supersedes this one.
     */
    constructor({ interval, state, messenger, getStakedBalanceForChain, includeStakedAssets, accountsApiChainIds, allowExternalServices, fetchingEnabled, isOnboarded, isHomepageSectionsV1Enabled, isDeprecated, }: {
        interval?: number;
        state?: Partial<AccountTrackerControllerState>;
        messenger: AccountTrackerControllerMessenger;
        getStakedBalanceForChain: AssetsContractController['getStakedBalanceForChain'];
        includeStakedAssets?: boolean;
        accountsApiChainIds?: () => ChainIdHex[];
        isHomepageSectionsV1Enabled?: () => boolean;
        allowExternalServices?: () => boolean;
        fetchingEnabled?: () => boolean;
        isOnboarded?: () => boolean;
        isDeprecated?: () => boolean;
    });
    /**
     * Whether the controller is active (keyring is unlocked and user is onboarded).
     * When locked or not onboarded, balance updates should be skipped.
     *
     * @returns Whether the controller should perform balance updates.
     */
    get isActive(): boolean;
    /**
     * Refreshes the balances of the accounts using the networkClientId
     *
     * @param input - The input for the poll.
     * @param input.networkClientIds - The network client IDs used to get balances.
     * @param input.queryAllAccounts - Whether to query all accounts or just the selected account
     */
    _executePoll({ networkClientIds, queryAllAccounts, }: AccountTrackerPollingInput): Promise<void>;
    /**
     * Refreshes the balances of the accounts depending on the multi-account setting.
     * If multi-account is disabled, only updates the selected account balance.
     * If multi-account is enabled, updates balances for all accounts.
     *
     * @param networkClientIds - Optional network client IDs to fetch a network client with
     * @param queryAllAccounts - Whether to query all accounts or just the selected account
     */
    refresh(networkClientIds: NetworkClientId[], queryAllAccounts?: boolean): Promise<void>;
    refreshAddresses({ networkClientIds, addresses, }: {
        networkClientIds: NetworkClientId[];
        addresses: string[];
    }): Promise<void>;
    /**
     * Sync accounts balances with some additional addresses.
     *
     * @param addresses - the additional addresses, may be hardware wallet addresses.
     * @param networkClientId - Optional networkClientId to fetch a network client with.
     * @returns accounts - addresses with synced balance
     */
    syncBalanceWithAddresses(addresses: string[], networkClientId?: NetworkClientId): Promise<Record<string, {
        balance: string;
        stakedBalance?: StakedBalance;
    }>>;
    /**
     * Updates the balances of multiple native tokens in a single batch operation.
     * This is more efficient than calling updateNativeToken multiple times as it
     * triggers only one state update.
     *
     * @param balances - Array of balance updates, each containing address, chainId, and balance.
     */
    updateNativeBalances(balances: {
        address: string;
        chainId: Hex;
        balance: Hex;
    }[]): void;
    /**
     * Updates the staked balances of multiple accounts in a single batch operation.
     * This is more efficient than updating staked balances individually as it
     * triggers only one state update.
     *
     * @param stakedBalances - Array of staked balance updates, each containing address, chainId, and stakedBalance.
     */
    updateStakedBalances(stakedBalances: {
        address: string;
        chainId: Hex;
        stakedBalance: StakedBalance;
    }[]): void;
}
export default AccountTrackerController;
