import type { AccountsControllerListMultichainAccountsAction, AccountsControllerAccountAddedEvent, AccountsControllerGetSelectedMultichainAccountAction } from '@metamask/accounts-controller';
import type { ControllerStateChangeEvent, ControllerGetStateAction } from '@metamask/base-controller';
import type { CaipAssetType } from '@metamask/keyring-api';
import type { KeyringControllerLockEvent, KeyringControllerUnlockEvent } from '@metamask/keyring-controller';
import type { InternalAccount } from '@metamask/keyring-internal-api';
import type { Messenger } from '@metamask/messenger';
import type { SnapControllerHandleRequestAction } from '@metamask/snaps-controllers';
import type { AssetConversion, HistoricalPriceIntervals, FungibleAssetMarketData } from '@metamask/snaps-sdk';
import type { CurrencyRateStateChange, CurrencyRateControllerGetStateAction } from '../CurrencyRateController.js';
import type { MultichainAssetsControllerGetStateAction, MultichainAssetsControllerAccountAssetListUpdatedEvent } from '../MultichainAssetsController/index.js';
import type { MultichainAssetsRatesControllerMethodActions } from './MultichainAssetsRatesController-method-action-types.js';
/**
 * The name of the MultichainAssetsRatesController.
 */
declare const controllerName = "MultichainAssetsRatesController";
type HistoricalPrice = {
    intervals: HistoricalPriceIntervals;
    updateTime: number;
    expirationTime?: number;
};
/**
 * State used by the MultichainAssetsRatesController to cache token conversion rates.
 */
export type MultichainAssetsRatesControllerState = {
    conversionRates: Record<CaipAssetType, UnifiedAssetConversion>;
    historicalPrices: Record<CaipAssetType, Record<string, HistoricalPrice>>;
};
/**
 * Returns the state of the MultichainAssetsRatesController.
 */
export type MultichainAssetsRatesControllerGetStateAction = ControllerGetStateAction<typeof controllerName, MultichainAssetsRatesControllerState>;
type UnifiedAssetConversion = AssetConversion & {
    marketData?: FungibleAssetMarketData;
};
/**
 * Constructs the default {@link MultichainAssetsRatesController} state. This allows
 * consumers to provide a partial state object when initializing the controller
 * and also helps in constructing complete state objects for this controller in
 * tests.
 *
 * @returns The default {@link MultichainAssetsRatesController} state.
 */
export declare function getDefaultMultichainAssetsRatesControllerState(): MultichainAssetsRatesControllerState;
/**
 * Event emitted when the state of the MultichainAssetsRatesController changes.
 */
export type MultichainAssetsRatesControllerStateChange = ControllerStateChangeEvent<typeof controllerName, MultichainAssetsRatesControllerState>;
/**
 * Actions exposed by the MultichainAssetsRatesController.
 */
export type MultichainAssetsRatesControllerActions = MultichainAssetsRatesControllerGetStateAction | MultichainAssetsRatesControllerMethodActions;
/**
 * Events emitted by MultichainAssetsRatesController.
 */
export type MultichainAssetsRatesControllerEvents = MultichainAssetsRatesControllerStateChange;
/**
 * Actions that this controller is allowed to call.
 */
export type AllowedActions = SnapControllerHandleRequestAction | AccountsControllerListMultichainAccountsAction | CurrencyRateControllerGetStateAction | MultichainAssetsControllerGetStateAction | AccountsControllerGetSelectedMultichainAccountAction;
/**
 * Events that this controller is allowed to subscribe to.
 */
export type AllowedEvents = KeyringControllerLockEvent | KeyringControllerUnlockEvent | AccountsControllerAccountAddedEvent | CurrencyRateStateChange | MultichainAssetsControllerAccountAssetListUpdatedEvent;
/**
 * Messenger type for the MultichainAssetsRatesController.
 */
export type MultichainAssetsRatesControllerMessenger = Messenger<typeof controllerName, MultichainAssetsRatesControllerActions | AllowedActions, MultichainAssetsRatesControllerEvents | AllowedEvents>;
/**
 * The input for starting polling in MultichainAssetsRatesController.
 */
export type MultichainAssetsRatesPollingInput = {
    accountId: string;
};
export type ConversionRatesWithMarketData = {
    conversionRates: Record<CaipAssetType, Record<CaipAssetType, UnifiedAssetConversion | null>>;
};
declare const MultichainAssetsRatesController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: MultichainAssetsRatesPollingInput) => void>>;
    _executePoll(input: MultichainAssetsRatesPollingInput): Promise<void>;
    startPolling(input: MultichainAssetsRatesPollingInput): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: MultichainAssetsRatesPollingInput): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: MultichainAssetsRatesPollingInput, callback: (input: MultichainAssetsRatesPollingInput) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
/**
 * Controller that manages multichain token conversion rates.
 *
 * This controller polls for token conversion rates and updates its state.
 */
export declare class MultichainAssetsRatesController extends MultichainAssetsRatesController_base<typeof controllerName, MultichainAssetsRatesControllerState, MultichainAssetsRatesControllerMessenger> {
    #private;
    /**
     * Creates an instance of MultichainAssetsRatesController.
     *
     * @param options - Constructor options.
     * @param options.interval - The polling interval in milliseconds.
     * @param options.state - The initial state.
     * @param options.messenger - A reference to the messenger.
     * @param options.isDeprecated - Optional function that returns true to completely
     * disable this controller (no requests, no state updates). When it returns
     * `true`, `conversionRates` and `historicalPrices` are reset to `{}` at
     * construction and at every polling entry point, so no stale rates remain in
     * state. The function is evaluated dynamically on each entry point so it can
     * be toggled at runtime. Intended for use when a higher-level controller
     * (e.g. AssetsController) supersedes this one.
     */
    constructor({ interval, state, messenger, isDeprecated, }: {
        interval?: number;
        state?: Partial<MultichainAssetsRatesControllerState>;
        messenger: MultichainAssetsRatesControllerMessenger;
        isDeprecated?: () => boolean;
    });
    /**
     * Executes a poll by updating token conversion rates for the current account.
     *
     * @returns A promise that resolves when the polling completes.
     */
    _executePoll(): Promise<void>;
    /**
     * Determines whether the controller is active.
     *
     * @returns True if the keyring is unlocked; otherwise, false.
     */
    get isActive(): boolean;
    /**
     * Updates token conversion rates for each non-EVM account.
     *
     * @returns A promise that resolves when the rates are updated.
     */
    updateAssetsRates(): Promise<void>;
    /**
     * Fetches historical prices for the current account
     *
     * @param asset - The asset to fetch historical prices for.
     * @param account - optional account to fetch historical prices for
     * @returns The historical prices.
     */
    fetchHistoricalPricesForAsset(asset: CaipAssetType, account?: InternalAccount): Promise<void>;
}
export {};
