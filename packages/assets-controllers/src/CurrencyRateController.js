import { TESTNET_TICKER_SYMBOLS, FALL_BACK_VS_CURRENCY, } from '@metamask/controller-utils';
import { StaticIntervalPollingController } from '@metamask/polling-controller';
import { Mutex } from 'async-mutex';
import { getNativeTokenAddress } from './token-prices-service/codefi-v2.js';
const name = 'CurrencyRateController';
const MESSENGER_EXPOSED_METHODS = [
    'startPolling',
    'stopPollingByPollingToken',
    'setCurrentCurrency',
    'updateExchangeRate',
];
const metadata = {
    currentCurrency: {
        includeInStateLogs: true,
        persist: false,
        includeInDebugSnapshot: true,
        usedInUi: true,
    },
    currencyRates: {
        includeInStateLogs: true,
        persist: false,
        includeInDebugSnapshot: true,
        usedInUi: true,
    },
};
const defaultState = {
    currentCurrency: 'usd',
    currencyRates: {
        ETH: {
            conversionDate: 0,
            conversionRate: 0,
            usdConversionRate: null,
        },
    },
};
const boundedPrecisionNumber = (value, precision = 9) => Number(value.toFixed(precision));
/**
 * Controller that passively polls on a set interval for an exchange rate from the current network
 * asset to the user's preferred currency.
 */
export class CurrencyRateController extends StaticIntervalPollingController() {
    #mutex = new Mutex();
    #includeUsdRate;
    #useExternalServices;
    #tokenPricesService;
    #isDeprecated;
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
    constructor({ includeUsdRate = false, interval = 180000, useExternalServices = () => true, isDeprecated = () => false, messenger, state, tokenPricesService, }) {
        super({
            name,
            metadata,
            messenger,
            state: { ...defaultState, ...state },
        });
        this.#includeUsdRate = includeUsdRate;
        this.#useExternalServices = useExternalServices;
        this.setIntervalLength(interval);
        this.#tokenPricesService = tokenPricesService;
        this.#isDeprecated = isDeprecated;
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
        }
        this.messenger.registerMethodActionHandlers(this, MESSENGER_EXPOSED_METHODS);
    }
    /**
     * Clears all persisted `currencyRates` so that no stale rates remain in state.
     *
     * Called from every entry point when `isDeprecated()` is true so that a
     * runtime toggle propagates to state immediately, even if the controller was
     * originally constructed while it was enabled. The update is skipped when
     * `currencyRates` is already empty to avoid emitting redundant state changes.
     */
    #enforceDisabledState() {
        if (Object.keys(this.state.currencyRates).length === 0) {
            return;
        }
        this.update((state) => {
            state.currencyRates = {};
        });
    }
    /**
     * Sets a currency to track.
     *
     * @param currentCurrency - ISO 4217 currency code.
     */
    async setCurrentCurrency(currentCurrency) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const releaseLock = await this.#mutex.acquire();
        const nativeCurrencies = Object.keys(this.state.currencyRates);
        try {
            this.update(() => {
                return {
                    ...defaultState,
                    currentCurrency,
                };
            });
        }
        finally {
            releaseLock();
        }
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.updateExchangeRate(nativeCurrencies);
    }
    /**
     * Attempts to fetch exchange rates from the primary Price API.
     *
     * @param nativeCurrenciesToFetch - Map of native currency to the currency symbol to fetch.
     * @param currentCurrency - The current fiat currency to get rates for.
     * @returns Object containing successful rates and currencies that failed.
     */
    async #fetchRatesFromPriceApi(nativeCurrenciesToFetch, currentCurrency) {
        const rates = {};
        let failedCurrencies = {};
        try {
            const response = await this.#tokenPricesService.fetchExchangeRates({
                baseCurrency: currentCurrency,
                includeUsdRate: this.#includeUsdRate,
                cryptocurrencies: [...new Set(Object.values(nativeCurrenciesToFetch))],
            });
            Object.entries(nativeCurrenciesToFetch).forEach(([nativeCurrency, fetchedCurrency]) => {
                const rate = response[fetchedCurrency.toLowerCase()];
                if (rate?.value) {
                    rates[nativeCurrency] = {
                        conversionDate: Date.now() / 1000,
                        conversionRate: boundedPrecisionNumber(1 / rate.value),
                        usdConversionRate: rate?.usd
                            ? boundedPrecisionNumber(1 / rate.usd)
                            : null,
                    };
                }
                else {
                    failedCurrencies[nativeCurrency] = fetchedCurrency;
                }
            });
        }
        catch (error) {
            console.error('Failed to fetch exchange rates.', error);
            failedCurrencies = { ...nativeCurrenciesToFetch };
        }
        return { rates, failedCurrencies };
    }
    /**
     * Fetches exchange rates from the token prices service as a fallback.
     * This method is designed to never throw - all errors are handled internally
     * and result in currencies being marked as failed.
     *
     * @param currenciesToFetch - Map of native currencies that need fallback fetching.
     * @param currentCurrency - The current fiat currency to get rates for.
     * @returns Object containing successful rates and currencies that failed.
     */
    async #fetchRatesFromTokenPricesService(currenciesToFetch, currentCurrency) {
        try {
            const rates = {};
            const failedCurrencies = {};
            const networkControllerState = this.messenger.call('NetworkController:getState');
            const networkConfigurations = networkControllerState.networkConfigurationsByChainId;
            // Build a map of nativeCurrency -> chainId for currencies to fetch
            const currencyToChainIds = Object.entries(currenciesToFetch).reduce((acc, [nativeCurrency, fetchedCurrency]) => {
                const matchingEntry = Object.entries(networkConfigurations).find(([, config]) => config.nativeCurrency.toUpperCase() ===
                    fetchedCurrency.toUpperCase());
                if (matchingEntry) {
                    acc[nativeCurrency] = { fetchedCurrency, chainId: matchingEntry[0] };
                }
                else {
                    // No matching network configuration - mark as failed
                    failedCurrencies[nativeCurrency] = fetchedCurrency;
                }
                return acc;
            }, {});
            const currencyToChainIdsEntries = Object.entries(currencyToChainIds);
            const ratesResults = await Promise.allSettled(currencyToChainIdsEntries.map(async ([nativeCurrency, { chainId }]) => {
                const nativeTokenAddress = getNativeTokenAddress(chainId);
                const tokenPrices = await this.#tokenPricesService.fetchTokenPrices({
                    assets: [{ chainId, tokenAddress: nativeTokenAddress }],
                    currency: currentCurrency,
                });
                const tokenPrice = tokenPrices.find((item) => item.tokenAddress.toLowerCase() ===
                    nativeTokenAddress.toLowerCase());
                return {
                    nativeCurrency,
                    conversionDate: tokenPrice ? Date.now() / 1000 : null,
                    conversionRate: tokenPrice?.price
                        ? boundedPrecisionNumber(tokenPrice.price)
                        : null,
                    usdConversionRate: null,
                };
            }));
            ratesResults.forEach((result, index) => {
                const [nativeCurrency, { fetchedCurrency, chainId }] = currencyToChainIdsEntries[index];
                if (result.status === 'fulfilled' && result.value.conversionRate) {
                    rates[nativeCurrency] = {
                        conversionDate: result.value.conversionDate,
                        conversionRate: result.value.conversionRate,
                        usdConversionRate: result.value.usdConversionRate,
                    };
                }
                else {
                    if (result.status === 'rejected') {
                        console.error(`Failed to fetch token price for ${nativeCurrency} on chain ${chainId}`, result.reason);
                    }
                    failedCurrencies[nativeCurrency] = fetchedCurrency;
                }
            });
            return { rates, failedCurrencies };
        }
        catch (error) {
            console.error('Failed to fetch exchange rates from token prices service.', error);
            // Return all currencies as failed
            return { rates: {}, failedCurrencies: { ...currenciesToFetch } };
        }
    }
    /**
     * Creates null rate entries for currencies that couldn't be fetched.
     *
     * @param currencies - Array of currency symbols to create null entries for.
     * @returns Null rate entries for all provided currencies.
     */
    #createNullRatesForCurrencies(currencies) {
        return currencies.reduce((acc, nativeCurrency) => {
            acc[nativeCurrency] = {
                conversionDate: null,
                conversionRate: null,
                usdConversionRate: null,
            };
            return acc;
        }, {});
    }
    /**
     * Fetches exchange rates with fallback logic.
     * First tries the Price API, then falls back to token prices service for any failed currencies.
     *
     * @param nativeCurrenciesToFetch - Map of native currency to the currency symbol to fetch.
     * @returns Exchange rates for all requested currencies.
     */
    async #fetchExchangeRatesWithFallback(nativeCurrenciesToFetch) {
        const { currentCurrency } = this.state;
        // Step 1: Try the Price API exchange rates first
        const { rates: ratesPriceApi, failedCurrencies: failedCurrenciesFromPriceApi, } = await this.#fetchRatesFromPriceApi(nativeCurrenciesToFetch, currentCurrency);
        // Step 2: If all currencies succeeded, return early
        if (Object.keys(failedCurrenciesFromPriceApi).length === 0) {
            return ratesPriceApi;
        }
        // Step 3: Fallback using token prices service for failed currencies
        const { rates: ratesFromFallback, failedCurrencies: failedCurrenciesFromFallback, } = await this.#fetchRatesFromTokenPricesService(failedCurrenciesFromPriceApi, currentCurrency);
        // Step 4: Create null rates for currencies that failed both approaches
        const nullRates = this.#createNullRatesForCurrencies(Object.keys(failedCurrenciesFromFallback));
        // Step 5: Merge all results - Price API rates take priority, then fallback, then null rates
        return {
            ...nullRates,
            ...ratesFromFallback,
            ...ratesPriceApi,
        };
    }
    /**
     * Updates the exchange rate for the current currency and native currency pairs.
     *
     * @param nativeCurrencies - The native currency symbols to fetch exchange rates for.
     */
    async updateExchangeRate(nativeCurrencies) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        if (!this.#useExternalServices()) {
            return;
        }
        const releaseLock = await this.#mutex.acquire();
        try {
            // For preloaded testnets (Goerli, Sepolia) we want to fetch exchange rate for real ETH.
            // Map each native currency to the symbol we want to fetch for it.
            const testnetSymbols = Object.values(TESTNET_TICKER_SYMBOLS);
            const nativeCurrenciesToFetch = nativeCurrencies.reduce((acc, nativeCurrency) => {
                if (!nativeCurrency) {
                    return acc;
                }
                acc[nativeCurrency] = testnetSymbols.includes(nativeCurrency)
                    ? FALL_BACK_VS_CURRENCY
                    : nativeCurrency;
                return acc;
            }, {});
            const rates = await this.#fetchExchangeRatesWithFallback(nativeCurrenciesToFetch);
            this.update((state) => {
                state.currencyRates = {
                    ...state.currencyRates,
                    ...rates,
                };
            });
        }
        catch (error) {
            console.error('Failed to fetch exchange rates.', error);
            throw error;
        }
        finally {
            releaseLock();
        }
    }
    /**
     * Prepare to discard this controller.
     *
     * This stops any active polling.
     */
    destroy() {
        super.destroy();
        this.stopAllPolling();
    }
    /**
     * Updates exchange rate for the current currency.
     *
     * @param input - The input for the poll.
     * @param input.nativeCurrencies - The native currency symbols to poll prices for.
     */
    async _executePoll({ nativeCurrencies, }) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        await this.updateExchangeRate(nativeCurrencies);
    }
}
export default CurrencyRateController;
