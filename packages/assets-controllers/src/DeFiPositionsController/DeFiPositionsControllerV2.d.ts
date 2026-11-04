import type { AccountTreeControllerGetAccountsFromSelectedAccountGroupAction } from '@metamask/account-tree-controller';
import { BaseController } from '@metamask/base-controller';
import type { ControllerGetStateAction, ControllerStateChangedEvent } from '@metamask/base-controller';
import type { ApiPlatformClient } from '@metamask/core-backend';
import type { Messenger } from '@metamask/messenger';
import type { RemoteFeatureFlagControllerGetStateAction } from '@metamask/remote-feature-flag-controller';
import type { DeFiPositionsControllerV2MethodActions } from './DeFiPositionsControllerV2-method-action-types.js';
import type { DeFiPositionsByAccount } from './group-defi-positions-v6.js';
declare const controllerName = "DeFiPositionsControllerV2";
export type DeFiPositionsControllerV2State = {
    /**
     * DeFi positions keyed by internal MetaMask account ID (`InternalAccount.id`,
     * the same key AssetsController uses). Each account maps to a flat list of
     * protocol groups shown in the DeFi tab, each carrying its own `chainId` for
     * filtering plus the details-page sections embedded inside it. This is
     * exactly the shape the client consumes, so no further transformation is
     * needed on read.
     *
     * Named `allDeFiPositionsV2` (rather than `allDeFiPositions`) so it can live
     * alongside the legacy `DeFiPositionsController` in clients that flatten every
     * controller's state into a single object (e.g. the extension background),
     * without colliding on the shared `allDeFiPositions` key.
     */
    allDeFiPositionsV2: DeFiPositionsByAccount;
};
export declare const getDefaultDeFiPositionsControllerV2State: () => DeFiPositionsControllerV2State;
export type DeFiPositionsControllerV2GetStateAction = ControllerGetStateAction<typeof controllerName, DeFiPositionsControllerV2State>;
export type DeFiPositionsControllerV2Actions = DeFiPositionsControllerV2GetStateAction | DeFiPositionsControllerV2MethodActions;
export type DeFiPositionsControllerV2StateChangedEvent = ControllerStateChangedEvent<typeof controllerName, DeFiPositionsControllerV2State>;
export type DeFiPositionsControllerV2Events = DeFiPositionsControllerV2StateChangedEvent;
/**
 * The external actions available to the {@link DeFiPositionsControllerV2}.
 */
export type AllowedActions = AccountTreeControllerGetAccountsFromSelectedAccountGroupAction | RemoteFeatureFlagControllerGetStateAction;
/**
 * The external events available to the {@link DeFiPositionsControllerV2}.
 *
 * None yet — clients must call `fetchDeFiPositions` (and optionally
 * `{ forceRefresh: true }`) on their own triggers. Likely future subscriptions:
 * `AccountTreeController:selectedAccountGroupChange`,
 * `TransactionController:transactionConfirmed`, and `KeyringController:lock`.
 */
export type AllowedEvents = never;
export type DeFiPositionsControllerV2Messenger = Messenger<typeof controllerName, DeFiPositionsControllerV2Actions | AllowedActions, DeFiPositionsControllerV2Events | AllowedEvents>;
/**
 * Controller that fetches DeFi positions for the selected account group from
 * the Accounts API (v6 multiaccount balances) and stores them in the shape the
 * client consumes directly.
 *
 * Deduplication and freshness are handled by the shared TanStack Query cache on
 * {@link ApiPlatformClient} (balances default `staleTime` is 1 minute). Pass
 * `{ forceRefresh: true }` to bypass that cache on the first attempt (e.g.
 * pull-to-refresh); later processing polls always bypass the cache.
 *
 * When the API reports account IDs in the response-level
 * `processingDefiPositions` array, this controller polls until indexing
 * finishes or the attempt limit is reached, and only then processes and writes
 * state — responses that still list processing accounts leave prior state
 * untouched. Concurrent calls for the same selected accounts and `vsCurrency`
 * share one in-flight promise so the UI can treat the pending promise as a
 * loading signal. Calls for a different selection or fiat currency start their
 * own fetch and leave any prior poll running, so switching back can join an
 * in-flight fetch for that group and currency.
 *
 * Processing-poll `maxAttempts` / `pollInterval` are read via
 * {@link getProcessingPollConfig} from the `defiControllerV2` remote feature
 * flag (`RemoteFeatureFlagController:getState`), falling back to built-in
 * defaults when unset or invalid. Clients must delegate that action to this
 * controller's messenger.
 */
export declare class DeFiPositionsControllerV2 extends BaseController<typeof controllerName, DeFiPositionsControllerV2State, DeFiPositionsControllerV2Messenger> {
    #private;
    /**
     * @param options - Constructor options.
     * @param options.messenger - The controller messenger.
     * @param options.apiClient - Accounts API client used to fetch balances/positions. Auth is handled by the client.
     * @param options.isEnabled - Returns whether fetching is enabled (default: () => false).
     * @param options.getVsCurrency - Returns the fiat currency for prices (default: () => 'usd').
     * @param options.state - Initial controller state.
     */
    constructor({ messenger, apiClient, isEnabled, getVsCurrency, state, }: {
        messenger: DeFiPositionsControllerV2Messenger;
        apiClient: ApiPlatformClient;
        isEnabled: () => boolean;
        getVsCurrency: () => string;
        state?: Partial<DeFiPositionsControllerV2State>;
    });
    /**
     * Fetches DeFi positions for the selected account group. State is updated
     * only when the response lists no accounts in its `processingDefiPositions`
     * array; each resolved account then has its state replaced (other accounts
     * stay). While any account is still indexing, prior state is kept and the
     * method polls (invalidating the balances cache between attempts) until no
     * accounts are processing, the attempt limit is reached, or a request fails.
     * Concurrent calls for the same selected accounts and `vsCurrency` share one
     * in-flight promise; calls for a different selection or fiat currency start
     * a new fetch and leave prior polls running so a later switch back can join
     * them. When a successful ready response required more than one attempt, or
     * when polling hits the attempt limit while still processing, reports to
     * Sentry via `messenger.captureException` (error names
     * `DeFiPositionsV2FetchAttempts` /
     * `DeFiPositionsV2ProcessingPollExhausted`) so poll limits can be tuned.
     * No-ops when disabled or when the group has no
     * supported accounts. Caching / spam prevention is handled by the apiClient
     * TanStack Query cache (keyed by accounts + query options including
     * `vsCurrency`). Pass `{ forceRefresh: true }` to bypass the cache on the
     * first attempt (e.g. pull-to-refresh).
     *
     * @param options - Optional fetch modifiers.
     * @param options.forceRefresh - When true, bypass the apiClient cache on the
     * first attempt and fetch immediately.
     * @returns Resolves when the fetch (and any processing polls) finish.
     */
    fetchDeFiPositions(options?: {
        forceRefresh?: boolean;
    }): Promise<void>;
}
export {};
