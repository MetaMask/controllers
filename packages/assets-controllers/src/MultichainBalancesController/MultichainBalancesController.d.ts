import type { AccountsControllerAccountAddedEvent, AccountsControllerAccountRemovedEvent, AccountsControllerListMultichainAccountsAction, AccountsControllerAccountBalancesUpdatesEvent } from '@metamask/accounts-controller';
import { BaseController } from '@metamask/base-controller';
import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { KeyringControllerGetStateAction } from '@metamask/keyring-controller';
import type { Messenger } from '@metamask/messenger';
import type { SnapControllerHandleRequestAction } from '@metamask/snaps-controllers';
import type { MultichainAssetsControllerGetStateAction, MultichainAssetsControllerAccountAssetListUpdatedEvent } from '../MultichainAssetsController/index.js';
declare const controllerName = "MultichainBalancesController";
/**
 * State used by the {@link MultichainBalancesController} to cache account balances.
 */
export type MultichainBalancesControllerState = {
    balances: {
        [account: string]: {
            [asset: string]: {
                amount: string;
                unit: string;
            };
        };
    };
};
/**
 * Constructs the default {@link MultichainBalancesController} state. This allows
 * consumers to provide a partial state object when initializing the controller
 * and also helps in constructing complete state objects for this controller in
 * tests.
 *
 * @returns The default {@link MultichainBalancesController} state.
 */
export declare function getDefaultMultichainBalancesControllerState(): MultichainBalancesControllerState;
/**
 * Returns the state of the {@link MultichainBalancesController}.
 */
export type MultichainBalancesControllerGetStateAction = ControllerGetStateAction<typeof controllerName, MultichainBalancesControllerState>;
/**
 * Event emitted when the state of the {@link MultichainBalancesController} changes.
 */
export type MultichainBalancesControllerStateChange = ControllerStateChangeEvent<typeof controllerName, MultichainBalancesControllerState>;
/**
 * Actions exposed by the {@link MultichainBalancesController}.
 */
export type MultichainBalancesControllerActions = MultichainBalancesControllerGetStateAction;
/**
 * Events emitted by {@link MultichainBalancesController}.
 */
export type MultichainBalancesControllerEvents = MultichainBalancesControllerStateChange;
/**
 * Actions that this controller is allowed to call.
 */
type AllowedActions = SnapControllerHandleRequestAction | AccountsControllerListMultichainAccountsAction | MultichainAssetsControllerGetStateAction | KeyringControllerGetStateAction;
/**
 * Events that this controller is allowed to subscribe.
 */
type AllowedEvents = AccountsControllerAccountAddedEvent | AccountsControllerAccountRemovedEvent | AccountsControllerAccountBalancesUpdatesEvent | MultichainAssetsControllerAccountAssetListUpdatedEvent;
/**
 * Messenger type for the MultichainBalancesController.
 */
export type MultichainBalancesControllerMessenger = Messenger<typeof controllerName, MultichainBalancesControllerActions | AllowedActions, MultichainBalancesControllerEvents | AllowedEvents>;
/**
 * The MultichainBalancesController is responsible for fetching and caching account
 * balances.
 */
export declare class MultichainBalancesController extends BaseController<typeof controllerName, MultichainBalancesControllerState, MultichainBalancesControllerMessenger> {
    #private;
    /**
     * Creates a MultichainBalancesController instance.
     *
     * @param options - Constructor options.
     * @param options.messenger - A reference to the messenger.
     * @param options.state - The initial state.
     * @param options.isDeprecated - Optional function that returns true to completely
     * disable this controller (no requests, no state updates). When it returns
     * `true`, `balances` is reset to `{}` at construction and at every entry point,
     * so no stale balances remain in state. The function is evaluated dynamically
     * on each entry point so it can be toggled at runtime. Intended for use when
     * a higher-level controller (e.g. AssetsController) supersedes this one.
     */
    constructor({ messenger, state, isDeprecated, }: {
        messenger: MultichainBalancesControllerMessenger;
        state?: Partial<MultichainBalancesControllerState>;
        isDeprecated?: () => boolean;
    });
    /**
     * Updates the balances of one account. This method doesn't return
     * anything, but it updates the state of the controller.
     *
     * @param accountId - The account ID.
     */
    updateBalance(accountId: string): Promise<void>;
}
export {};
