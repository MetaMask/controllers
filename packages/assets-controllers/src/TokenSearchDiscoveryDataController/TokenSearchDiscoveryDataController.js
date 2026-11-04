import { BaseController } from '@metamask/base-controller';
import { formatIconUrlWithProxy } from '../assetsUtil.js';
import { fetchTokenMetadata, TOKEN_METADATA_NO_SUPPORT_ERROR, } from '../token-service.js';
// === GENERAL ===
export const controllerName = 'TokenSearchDiscoveryDataController';
export const MAX_TOKEN_DISPLAY_DATA_LENGTH = 10;
const tokenSearchDiscoveryDataControllerMetadata = {
    tokenDisplayData: {
        includeInStateLogs: false,
        persist: true,
        includeInDebugSnapshot: false,
        usedInUi: true,
    },
};
/**
 * Constructs the default {@link TokenSearchDiscoveryDataController} state. This allows
 * consumers to provide a partial state object when initializing the controller
 * and also helps in constructing complete state objects for this controller in
 * tests.
 *
 * @returns The default {@link TokenSearchDiscoveryDataController} state.
 */
export function getDefaultTokenSearchDiscoveryDataControllerState() {
    return {
        tokenDisplayData: [],
    };
}
/**
 * The TokenSearchDiscoveryDataController manages the retrieval of token search results and token discovery.
 * It fetches token metadata from the Token API and token prices from the token prices service.
 */
export class TokenSearchDiscoveryDataController extends BaseController {
    #abortController;
    #tokenPricesService;
    constructor({ state = {}, messenger, tokenPricesService, }) {
        super({
            name: controllerName,
            metadata: tokenSearchDiscoveryDataControllerMetadata,
            messenger,
            state: {
                ...getDefaultTokenSearchDiscoveryDataControllerState(),
                ...state,
            },
        });
        this.#abortController = new AbortController();
        this.#tokenPricesService = tokenPricesService;
    }
    async #fetchPriceData(chainId, address) {
        const { currentCurrency } = this.messenger.call('CurrencyRateController:getState');
        try {
            const pricesData = await this.#tokenPricesService.fetchTokenPrices({
                assets: [{ chainId, tokenAddress: address }],
                currency: currentCurrency,
            });
            return pricesData[0] ?? null;
        }
        catch (error) {
            console.error(error);
            return null;
        }
    }
    async fetchTokenDisplayData(chainId, address) {
        let tokenMetadata;
        try {
            tokenMetadata = await fetchTokenMetadata(chainId, address, this.#abortController.signal);
        }
        catch (error) {
            if (!(error instanceof Error) ||
                !error.message.includes(TOKEN_METADATA_NO_SUPPORT_ERROR)) {
                throw error;
            }
        }
        const { currentCurrency } = this.messenger.call('CurrencyRateController:getState');
        let tokenDisplayData;
        if (tokenMetadata) {
            const priceData = await this.#fetchPriceData(chainId, address);
            tokenDisplayData = {
                found: true,
                address,
                chainId,
                currency: currentCurrency,
                token: {
                    ...tokenMetadata,
                    isERC721: false,
                    image: formatIconUrlWithProxy({
                        chainId,
                        tokenAddress: address,
                    }),
                },
                price: priceData,
            };
        }
        else {
            tokenDisplayData = {
                found: false,
                address,
                chainId,
                currency: currentCurrency,
            };
        }
        this.update((state) => {
            state.tokenDisplayData = [
                tokenDisplayData,
                ...state.tokenDisplayData.filter((token) => token.address !== address ||
                    token.chainId !== chainId ||
                    token.currency !== currentCurrency),
            ].slice(0, MAX_TOKEN_DISPLAY_DATA_LENGTH);
        });
    }
}
