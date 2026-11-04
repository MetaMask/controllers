import type { AccountsControllerAccountAddedEvent, AccountsControllerAccountAssetListUpdatedEvent, AccountsControllerAccountRemovedEvent, AccountsControllerListMultichainAccountsAction } from '@metamask/accounts-controller';
import type { ControllerGetStateAction, ControllerStateChangeEvent } from '@metamask/base-controller';
import type { CaipAssetType } from '@metamask/keyring-api';
import type { Messenger } from '@metamask/messenger';
import type { GetPermissions } from '@metamask/permission-controller';
import type { PhishingControllerBulkScanTokensAction } from '@metamask/phishing-controller';
import type { SnapControllerGetRunnableSnapsAction, SnapControllerHandleRequestAction } from '@metamask/snaps-controllers';
import type { FungibleAssetMetadata } from '@metamask/snaps-sdk';
import type { MultichainAssetsControllerMethodActions } from './MultichainAssetsController-method-action-types.js';
declare const controllerName = "MultichainAssetsController";
export type MultichainAssetsControllerState = {
    assetsMetadata: {
        [asset: CaipAssetType]: FungibleAssetMetadata;
    };
    accountsAssets: {
        [account: string]: CaipAssetType[];
    };
    allIgnoredAssets: {
        [account: string]: CaipAssetType[];
    };
};
export type AssetMetadataResponse = {
    assets: {
        [asset: CaipAssetType]: FungibleAssetMetadata;
    };
};
export type MultichainAssetsControllerAccountAssetListUpdatedEvent = {
    type: `${typeof controllerName}:accountAssetListUpdated`;
    payload: AccountsControllerAccountAssetListUpdatedEvent['payload'];
};
/**
 * Constructs the default {@link MultichainAssetsController} state. This allows
 * consumers to provide a partial state object when initializing the controller
 * and also helps in constructing complete state objects for this controller in
 * tests.
 *
 * @returns The default {@link MultichainAssetsController} state.
 */
export declare function getDefaultMultichainAssetsControllerState(): MultichainAssetsControllerState;
/**
 * Returns the state of the {@link MultichainAssetsController}.
 */
export type MultichainAssetsControllerGetStateAction = ControllerGetStateAction<typeof controllerName, MultichainAssetsControllerState>;
/**
 * Event emitted when the state of the {@link MultichainAssetsController} changes.
 */
export type MultichainAssetsControllerStateChangeEvent = ControllerStateChangeEvent<typeof controllerName, MultichainAssetsControllerState>;
/**
 * Actions exposed by the {@link MultichainAssetsController}.
 */
export type MultichainAssetsControllerActions = MultichainAssetsControllerGetStateAction | MultichainAssetsControllerMethodActions;
/**
 * Events emitted by {@link MultichainAssetsController}.
 */
export type MultichainAssetsControllerEvents = MultichainAssetsControllerStateChangeEvent | MultichainAssetsControllerAccountAssetListUpdatedEvent;
/**
 * Actions that this controller is allowed to call.
 */
type AllowedActions = SnapControllerGetRunnableSnapsAction | SnapControllerHandleRequestAction | GetPermissions | AccountsControllerListMultichainAccountsAction | PhishingControllerBulkScanTokensAction;
/**
 * Events that this controller is allowed to subscribe.
 */
type AllowedEvents = AccountsControllerAccountAddedEvent | AccountsControllerAccountRemovedEvent | AccountsControllerAccountAssetListUpdatedEvent;
/**
 * Messenger type for the MultichainAssetsController.
 */
export type MultichainAssetsControllerMessenger = Messenger<typeof controllerName, MultichainAssetsControllerActions | AllowedActions, MultichainAssetsControllerEvents | AllowedEvents>;
declare const MultichainAssetsController_base: (abstract new (...args: any[]) => {
    readonly _callbacks: Map<string, Set<(input: null) => void>>;
    _executePoll(input: null): Promise<void>;
    startPolling(input: null): string;
    stopAllPolling(): void;
    stopPollingByPollingToken(pollingToken: string): void;
    readonly _intervalIds: Record<import("@metamask/polling-controller").PollingTokenSetId, NodeJS.Timeout>;
    _intervalLength: number | undefined;
    setIntervalLength(intervalLength: number): void;
    getIntervalLength(): number | undefined;
    _startPolling(input: null): void;
    _stopPollingByPollingTokenSetId(key: import("@metamask/polling-controller").PollingTokenSetId): void;
    readonly _pollingTokenSets: Map<import("@metamask/polling-controller").PollingTokenSetId, Set<string>>;
    onPollingComplete(input: null, callback: (input: null) => void): void;
}) & typeof import("@metamask/base-controller").BaseController;
export declare class MultichainAssetsController extends MultichainAssetsController_base<typeof controllerName, MultichainAssetsControllerState, MultichainAssetsControllerMessenger> {
    #private;
    constructor({ messenger, state, blockaidTokenRescanInterval, isDeprecated, }: {
        messenger: MultichainAssetsControllerMessenger;
        state?: Partial<MultichainAssetsControllerState>;
        /** Blockaid re-scan interval (ms); default daily. `0` disables. */
        blockaidTokenRescanInterval?: number;
        isDeprecated?: () => boolean;
    });
    _executePoll(_input: null): Promise<void>;
    /**
     * Returns the metadata for the given asset
     *
     * @param asset - The asset to get metadata for
     * @returns The metadata for the asset or undefined if not found.
     */
    getAssetMetadata(asset: CaipAssetType): FungibleAssetMetadata | undefined;
    /**
     * Ignores a batch of assets for a specific account.
     *
     * @param assetsToIgnore - Array of asset IDs to ignore.
     * @param accountId - The account ID to ignore assets for.
     */
    ignoreAssets(assetsToIgnore: CaipAssetType[], accountId: string): void;
    /**
     * Adds multiple assets to the stored asset list for a specific account.
     * All assets must belong to the same chain.
     *
     * @param assetIds - Array of CAIP asset IDs to add (must be from same chain).
     * @param accountId - The account ID to add the assets to.
     * @returns The updated asset list for the account.
     * @throws Error if assets are from different chains.
     */
    addAssets(assetIds: CaipAssetType[], accountId: string): Promise<CaipAssetType[]>;
}
export {};
