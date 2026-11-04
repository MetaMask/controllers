import { Web3Provider } from '@ethersproject/providers';
import { BNToHex, isEqualCaseInsensitive, isValidHexAddress, safelyExecuteWithTimeout, toChecksumHexAddress, toHex, } from '@metamask/controller-utils';
import { StaticIntervalPollingController } from '@metamask/polling-controller';
import { isCaipAssetType, isCaipChainId, isStrictHexString, parseCaipAssetType, parseCaipChainId, } from '@metamask/utils';
import { produce } from 'immer';
import { isEqual, union } from 'lodash-es';
import { STAKING_CONTRACT_ADDRESS_BY_CHAINID } from './AssetsContractController.js';
import { MUSD_ERC20_ADDRESS_LOWER, MUSD_TOKEN_DETECTION_CHAIN_IDS, } from './constants.js';
import { AccountsApiBalanceFetcher } from './multi-chain-accounts-service/api-balance-fetcher.js';
import { RpcBalanceFetcher } from './rpc-service/rpc-balance-fetcher.js';
import { createBatchedHandler } from './utils/create-batch-handler.js';
const MUSD_IMPORT_CHAIN_ID_SET = new Set(MUSD_TOKEN_DETECTION_CHAIN_IDS);
const CONTROLLER = 'TokenBalancesController';
const DEFAULT_INTERVAL_MS = 30_000; // 30 seconds
const DEFAULT_WEBSOCKET_ACTIVE_POLLING_INTERVAL_MS = 300_000; // 5 minutes
/** Debounce wait (ms) for coalescing rapid updateBalances calls before flush */
export const UPDATE_BALANCES_BATCH_MS = 200;
/**
 * Merges two UpdateBalancesOptions per queue-and-merge rules:
 * - chainIds: union of both lists when each option includes `chainIds`; if either omits `chainIds`, the merged field is undefined (all chains).
 * - tokenAddresses: union of both lists when each option includes `tokenAddresses`; if either omits `tokenAddresses`, the merged field is undefined (all tokens).
 * - queryAllAccounts: true if either is true.
 * Exported for tests.
 *
 * @param a - First options (e.g. accumulated).
 * @param b - Second options to merge in.
 * @returns New merged options.
 */
export function mergeUpdateBalancesOptions(a, b) {
    const chainIds = a.chainIds && b.chainIds && union(a.chainIds, b.chainIds);
    const tokenAddresses = a.tokenAddresses &&
        b.tokenAddresses &&
        union(a.tokenAddresses, b.tokenAddresses);
    const queryAllAccounts = Boolean(a.queryAllAccounts) || Boolean(b.queryAllAccounts);
    return { chainIds, tokenAddresses, queryAllAccounts };
}
const metadata = {
    tokenBalances: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: false,
        usedInUi: true,
    },
};
const draft = (base, fn) => produce(base, fn);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const checksum = (addr) => toChecksumHexAddress(addr);
/**
 * Convert CAIP chain ID or hex chain ID to hex chain ID.
 *
 * @param chainId - CAIP chain ID or hex chain ID.
 * @returns Hex chain ID.
 */
export const caipChainIdToHex = (chainId) => {
    if (isStrictHexString(chainId)) {
        return chainId;
    }
    if (isCaipChainId(chainId)) {
        return toHex(parseCaipChainId(chainId).reference);
    }
    throw new Error('caipChainIdToHex - Failed to provide CAIP-2 or Hex chainId');
};
/**
 * Extract token address from asset type.
 *
 * @param assetType - Asset type string.
 * @returns Tuple of [tokenAddress, isNativeToken] or null if invalid.
 */
export const parseAssetType = (assetType) => {
    if (!isCaipAssetType(assetType)) {
        return null;
    }
    const parsed = parseCaipAssetType(assetType);
    if (parsed.assetNamespace === 'erc20') {
        return [parsed.assetReference, false];
    }
    if (parsed.assetNamespace === 'slip44') {
        return [ZERO_ADDRESS, true];
    }
    return null;
};
const MESSENGER_EXPOSED_METHODS = [
    'updateChainPollingConfigs',
    'getChainPollingConfig',
    'updateBalances',
    'resetState',
];
export class TokenBalancesController extends StaticIntervalPollingController() {
    #platform;
    #queryAllAccounts;
    #accountsApiChainIds;
    #allowExternalServices;
    #isOnboarded;
    #isDeprecated;
    #balanceFetchers;
    #allTokens = {};
    #detectedTokens = {};
    #allIgnoredTokens = {};
    /** Default polling interval for chains without specific configuration */
    #defaultInterval;
    /** Polling interval when WebSocket is active and providing real-time updates */
    #websocketActivePollingInterval;
    /** Per-chain polling configuration */
    #chainPollingConfig;
    /** Active polling timers grouped by interval */
    #intervalPollingTimers = new Map();
    /** Track if controller-level polling is active */
    #isControllerPollingActive = false;
    /** Track if the keyring is unlocked */
    #isUnlocked = false;
    /** Store original chainIds from startPolling to preserve intent */
    #requestedChainIds = [];
    /** Debouncing for rapid status changes to prevent excessive HTTP calls */
    #statusChangeDebouncer = {
        timer: null,
        pendingChanges: new Map(),
    };
    #batchedUpdateBalances;
    constructor({ messenger, interval = DEFAULT_INTERVAL_MS, websocketActivePollingInterval = DEFAULT_WEBSOCKET_ACTIVE_POLLING_INTERVAL_MS, chainPollingIntervals = {}, state = {}, queryMultipleAccounts = true, accountsApiChainIds = () => [], allowExternalServices = () => true, platform, isOnboarded = () => true, isDeprecated = () => false, }) {
        super({
            name: CONTROLLER,
            messenger,
            metadata,
            state: { tokenBalances: {}, ...state },
        });
        this.#normalizeAccountAddresses();
        this.#platform = platform ?? 'extension';
        this.#queryAllAccounts = queryMultipleAccounts;
        this.#accountsApiChainIds = accountsApiChainIds;
        this.#allowExternalServices = allowExternalServices;
        this.#isOnboarded = isOnboarded;
        this.#isDeprecated = isDeprecated;
        this.#defaultInterval = interval;
        this.#websocketActivePollingInterval = websocketActivePollingInterval;
        this.#chainPollingConfig = { ...chainPollingIntervals };
        // Always include AccountsApiFetcher - it dynamically checks allowExternalServices() in supports()
        this.#balanceFetchers = [
            {
                fetcher: this.#createAccountsApiFetcher(),
                name: 'AccountsApiFetcher',
            },
            {
                fetcher: new RpcBalanceFetcher(this.#getProvider, this.#getNetworkClient, () => ({
                    allTokens: this.#allTokens,
                    allDetectedTokens: this.#detectedTokens,
                })),
                name: 'RpcFetcher',
            },
        ];
        this.setIntervalLength(interval);
        const { allTokens, allDetectedTokens, allIgnoredTokens } = this.messenger.call('TokensController:getState');
        this.#allTokens = allTokens;
        this.#detectedTokens = allDetectedTokens;
        this.#allIgnoredTokens = allIgnoredTokens;
        const { isUnlocked } = this.messenger.call('KeyringController:getState');
        this.#isUnlocked = isUnlocked;
        this.#batchedUpdateBalances = createBatchedHandler((buffer) => buffer.length === 0
            ? {}
            : buffer
                .slice(1)
                .reduce((acc, opts) => mergeUpdateBalancesOptions(acc, opts), buffer[0]), UPDATE_BALANCES_BATCH_MS, (merged) => this.#executeUpdateBalances(merged));
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
        }
        this.#subscribeToControllers();
        messenger.registerMethodActionHandlers(this, MESSENGER_EXPOSED_METHODS);
    }
    /**
     * Clears all persisted `tokenBalances` so that no stale balances remain in
     * state.
     *
     * Called from every entry point when `isDeprecated()` is true so that a runtime
     * toggle propagates to state immediately, even if the controller was originally
     * constructed while it was enabled. The update is skipped when `tokenBalances`
     * is already empty to avoid emitting redundant state changes.
     */
    #enforceDisabledState() {
        if (Object.keys(this.state.tokenBalances).length === 0) {
            return;
        }
        this.update(() => ({ tokenBalances: {} }));
    }
    #subscribeToControllers() {
        this.messenger.subscribe('TokensController:stateChange', (tokensState) => {
            this.#onTokensChanged(tokensState).catch((error) => {
                console.warn('Error handling token state change:', error);
            });
        });
        this.messenger.subscribe('NetworkController:stateChange', this.#onNetworkChanged);
        this.messenger.subscribe('KeyringController:unlock', () => {
            this.#isUnlocked = true;
        });
        this.messenger.subscribe('KeyringController:lock', () => {
            this.#isUnlocked = false;
        });
        this.messenger.subscribe('KeyringController:accountRemoved', this.#onAccountRemoved);
        this.messenger.subscribe('AccountsController:selectedEvmAccountChange', this.#onAccountChanged);
        this.messenger.subscribe('AccountActivityService:balanceUpdated', (event) => {
            this.#onAccountActivityBalanceUpdate(event).catch((error) => {
                console.warn('Error handling balance update:', error);
            });
        });
        this.messenger.subscribe('AccountActivityService:statusChanged', this.#onAccountActivityStatusChanged.bind(this));
        this.messenger.subscribe('TransactionController:transactionConfirmed', (transactionMeta) => {
            this.updateBalances({
                chainIds: [transactionMeta.chainId],
            }).catch(() => {
                // Silently handle balance update errors
            });
        });
    }
    /**
     * Whether the controller is active (keyring is unlocked and user is onboarded).
     * When locked or not onboarded, balance updates should be skipped.
     *
     * @returns Whether the controller should perform balance updates.
     */
    get isActive() {
        return this.#isUnlocked && this.#isOnboarded();
    }
    /**
     * Normalize all account addresses to lowercase and merge duplicates
     * Handles migration from old state where addresses might be checksummed.
     */
    #normalizeAccountAddresses() {
        const currentState = this.state.tokenBalances;
        const normalizedBalances = {};
        for (const address of Object.keys(currentState)) {
            const lowercaseAddress = address.toLowerCase();
            const accountBalances = currentState[address];
            if (!accountBalances) {
                continue;
            }
            normalizedBalances[lowercaseAddress] ??= {};
            for (const chainId of Object.keys(accountBalances)) {
                const chainIdKey = chainId;
                normalizedBalances[lowercaseAddress][chainIdKey] ??= {};
                Object.assign(normalizedBalances[lowercaseAddress][chainIdKey], accountBalances[chainIdKey]);
            }
        }
        if (Object.keys(currentState).length !==
            Object.keys(normalizedBalances).length ||
            Object.keys(currentState).some((addr) => addr !== addr.toLowerCase())) {
            this.update(() => ({ tokenBalances: normalizedBalances }));
        }
    }
    #chainIdsWithTokens() {
        return [
            ...new Set([
                ...Object.keys(this.#allTokens),
                ...Object.keys(this.#detectedTokens),
            ]),
        ];
    }
    #getProvider = (chainId) => {
        const { networkConfigurationsByChainId } = this.messenger.call('NetworkController:getState');
        const networkConfig = networkConfigurationsByChainId[chainId];
        const { networkClientId } = networkConfig.rpcEndpoints[networkConfig.defaultRpcEndpointIndex];
        const client = this.messenger.call('NetworkController:getNetworkClientById', networkClientId);
        return new Web3Provider(client.provider);
    };
    #getNetworkClient = (chainId) => {
        const { networkConfigurationsByChainId } = this.messenger.call('NetworkController:getState');
        const networkConfig = networkConfigurationsByChainId[chainId];
        const { networkClientId } = networkConfig.rpcEndpoints[networkConfig.defaultRpcEndpointIndex];
        return this.messenger.call('NetworkController:getNetworkClientById', networkClientId);
    };
    #createAccountsApiFetcher = () => {
        const originalFetcher = new AccountsApiBalanceFetcher(this.#platform, this.#getProvider, () => this.state.tokenBalances);
        return {
            // Dynamically check allowExternalServices() at call time, not just at construction time
            supports: (chainId) => this.#allowExternalServices() &&
                this.#accountsApiChainIds().includes(chainId) &&
                originalFetcher.supports(chainId),
            fetch: originalFetcher.fetch.bind(originalFetcher),
        };
    };
    _startPolling({ chainIds }) {
        this.#requestedChainIds = [...chainIds];
        this.#isControllerPollingActive = true;
        this.#startIntervalGroupPolling(chainIds, true);
    }
    #startIntervalGroupPolling(chainIds, immediate = true) {
        this.#intervalPollingTimers.forEach((timer) => clearInterval(timer));
        this.#intervalPollingTimers.clear();
        const intervalGroups = new Map();
        for (const chainId of chainIds) {
            const config = this.getChainPollingConfig(chainId);
            const group = intervalGroups.get(config.interval) ?? [];
            group.push(chainId);
            intervalGroups.set(config.interval, group);
        }
        for (const [interval, chainIdsGroup] of intervalGroups) {
            this.#startPollingForInterval(interval, chainIdsGroup, immediate);
        }
    }
    #startPollingForInterval(interval, chainIds, immediate = true) {
        const pollFunction = async () => {
            if (!this.#isControllerPollingActive) {
                return;
            }
            try {
                await this._executePoll({ chainIds });
            }
            catch (error) {
                console.warn(`Polling failed for chains ${chainIds.join(', ')} with interval ${interval}:`, error);
            }
        };
        if (immediate) {
            pollFunction().catch((error) => {
                console.warn(`Immediate polling failed for chains ${chainIds.join(', ')}:`, error);
            });
        }
        this.#setPollingTimer(interval, chainIds, pollFunction);
    }
    #setPollingTimer(interval, chainIds, pollFunction) {
        const timer = setInterval(() => {
            pollFunction().catch((error) => {
                console.warn(`Interval polling failed for chains ${chainIds.join(', ')}:`, error);
            });
        }, interval);
        this.#intervalPollingTimers.set(interval, timer);
    }
    _stopPollingByPollingTokenSetId(tokenSetId) {
        let chainsToStop = [];
        try {
            const parsedTokenSetId = JSON.parse(tokenSetId);
            chainsToStop = parsedTokenSetId.chainIds ?? [];
        }
        catch (error) {
            console.warn('Failed to parse tokenSetId, stopping all polling:', error);
            this.#stopAllPolling();
            return;
        }
        const currentChainsSet = new Set(this.#requestedChainIds);
        const stopChainsSet = new Set(chainsToStop);
        const isCurrentSession = currentChainsSet.size === stopChainsSet.size &&
            [...currentChainsSet].every((chain) => stopChainsSet.has(chain));
        if (isCurrentSession) {
            this.#stopAllPolling();
        }
    }
    #stopAllPolling() {
        this.#isControllerPollingActive = false;
        this.#requestedChainIds = [];
        this.#intervalPollingTimers.forEach((timer) => clearInterval(timer));
        this.#intervalPollingTimers.clear();
    }
    getChainPollingConfig(chainId) {
        return (this.#chainPollingConfig[chainId] ?? {
            interval: this.#defaultInterval,
        });
    }
    async _executePoll({ chainIds, queryAllAccounts = false, }) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        await this.#executeUpdateBalances({ chainIds, queryAllAccounts });
    }
    updateChainPollingConfigs(configs, options = { immediateUpdate: true }) {
        Object.assign(this.#chainPollingConfig, configs);
        if (this.#isControllerPollingActive) {
            this.#startIntervalGroupPolling(this.#requestedChainIds, options.immediateUpdate);
        }
    }
    async updateBalances(options = {}) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        if (!this.isActive) {
            return;
        }
        await this.#batchedUpdateBalances(options);
    }
    async #executeUpdateBalances({ chainIds, tokenAddresses, queryAllAccounts = false, } = {}) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        if (!this.isActive) {
            return;
        }
        const targetChains = this.#getTargetChains(chainIds);
        if (!targetChains.length) {
            return;
        }
        const { selectedAccount, allAccounts, jwtToken } = await this.#getAccountsAndJwt();
        const aggregatedBalances = await this.#fetchAllBalances({
            targetChains,
            selectedAccount,
            allAccounts,
            jwtToken,
            queryAllAccounts: queryAllAccounts ?? this.#queryAllAccounts,
        });
        const filteredAggregated = this.#filterByTokenAddresses(aggregatedBalances, tokenAddresses);
        const accountsToProcess = this.#getAccountsToProcess(queryAllAccounts, allAccounts, selectedAccount);
        const prev = this.state;
        const next = this.#applyTokenBalancesToState({
            prev,
            targetChains,
            accountsToProcess,
            balances: filteredAggregated,
        });
        if (!isEqual(prev, next)) {
            this.update(() => next);
            const accountTrackerState = this.messenger.call('AccountTrackerController:getState');
            const nativeUpdates = this.#buildNativeBalanceUpdates(filteredAggregated, accountTrackerState);
            if (nativeUpdates.length > 0) {
                this.messenger.call('AccountTrackerController:updateNativeBalances', nativeUpdates);
            }
            const stakedUpdates = this.#buildStakedBalanceUpdates(filteredAggregated, accountTrackerState);
            if (stakedUpdates.length > 0) {
                this.messenger.call('AccountTrackerController:updateStakedBalances', stakedUpdates);
            }
        }
        await this.#importUntrackedTokens(filteredAggregated, targetChains);
    }
    #getTargetChains(chainIds) {
        return chainIds?.length ? chainIds : this.#chainIdsWithTokens();
    }
    async #getAccountsAndJwt() {
        const { address: selected } = this.messenger.call('AccountsController:getSelectedAccount');
        const allAccounts = this.messenger.call('AccountsController:listAccounts');
        const jwtToken = await safelyExecuteWithTimeout(() => {
            return this.messenger.call('AuthenticationController:getBearerToken');
        }, false, 5000);
        return {
            selectedAccount: selected,
            allAccounts,
            jwtToken,
        };
    }
    async #fetchAllBalances({ targetChains, selectedAccount, allAccounts, jwtToken, queryAllAccounts, }) {
        const aggregated = [];
        let remainingChains = [...targetChains];
        let previousUnprocessedTokens;
        let previousFetcherName;
        for (const { fetcher, name: fetcherName } of this.#balanceFetchers) {
            const supportedChains = remainingChains.filter((chain) => fetcher.supports(chain));
            if (!supportedChains.length) {
                continue;
            }
            try {
                const result = await fetcher.fetch({
                    chainIds: supportedChains,
                    queryAllAccounts,
                    selectedAccount,
                    allAccounts,
                    jwtToken,
                    unprocessedTokens: previousUnprocessedTokens,
                });
                // Add balances, and removed processed chains
                if (result.balances?.length) {
                    aggregated.push(...result.balances);
                    const processed = new Set(result.balances.map((b) => b.chainId));
                    remainingChains = remainingChains.filter((chain) => !processed.has(chain));
                }
                // Add unprocessed chains (from missing chains or missing tokens)
                if (result.unprocessedChainIds || result.unprocessedTokens) {
                    const resultUnprocessedChains = result.unprocessedChainIds ?? [];
                    const resultUnsupportedTokenChains = Object.entries(result.unprocessedTokens ?? {}).flatMap(([_account, chainMap]) => Object.keys(chainMap));
                    const unprocessedChainIds = Array.from(new Set([
                        ...resultUnprocessedChains,
                        ...resultUnsupportedTokenChains,
                    ]));
                    remainingChains = Array.from(new Set([...remainingChains, ...unprocessedChainIds]));
                    this.messenger
                        .call('TokenDetectionController:detectTokens', {
                        chainIds: unprocessedChainIds,
                        forceRpc: true,
                    })
                        .catch(() => {
                        // Silently handle token detection errors
                    });
                }
                // Balance Error Reporting - for unprocessed tokens from last fetcher, if balances are retrieved
                const unprocessedTokensForReporting = previousUnprocessedTokens;
                if (unprocessedTokensForReporting && result.balances?.length) {
                    const confirmedUnprocessedTokens = [];
                    // Capture balances that were found (> 0 balance), and was unprocessed
                    result.balances.forEach((bal) => {
                        const lowercaseAccount = bal.account.toLowerCase();
                        const lowercaseTokenAddress = bal.token.toLowerCase();
                        const hasResultBalance = bal.success && bal.token && bal.value && !bal.value.isZero();
                        const isUnprocessed = unprocessedTokensForReporting?.[lowercaseAccount]?.[bal.chainId]?.includes(lowercaseTokenAddress);
                        if (hasResultBalance && isUnprocessed) {
                            confirmedUnprocessedTokens.push({
                                chainId: bal.chainId,
                                tokenAddress: lowercaseTokenAddress,
                            });
                        }
                    });
                    const confirmedUnprocessedTokenStrings = confirmedUnprocessedTokens.map((token) => `${token.chainId}:${token.tokenAddress}`);
                    if (confirmedUnprocessedTokens.length) {
                        console.warn(`TokenBalanceController: fetcher ${previousFetcherName} did not process tokens (instead handled by fetcher ${fetcherName}): ${confirmedUnprocessedTokenStrings.join(', ')}`);
                    }
                }
                // Set new previous fields
                previousUnprocessedTokens = result.unprocessedTokens;
                previousFetcherName = fetcherName;
            }
            catch (error) {
                console.warn(`Balance fetcher failed for chains ${supportedChains.join(', ')}: ${String(error)}`);
                this.messenger
                    .call('TokenDetectionController:detectTokens', {
                    chainIds: supportedChains,
                    forceRpc: true,
                })
                    .catch(() => {
                    // Silently handle token detection errors
                });
            }
            if (!remainingChains.length) {
                break;
            }
        }
        return aggregated;
    }
    #filterByTokenAddresses(balances, tokenAddresses) {
        if (!tokenAddresses?.length) {
            return balances;
        }
        const lowered = tokenAddresses.map((a) => a.toLowerCase());
        return balances.filter((balance) => lowered.includes(balance.token.toLowerCase()));
    }
    #getAccountsToProcess(queryAllAccountsParam, allAccounts, selectedAccount) {
        const effectiveQueryAll = queryAllAccountsParam ?? this.#queryAllAccounts ?? false;
        if (!effectiveQueryAll) {
            return [selectedAccount];
        }
        return allAccounts.map((account) => account.address);
    }
    #applyTokenBalancesToState({ prev, targetChains, accountsToProcess, balances, }) {
        return draft(prev, (draftState) => {
            for (const chainId of targetChains) {
                for (const account of accountsToProcess) {
                    draftState.tokenBalances[account] ??= {};
                    draftState.tokenBalances[account][chainId] ??= {};
                    const chainTokens = this.#allTokens[chainId];
                    if (chainTokens?.[account]) {
                        Object.values(chainTokens[account]).forEach((token) => {
                            const tokenAddress = checksum(token.address);
                            draftState.tokenBalances[account][chainId][tokenAddress] ??=
                                '0x0';
                        });
                    }
                    const detectedChainTokens = this.#detectedTokens[chainId];
                    if (detectedChainTokens?.[account]) {
                        Object.values(detectedChainTokens[account]).forEach((token) => {
                            const tokenAddress = checksum(token.address);
                            draftState.tokenBalances[account][chainId][tokenAddress] ??=
                                '0x0';
                        });
                    }
                }
            }
            balances.forEach(({ success, value, account, token, chainId }) => {
                if (!success || value === undefined) {
                    return;
                }
                const lowerCaseAccount = account.toLowerCase();
                const newBalance = toHex(value);
                const tokenAddress = checksum(token);
                const currentBalance = draftState.tokenBalances[lowerCaseAccount]?.[chainId]?.[tokenAddress];
                if (currentBalance !== newBalance) {
                    ((draftState.tokenBalances[lowerCaseAccount] ??= {})[chainId] ??= {})[tokenAddress] = newBalance;
                }
            });
        });
    }
    #buildNativeBalanceUpdates(balances, accountTrackerState) {
        const nativeBalances = balances.filter((balance) => balance.success && balance.token === ZERO_ADDRESS);
        if (!nativeBalances.length) {
            return [];
        }
        return nativeBalances
            .map((balance) => ({
            address: balance.account,
            chainId: balance.chainId,
            balance: balance.value ? BNToHex(balance.value) : '0x0',
        }))
            .filter((update) => {
            const currentBalance = accountTrackerState.accountsByChainId[update.chainId]?.[checksum(update.address)]?.balance;
            return currentBalance !== update.balance;
        });
    }
    #buildStakedBalanceUpdates(balances, accountTrackerState) {
        const stakedBalances = balances.filter((balance) => {
            if (!balance.success || balance.token === ZERO_ADDRESS) {
                return false;
            }
            const stakingContractAddress = STAKING_CONTRACT_ADDRESS_BY_CHAINID[balance.chainId];
            return (stakingContractAddress?.toLowerCase() === balance.token.toLowerCase());
        });
        if (!stakedBalances.length) {
            return [];
        }
        return stakedBalances
            .map((balance) => ({
            address: balance.account,
            chainId: balance.chainId,
            stakedBalance: balance.value ? toHex(balance.value) : '0x0',
        }))
            .filter((update) => {
            const currentStakedBalance = accountTrackerState.accountsByChainId[update.chainId]?.[checksum(update.address)]?.stakedBalance;
            return currentStakedBalance !== update.stakedBalance;
        });
    }
    /**
     * Import untracked tokens that have non-zero balances.
     * This mirrors the v2 behavior where only tokens with actual balances are added.
     * For mUSD default networks, the mUSD contract is also scheduled for import when
     * balance is zero (Accounts API omits it like the single-call contract).
     * Delegates to TokenDetectionController:addDetectedTokensViaPolling which handles:
     * - Checking if useTokenDetection preference is enabled
     * - Filtering tokens already in allTokens or allIgnoredTokens
     * - Token metadata lookup and addition via TokensController
     *
     * @param balances - Array of processed balance results from fetchers
     * @param targetChainIds - Chains included in this balance update (for mUSD zero-balance import)
     */
    async #importUntrackedTokens(balances, targetChainIds) {
        const tokensByChain = new Map();
        for (const balance of balances) {
            // Skip failed fetches, native tokens, and zero balances (like v2 did)
            if (!balance.success ||
                balance.token === ZERO_ADDRESS ||
                !balance.value ||
                balance.value.isZero()) {
                continue;
            }
            const tokenAddress = checksum(balance.token);
            const existing = tokensByChain.get(balance.chainId) ?? [];
            if (!existing.includes(tokenAddress)) {
                existing.push(tokenAddress);
                tokensByChain.set(balance.chainId, existing);
            }
        }
        for (const chainId of targetChainIds) {
            if (!MUSD_IMPORT_CHAIN_ID_SET.has(chainId)) {
                continue;
            }
            const existing = tokensByChain.get(chainId) ?? [];
            const alreadyHasMusd = existing.some((addr) => isEqualCaseInsensitive(addr, MUSD_ERC20_ADDRESS_LOWER));
            if (!alreadyHasMusd) {
                tokensByChain.set(chainId, [...existing, MUSD_ERC20_ADDRESS_LOWER]);
            }
        }
        // Add detected tokens via TokenDetectionController (handles preference check,
        // filtering of allTokens/allIgnoredTokens, and metadata lookup)
        for (const [chainId, tokenAddresses] of tokensByChain) {
            if (tokenAddresses.length) {
                await this.messenger.call('TokenDetectionController:addDetectedTokensViaPolling', {
                    tokensSlice: tokenAddresses,
                    chainId,
                });
            }
        }
    }
    resetState() {
        this.update(() => ({ tokenBalances: {} }));
    }
    #isTokenTracked(tokenAddress, account, chainId) {
        const normalizedAccount = account.toLowerCase();
        if (this.#allTokens?.[chainId]?.[normalizedAccount]?.some((token) => token.address === tokenAddress)) {
            return true;
        }
        if (this.#allIgnoredTokens?.[chainId]?.[normalizedAccount]?.some((token) => token === tokenAddress)) {
            return true;
        }
        return false;
    }
    #onTokensChanged = async (state) => {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const changed = [];
        let hasChanges = false;
        const incomingChainIds = new Set([
            ...Object.keys(state.allTokens),
            ...Object.keys(state.allDetectedTokens),
        ]);
        const relevantChainIds = Array.from(incomingChainIds).filter((chainId) => {
            const id = chainId;
            const hasTokensNow = (state.allTokens[id] && Object.keys(state.allTokens[id]).length > 0) ||
                (state.allDetectedTokens[id] &&
                    Object.keys(state.allDetectedTokens[id]).length > 0);
            const hadTokensBefore = (this.#allTokens[id] && Object.keys(this.#allTokens[id]).length > 0) ||
                (this.#detectedTokens[id] &&
                    Object.keys(this.#detectedTokens[id]).length > 0);
            const hasTokenChange = !isEqual(state.allTokens[id], this.#allTokens[id]) ||
                !isEqual(state.allDetectedTokens[id], this.#detectedTokens[id]);
            return hasTokenChange || (!hadTokensBefore && hasTokensNow);
        });
        if (!relevantChainIds.length) {
            this.#allTokens = state.allTokens;
            this.#detectedTokens = state.allDetectedTokens;
            return;
        }
        this.update((currentState) => {
            for (const chainId of relevantChainIds) {
                const id = chainId;
                const hasTokensNow = (state.allTokens[id] &&
                    Object.keys(state.allTokens[id]).length > 0) ||
                    (state.allDetectedTokens[id] &&
                        Object.keys(state.allDetectedTokens[id]).length > 0);
                const hadTokensBefore = (this.#allTokens[id] &&
                    Object.keys(this.#allTokens[id]).length > 0) ||
                    (this.#detectedTokens[id] &&
                        Object.keys(this.#detectedTokens[id]).length > 0);
                const tokensChanged = !isEqual(state.allTokens[id], this.#allTokens[id]) ||
                    !isEqual(state.allDetectedTokens[id], this.#detectedTokens[id]);
                if (!tokensChanged) {
                    continue;
                }
                if (hasTokensNow) {
                    changed.push(id);
                }
                else if (hadTokensBefore) {
                    for (const address of Object.keys(currentState.tokenBalances)) {
                        const addressKey = address;
                        if (currentState.tokenBalances[addressKey]?.[id]) {
                            currentState.tokenBalances[addressKey][id] = {};
                            hasChanges = true;
                        }
                    }
                }
            }
        });
        this.#allTokens = state.allTokens;
        this.#detectedTokens = state.allDetectedTokens;
        this.#allIgnoredTokens = state.allIgnoredTokens;
        if (changed.length && !hasChanges) {
            this.updateBalances({ chainIds: changed }).catch((error) => {
                console.warn('Error updating balances after token change:', error);
            });
        }
    };
    #onNetworkChanged = (state) => {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const currentNetworks = new Set(Object.keys(state.networkConfigurationsByChainId));
        const networksWithBalances = new Set();
        for (const address of Object.keys(this.state.tokenBalances)) {
            const addressKey = address;
            for (const network of Object.keys(this.state.tokenBalances[addressKey] || {})) {
                networksWithBalances.add(network);
            }
        }
        const removedNetworks = Array.from(networksWithBalances).filter((network) => !currentNetworks.has(network));
        if (!removedNetworks.length) {
            return;
        }
        this.update((currentState) => {
            for (const address of Object.keys(currentState.tokenBalances)) {
                const addressKey = address;
                for (const removedNetwork of removedNetworks) {
                    const networkKey = removedNetwork;
                    if (currentState.tokenBalances[addressKey]?.[networkKey]) {
                        delete currentState.tokenBalances[addressKey][networkKey];
                    }
                }
            }
        });
    };
    #onAccountRemoved = (addr) => {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        if (!isStrictHexString(addr) || !isValidHexAddress(addr)) {
            return;
        }
        this.update((currentState) => {
            delete currentState.tokenBalances[addr];
        });
    };
    #onAccountChanged = () => {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const chainIds = this.#chainIdsWithTokens();
        if (!chainIds.length) {
            return;
        }
        this.updateBalances({ chainIds }).catch(() => {
            // Silently handle polling errors
        });
    };
    #prepareBalanceUpdates(updates, account, chainId) {
        const tokenBalances = [];
        const newTokens = [];
        const nativeBalanceUpdates = [];
        for (const update of updates) {
            const { asset, postBalance } = update;
            if (postBalance.error) {
                throw new Error('Balance update has error');
            }
            const parsed = parseAssetType(asset.type);
            if (!parsed) {
                throw new Error('Failed to parse asset type');
            }
            const [tokenAddress, isNativeToken] = parsed;
            if (!isStrictHexString(tokenAddress) ||
                !isValidHexAddress(tokenAddress)) {
                throw new Error('Invalid token address');
            }
            const checksumTokenAddress = checksum(tokenAddress);
            const isTracked = this.#isTokenTracked(checksumTokenAddress, account, chainId);
            const balanceHex = postBalance.amount;
            tokenBalances.push({
                tokenAddress: checksumTokenAddress,
                balance: balanceHex,
            });
            if (isNativeToken) {
                nativeBalanceUpdates.push({
                    address: account,
                    chainId,
                    balance: balanceHex,
                });
            }
            if (!isNativeToken && !isTracked) {
                newTokens.push(checksumTokenAddress);
            }
        }
        return { tokenBalances, newTokens, nativeBalanceUpdates };
    }
    #onAccountActivityBalanceUpdate = async ({ address, chain, updates, }) => {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const chainId = caipChainIdToHex(chain);
        const checksummedAccount = checksum(address);
        try {
            const { tokenBalances, newTokens, nativeBalanceUpdates } = this.#prepareBalanceUpdates(updates, checksummedAccount, chainId);
            if (tokenBalances.length > 0) {
                this.update((state) => {
                    const lowercaseAccount = checksummedAccount.toLowerCase();
                    state.tokenBalances[lowercaseAccount] ??= {};
                    state.tokenBalances[lowercaseAccount][chainId] ??= {};
                    for (const { tokenAddress, balance } of tokenBalances) {
                        state.tokenBalances[lowercaseAccount][chainId][tokenAddress] =
                            balance;
                    }
                });
            }
            if (nativeBalanceUpdates.length > 0) {
                this.messenger.call('AccountTrackerController:updateNativeBalances', nativeBalanceUpdates);
            }
            if (newTokens.length > 0) {
                await this.messenger.call('TokenDetectionController:addDetectedTokensViaWs', {
                    tokensSlice: newTokens,
                    chainId,
                });
            }
        }
        catch (error) {
            console.warn(`Error updating balances from AccountActivityService for chain ${chain}, account ${address}:`, error);
            console.warn('Balance update data:', JSON.stringify(updates, null, 2));
            await this.updateBalances({ chainIds: [chainId] }).catch(() => {
                // Silently handle polling errors
            });
        }
    };
    #onAccountActivityStatusChanged = ({ chainIds, status, }) => {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        for (const chainId of chainIds) {
            this.#statusChangeDebouncer.pendingChanges.set(chainId, status);
        }
        if (this.#statusChangeDebouncer.timer) {
            clearTimeout(this.#statusChangeDebouncer.timer);
        }
        this.#statusChangeDebouncer.timer = setTimeout(() => {
            this.#processAccumulatedStatusChanges();
        }, 5000);
    };
    #processAccumulatedStatusChanges() {
        const changes = Array.from(this.#statusChangeDebouncer.pendingChanges.entries());
        this.#statusChangeDebouncer.pendingChanges.clear();
        this.#statusChangeDebouncer.timer = null;
        if (!changes.length) {
            return;
        }
        try {
            const chainConfigs = {};
            for (const [chainId, status] of changes) {
                if (isCaipChainId(chainId) &&
                    parseCaipChainId(chainId).namespace !== 'eip155') {
                    continue;
                }
                const hexChainId = caipChainIdToHex(chainId);
                chainConfigs[hexChainId] =
                    status === 'down'
                        ? { interval: this.#defaultInterval }
                        : { interval: this.#websocketActivePollingInterval };
            }
            if (Object.keys(chainConfigs).length === 0) {
                return;
            }
            const jitterDelay = Math.random() * this.#defaultInterval;
            setTimeout(() => {
                this.updateChainPollingConfigs(chainConfigs, { immediateUpdate: true });
            }, jitterDelay);
        }
        catch (error) {
            console.warn('Error processing accumulated status changes:', error);
        }
    }
    destroy() {
        this.#isControllerPollingActive = false;
        this.#intervalPollingTimers.forEach((timer) => clearInterval(timer));
        this.#intervalPollingTimers.clear();
        if (this.#statusChangeDebouncer.timer) {
            clearTimeout(this.#statusChangeDebouncer.timer);
            this.#statusChangeDebouncer.timer = null;
        }
        super.destroy();
    }
}
export default TokenBalancesController;
