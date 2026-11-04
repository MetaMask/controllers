import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { Messenger } from '@metamask/messenger';
import type { NetworkControllerGetStateAction, NetworkControllerStateChangeEvent } from '@metamask/network-controller';
import type { NetworkEnablementControllerGetStateAction } from '@metamask/network-enablement-controller';
import type { Hex } from '@metamask/utils';
import type { AbstractTokenPricesService } from './token-prices-service/abstract-token-prices-service.js';
import { TokenRwaData } from './token-service.js';
import type { TokensControllerGetStateAction, TokensControllerStateChangeEvent } from './TokensController.js';
/**
 * @type Token
 *
 * Token representation
 *
 * @property address - Hex address of the token contract
 * @property decimals - Number of decimals the token uses
 * @property symbol - Symbol of the token
 * @property aggregators - An array containing the token's aggregators
 * @property image - Image of the token, url or bit32 image
 * @property hasBalanceError - 'true' if there is an error while updating the token balance
 * @property isERC721 - 'true' if the token is a ERC721 token
 * @property name - Name of the token
 */
export type Token = {
    address: string;
    decimals: number;
    symbol: string;
    aggregators?: string[];
    image?: string;
    hasBalanceError?: boolean;
    isERC721?: boolean;
    name?: string;
    rwaData?: TokenRwaData;
};
export type ContractExchangeRates = {
    [address: string]: number | undefined;
};
export type MarketDataDetails = {
    tokenAddress: `0x${string}`;
    currency: string;
    allTimeHigh: number;
    allTimeLow: number;
    circulatingSupply: number;
    dilutedMarketCap: number;
    high1d: number;
    low1d: number;
    marketCap: number;
    marketCapPercentChange1d: number;
    price: number;
    priceChange1d: number;
    pricePercentChange1d: number;
    pricePercentChange1h: number;
    pricePercentChange1y: number;
    pricePercentChange7d: number;
    pricePercentChange14d: number;
    pricePercentChange30d: number;
    pricePercentChange200d: number;
    totalVolume: number;
};
/**
 * Represents a mapping of token contract addresses to their market data.
 */
export type ContractMarketData = Record<Hex, MarketDataDetails>;
type ChainIdAndNativeCurrency = {
    chainId: Hex;
    nativeCurrency: string;
};
/**
 * The external actions available to the {@link TokenRatesController}.
 */
export type AllowedActions = TokensControllerGetStateAction | NetworkControllerGetStateAction | NetworkEnablementControllerGetStateAction;
/**
 * The external events available to the {@link TokenRatesController}.
 */
export type AllowedEvents = TokensControllerStateChangeEvent | NetworkControllerStateChangeEvent;
/**
 * The name of the {@link TokenRatesController}.
 */
export declare const controllerName = "TokenRatesController";
/**
 * @type TokenRatesState
 *
 * Token rates controller state
 *
 * @property marketData - Market data for tokens, keyed by chain ID and then token contract address.
 */
export type TokenRatesControllerState = {
    marketData: Record<Hex, Record<Hex, MarketDataDetails>>;
};
/**
 * The action that can be performed to get the state of the {@link TokenRatesController}.
 */
export type TokenRatesControllerGetStateAction = ControllerGetStateAction<typeof controllerName, TokenRatesControllerState>;
/**
 * The actions that can be performed using the {@link TokenRatesController}.
 */
export type TokenRatesControllerActions = TokenRatesControllerGetStateAction;
/**
 * The event that {@link TokenRatesController} can emit.
 */
export type TokenRatesControllerStateChangeEvent = ControllerStateChangeEvent<typeof controllerName, TokenRatesControllerState>;
/**
 * The events that {@link TokenRatesController} can emit.
 */
export type TokenRatesControllerEvents = TokenRatesControllerStateChangeEvent;
/**
 * The messenger of the {@link TokenRatesController} for communication.
 */
export type TokenRatesControllerMessenger = Messenger<typeof controllerName, TokenRatesControllerActions | AllowedActions, TokenRatesControllerEvents | AllowedEvents>;
/**
 * Get the default {@link TokenRatesController} state.
 *
 * @returns The default {@link TokenRatesController} state.
 */
export declare const getDefaultTokenRatesControllerState: () => TokenRatesControllerState;
/** The input to start polling for the {@link TokenRatesController} */
export type TokenRatesPollingInput = {
    chainIds: Hex[];
};
declare const TokenRatesController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: TokenRatesPollingInput) => void>>;
    _executePoll(input: TokenRatesPollingInput): Promise<void>;
    startPolling(input: TokenRatesPollingInput): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: TokenRatesPollingInput): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: TokenRatesPollingInput, callback: (input: TokenRatesPollingInput) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
/**
 * Controller that passively polls on a set interval for token-to-fiat exchange rates
 * for tokens stored in the TokensController
 */
export declare class TokenRatesController extends TokenRatesController_base<typeof controllerName, TokenRatesControllerState, TokenRatesControllerMessenger> {
    #private;
    /**
     * Creates a TokenRatesController instance.
     *
     * @param options - The controller options.
     * @param options.interval - The polling interval in ms
     * @param options.disabled - Boolean to track if network requests are blocked
     * @param options.isDeprecated - Optional function that returns true to completely
     * disable this controller (no requests, no state updates). When it returns
     * `true`, `marketData` is reset to `{}` at construction and at every polling
     * entry point, so no stale rates remain in state. The function is evaluated
     * dynamically on each entry point so it can be toggled at runtime. Intended for
     * use when a higher-level controller (e.g. AssetsController) supersedes this one.
     * @param options.tokenPricesService - An object in charge of retrieving token price
     * @param options.messenger - The messenger instance for communication
     * @param options.state - Initial state to set on this controller
     */
    constructor({ interval, disabled, isDeprecated, tokenPricesService, messenger, state, }: {
        interval?: number;
        disabled?: boolean;
        isDeprecated?: () => boolean;
        tokenPricesService: AbstractTokenPricesService;
        messenger: TokenRatesControllerMessenger;
        state?: Partial<TokenRatesControllerState>;
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
     * Updates exchange rates for all tokens.
     *
     * @param chainIdAndNativeCurrency - The chain ID and native currency.
     */
    updateExchangeRates(chainIdAndNativeCurrency: ChainIdAndNativeCurrency[]): Promise<void>;
    /**
     * Updates token rates for the given networkClientId
     *
     * @param input - The input for the poll.
     * @param input.chainIds - The chain ids to poll token rates on.
     */
    _executePoll({ chainIds }: TokenRatesPollingInput): Promise<void>;
    /**
     * Reset the controller state to the default state.
     */
    resetState(): void;
}
export default TokenRatesController;
