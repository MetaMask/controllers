import { BaseController } from '@metamask/base-controller';
import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { Messenger } from '@metamask/messenger';
import type { Hex } from '@metamask/utils';
import type { CurrencyRateControllerGetStateAction } from '../CurrencyRateController.js';
import type { AbstractTokenPricesService } from '../token-prices-service/index.js';
import type { TokenDisplayData } from './types.js';
export declare const controllerName = "TokenSearchDiscoveryDataController";
export declare const MAX_TOKEN_DISPLAY_DATA_LENGTH = 10;
export type TokenSearchDiscoveryDataControllerState = {
    tokenDisplayData: TokenDisplayData[];
};
/**
 * The action which can be used to retrieve the state of the
 * {@link TokenSearchDiscoveryDataController}.
 */
export type TokenSearchDiscoveryDataControllerGetStateAction = ControllerGetStateAction<typeof controllerName, TokenSearchDiscoveryDataControllerState>;
/**
 * All actions that {@link TokenSearchDiscoveryDataController} registers, to be
 * called externally.
 */
export type TokenSearchDiscoveryDataControllerActions = TokenSearchDiscoveryDataControllerGetStateAction;
/**
 * All actions that {@link TokenSearchDiscoveryDataController} calls internally.
 */
export type AllowedActions = CurrencyRateControllerGetStateAction;
/**
 * The event that {@link TokenSearchDiscoveryDataController} publishes when updating
 * state.
 */
export type TokenSearchDiscoveryDataControllerStateChangeEvent = ControllerStateChangeEvent<typeof controllerName, TokenSearchDiscoveryDataControllerState>;
/**
 * All events that {@link TokenSearchDiscoveryDataController} publishes, to be
 * subscribed to externally.
 */
export type TokenSearchDiscoveryDataControllerEvents = TokenSearchDiscoveryDataControllerStateChangeEvent;
/**
 * All events that {@link TokenSearchDiscoveryDataController} subscribes to internally.
 */
export type AllowedEvents = never;
/**
 * The messenger which is restricted to actions and events accessed by
 * {@link TokenSearchDiscoveryDataController}.
 */
export type TokenSearchDiscoveryDataControllerMessenger = Messenger<typeof controllerName, TokenSearchDiscoveryDataControllerActions | AllowedActions, TokenSearchDiscoveryDataControllerEvents | AllowedEvents>;
/**
 * Constructs the default {@link TokenSearchDiscoveryDataController} state. This allows
 * consumers to provide a partial state object when initializing the controller
 * and also helps in constructing complete state objects for this controller in
 * tests.
 *
 * @returns The default {@link TokenSearchDiscoveryDataController} state.
 */
export declare function getDefaultTokenSearchDiscoveryDataControllerState(): TokenSearchDiscoveryDataControllerState;
/**
 * The TokenSearchDiscoveryDataController manages the retrieval of token search results and token discovery.
 * It fetches token metadata from the Token API and token prices from the token prices service.
 */
export declare class TokenSearchDiscoveryDataController extends BaseController<typeof controllerName, TokenSearchDiscoveryDataControllerState, TokenSearchDiscoveryDataControllerMessenger> {
    #private;
    constructor({ state, messenger, tokenPricesService, }: {
        state?: Partial<TokenSearchDiscoveryDataControllerState>;
        messenger: TokenSearchDiscoveryDataControllerMessenger;
        tokenPricesService: AbstractTokenPricesService;
    });
    fetchTokenDisplayData(chainId: Hex, address: string): Promise<void>;
}
