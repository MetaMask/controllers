import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkControllerGetNetworkClientByIdAction, NetworkControllerGetStateAction } from '@metamask/network-controller';
import type { CurrencyRateControllerMethodActions } from './CurrencyRateController-method-action-types.js';
import type { AbstractTokenPricesService } from './token-prices-service/abstract-token-prices-service.js';
/**
 * currencyRates - Object keyed by native currency
 *
 * currencyRates.conversionDate - Timestamp of conversion rate expressed in ms since UNIX epoch
 *
 * currencyRates.conversionRate - Conversion rate from current base asset to the current currency
 *
 * currentCurrency - Currently-active ISO 4217 currency code
 *
 * usdConversionRate - Conversion rate from usd to the current currency
 */
export type CurrencyRateState = {
    currentCurrency: string;
    currencyRates: Record<string, {
        conversionDate: number | null;
        conversionRate: number | null;
        usdConversionRate: number | null;
    }>;
};
declare const name = "CurrencyRateController";
export type CurrencyRateStateChange = ControllerStateChangeEvent<typeof name, CurrencyRateState>;
export type CurrencyRateControllerEvents = CurrencyRateStateChange;
export type CurrencyRateControllerGetStateAction = ControllerGetStateAction<typeof name, CurrencyRateState>;
export type CurrencyRateControllerActions = CurrencyRateControllerGetStateAction | CurrencyRateControllerMethodActions;
type AllowedActions = NetworkControllerGetNetworkClientByIdAction | NetworkControllerGetStateAction;
export type CurrencyRateMessenger = Messenger<typeof name, CurrencyRateControllerActions | AllowedActions, CurrencyRateControllerEvents>;
/** The input to start polling for the {@link CurrencyRateController} */
type CurrencyRatePollingInput = {
    nativeCurrencies: string[];
};
declare const CurrencyRateController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: CurrencyRatePollingInput) => void>>;
    _executePoll(input: CurrencyRatePollingInput): Promise<void>;
    startPolling(input: CurrencyRatePollingInput): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: CurrencyRatePollingInput): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: CurrencyRatePollingInput, callback: (input: CurrencyRatePollingInput) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
/**
 * Controller that passively polls on a set interval for an exchange rate from the current network
 * asset to the user's preferred currency.
 */
export declare class CurrencyRateController extends CurrencyRateController_base<typeof name, CurrencyRateState, CurrencyRateMessenger> {
    #private;
    /**
     * Creates a CurrencyRateController instance.
     *
     * @param options - Constructor options.
     * @param options.includeUsdRate - Keep track of the USD rate in addition to the current currency rate.
     * @param options.interval - The polling interval, in milliseconds.
     * @param options.messenger - A reference to the messenger.
     * @param options.state - Initial state to set on this controller.
     * @param options.useExternalServices - Feature Switch for using external services (default: true)
     * @param options.tokenPricesService - An object in charge of retrieving token prices
     * @param options.isDeprecated - Optional function that returns true to completely
     * disable this controller (no requests, no state updates). When it returns
     * `true`, `currencyRates` is reset to `{}` at construction and at every entry point,
     * so no stale rates remain in state. The function is evaluated dynamically
     * on each entry point so it can be toggled at runtime. Intended for use when
     * a higher-level controller (e.g. AssetsController) supersedes this one.
     */
    constructor({ includeUsdRate, interval, useExternalServices, isDeprecated, messenger, state, tokenPricesService, }: {
        includeUsdRate?: boolean;
        interval?: number;
        messenger: CurrencyRateMessenger;
        state?: Partial<CurrencyRateState>;
        useExternalServices?: () => boolean;
        isDeprecated?: () => boolean;
        tokenPricesService: AbstractTokenPricesService;
    });
    /**
     * Sets a currency to track.
     *
     * @param currentCurrency - ISO 4217 currency code.
     */
    setCurrentCurrency(currentCurrency: string): Promise<void>;
    /**
     * Updates the exchange rate for the current currency and native currency pairs.
     *
     * @param nativeCurrencies - The native currency symbols to fetch exchange rates for.
     */
    updateExchangeRate(nativeCurrencies: (string | undefined)[]): Promise<void>;
    /**
     * Prepare to discard this controller.
     *
     * This stops any active polling.
     */
    destroy(): void;
    /**
     * Updates exchange rate for the current currency.
     *
     * @param input - The input for the poll.
     * @param input.nativeCurrencies - The native currency symbols to poll prices for.
     */
    _executePoll({ nativeCurrencies, }: CurrencyRatePollingInput): Promise<void>;
}
export default CurrencyRateController;
