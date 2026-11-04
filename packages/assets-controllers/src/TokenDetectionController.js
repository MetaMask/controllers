import contractMap from '@metamask/contract-metadata';
import { ASSET_TYPES, ChainId, ERC20, safelyExecute, isEqualCaseInsensitive, toChecksumHexAddress, } from '@metamask/controller-utils';
import { StaticIntervalPollingController } from '@metamask/polling-controller';
import { formatIconUrlWithProxy, isTokenDetectionSupportedForNetwork, } from './assetsUtil.js';
import { MUSD_ERC20_ADDRESS_LOWER, MUSD_TOKEN_DETECTION_CHAIN_IDS, MUSD_TOKEN_METADATA_BY_CHAIN, SUPPORTED_NETWORKS_ACCOUNTS_API_V4, } from './constants.js';
const DEFAULT_INTERVAL = 180000;
export const STATIC_MAINNET_TOKEN_LIST = Object.entries(contractMap).reduce((acc, [base, contract]) => {
    const { logo, erc20, erc721, ...tokenMetadata } = contract;
    return {
        ...acc,
        [base.toLowerCase()]: {
            ...tokenMetadata,
            address: base.toLowerCase(),
            iconUrl: `images/contract/${logo}`,
            aggregators: [],
        },
    };
}, {});
const MUSD_TOKEN_DETECTION_CHAIN_ID_SET = new Set(MUSD_TOKEN_DETECTION_CHAIN_IDS);
export const controllerName = 'TokenDetectionController';
const MESSENGER_EXPOSED_METHODS = [
    'startPolling',
    'stopPollingByPollingToken',
    'addDetectedTokensViaWs',
    'addDetectedTokensViaPolling',
    'detectTokens',
    'enable',
    'disable',
    'start',
    'stop',
];
/**
 * Controller that passively polls on a set interval for Tokens auto detection
 *
 * intervalId - Polling interval used to fetch new token rates
 *
 * selectedAddress - Vault selected address
 *
 * networkClientId - The network client ID of the current selected network
 *
 * disabled - Boolean to track if network requests are blocked
 *
 * isUnlocked - Boolean to track if the keyring state is unlocked
 *
 * isDetectionEnabledFromPreferences - Boolean to track if detection is enabled from PreferencesController
 *
 */
export class TokenDetectionController extends StaticIntervalPollingController() {
    #intervalId;
    #selectedAccountId;
    #tokenListService;
    #disabled;
    #isUnlocked;
    #isDetectionEnabledFromPreferences;
    #useTokenDetection;
    #useExternalServices;
    #isDeprecated;
    #getBalancesInSingleCall;
    #trackMetaMetricsEvent;
    /**
     * Creates a TokenDetectionController instance.
     *
     * @param options - The controller options.
     * @param options.messenger - The controller messenger.
     * @param options.tokenListService - Shared service for fetching the token list per chain.
     * @param options.disabled - If set to true, all network requests are blocked.
     * @param options.interval - Polling interval used to fetch new token rates
     * @param options.getBalancesInSingleCall - Gets the balances of a list of tokens for the given address.
     * @param options.trackMetaMetricsEvent - Sets options for MetaMetrics event tracking.
     * @param options.useTokenDetection - Feature Switch for using token detection (default: true)
     * @param options.useExternalServices - Feature Switch for using external services (default: false)
     * @param options.isDeprecated - Optional callback that disables token detection when it returns true.
     */
    constructor({ interval = DEFAULT_INTERVAL, disabled = true, getBalancesInSingleCall, trackMetaMetricsEvent, messenger, tokenListService, useTokenDetection = () => true, useExternalServices = () => true, isDeprecated = () => false, }) {
        super({
            name: controllerName,
            messenger,
            state: {},
            metadata: {},
        });
        messenger.registerMethodActionHandlers(this, MESSENGER_EXPOSED_METHODS);
        this.#disabled = disabled;
        this.setIntervalLength(interval);
        this.#selectedAccountId = this.#getSelectedAccount().id;
        this.#tokenListService = tokenListService;
        const { useTokenDetection: defaultUseTokenDetection } = this.messenger.call('PreferencesController:getState');
        this.#isDetectionEnabledFromPreferences = defaultUseTokenDetection;
        this.#getBalancesInSingleCall = getBalancesInSingleCall;
        this.#trackMetaMetricsEvent = trackMetaMetricsEvent;
        const { isUnlocked } = this.messenger.call('KeyringController:getState');
        this.#isUnlocked = isUnlocked;
        this.#useTokenDetection = useTokenDetection;
        this.#useExternalServices = useExternalServices;
        this.#isDeprecated = isDeprecated;
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
        }
        this.#registerEventListeners();
    }
    #enforceDisabledState() {
        if (Object.keys(this.state).length === 0) {
            return;
        }
        this.update(() => ({}));
    }
    /**
     * Constructor helper for registering this controller's messenger subscriptions to controller events.
     */
    #registerEventListeners() {
        this.messenger.subscribe('KeyringController:unlock', () => {
            this.#isUnlocked = true;
            this.#restartTokenDetection().catch(() => {
                // Silently handle token detection errors
            });
        });
        this.messenger.subscribe('KeyringController:lock', () => {
            this.#isUnlocked = false;
            this.#stopPolling();
        });
        this.messenger.subscribe('PreferencesController:stateChange', ({ useTokenDetection }) => {
            const selectedAccount = this.#getSelectedAccount();
            const isDetectionChangedFromPreferences = this.#isDetectionEnabledFromPreferences !== useTokenDetection;
            this.#isDetectionEnabledFromPreferences = useTokenDetection;
            if (isDetectionChangedFromPreferences) {
                this.#restartTokenDetection({
                    selectedAddress: selectedAccount.address,
                }).catch(() => {
                    // Silently handle token detection errors
                });
            }
        });
        this.messenger.subscribe('AccountsController:selectedEvmAccountChange', (selectedAccount) => {
            const { networkConfigurationsByChainId } = this.messenger.call('NetworkController:getState');
            const chainIds = Object.keys(networkConfigurationsByChainId);
            const isSelectedAccountIdChanged = this.#selectedAccountId !== selectedAccount.id;
            if (isSelectedAccountIdChanged) {
                this.#selectedAccountId = selectedAccount.id;
                this.#restartTokenDetection({
                    selectedAddress: selectedAccount.address,
                    chainIds,
                }).catch(() => {
                    // Silently handle token detection errors
                });
            }
        });
        this.messenger.subscribe('TransactionController:transactionConfirmed', (transactionMeta) => {
            this.detectTokens({
                chainIds: [transactionMeta.chainId],
            }).catch(() => {
                // Silently handle token detection errors
            });
        });
    }
    /**
     * Allows controller to make active and passive polling requests
     */
    enable() {
        this.#disabled = false;
    }
    /**
     * Blocks controller from making network calls
     */
    disable() {
        this.#disabled = true;
    }
    /**
     * Internal isActive state
     *
     * @returns Whether the controller is active (not disabled and keyring is unlocked)
     */
    get isActive() {
        return !this.#disabled && this.#isUnlocked;
    }
    /**
     * Start polling for detected tokens.
     */
    async start() {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        this.enable();
        await this.#startPolling();
    }
    /**
     * Stop polling for detected tokens.
     */
    stop() {
        this.disable();
        this.#stopPolling();
    }
    #stopPolling() {
        if (this.#intervalId) {
            clearInterval(this.#intervalId);
        }
    }
    /**
     * Starts a new polling interval.
     */
    async #startPolling() {
        if (!this.isActive) {
            return;
        }
        this.#stopPolling();
        await this.detectTokens();
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.#intervalId = setInterval(async () => {
            await this.detectTokens();
        }, this.getIntervalLength());
    }
    #getCorrectNetworkClientIdByChainId(chainIds) {
        const { networkConfigurationsByChainId, selectedNetworkClientId } = this.messenger.call('NetworkController:getState');
        if (!chainIds) {
            const networkConfiguration = this.messenger.call('NetworkController:getNetworkConfigurationByNetworkClientId', selectedNetworkClientId);
            return [
                {
                    chainId: networkConfiguration?.chainId ?? ChainId.mainnet,
                    networkClientId: selectedNetworkClientId,
                },
            ];
        }
        return chainIds.map((chainId) => {
            const configuration = networkConfigurationsByChainId[chainId];
            return {
                chainId,
                networkClientId: configuration.rpcEndpoints[configuration.defaultRpcEndpointIndex]
                    .networkClientId,
            };
        });
    }
    async _executePoll({ chainIds, address, }) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        if (!this.isActive) {
            return;
        }
        await this.detectTokens({
            chainIds,
            selectedAddress: address,
        });
    }
    /**
     * Restart token detection polling period and call detectNewTokens
     * in case of address change or user session initialization.
     *
     * @param options - Options for restart token detection.
     * @param options.selectedAddress - the selectedAddress against which to detect for token balances
     * @param options.chainIds - The chain IDs of the network client to use.
     */
    async #restartTokenDetection({ selectedAddress, chainIds, } = {}) {
        await this.detectTokens({
            chainIds,
            selectedAddress,
        });
        this.setIntervalLength(DEFAULT_INTERVAL);
    }
    /**
     * Returns the token cache for `chainId` if detection should proceed, or `null` if it
     * should be skipped.  Each call fetches a fresh snapshot from `TokenListService` (which
     * may serve from its in-memory cache) so concurrent calls for different chains never
     * overwrite each other's data.
     *
     * @param chainId - The chain ID to build a detection cache for.
     * @returns A `TokensChainsCache` scoped to `chainId`, or `null` when detection should be skipped.
     */
    async #getChainCacheForDetection(chainId) {
        if (!isTokenDetectionSupportedForNetwork(chainId)) {
            return null;
        }
        if (!this.#isDetectionEnabledFromPreferences &&
            chainId !== ChainId.mainnet) {
            return null;
        }
        const isMainnetDetectionInactive = !this.#isDetectionEnabledFromPreferences && chainId === ChainId.mainnet;
        if (isMainnetDetectionInactive) {
            return this.#getConvertedStaticMainnetTokenList();
        }
        const tokenListMap = await this.#tokenListService.fetchTokensByChainId(chainId);
        return this.#applyMusdDefaultToTokensChainsCache(chainId, {
            [chainId]: { data: tokenListMap, timestamp: Date.now() },
        });
    }
    async #detectTokensUsingRpc(chainsToDetectUsingRpc, addressToDetect) {
        for (const { chainId, networkClientId } of chainsToDetectUsingRpc) {
            const chainCache = await this.#getChainCacheForDetection(chainId);
            if (!chainCache) {
                continue;
            }
            const tokenCandidateSlices = this.#getSlicesOfTokensToDetect({
                chainId,
                chainCache,
                selectedAddress: addressToDetect,
            });
            const tokenDetectionPromises = tokenCandidateSlices.map((tokensSlice) => this.#addDetectedTokens({
                tokensSlice,
                selectedAddress: addressToDetect,
                networkClientId,
                chainId,
                chainCache,
            }));
            await Promise.all(tokenDetectionPromises);
        }
    }
    /**
     * For each token in the token list provided by the TokenListService, checks the token's balance for the selected account address on the active network.
     * On mainnet, if token detection is disabled in preferences, ERC20 token auto detection will be triggered for each contract address in the legacy token list from the @metamask/contract-metadata repo.
     *
     * @param options - Options for token detection.
     * @param options.chainIds - The chain IDs of the network client to use.
     * @param options.selectedAddress - the selectedAddress against which to detect for token balances.
     * @param options.forceRpc - Force RPC-based token detection for all specified chains,
     * bypassing external services check and ensuring RPC is used even for chains
     * that might otherwise be handled by the Accounts API.
     */
    async detectTokens({ chainIds, selectedAddress, forceRpc = false, } = {}) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        if (!this.isActive) {
            return;
        }
        // When forceRpc is true, bypass the useTokenDetection check to ensure RPC detection runs
        if (!forceRpc && !this.#useTokenDetection()) {
            return;
        }
        // If external services are disabled and not forcing RPC, skip all detection
        if (!forceRpc && !this.#useExternalServices()) {
            return;
        }
        const addressToDetect = selectedAddress ?? this.#getSelectedAddress();
        const clientNetworks = this.#getCorrectNetworkClientIdByChainId(chainIds);
        // If forceRpc is true, use RPC for all chains
        // Otherwise, skip chains supported by Accounts API (they are handled by TokenBalancesController)
        const chainsToDetectUsingRpc = forceRpc
            ? clientNetworks
            : clientNetworks.filter(({ chainId }) => !SUPPORTED_NETWORKS_ACCOUNTS_API_V4.includes(chainId));
        if (chainsToDetectUsingRpc.length === 0) {
            return;
        }
        await this.#detectTokensUsingRpc(chainsToDetectUsingRpc, addressToDetect);
    }
    #getSlicesOfTokensToDetect({ chainId, chainCache, selectedAddress, }) {
        const { allTokens, allDetectedTokens, allIgnoredTokens } = this.messenger.call('TokensController:getState');
        const [tokensAddresses, detectedTokensAddresses, ignoredTokensAddresses] = [
            allTokens,
            allDetectedTokens,
            allIgnoredTokens,
        ].map((tokens) => (tokens[chainId]?.[selectedAddress] ?? []).map((value) => typeof value === 'string' ? value : value.address));
        const tokensToDetect = [];
        for (const tokenAddress of Object.keys(chainCache[chainId]?.data ?? {})) {
            if ([
                tokensAddresses,
                detectedTokensAddresses,
                ignoredTokensAddresses,
            ].every((addresses) => !addresses.find((address) => isEqualCaseInsensitive(address, tokenAddress)))) {
                tokensToDetect.push(tokenAddress);
            }
        }
        const slicesOfTokensToDetect = [];
        for (let i = 0, size = 1000; i < tokensToDetect.length; i += size) {
            slicesOfTokensToDetect.push(tokensToDetect.slice(i, i + size));
        }
        return slicesOfTokensToDetect;
    }
    #getConvertedStaticMainnetTokenList() {
        const data = Object.entries(STATIC_MAINNET_TOKEN_LIST).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: {
                name: value.name,
                symbol: value.symbol,
                decimals: value.decimals,
                address: value.address,
                aggregators: [],
                iconUrl: value?.iconUrl,
            },
        }), {});
        const dataWithMusd = this.#mergeMusdIntoTokenListMap(ChainId.mainnet, data);
        return {
            '0x1': {
                data: dataWithMusd,
                timestamp: 0,
            },
        };
    }
    /**
     * mUSD token list row derived from Tokens API v3/assets (baked in for offline detection).
     *
     * @param chainId - Hex chain id (mainnet, Linea, or Monad).
     * @returns Token list entry for the detection cache.
     */
    #buildMusdTokenListToken(chainId) {
        const meta = MUSD_TOKEN_METADATA_BY_CHAIN[chainId];
        return {
            address: MUSD_ERC20_ADDRESS_LOWER,
            name: meta.name,
            symbol: meta.symbol,
            decimals: meta.decimals,
            aggregators: [...meta.aggregators],
            iconUrl: formatIconUrlWithProxy({
                chainId,
                tokenAddress: MUSD_ERC20_ADDRESS_LOWER,
            }),
            occurrences: 999,
        };
    }
    /**
     * Merge mUSD into a flat token map when the chain is one of the default mUSD networks.
     *
     * @param chainId - Network being detected.
     * @param data - Existing token map for that chain.
     * @returns New map including mUSD when applicable.
     */
    #mergeMusdIntoTokenListMap(chainId, data) {
        return {
            ...data,
            [MUSD_ERC20_ADDRESS_LOWER]: this.#buildMusdTokenListToken(chainId),
        };
    }
    /**
     * Shallow-clone the token list cache for the current chain and merge mUSD so we never
     * mutate the cache by reference.
     *
     * @param chainId - Network being detected.
     * @param cache - Full tokens-by-chain cache.
     * @returns Cache object safe to read and mutate for this detection pass.
     */
    #applyMusdDefaultToTokensChainsCache(chainId, cache) {
        if (!MUSD_TOKEN_DETECTION_CHAIN_ID_SET.has(chainId)) {
            return cache;
        }
        const existing = cache[chainId];
        return {
            ...cache,
            [chainId]: {
                data: this.#mergeMusdIntoTokenListMap(chainId, existing?.data ?? {}),
                timestamp: existing?.timestamp ?? 0,
            },
        };
    }
    /**
     * If mUSD is in the (possibly merged) token list for this chain, include its address
     * in the slice so we still run detection when balance is zero (single-call / Accounts API
     * / WebSocket do not list the contract when balance is zero).
     *
     * @param tokensSlice - Address batch from the caller.
     * @param chainId - Network being updated.
     * @returns The slice, possibly with mUSD appended.
     */
    #includeMusdInTokenDetectionSlice(tokensSlice, chainId) {
        if (!MUSD_TOKEN_DETECTION_CHAIN_ID_SET.has(chainId)) {
            return tokensSlice;
        }
        if (tokensSlice.some((a) => isEqualCaseInsensitive(a, MUSD_ERC20_ADDRESS_LOWER))) {
            return tokensSlice;
        }
        return [...tokensSlice, MUSD_ERC20_ADDRESS_LOWER];
    }
    async #addDetectedTokens({ tokensSlice, selectedAddress, networkClientId, chainId, chainCache, }) {
        await safelyExecute(async () => {
            const balances = await this.#getBalancesInSingleCall(selectedAddress, tokensSlice, networkClientId);
            const chainData = chainCache[chainId]?.data ?? {};
            const tokensWithBalance = [];
            const eventTokensDetails = [];
            for (const nonZeroTokenAddress of Object.keys(balances)) {
                // chainData keys are lowercase (normalised by buildTokenListMap);
                // balance keys are checksummed, so normalise before lookup.
                const tokenListEntry = chainData[nonZeroTokenAddress.toLowerCase()];
                if (!tokenListEntry) {
                    continue;
                }
                const { decimals, symbol, aggregators, iconUrl, name, rwaData } = tokenListEntry;
                eventTokensDetails.push(`${symbol} - ${nonZeroTokenAddress}`);
                tokensWithBalance.push({
                    address: nonZeroTokenAddress,
                    decimals,
                    symbol,
                    aggregators,
                    image: iconUrl,
                    isERC721: false,
                    name,
                    ...(rwaData && { rwaData }),
                });
            }
            // mUSD is always in the chain token cache on supported networks, but
            // getBalancesInSingleCall omits zero balances; still add mUSD so the wallet
            // shows the asset (balance updates via the usual balance pipeline).
            if (MUSD_TOKEN_DETECTION_CHAIN_ID_SET.has(chainId)) {
                const musdInSlice = tokensSlice.some((addr) => isEqualCaseInsensitive(addr, MUSD_ERC20_ADDRESS_LOWER));
                const musdHasNonZeroFromRpc = Object.keys(balances).some((addr) => isEqualCaseInsensitive(addr, MUSD_ERC20_ADDRESS_LOWER));
                if (musdInSlice && !musdHasNonZeroFromRpc) {
                    const musdListToken = Object.entries(chainData).find(([key]) => isEqualCaseInsensitive(key, MUSD_ERC20_ADDRESS_LOWER))?.[1];
                    if (musdListToken) {
                        const { decimals, symbol, aggregators, iconUrl, name, rwaData } = musdListToken;
                        eventTokensDetails.push(`${symbol} - ${MUSD_ERC20_ADDRESS_LOWER}`);
                        tokensWithBalance.push({
                            address: MUSD_ERC20_ADDRESS_LOWER,
                            decimals,
                            symbol,
                            aggregators,
                            image: iconUrl,
                            isERC721: false,
                            name,
                            ...(rwaData && { rwaData }),
                        });
                    }
                }
            }
            if (tokensWithBalance.length) {
                this.#trackMetaMetricsEvent({
                    event: 'Token Detected',
                    category: 'Wallet',
                    properties: {
                        tokens: eventTokensDetails,
                        token_standard: ERC20,
                        asset_type: ASSET_TYPES.TOKEN,
                    },
                });
                await this.messenger.call('TokensController:addTokens', tokensWithBalance, networkClientId);
            }
        });
    }
    /**
     * Add tokens detected from websocket balance updates
     * This method:
     * - Checks if useTokenDetection preference is enabled (skips if disabled)
     * - Checks if external services are enabled (skips if disabled)
     * - Tokens are expected to be in the tokensChainsCache with full metadata
     * - Balance fetching is skipped since balances are provided by the websocket
     * - Ignored tokens have been filtered out by the caller
     *
     * @param options - The options object
     * @param options.tokensSlice - Array of token addresses detected from websocket (already filtered to exclude ignored tokens)
     * @param options.chainId - Hex chain ID
     * @returns Promise that resolves when tokens are added
     */
    async addDetectedTokensViaWs({ tokensSlice, chainId, }) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        // Check if token detection is enabled via preferences
        if (!this.#useTokenDetection()) {
            return;
        }
        // Check if external services are enabled (websocket requires external services)
        if (!this.#useExternalServices()) {
            return;
        }
        let tokenListMap;
        try {
            tokenListMap = await this.#tokenListService.fetchTokensByChainId(chainId);
        }
        catch {
            // These methods return void; there is no token array to return.
            // Gracefully exit so the caller is unaffected — the next polling cycle
            // will retry the fetch.
            return;
        }
        const chainCache = this.#applyMusdDefaultToTokensChainsCache(chainId, {
            [chainId]: { data: tokenListMap, timestamp: Date.now() },
        });
        const effectiveSlice = this.#includeMusdInTokenDetectionSlice(tokensSlice, chainId);
        const tokensWithBalance = [];
        const eventTokensDetails = [];
        for (const tokenAddress of effectiveSlice) {
            // Normalize addresses explicitly (don't assume input format)
            const lowercaseTokenAddress = tokenAddress.toLowerCase();
            const checksummedTokenAddress = toChecksumHexAddress(tokenAddress);
            // Check map of validated tokens (cache keys are lowercase)
            const tokenData = chainCache[chainId]?.data?.[lowercaseTokenAddress];
            if (!tokenData) {
                continue;
            }
            const { decimals, symbol, aggregators, iconUrl, name, rwaData } = tokenData;
            // Push to lists with checksummed address (for allTokens storage)
            eventTokensDetails.push(`${symbol} - ${checksummedTokenAddress}`);
            tokensWithBalance.push({
                address: checksummedTokenAddress,
                decimals,
                symbol,
                aggregators,
                image: iconUrl,
                isERC721: false,
                name,
                ...(rwaData && { rwaData }),
            });
        }
        // Perform addition
        if (tokensWithBalance.length) {
            this.#trackMetaMetricsEvent({
                event: 'Token Detected',
                category: 'Wallet',
                properties: {
                    tokens: eventTokensDetails,
                    token_standard: ERC20,
                    asset_type: ASSET_TYPES.TOKEN,
                },
            });
            const networkClientId = this.messenger.call('NetworkController:findNetworkClientIdByChainId', chainId);
            await this.messenger.call('TokensController:addTokens', tokensWithBalance, networkClientId);
        }
    }
    /**
     * Add tokens detected from polling balance updates
     * This method:
     * - Checks if useTokenDetection preference is enabled (skips if disabled)
     * - Checks if external services are enabled (skips if disabled)
     * - Filters out tokens already in allTokens or allIgnoredTokens
     * - Tokens are expected to be in the tokensChainsCache with full metadata
     * - Balance fetching is skipped since balances are provided by the caller
     *
     * @param options - The options object
     * @param options.tokensSlice - Array of token addresses detected from polling
     * @param options.chainId - Hex chain ID
     * @returns Promise that resolves when tokens are added
     */
    async addDetectedTokensViaPolling({ tokensSlice, chainId, }) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        // Check if token detection is enabled via preferences
        if (!this.#useTokenDetection()) {
            return;
        }
        // Check if external services are enabled (polling via API requires external services)
        if (!this.#useExternalServices()) {
            return;
        }
        let tokenListMap;
        try {
            tokenListMap = await this.#tokenListService.fetchTokensByChainId(chainId);
        }
        catch {
            // These methods return void; there is no token array to return.
            // Gracefully exit so the caller is unaffected — the next polling cycle
            // will retry the fetch.
            return;
        }
        const chainCache = this.#applyMusdDefaultToTokensChainsCache(chainId, {
            [chainId]: { data: tokenListMap, timestamp: Date.now() },
        });
        const selectedAddress = this.#getSelectedAddress();
        // Get current token states to filter out already tracked/ignored tokens
        const { allTokens, allIgnoredTokens } = this.messenger.call('TokensController:getState');
        const existingTokenAddresses = (allTokens[chainId]?.[selectedAddress] ?? []).map((token) => token.address.toLowerCase());
        const ignoredTokenAddresses = (allIgnoredTokens[chainId]?.[selectedAddress] ?? []).map((address) => address.toLowerCase());
        const effectiveSlice = this.#includeMusdInTokenDetectionSlice(tokensSlice, chainId);
        const tokensWithBalance = [];
        const eventTokensDetails = [];
        for (const tokenAddress of effectiveSlice) {
            const lowercaseTokenAddress = tokenAddress.toLowerCase();
            const checksummedTokenAddress = toChecksumHexAddress(tokenAddress);
            // Skip tokens already in allTokens
            if (existingTokenAddresses.includes(lowercaseTokenAddress)) {
                continue;
            }
            // Skip tokens in allIgnoredTokens
            if (ignoredTokenAddresses.includes(lowercaseTokenAddress)) {
                continue;
            }
            // Check map of validated tokens (cache keys are lowercase)
            const tokenData = chainCache[chainId]?.data?.[lowercaseTokenAddress];
            if (!tokenData) {
                continue;
            }
            const { decimals, symbol, aggregators, iconUrl, name, rwaData } = tokenData;
            eventTokensDetails.push(`${symbol} - ${checksummedTokenAddress}`);
            tokensWithBalance.push({
                address: checksummedTokenAddress,
                decimals,
                symbol,
                aggregators,
                image: iconUrl,
                isERC721: false,
                name,
                ...(rwaData && { rwaData }),
            });
        }
        // Perform addition
        if (tokensWithBalance.length) {
            this.#trackMetaMetricsEvent({
                event: 'Token Detected',
                category: 'Wallet',
                properties: {
                    tokens: eventTokensDetails,
                    token_standard: ERC20,
                    asset_type: ASSET_TYPES.TOKEN,
                },
            });
            const networkClientId = this.messenger.call('NetworkController:findNetworkClientIdByChainId', chainId);
            await this.messenger.call('TokensController:addTokens', tokensWithBalance, networkClientId);
        }
    }
    #getSelectedAccount() {
        return this.messenger.call('AccountsController:getSelectedAccount');
    }
    #getSelectedAddress() {
        // If the address is not defined (or empty), we fallback to the currently selected account's address
        const account = this.messenger.call('AccountsController:getAccount', this.#selectedAccountId);
        return account?.address ?? '';
    }
}
export default TokenDetectionController;
