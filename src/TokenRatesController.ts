import 'isomorphic-fetch';
import BaseController, { BaseConfig, BaseState } from './BaseController';
import AssetsController from './AssetsController';
import { safelyExecute } from './util';
import CurrencyRateController from './CurrencyRateController';
const { toChecksumAddress } = require('ethereumjs-util');

/**
 * @type Token
 *
 * Token representation
 *
 * @property address - Hex address of the token contract
 * @property decimals - Number of decimals the token uses
 * @property symbol - Symbol of the token
 */
export interface Token {
	address: string;
	decimals: number;
	symbol: string;
}

/**
 * @type TokenRatesConfig
 *
 * Token rates controller configuration
 *
 * @property interval - Polling interval used to fetch new token rates
 * @property tokens - List of tokens to track exchange rates for
 */
export interface TokenRatesConfig extends BaseConfig {
	interval: number;
	nativeCurrency: string;
	tokens: Token[];
}

/**
 * @type TokenRatesState
 *
 * Token rates controller state
 *
 * @property contractExchangeRates - Hash of token contract addresses to exchange rates
 */
export interface TokenRatesState extends BaseState {
	contractExchangeRates: { [address: string]: number };
}

/**
 * Controller that passively polls on a set interval for token-to-fiat exchange rates
 * for tokens stored in the AssetsController
 */
export class TokenRatesController extends BaseController<TokenRatesConfig, TokenRatesState> {
	private handle?: NodeJS.Timer;
	private tokenList: Token[] = [];

	private getPricingURL(query: string) {
		return `https://exchanges.balanc3.net/pie?${query}&autoConversion=true`;
	}

	/**
	 * Name of this controller used during composition
	 */
	name = 'TokenRatesController';

	/**
	 * List of required sibling controllers this controller needs to function
	 */
	requiredControllers = ['AssetsController', 'CurrencyRateController'];

	/**
	 * Creates a TokenRatesController instance
	 *
	 * @param config - Initial options used to configure this controller
	 * @param state - Initial state to set on this controller
	 */
	constructor(config?: Partial<TokenRatesConfig>, state?: Partial<TokenRatesState>) {
		super(config, state);
		this.defaultConfig = {
			interval: 180000,
			nativeCurrency: 'eth',
			tokens: []
		};
		this.defaultState = { contractExchangeRates: {} };
		this.initialize();
	}

	/**
	 * Sets a new polling interval
	 *
	 * @param interval - Polling interval used to fetch new token rates
	 */
	set interval(interval: number) {
		this.handle && clearInterval(this.handle);
		safelyExecute(() => this.updateExchangeRates());
		this.handle = setInterval(() => {
			safelyExecute(() => this.updateExchangeRates());
		}, interval);
	}

	/**
	 * Sets a new token list to track prices
	 *
	 * @param tokens - List of tokens to track exchange rates for
	 */
	set tokens(tokens: Token[]) {
		this.tokenList = tokens;
		safelyExecute(() => this.updateExchangeRates());
	}

	/**
	 * Fetches a token exchange rate by address
	 *
	 * @param query - Query according to tokens in tokenList
	 * @returns - Promise resolving to exchange rates for given pairs
	 */
	async fetchExchangeRate(query: string): Promise<{ prices: Array<{ pair: string; price: number }> }> {
		const response = await fetch(this.getPricingURL(query));
		const json = await response.json();
		return json;
	}

	/**
	 * Extension point called if and when this controller is composed
	 * with other controllers using a ComposableController
	 */
	onComposed() {
		super.onComposed();
		const assets = this.context.AssetsController as AssetsController;
		const currencyRate = this.context.CurrencyRateController as CurrencyRateController;
		assets.subscribe(() => {
			this.configure({ tokens: assets.state.tokens });
		});
		currencyRate.subscribe(() => {
			this.configure({ nativeCurrency: currencyRate.state.nativeCurrency });
		});
	}

	/**
	 * Updates exchange rates for all tokens
	 *
	 * @returns Promise resolving when this operation completes
	 */
	async updateExchangeRates() {
		if (this.disabled || this.tokenList.length === 0) {
			return;
		}
		const newContractExchangeRates: { [address: string]: number } = {};
		const { nativeCurrency } = this.config;
		const pairs = this.tokenList.map((token) => `pairs[]=${token.address}/${nativeCurrency}`);
		const query = pairs.join('&');
		const { prices = [] } = await this.fetchExchangeRate(query);
		prices.forEach(({ pair, price }) => {
			const address = toChecksumAddress(pair.split('/')[0].toLowerCase());
			newContractExchangeRates[address] = typeof price === 'number' ? price : 0;
		});
		this.update({ contractExchangeRates: newContractExchangeRates });
	}
}

export default TokenRatesController;
