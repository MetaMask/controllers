import { isEvmAccountType } from '@metamask/keyring-api';
import { StaticIntervalPollingController } from '@metamask/polling-controller';
import { HandlerType } from '@metamask/snaps-utils';
import { Mutex } from 'async-mutex';
import { MAP_CAIP_CURRENCIES } from './constant.js';
/**
 * The name of the MultichainAssetsRatesController.
 */
const controllerName = 'MultichainAssetsRatesController';
/**
 * Constructs the default {@link MultichainAssetsRatesController} state. This allows
 * consumers to provide a partial state object when initializing the controller
 * and also helps in constructing complete state objects for this controller in
 * tests.
 *
 * @returns The default {@link MultichainAssetsRatesController} state.
 */
export function getDefaultMultichainAssetsRatesControllerState() {
    return { conversionRates: {}, historicalPrices: {} };
}
const metadata = {
    conversionRates: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: true,
        usedInUi: true,
    },
    historicalPrices: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: true,
        usedInUi: true,
    },
};
const MESSENGER_EXPOSED_METHODS = [
    'updateAssetsRates',
    'fetchHistoricalPricesForAsset',
];
/**
 * Controller that manages multichain token conversion rates.
 *
 * This controller polls for token conversion rates and updates its state.
 */
export class MultichainAssetsRatesController extends StaticIntervalPollingController() {
    #mutex = new Mutex();
    #currentCurrency;
    #isUnlocked = true;
    #isDeprecated;
    /**
     * Creates an instance of MultichainAssetsRatesController.
     *
     * @param options - Constructor options.
     * @param options.interval - The polling interval in milliseconds.
     * @param options.state - The initial state.
     * @param options.messenger - A reference to the messenger.
     * @param options.isDeprecated - Optional function that returns true to completely
     * disable this controller (no requests, no state updates). When it returns
     * `true`, `conversionRates` and `historicalPrices` are reset to `{}` at
     * construction and at every polling entry point, so no stale rates remain in
     * state. The function is evaluated dynamically on each entry point so it can
     * be toggled at runtime. Intended for use when a higher-level controller
     * (e.g. AssetsController) supersedes this one.
     */
    constructor({ interval = 18000, state = {}, messenger, isDeprecated = () => false, }) {
        super({
            name: controllerName,
            messenger,
            state: {
                ...getDefaultMultichainAssetsRatesControllerState(),
                ...state,
            },
            metadata,
        });
        this.setIntervalLength(interval);
        this.#isDeprecated = isDeprecated;
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
        }
        messenger.registerMethodActionHandlers(this, MESSENGER_EXPOSED_METHODS);
        // Subscribe to keyring lock/unlock events.
        this.messenger.subscribe('KeyringController:lock', () => {
            this.#isUnlocked = false;
        });
        this.messenger.subscribe('KeyringController:unlock', () => {
            this.#isUnlocked = true;
        });
        ({ currentCurrency: this.#currentCurrency } = this.messenger.call('CurrencyRateController:getState'));
        this.messenger.subscribe('CurrencyRateController:stateChange', 
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (currentCurrency) => {
            if (this.#isDeprecated()) {
                this.#enforceDisabledState();
                return;
            }
            this.#currentCurrency = currentCurrency;
            await this.updateAssetsRates();
        }, (currencyRateControllerState) => currencyRateControllerState.currentCurrency);
        this.messenger.subscribe('MultichainAssetsController:accountAssetListUpdated', 
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async ({ assets }) => {
            if (this.#isDeprecated()) {
                this.#enforceDisabledState();
                return;
            }
            // Treat the event payload as a per-account delta so we can fetch only
            // newly added assets and independently clean up removed ones.
            const updatedAccountAssets = Object.entries(assets).map(([accountId, { added, removed }]) => ({
                accountId,
                added: [...added],
                removed: [...removed],
            }));
            await this.#updateAssetsRatesForNewAssets(updatedAccountAssets);
        });
    }
    /**
     * Clears all persisted `conversionRates` and `historicalPrices` so that no
     * stale rates remain in state.
     *
     * Called from every entry point when `isDeprecated()` is true so that a
     * runtime toggle propagates to state immediately, even if the controller was
     * originally constructed while it was enabled. The update is skipped when
     * both fields are already empty to avoid emitting redundant state changes.
     */
    #enforceDisabledState() {
        if (Object.keys(this.state.conversionRates).length === 0 &&
            Object.keys(this.state.historicalPrices).length === 0) {
            return;
        }
        this.update((state) => {
            state.conversionRates = {};
            state.historicalPrices = {};
        });
    }
    /**
     * Executes a poll by updating token conversion rates for the current account.
     *
     * @returns A promise that resolves when the polling completes.
     */
    async _executePoll() {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        await this.updateAssetsRates();
    }
    /**
     * Determines whether the controller is active.
     *
     * @returns True if the keyring is unlocked; otherwise, false.
     */
    get isActive() {
        return this.#isUnlocked;
    }
    /**
     * Checks if an account is a non-EVM account with a Snap.
     *
     * @param account - The account to check.
     * @returns True if the account is non-EVM and has Snap metadata; otherwise, false.
     */
    #isNonEvmAccount(account) {
        return (!isEvmAccountType(account.type) && account.metadata.snap !== undefined);
    }
    /**
     * Retrieves all multichain accounts from the AccountsController.
     *
     * @returns An array of internal accounts.
     */
    #listMultichainAccounts() {
        return this.messenger.call('AccountsController:listMultichainAccounts');
    }
    /**
     * Filters and returns non-EVM accounts that should have balances.
     *
     * @returns An array of non-EVM internal accounts.
     */
    #listAccounts() {
        const accounts = this.#listMultichainAccounts();
        return accounts.filter((account) => this.#isNonEvmAccount(account));
    }
    /**
     * Adds the assets to a map of Snap ID to assets.
     *
     * @param snapIdToAssets - The map of Snap ID to assets.
     * @param account - The account to add the assets for.
     * @param assets - The assets to add.
     */
    #addAssetsToSnapIdMap(snapIdToAssets, account, assets) {
        // Prevent creating a new set if there are no assets to add.
        if (assets.length === 0) {
            return;
        }
        // FIXME: Instead of using the Snap ID from the account, we should
        // select the Snap based on the supported scopes defined in the Snaps'
        // manifest.
        const snapId = account.metadata.snap?.id;
        if (!snapId) {
            return;
        }
        let snapAssets = snapIdToAssets.get(snapId);
        if (!snapAssets) {
            snapAssets = new Set();
            snapIdToAssets.set(snapId, snapAssets);
        }
        for (const asset of assets) {
            snapAssets.add(asset);
        }
    }
    /**
     * Updates token conversion rates for each non-EVM account.
     *
     * @returns A promise that resolves when the rates are updated.
     */
    async updateAssetsRates() {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return Promise.resolve();
        }
        const releaseLock = await this.#mutex.acquire();
        return (async () => {
            if (!this.isActive) {
                return;
            }
            // Compute the set of unique assets from all accounts. It's important to
            // deduplicate assets here to avoid duplicate requests to the Snap.
            const accounts = this.#listAccounts();
            const snapIdToAssets = new Map();
            for (const account of accounts) {
                this.#addAssetsToSnapIdMap(snapIdToAssets, account, this.#getAssetsForAccount(account.id));
            }
            this.#applyUpdatedRates(await this.#getUpdatedRatesFor(snapIdToAssets));
        })().finally(() => {
            releaseLock();
        });
    }
    /**
     * Returns the CAIP-19 asset type for the current selected currency. Defaults
     * to USD if the current selected currency is not supported.
     *
     * @returns The CAIP-19 asset type for the current selected currency.
     */
    #getCaipCurrentCurrency() {
        return (MAP_CAIP_CURRENCIES[this.#currentCurrency] ?? MAP_CAIP_CURRENCIES.usd);
    }
    /**
     * Fetches the conversion rates for the given assets from the given Snap.
     *
     * @param snapId - The ID of the Snap.
     * @param assets - The assets to fetch the conversion rates for.
     * @param currency - The currency to fetch the conversion rates for.
     * @returns A record of CAIP-19 asset types to conversion rates.
     */
    async #getConversionRates(snapId, assets, currency) {
        // Prevent making a Snap call if there are no assets to fetch.
        if (assets.size === 0) {
            return {};
        }
        const response = await this.#handleSnapRequest({
            snapId,
            handler: HandlerType.OnAssetsConversion,
            params: {
                conversions: Array.from(assets).map((asset) => ({
                    from: asset,
                    to: currency,
                })),
            },
        });
        if (!response) {
            return {};
        }
        const assetToConversionRate = {};
        for (const asset of assets) {
            assetToConversionRate[asset] =
                response.conversionRates?.[asset]?.[currency] ?? undefined;
        }
        return assetToConversionRate;
    }
    /**
     * Fetches the market data for the given assets from the given Snap.
     *
     * @param snapId - The ID of the Snap.
     * @param assets - The assets to fetch the market data for.
     * @param currency - The currency to fetch the market data for.
     * @returns A record of CAIP-19 asset types to market data.
     */
    async #getMarketData(snapId, assets, currency) {
        // Prevent making a Snap call if there are no assets to fetch.
        if (assets.size === 0) {
            return {};
        }
        const response = await this.#handleSnapRequest({
            snapId,
            handler: HandlerType.OnAssetsMarketData,
            params: {
                assets: Array.from(assets).map((asset) => ({
                    asset,
                    unit: currency,
                })),
            },
        });
        if (!response) {
            return {};
        }
        const assetToMarketData = {};
        for (const asset of assets) {
            const assetMarketData = response.marketData?.[asset]?.[currency];
            // We do not consider NFTs here, so `fungible` must be `true`.
            if (assetMarketData?.fungible) {
                assetToMarketData[asset] = assetMarketData;
            }
            else {
                assetToMarketData[asset] = undefined;
            }
        }
        return assetToMarketData;
    }
    /**
     * Fetches the updated rates for the given assets from the given Snaps.
     *
     * @param snapIdToAssets - A map of Snap ID to CAIP-19 asset types.
     * @returns A record of CAIP-19 asset types to unified asset conversions.
     */
    async #getUpdatedRatesFor(snapIdToAssets) {
        const updatedRates = {};
        // Keep a local copy to ensure that the currency is always the same for the
        // entire loop.
        const currency = this.#getCaipCurrentCurrency();
        // Note: Since the assets come from a 1-to-1 mapping with Snap IDs, we know
        // that a given asset will not appear under multiple Snap IDs.
        for (const [snapId, assets] of snapIdToAssets.entries()) {
            const [rates, marketData] = await Promise.all([
                this.#getConversionRates(snapId, assets, currency),
                this.#getMarketData(snapId, assets, currency),
            ]);
            for (const asset of assets) {
                const assetRate = rates[asset];
                const assetMarketData = marketData[asset];
                // Rates are mandatory, so skip the asset if not available.
                if (!assetRate) {
                    continue;
                }
                updatedRates[asset] = {
                    currency,
                    ...assetRate,
                    ...(assetMarketData && { marketData: assetMarketData }),
                };
            }
        }
        return updatedRates;
    }
    /**
     * Fetches historical prices for the current account
     *
     * @param asset - The asset to fetch historical prices for.
     * @param account - optional account to fetch historical prices for
     * @returns The historical prices.
     */
    async fetchHistoricalPricesForAsset(asset, account) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return Promise.resolve();
        }
        const releaseLock = await this.#mutex.acquire();
        return (async () => {
            const currentCaipCurrency = MAP_CAIP_CURRENCIES[this.#currentCurrency] ?? MAP_CAIP_CURRENCIES.usd;
            // Check if we already have historical prices for this asset and currency
            const historicalPriceExpirationTime = this.state.historicalPrices[asset]?.[this.#currentCurrency]
                ?.expirationTime;
            const historicalPriceHasExpired = historicalPriceExpirationTime &&
                historicalPriceExpirationTime < Date.now();
            if (historicalPriceHasExpired === false) {
                return;
            }
            const selectedAccount = account ??
                this.messenger.call('AccountsController:getSelectedMultichainAccount');
            try {
                const historicalPricesResponse = await this.messenger.call('SnapController:handleRequest', {
                    snapId: selectedAccount?.metadata.snap?.id,
                    origin: 'metamask',
                    handler: HandlerType.OnAssetHistoricalPrice,
                    request: {
                        jsonrpc: '2.0',
                        method: HandlerType.OnAssetHistoricalPrice,
                        params: {
                            from: asset,
                            to: currentCaipCurrency,
                        },
                    },
                });
                // skip state update if no historical prices are returned
                if (!historicalPricesResponse) {
                    return;
                }
                this.update((state) => {
                    state.historicalPrices = {
                        ...state.historicalPrices,
                        [asset]: {
                            ...state.historicalPrices[asset],
                            [this.#currentCurrency]: historicalPricesResponse?.historicalPrice,
                        },
                    };
                });
            }
            catch {
                throw new Error(`Failed to fetch historical prices for asset: ${asset}`);
            }
        })().finally(() => {
            releaseLock();
        });
    }
    /**
     * Reconciles cached rates after an account asset-list update event.
     *
     * The event payload is treated as a delta:
     * - `added` assets are batched by Snap and fetched for fresh rates
     * - `removed` assets are deleted from cached state only if they are no longer tracked by any account
     *
     * This global check is required because rate state is keyed by asset rather
     * than by account, so the same asset may still be shared by another account.
     *
     * @param accounts - The per-account asset deltas from the asset-list update event.
     * @returns A promise that resolves when the rates are updated.
     */
    async #updateAssetsRatesForNewAssets(accounts) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return Promise.resolve();
        }
        const releaseLock = await this.#mutex.acquire();
        return (async () => {
            if (!this.isActive) {
                return;
            }
            // First build a map containing all assets that need to be updated per
            // Snap ID, this will be used to batch the requests.
            const snapIdToAssets = new Map();
            const removedAssets = new Set();
            for (const { accountId, added, removed } of accounts) {
                if (added.length !== 0) {
                    // Only newly added assets need fresh rate requests.
                    this.#addAssetsToSnapIdMap(snapIdToAssets, this.#getAccount(accountId), added);
                }
                // Collect removed assets separately so we can decide later whether they
                // are truly stale or still referenced by another account.
                for (const asset of removed) {
                    removedAssets.add(asset);
                }
            }
            const updatedRates = await this.#getUpdatedRatesFor(snapIdToAssets);
            // Rates are stored globally by asset, so delete only assets that no
            // longer exist in any account asset list.
            const assetsToDelete = Array.from(removedAssets).filter((asset) => !this.#isAssetTracked(asset));
            this.#applyUpdatedRates(updatedRates, assetsToDelete);
        })().finally(() => {
            releaseLock();
        });
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
     * Returns the array of CAIP-19 assets for the given account ID.
     * If none are found, returns an empty array.
     *
     * @param accountId - The account ID to get the assets for.
     * @returns An array of CAIP-19 assets.
     */
    #getAssetsForAccount(accountId) {
        // Always fetch fresh state - MultichainAssetsController uses Immer which creates
        // new object references on every update, so caching would become stale.
        const { accountsAssets } = this.messenger.call('MultichainAssetsController:getState');
        return accountsAssets?.[accountId] ?? [];
    }
    /**
     * Applies fresh rates and removes stale asset-rate state in one update.
     *
     * @param updatedRates - The latest conversion rates fetched for added assets.
     * @param removedAssets - Assets that should be purged because they are no longer tracked by any account.
     */
    #applyUpdatedRates(updatedRates, removedAssets = []) {
        if (Object.keys(updatedRates).length === 0 && removedAssets.length === 0) {
            return;
        }
        this.update((state) => {
            // Drop both current rates and historical prices for assets that are no
            // longer referenced anywhere in MultichainAssetsController state.
            for (const asset of removedAssets) {
                delete state.conversionRates[asset];
                delete state.historicalPrices[asset];
            }
            // Merge the freshly fetched rates after cleanup.
            state.conversionRates = {
                ...state.conversionRates,
                ...updatedRates,
            };
        });
    }
    /**
     * Checks whether an asset is still tracked by any account in
     * MultichainAssetsController state.
     *
     * @param asset - The asset to check.
     * @returns True if the asset still exists in any account asset list.
     */
    #isAssetTracked(asset) {
        const { accountsAssets } = this.messenger.call('MultichainAssetsController:getState');
        // Rate state is global per asset, so inspect all account asset lists before
        // deciding whether a removed asset should be purged from cache.
        return Object.values(accountsAssets ?? {}).some((accountAssets) => accountAssets.includes(asset));
    }
    async #handleSnapRequest(args) {
        const { snapId, handler, params } = args;
        try {
            return await this.messenger.call('SnapController:handleRequest', {
                snapId,
                origin: 'metamask',
                handler,
                request: {
                    jsonrpc: '2.0',
                    method: handler,
                    params,
                },
            });
        }
        catch (error) {
            console.error(`Snap request failed for ${handler}:`, {
                snapId,
                handler,
                message: error.message,
                params,
            });
            return undefined;
        }
    }
}
