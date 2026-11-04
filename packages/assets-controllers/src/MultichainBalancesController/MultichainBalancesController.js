import { BaseController } from '@metamask/base-controller';
import { isEvmAccountType } from '@metamask/keyring-api';
import { KeyringClient } from '@metamask/keyring-snap-client';
import { HandlerType } from '@metamask/snaps-utils';
const controllerName = 'MultichainBalancesController';
/**
 * Constructs the default {@link MultichainBalancesController} state. This allows
 * consumers to provide a partial state object when initializing the controller
 * and also helps in constructing complete state objects for this controller in
 * tests.
 *
 * @returns The default {@link MultichainBalancesController} state.
 */
export function getDefaultMultichainBalancesControllerState() {
    return { balances: {} };
}
/**
 * {@link MultichainBalancesController}'s metadata.
 *
 * This allows us to choose if fields of the state should be persisted or not
 * using the `persist` flag; and if they can be sent to Sentry or not, using
 * the `anonymous` flag.
 */
const balancesControllerMetadata = {
    balances: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: false,
        usedInUi: true,
    },
};
/**
 * The MultichainBalancesController is responsible for fetching and caching account
 * balances.
 */
export class MultichainBalancesController extends BaseController {
    #isDeprecated;
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
    constructor({ messenger, state = {}, isDeprecated = () => false, }) {
        super({
            messenger,
            name: controllerName,
            metadata: balancesControllerMetadata,
            state: {
                ...getDefaultMultichainBalancesControllerState(),
                ...state,
            },
        });
        this.#isDeprecated = isDeprecated;
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
        }
        else {
            // Fetch initial balances for all non-EVM accounts
            for (const account of this.#listAccounts()) {
                // Fetching the balance is asynchronous and we cannot use `await` here.
                // eslint-disable-next-line no-void
                void this.updateBalance(account.id);
            }
        }
        this.messenger.subscribe('AccountsController:accountRemoved', (account) => this.#handleOnAccountRemoved(account));
        this.messenger.subscribe('AccountsController:accountBalancesUpdated', (balanceUpdate) => this.#handleOnAccountBalancesUpdated(balanceUpdate));
        this.messenger.subscribe('MultichainAssetsController:accountAssetListUpdated', 
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async ({ assets }) => {
            const updatedAccountAssets = Object.entries(assets).map(([accountId, { added, removed }]) => ({
                accountId,
                added: [...added],
                removed: [...removed],
            }));
            await this.#handleOnAccountAssetListUpdated(updatedAccountAssets);
        });
    }
    /**
     * Clears all persisted `balances` so that no stale balances remain in state.
     *
     * Called from every entry point when `isDeprecated()` is true so that a
     * runtime toggle propagates to state immediately, even if the controller was
     * originally constructed while it was enabled. The update is skipped when
     * `balances` is already empty to avoid emitting redundant state changes.
     */
    #enforceDisabledState() {
        if (Object.keys(this.state.balances).length === 0) {
            return;
        }
        this.update((state) => {
            state.balances = {};
        });
    }
    /**
     * Reconciles cached balances after a multichain asset-list update event.
     *
     * The event payload is treated as a delta:
     * - balances for `removed` assets are deleted so stale entries cannot remain
     * - balances for `added` assets are fetched from the snap and merged in
     * - if an added asset is not returned by the snap, a zero placeholder is stored
     *   so the asset can still be represented in state
     *
     * @param accounts - The per-account asset deltas from the asset-list update event.
     */
    async #handleOnAccountAssetListUpdated(accounts) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const { isUnlocked } = this.messenger.call('KeyringController:getState');
        if (!isUnlocked) {
            return;
        }
        const balancesToAdd = {};
        for (const { accountId, added } of accounts) {
            if (added.length === 0) {
                continue;
            }
            const account = this.#getAccount(accountId);
            if (account.metadata.snap) {
                const accountBalance = await this.#getBalances(account.id, account.metadata.snap.id, added);
                balancesToAdd[accountId] = accountBalance;
            }
        }
        this.update((state) => {
            for (const { accountId, added, removed } of accounts) {
                const accountBalances = state.balances[accountId] ?? {};
                const addedBalances = balancesToAdd[accountId] ?? {};
                state.balances[accountId] = accountBalances;
                // Remove balances for assets that disappeared from the account asset list
                // so stale entries cannot remain in state.
                for (const assetId of removed) {
                    delete state.balances[accountId][assetId];
                }
                // Merge the balances returned by the snap for the newly added assets.
                for (const [assetId, balance] of Object.entries(addedBalances)) {
                    state.balances[accountId][assetId] = balance;
                }
                // If the asset list was updated but the snap did not return a balance for
                // one of the added assets, keep the asset visible with an explicit zero.
                for (const assetId of added) {
                    if (!state.balances[accountId][assetId]) {
                        state.balances[accountId][assetId] = { amount: '0', unit: '' };
                    }
                }
            }
        });
    }
    /**
     * Updates the balances of one account. This method doesn't return
     * anything, but it updates the state of the controller.
     *
     * @param accountId - The account ID.
     * @param assets - The list of asset types for this account to upadte.
     */
    async #updateBalance(accountId, assets) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const { isUnlocked } = this.messenger.call('KeyringController:getState');
        if (!isUnlocked) {
            return;
        }
        try {
            const account = this.#getAccount(accountId);
            if (account.metadata.snap) {
                const accountBalance = await this.#getBalances(account.id, account.metadata.snap.id, assets);
                this.update((state) => {
                    state.balances[accountId] = accountBalance;
                });
            }
        }
        catch (error) {
            // FIXME: Maybe we shouldn't catch all errors here since this method is also being
            // used in the public methods. This means if something else uses `updateBalance` it
            // won't be able to catch and gets the error itself...
            console.error(`Failed to fetch balances for account ${accountId}:`, error);
        }
    }
    /**
     * Updates the balances of one account. This method doesn't return
     * anything, but it updates the state of the controller.
     *
     * @param accountId - The account ID.
     */
    async updateBalance(accountId) {
        await this.#updateBalance(accountId, this.#listAccountAssets(accountId));
    }
    /**
     * Lists the multichain accounts coming from the `AccountsController`.
     *
     * @returns A list of multichain accounts.
     */
    #listMultichainAccounts() {
        return this.messenger.call('AccountsController:listMultichainAccounts');
    }
    /**
     * Lists the accounts that we should get balances for.
     *
     * @returns A list of accounts that we should get balances for.
     */
    #listAccounts() {
        const accounts = this.#listMultichainAccounts();
        return accounts.filter((account) => this.#isNonEvmAccount(account));
    }
    /**
     * Lists the accounts assets.
     *
     * @param accountId - The account ID.
     * @returns The list of assets for this account, returns an empty list if none.
     */
    #listAccountAssets(accountId) {
        // TODO: Add an action `MultichainAssetsController:getAccountAssets` maybe?
        const assetsState = this.messenger.call('MultichainAssetsController:getState');
        return assetsState.accountsAssets[accountId] ?? [];
    }
    /**
     * Get a non-EVM account from its ID.
     *
     * @param accountId - The account ID.
     * @returns The non-EVM account.
     */
    #getAccount(accountId) {
        const account = this.#listAccounts().find((multichainAccount) => multichainAccount.id === accountId);
        if (!account) {
            throw new Error(`Unknown account: ${accountId}`);
        }
        return account;
    }
    /**
     * Checks for non-EVM accounts.
     *
     * @param account - The new account to be checked.
     * @returns True if the account is a non-EVM account, false otherwise.
     */
    #isNonEvmAccount(account) {
        return (!isEvmAccountType(account.type) &&
            // Non-EVM accounts are backed by a Snap for now
            account.metadata.snap !== undefined);
    }
    /**
     * Handles balance updates received from the AccountsController.
     *
     * @param balanceUpdate - The balance update event containing new balances.
     */
    #handleOnAccountBalancesUpdated(balanceUpdate) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        this.update((state) => {
            Object.entries(balanceUpdate.balances).forEach(([accountId, assetBalances]) => {
                if (accountId in state.balances) {
                    Object.assign(state.balances[accountId], assetBalances);
                }
            });
        });
    }
    /**
     * Handles changes when a new account has been removed.
     *
     * @param accountId - The account ID being removed.
     */
    async #handleOnAccountRemoved(accountId) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        if (accountId in this.state.balances) {
            this.update((state) => {
                delete state.balances[accountId];
            });
        }
    }
    /**
     * Get the balances for an account.
     *
     * @param accountId - ID of the account to get balances for.
     * @param snapId - ID of the Snap which manages the account.
     * @param assetTypes - Array of asset types to get balances for.
     * @returns A map of asset types to balances.
     */
    async #getBalances(accountId, snapId, assetTypes) {
        return await this.#getClient(snapId).getAccountBalances(accountId, assetTypes);
    }
    /**
     * Gets a `KeyringClient` for a Snap.
     *
     * @param snapId - ID of the Snap to get the client for.
     * @returns A `KeyringClient` for the Snap.
     */
    #getClient(snapId) {
        return new KeyringClient({
            send: async (request) => (await this.messenger.call('SnapController:handleRequest', {
                snapId: snapId,
                origin: 'metamask',
                handler: HandlerType.OnKeyringRequest,
                request,
            })),
        });
    }
}
