import { BaseController } from '@metamask/base-controller';
import type { RatesControllerState, RatesControllerOptions, RatesControllerMessenger } from './types.js';
export declare const name = "RatesController";
/**
 * Supported cryptocurrencies that can be used as a base currency. The value needs to be compatible
 * with CryptoCompare's API which is the default source for the rates.
 *
 * See: https://min-api.cryptocompare.com/documentation?key=Price&cat=multipleSymbolsPriceEndpoint
 */
export declare enum Cryptocurrency {
    Btc = "btc",
    Solana = "sol"
}
export declare class RatesController extends BaseController<typeof name, RatesControllerState, RatesControllerMessenger> {
    #private;
    /**
     * Creates a RatesController instance.
     *
     * @param options - Constructor options.
     * @param options.includeUsdRate - Keep track of the USD rate in addition to the current currency rate.
     * @param options.interval - The polling interval, in milliseconds.
     * @param options.messenger - A reference to the messaging system.
     * @param options.state - Initial state to set on this controller.
     * @param options.fetchMultiExchangeRate - Fetches the exchange rate from an external API. This option is primarily meant for use in unit tests.
     */
    constructor({ interval, messenger, state, includeUsdRate, fetchMultiExchangeRate, }: RatesControllerOptions);
    /**
     * Starts the polling process.
     */
    start(): Promise<void>;
    /**
     * Stops the polling process.
     */
    stop(): Promise<void>;
    /**
     * Returns the current list of cryptocurrency.
     *
     * @returns The cryptocurrency list.
     */
    getCryptocurrencyList(): Cryptocurrency[];
    /**
     * Sets the list of supported cryptocurrencies.
     *
     * @param cryptocurrencies - The list of supported cryptocurrencies.
     */
    setCryptocurrencyList(cryptocurrencies: Cryptocurrency[]): Promise<void>;
    /**
     * Sets the internal fiat currency and update rates accordingly.
     *
     * @param fiatCurrency - The fiat currency.
     */
    setFiatCurrency(fiatCurrency: string): Promise<void>;
}
