import type { AccountTreeControllerGetAccountsFromSelectedAccountGroupAction, AccountTreeControllerSelectedAccountGroupChangeEvent } from '@metamask/account-tree-controller';
import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { KeyringControllerLockEvent } from '@metamask/keyring-controller';
import type { Messenger } from '@metamask/messenger';
import type { TransactionControllerTransactionConfirmedEvent } from '@metamask/transaction-controller';
import type { Hex } from '@metamask/utils';
import type { DeFiPositionsControllerMethodActions } from './DeFiPositionsController-method-action-types.js';
import type { GroupedDeFiPositions } from './group-defi-positions.js';
declare const controllerName = "DeFiPositionsController";
export type GroupedDeFiPositionsPerChain = {
    [chain: Hex]: GroupedDeFiPositions;
};
export type TrackingEventPayload = {
    event: string;
    category: string;
    properties: {
        totalPositions: number;
        totalMarketValueUSD: number;
        breakdown?: {
            protocolId: string;
            marketValueUSD: number;
            chainId: Hex;
            count: number;
        }[];
    };
};
type TrackEventHook = (event: TrackingEventPayload) => void;
export type DeFiPositionsControllerState = {
    /**
     * Object containing DeFi positions per account and network
     */
    allDeFiPositions: {
        [accountAddress: string]: GroupedDeFiPositionsPerChain | null;
    };
    /**
     * Object containing DeFi positions count per account
     */
    allDeFiPositionsCount: {
        [accountAddress: string]: number;
    };
};
export declare const getDefaultDefiPositionsControllerState: () => DeFiPositionsControllerState;
export type DeFiPositionsControllerActions = DeFiPositionsControllerGetStateAction | DeFiPositionsControllerMethodActions;
export type DeFiPositionsControllerGetStateAction = ControllerGetStateAction<typeof controllerName, DeFiPositionsControllerState>;
export type DeFiPositionsControllerEvents = DeFiPositionsControllerStateChangeEvent;
export type DeFiPositionsControllerStateChangeEvent = ControllerStateChangeEvent<typeof controllerName, DeFiPositionsControllerState>;
/**
 * The external actions available to the {@link DeFiPositionsController}.
 */
export type AllowedActions = AccountTreeControllerGetAccountsFromSelectedAccountGroupAction;
/**
 * The external events available to the {@link DeFiPositionsController}.
 */
export type AllowedEvents = KeyringControllerLockEvent | TransactionControllerTransactionConfirmedEvent | AccountTreeControllerSelectedAccountGroupChangeEvent;
/**
 * The messenger of the {@link DeFiPositionsController}.
 */
export type DeFiPositionsControllerMessenger = Messenger<typeof controllerName, DeFiPositionsControllerActions | AllowedActions, DeFiPositionsControllerEvents | AllowedEvents>;
declare const DeFiPositionsController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: import("@metamask/utils").Json) => void>>;
    _executePoll(input: import("@metamask/utils").Json): Promise<void>;
    startPolling(input: import("@metamask/utils").Json): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: import("@metamask/utils").Json): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: import("@metamask/utils").Json, callback: (input: import("@metamask/utils").Json) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
/**
 * Controller that stores assets and exposes convenience methods
 */
export declare class DeFiPositionsController extends DeFiPositionsController_base<typeof controllerName, DeFiPositionsControllerState, DeFiPositionsControllerMessenger> {
    #private;
    /**
     * DeFiPositionsController constuctor
     *
     * @param options - Constructor options.
     * @param options.messenger - The controller messenger.
     * @param options.isEnabled - Function that returns whether the controller is enabled. (default: () => true)
     * @param options.trackEvent - Function to track events. (default: undefined)
     */
    constructor({ messenger, isEnabled, trackEvent, }: {
        messenger: DeFiPositionsControllerMessenger;
        isEnabled?: () => boolean;
        trackEvent?: TrackEventHook;
    });
    _executePoll(): Promise<void>;
}
export {};
