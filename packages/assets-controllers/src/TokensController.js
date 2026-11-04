import { Contract } from '@ethersproject/contracts';
import { Web3Provider } from '@ethersproject/providers';
import { BaseController } from '@metamask/base-controller';
import contractsMap from '@metamask/contract-metadata';
import { toChecksumHexAddress, ERC721_INTERFACE_ID, ORIGIN_METAMASK, ApprovalType, ERC20, ERC721, ERC1155, isValidHexAddress, safelyExecute, } from '@metamask/controller-utils';
import { abiERC721 } from '@metamask/metamask-eth-abis';
import { rpcErrors } from '@metamask/rpc-errors';
import { isStrictHexString } from '@metamask/utils';
import { Mutex } from 'async-mutex';
import { cloneDeep } from 'lodash-es';
import { v1 as random } from 'uuid';
import { formatAggregatorNames, formatIconUrlWithProxy } from './assetsUtil.js';
import { ERC20Standard } from './Standards/ERC20Standard.js';
import { ERC1155Standard } from './Standards/NftStandards/ERC1155/ERC1155Standard.js';
import { fetchTokenMetadata, TOKEN_METADATA_NO_SUPPORT_ERROR, } from './token-service.js';
const getNonEmptyString = (...candidates) => {
    return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim() !== '');
};
const metadata = {
    allTokens: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: false,
        usedInUi: true,
    },
    allIgnoredTokens: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: false,
        usedInUi: true,
    },
    allDetectedTokens: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: false,
        usedInUi: true,
    },
};
const controllerName = 'TokensController';
export const getDefaultTokensState = () => {
    return {
        allTokens: {},
        allIgnoredTokens: {},
        allDetectedTokens: {},
    };
};
const MESSENGER_EXPOSED_METHODS = [
    'addDetectedTokens',
    'addTokens',
    'addToken',
    'ignoreTokens',
    'updateTokenType',
    'watchAsset',
    'clearIgnoredTokens',
    'resetState',
];
/**
 * Controller that stores assets and exposes convenience methods
 */
export class TokensController extends BaseController {
    #mutex = new Mutex();
    #selectedAccountId;
    #provider;
    #abortController;
    #isDeprecated;
    /**
     * Tokens controller options
     *
     * @param options - Constructor options.
     * @param options.chainId - The chain ID of the current network.
     * @param options.provider - Network provider.
     * @param options.state - Initial state to set on this controller.
     * @param options.messenger - The messenger.
     * @param options.tokenListService - Shared service for fetching token metadata per chain.
     * @param options.isDeprecated - Optional function that returns true to completely
     * disable this controller (no requests, no state updates). When it returns
     * `true`, `allTokens`, `allIgnoredTokens`, and `allDetectedTokens` are reset to
     * `{}` at construction and at every entry point, so no stale token data remains
     * in state. The function is evaluated dynamically on each entry point so it can
     * be toggled at runtime. Intended for use when a higher-level controller
     * (e.g. AssetsController) supersedes this one.
     */
    constructor({ provider, state, messenger, tokenListService, isDeprecated = () => false, }) {
        super({
            name: controllerName,
            metadata,
            messenger,
            state: {
                ...getDefaultTokensState(),
                ...state,
            },
        });
        this.#provider = provider;
        this.#isDeprecated = isDeprecated;
        this.#selectedAccountId = this.#getSelectedAccount().id;
        this.#abortController = new AbortController();
        messenger.registerMethodActionHandlers(this, MESSENGER_EXPOSED_METHODS);
        this.messenger.subscribe('AccountsController:selectedEvmAccountChange', this.#onSelectedAccountChange.bind(this));
        this.messenger.subscribe('NetworkController:stateChange', this.#onNetworkStateChange.bind(this));
        this.messenger.subscribe('KeyringController:accountRemoved', (accountAddress) => this.#handleOnAccountRemoved(accountAddress));
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
        }
        else {
            // Enrich persisted tokens with name/rwaData from the token list once at init.
            this.#enrichTokensFromTokenList(tokenListService).catch(() => {
                // Tokens remain usable without metadata enrichment
            });
        }
    }
    /**
     * Clears all persisted token state so that no stale data remains.
     *
     * Called from every entry point when `isDeprecated()` is true so that a
     * runtime toggle propagates to state immediately, even if the controller was
     * originally constructed while it was enabled. The update is skipped when
     * all three maps are already empty to avoid emitting redundant state changes.
     */
    #enforceDisabledState() {
        const { allTokens, allIgnoredTokens, allDetectedTokens } = this.state;
        if (Object.keys(allTokens).length === 0 &&
            Object.keys(allIgnoredTokens).length === 0 &&
            Object.keys(allDetectedTokens).length === 0) {
            return;
        }
        this.update((state) => {
            state.allTokens = {};
            state.allIgnoredTokens = {};
            state.allDetectedTokens = {};
        });
    }
    async #enrichTokensFromTokenList(tokenListService) {
        const chainIds = Object.keys(this.state.allTokens);
        if (chainIds.length === 0) {
            return;
        }
        // Fetch all chain data concurrently before touching state so the async gap
        // is as short as possible and we never hold a stale T0 snapshot while
        // awaiting individual chain requests.
        // Promise.allSettled ensures a transient error on one chain does not
        // prevent other chains from being enriched.
        const results = await Promise.allSettled(chainIds.map(async (chainId) => {
            const data = await tokenListService.fetchTokensByChainId(chainId);
            return [chainId, data];
        }));
        const chainDataMap = Object.fromEntries(results
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value));
        // Read selectedAddress inside the updater so it reflects the live account
        // at the moment the state write happens, not a snapshot taken before the
        // async fetch gap above.
        this.update((state) => {
            const selectedAddress = this.#getSelectedAddress();
            for (const chainId of chainIds) {
                const chainData = chainDataMap[chainId];
                const tokens = state.allTokens[chainId]?.[selectedAddress];
                if (!tokens || !chainData) {
                    continue;
                }
                for (const token of tokens) {
                    const cachedToken = chainData[token.address.toLowerCase()];
                    if (cachedToken?.name && !token.name) {
                        token.name = cachedToken.name;
                    }
                    if (cachedToken?.rwaData) {
                        token.rwaData = cachedToken.rwaData;
                    }
                }
            }
        });
    }
    #handleOnAccountRemoved(accountAddress) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const isEthAddress = isStrictHexString(accountAddress.toLowerCase()) &&
            isValidHexAddress(accountAddress);
        if (!isEthAddress) {
            return;
        }
        const { allTokens, allIgnoredTokens, allDetectedTokens } = this.state;
        const newAllTokens = cloneDeep(allTokens);
        const newAllDetectedTokens = cloneDeep(allDetectedTokens);
        const newAllIgnoredTokens = cloneDeep(allIgnoredTokens);
        for (const chainId of Object.keys(newAllTokens)) {
            if (newAllTokens[chainId][accountAddress]) {
                delete newAllTokens[chainId][accountAddress];
            }
        }
        for (const chainId of Object.keys(newAllDetectedTokens)) {
            if (newAllDetectedTokens[chainId][accountAddress]) {
                delete newAllDetectedTokens[chainId][accountAddress];
            }
        }
        for (const chainId of Object.keys(newAllIgnoredTokens)) {
            if (newAllIgnoredTokens[chainId][accountAddress]) {
                delete newAllIgnoredTokens[chainId][accountAddress];
            }
        }
        this.update((state) => {
            state.allTokens = newAllTokens;
            state.allIgnoredTokens = newAllIgnoredTokens;
            state.allDetectedTokens = newAllDetectedTokens;
        });
    }
    /**
     * Handles the event when the network state changes.
     *
     * @param _ - The network state.
     * @param patches - An array of patch operations performed on the network state.
     */
    #onNetworkStateChange(_, patches) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        // Remove state for deleted networks
        for (const patch of patches) {
            if (patch.op === 'remove' &&
                patch.path[0] === 'networkConfigurationsByChainId') {
                const removedChainId = patch.path[1];
                this.update((state) => {
                    delete state.allTokens[removedChainId];
                    delete state.allIgnoredTokens[removedChainId];
                    delete state.allDetectedTokens[removedChainId];
                });
            }
        }
    }
    /**
     * Handles the selected account change in the accounts controller.
     *
     * @param selectedAccount - The new selected account
     */
    #onSelectedAccountChange(selectedAccount) {
        this.#selectedAccountId = selectedAccount.id;
    }
    /**
     * Fetch metadata for a token.
     *
     * @param tokenAddress - The address of the token.
     * @param chainId - The chain ID of the network on which the token is detected.
     * @returns The token metadata.
     */
    async #fetchTokenMetadata(tokenAddress, chainId) {
        try {
            const token = await fetchTokenMetadata(chainId, tokenAddress, this.#abortController.signal);
            return token;
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes(TOKEN_METADATA_NO_SUPPORT_ERROR)) {
                return undefined;
            }
            throw error;
        }
    }
    /**
     * Adds a token to the stored token list.
     *
     * @param options - The method argument object.
     * @param options.address - Hex address of the token contract.
     * @param options.symbol - Symbol of the token.
     * @param options.decimals - Number of decimals the token uses.
     * @param options.name - Name of the token.
     * @param options.image - Image of the token.
     * @param options.interactingAddress - The address of the account to add a token to.
     * @param options.networkClientId - Network Client ID.
     * @param options.rwaData - Optional RWA data for the token.
     * @returns Current token list.
     */
    async addToken({ address, symbol, decimals, name, image, interactingAddress, networkClientId, rwaData, }) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return [];
        }
        const releaseLock = await this.#mutex.acquire();
        const { allTokens, allIgnoredTokens, allDetectedTokens } = this.state;
        const chainIdToUse = this.messenger.call('NetworkController:getNetworkClientById', networkClientId).configuration.chainId;
        const accountAddress = this.#getAddressOrSelectedAddress(interactingAddress);
        try {
            address = toChecksumHexAddress(address);
            const tokens = allTokens[chainIdToUse]?.[accountAddress] ?? [];
            const ignoredTokens = allIgnoredTokens[chainIdToUse]?.[accountAddress] ?? [];
            const detectedTokens = allDetectedTokens[chainIdToUse]?.[accountAddress] ?? [];
            const newTokens = [...tokens];
            const [isERC721, tokenMetadata] = await Promise.all([
                this.#detectIsERC721(address, networkClientId),
                // TODO parameterize the token metadata fetch by networkClientId
                this.#fetchTokenMetadata(address, chainIdToUse),
            ]);
            const newEntry = {
                address,
                symbol,
                decimals,
                image: image && image.trim() !== ''
                    ? image
                    : formatIconUrlWithProxy({
                        chainId: chainIdToUse,
                        tokenAddress: address,
                    }),
                isERC721,
                aggregators: formatAggregatorNames(tokenMetadata?.aggregators ?? []),
                name,
                ...(rwaData !== undefined && { rwaData }),
            };
            const previousIndex = newTokens.findIndex((token) => token.address.toLowerCase() === address.toLowerCase());
            if (previousIndex === -1) {
                newTokens.push(newEntry);
            }
            else {
                newTokens[previousIndex] = newEntry;
            }
            const newIgnoredTokens = ignoredTokens.filter((tokenAddress) => tokenAddress.toLowerCase() !== address.toLowerCase());
            const newDetectedTokens = detectedTokens.filter((token) => token.address.toLowerCase() !== address.toLowerCase());
            const { newAllTokens, newAllIgnoredTokens, newAllDetectedTokens } = this.#getNewAllTokensState({
                newTokens,
                newIgnoredTokens,
                newDetectedTokens,
                interactingAddress: accountAddress,
                interactingChainId: chainIdToUse,
            });
            const newState = {
                allTokens: newAllTokens,
                allIgnoredTokens: newAllIgnoredTokens,
                allDetectedTokens: newAllDetectedTokens,
            };
            this.update((state) => {
                Object.assign(state, newState);
            });
            return newTokens;
        }
        finally {
            releaseLock();
        }
    }
    /**
     * Add a batch of tokens.
     *
     * @param tokensToImport - Array of tokens to import.
     * @param networkClientId - Optional network client ID used to determine interacting chain ID.
     */
    async addTokens(tokensToImport, networkClientId) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const releaseLock = await this.#mutex.acquire();
        const { allTokens, allIgnoredTokens, allDetectedTokens } = this.state;
        const importedTokensMap = {};
        const interactingChainId = this.messenger.call('NetworkController:getNetworkClientById', networkClientId).configuration.chainId;
        // Used later to dedupe imported tokens
        const newTokensMap = [
            ...(allTokens[interactingChainId]?.[this.#getSelectedAccount().address] ??
                []),
            ...tokensToImport,
        ].reduce((output, token) => {
            output[toChecksumHexAddress(token.address)] = token;
            return output;
        }, {});
        try {
            tokensToImport.forEach((tokenToAdd) => {
                const { address, symbol, decimals, image, aggregators, name, rwaData } = tokenToAdd;
                const checksumAddress = toChecksumHexAddress(address);
                const formattedToken = {
                    address: checksumAddress,
                    symbol,
                    decimals,
                    image,
                    aggregators,
                    name,
                    ...(rwaData && { rwaData }),
                };
                newTokensMap[checksumAddress] = formattedToken;
                importedTokensMap[address.toLowerCase()] = true;
                return formattedToken;
            });
            const newTokens = Object.values(newTokensMap);
            const newIgnoredTokens = allIgnoredTokens[interactingChainId]?.[this.#getSelectedAddress()]?.filter((tokenAddress) => !newTokensMap[toChecksumHexAddress(tokenAddress)]);
            const detectedTokensForGivenChain = interactingChainId
                ? allDetectedTokens?.[interactingChainId]?.[this.#getSelectedAddress()]
                : [];
            const newDetectedTokens = detectedTokensForGivenChain?.filter((t) => !importedTokensMap[t.address.toLowerCase()]);
            const { newAllTokens, newAllDetectedTokens, newAllIgnoredTokens } = this.#getNewAllTokensState({
                newTokens,
                newDetectedTokens,
                newIgnoredTokens,
                interactingChainId,
            });
            this.update((state) => {
                state.allTokens = newAllTokens;
                state.allDetectedTokens = newAllDetectedTokens;
                state.allIgnoredTokens = newAllIgnoredTokens;
            });
        }
        finally {
            releaseLock();
        }
    }
    /**
     * Ignore a batch of tokens.
     *
     * @param tokenAddressesToIgnore - Array of token addresses to ignore.
     * @param networkClientId - Optional network client ID used to determine interacting chain ID.
     */
    ignoreTokens(tokenAddressesToIgnore, networkClientId) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const interactingChainId = this.messenger.call('NetworkController:getNetworkClientById', networkClientId).configuration.chainId;
        const { allTokens, allDetectedTokens, allIgnoredTokens } = this.state;
        const ignoredTokensMap = {};
        const ignoredTokens = allIgnoredTokens[interactingChainId]?.[this.#getSelectedAddress()] ?? [];
        let newIgnoredTokens = [...ignoredTokens];
        const tokens = allTokens[interactingChainId]?.[this.#getSelectedAddress()] ?? [];
        const detectedTokens = allDetectedTokens[interactingChainId]?.[this.#getSelectedAddress()] ?? [];
        const checksummedTokenAddresses = tokenAddressesToIgnore.map((address) => {
            const checksumAddress = toChecksumHexAddress(address);
            ignoredTokensMap[address.toLowerCase()] = true;
            return checksumAddress;
        });
        newIgnoredTokens = [...ignoredTokens, ...checksummedTokenAddresses];
        const newDetectedTokens = detectedTokens.filter((token) => !ignoredTokensMap[token.address.toLowerCase()]);
        const newTokens = tokens.filter((token) => !ignoredTokensMap[token.address.toLowerCase()]);
        const { newAllIgnoredTokens, newAllDetectedTokens, newAllTokens } = this.#getNewAllTokensState({
            newIgnoredTokens,
            newDetectedTokens,
            newTokens,
            interactingChainId,
        });
        this.update((state) => {
            state.allIgnoredTokens = newAllIgnoredTokens;
            state.allDetectedTokens = newAllDetectedTokens;
            state.allTokens = newAllTokens;
        });
    }
    /**
     * Adds a batch of detected tokens to the stored token list.
     *
     * @param incomingDetectedTokens - Array of detected tokens to be added or updated.
     * @param detectionDetails - An object containing the chain ID and address of the currently selected network on which the incomingDetectedTokens were detected.
     * @param detectionDetails.selectedAddress - the account address on which the incomingDetectedTokens were detected.
     * @param detectionDetails.chainId - the chainId on which the incomingDetectedTokens were detected.
     */
    async addDetectedTokens(incomingDetectedTokens, detectionDetails) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        const releaseLock = await this.#mutex.acquire();
        const { chainId } = detectionDetails;
        // Previously selectedAddress could be an empty string. This is to preserve the behaviour
        const accountAddress = detectionDetails?.selectedAddress ?? this.#getSelectedAddress();
        const { allTokens, allDetectedTokens, allIgnoredTokens } = this.state;
        let newTokens = [...(allTokens?.[chainId]?.[accountAddress] ?? [])];
        let newDetectedTokens = [
            ...(allDetectedTokens?.[chainId]?.[accountAddress] ?? []),
        ];
        try {
            incomingDetectedTokens.forEach((tokenToAdd) => {
                const { address, symbol, decimals, image, aggregators, isERC721, name, rwaData, } = tokenToAdd;
                const checksumAddress = toChecksumHexAddress(address);
                const newEntry = {
                    address: checksumAddress,
                    symbol,
                    decimals,
                    image,
                    isERC721,
                    aggregators,
                    name,
                    ...(rwaData && { rwaData }),
                };
                const previousImportedIndex = newTokens.findIndex((token) => token.address.toLowerCase() === checksumAddress.toLowerCase());
                if (previousImportedIndex === -1) {
                    const ignoredTokenIndex = allIgnoredTokens?.[chainId]?.[accountAddress]?.indexOf(address) ??
                        -1;
                    if (ignoredTokenIndex === -1) {
                        // Add detected token
                        const previousDetectedIndex = newDetectedTokens.findIndex((token) => token.address.toLowerCase() === checksumAddress.toLowerCase());
                        if (previousDetectedIndex === -1) {
                            newDetectedTokens.push(newEntry);
                        }
                        else {
                            newDetectedTokens[previousDetectedIndex] = newEntry;
                        }
                    }
                }
                else {
                    // Update existing data of imported token
                    newTokens[previousImportedIndex] = newEntry;
                }
            });
            const { newAllTokens, newAllDetectedTokens } = this.#getNewAllTokensState({
                newTokens,
                newDetectedTokens,
                interactingAddress: accountAddress,
                interactingChainId: chainId,
            });
            // We may be detecting tokens on a different chain/account pair than are currently configured.
            // Re-point `tokens` and `detectedTokens` to keep them referencing the current chain/account.
            const selectedAddress = this.#getSelectedAddress();
            newTokens = newAllTokens?.[chainId]?.[selectedAddress] ?? [];
            newDetectedTokens =
                newAllDetectedTokens?.[chainId]?.[selectedAddress] ?? [];
            this.update((state) => {
                state.allTokens = newAllTokens;
                state.allDetectedTokens = newAllDetectedTokens;
            });
        }
        finally {
            releaseLock();
        }
    }
    /**
     * Adds isERC721 field to token object. This is called when a user attempts to add tokens that
     * were previously added which do not yet had isERC721 field.
     *
     * @param tokenAddress - The contract address of the token requiring the isERC721 field added.
     * @param networkClientId - The network client ID of the network on which the token is detected.
     * @returns The new token object with the added isERC721 field.
     */
    async updateTokenType(tokenAddress, networkClientId) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            throw new Error('TokensController is deprecated');
        }
        const chainIdToUse = this.messenger.call('NetworkController:getNetworkClientById', networkClientId).configuration.chainId;
        const isERC721 = await this.#detectIsERC721(tokenAddress, networkClientId);
        const accountAddress = this.#getSelectedAddress();
        const tokens = [...this.state.allTokens[chainIdToUse][accountAddress]];
        const tokenIndex = tokens.findIndex((token) => {
            return token.address.toLowerCase() === tokenAddress.toLowerCase();
        });
        const updatedToken = { ...tokens[tokenIndex], isERC721 };
        tokens[tokenIndex] = updatedToken;
        this.update((state) => {
            state.allTokens[chainIdToUse][accountAddress] = tokens;
        });
        return updatedToken;
    }
    /**
     * Detects whether or not a token is ERC-721 compatible.
     *
     * @param tokenAddress - The token contract address.
     * @param networkClientId - Optional network client ID to fetch contract info with.
     * @returns A boolean indicating whether the token address passed in supports the EIP-721
     * interface.
     */
    async #detectIsERC721(tokenAddress, networkClientId) {
        const checksumAddress = toChecksumHexAddress(tokenAddress);
        // if this token is already in our contract metadata map we don't need
        // to check against the contract
        if (contractsMap[checksumAddress]?.erc721 === true) {
            return Promise.resolve(true);
        }
        else if (contractsMap[checksumAddress]?.erc20 === true) {
            return Promise.resolve(false);
        }
        const tokenContract = this.#createEthersContract(tokenAddress, abiERC721, networkClientId);
        try {
            return await tokenContract.supportsInterface(ERC721_INTERFACE_ID);
        }
        catch (error) {
            // currently we see a variety of errors across different networks when
            // token contracts are not ERC721 compatible. We need to figure out a better
            // way of differentiating token interface types but for now if we get an error
            // we have to assume the token is not ERC721 compatible.
            return false;
        }
    }
    #getProvider(networkClientId) {
        return new Web3Provider(networkClientId
            ? this.messenger.call('NetworkController:getNetworkClientById', networkClientId).provider
            : this.#provider);
    }
    #createEthersContract(tokenAddress, abi, networkClientId) {
        const web3provider = this.#getProvider(networkClientId);
        const tokenContract = new Contract(tokenAddress, abi, web3provider);
        return tokenContract;
    }
    #generateRandomId() {
        return random();
    }
    /**
     * Adds a new suggestedAsset to the list of watched assets.
     * Parameters will be validated according to the asset type being watched.
     *
     * @param options - The method options.
     * @param options.asset - The asset to be watched. For now only ERC20 tokens are accepted.
     * @param options.type - The asset type.
     * @param options.interactingAddress - The address of the account that is requesting to watch the asset.
     * @param options.networkClientId - Network Client ID.
     * @param options.origin - The origin to set on the approval request.
     * @param options.pageMeta - The metadata for the page initiating the request.
     * @param options.requestMetadata - Metadata for the request, including pageMeta and origin.
     * @returns A promise that resolves if the asset was watched successfully, and rejects otherwise.
     */
    async watchAsset({ asset, type, interactingAddress, networkClientId, origin, pageMeta, requestMetadata, }) {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        if (type !== ERC20) {
            throw new Error(`Asset of type ${type} not supported`);
        }
        if (!asset.address) {
            throw rpcErrors.invalidParams('Address must be specified');
        }
        if (!isValidHexAddress(asset.address)) {
            throw rpcErrors.invalidParams(`Invalid address "${asset.address}"`);
        }
        const selectedAddress = this.#getAddressOrSelectedAddress(interactingAddress);
        // Validate contract
        if (await this.#detectIsERC721(asset.address, networkClientId)) {
            throw rpcErrors.invalidParams(`Contract ${asset.address} must match type ${type}, but was detected as ${ERC721}`);
        }
        const provider = this.#getProvider(networkClientId);
        const isErc1155 = await safelyExecute(() => new ERC1155Standard(provider).contractSupportsBase1155Interface(asset.address));
        if (isErc1155) {
            throw rpcErrors.invalidParams(`Contract ${asset.address} must match type ${type}, but was detected as ${ERC1155}`);
        }
        const erc20 = new ERC20Standard(provider);
        const [contractName, contractSymbol, contractDecimals] = await Promise.all([
            safelyExecute(() => erc20.getTokenName(asset.address)),
            safelyExecute(() => erc20.getTokenSymbol(asset.address)),
            safelyExecute(async () => erc20.getTokenDecimals(asset.address)),
        ]);
        asset.name = contractName;
        // Validate symbol
        if (!asset.symbol && !contractSymbol) {
            throw rpcErrors.invalidParams('A symbol is required, but was not found in either the request or contract');
        }
        if (contractSymbol !== undefined &&
            asset.symbol !== undefined &&
            asset.symbol.toUpperCase() !== contractSymbol.toUpperCase()) {
            throw rpcErrors.invalidParams(`The symbol in the request (${asset.symbol}) does not match the symbol in the contract (${contractSymbol})`);
        }
        asset.symbol = contractSymbol ?? asset.symbol;
        if (typeof asset.symbol !== 'string') {
            throw rpcErrors.invalidParams(`Invalid symbol: not a string`);
        }
        if (asset.symbol.length > 11) {
            throw rpcErrors.invalidParams(`Invalid symbol "${asset.symbol}": longer than 11 characters`);
        }
        // Validate decimals
        if (asset.decimals === undefined && contractDecimals === undefined) {
            throw rpcErrors.invalidParams('Decimals are required, but were not found in either the request or contract');
        }
        if (contractDecimals !== undefined &&
            asset.decimals !== undefined &&
            String(asset.decimals) !== contractDecimals) {
            throw rpcErrors.invalidParams(`The decimals in the request (${asset.decimals}) do not match the decimals in the contract (${contractDecimals})`);
        }
        const decimalsStr = contractDecimals ?? asset.decimals;
        const decimalsNum = parseInt(decimalsStr, 10);
        if (!Number.isInteger(decimalsNum) || decimalsNum > 36 || decimalsNum < 0) {
            throw rpcErrors.invalidParams(`Invalid decimals "${decimalsStr}": must be an integer 0 <= 36`);
        }
        asset.decimals = decimalsNum;
        const suggestedAssetMeta = {
            asset,
            id: this.#generateRandomId(),
            time: Date.now(),
            type,
            interactingAddress: selectedAddress,
            origin: getNonEmptyString(requestMetadata?.origin, origin),
            pageMeta: requestMetadata?.pageMeta ?? pageMeta,
        };
        await this.#requestApproval(suggestedAssetMeta);
        const { address, symbol, decimals, name, image, rwaData } = asset;
        await this.addToken({
            address,
            symbol,
            decimals,
            name,
            image,
            interactingAddress: suggestedAssetMeta.interactingAddress,
            networkClientId,
            rwaData,
        });
    }
    /**
     * Takes a new tokens and ignoredTokens array for the current network/account combination
     * and returns new allTokens and allIgnoredTokens state to update to.
     *
     * @param params - Object that holds token params.
     * @param params.newTokens - The new tokens to set for the current network and selected account.
     * @param params.newIgnoredTokens - The new ignored tokens to set for the current network and selected account.
     * @param params.newDetectedTokens - The new detected tokens to set for the current network and selected account.
     * @param params.interactingAddress - The account address to use to store the tokens.
     * @param params.interactingChainId - The chainId to use to store the tokens.
     * @returns The updated `allTokens` and `allIgnoredTokens` state.
     */
    #getNewAllTokensState(params) {
        const { newTokens, newIgnoredTokens, newDetectedTokens, interactingAddress, interactingChainId, } = params;
        const { allTokens, allIgnoredTokens, allDetectedTokens } = this.state;
        const userAddressToAddTokens = this.#getAddressOrSelectedAddress(interactingAddress);
        let newAllTokens = allTokens;
        if (newTokens?.length ||
            (newTokens &&
                allTokens &&
                allTokens[interactingChainId] &&
                allTokens[interactingChainId][userAddressToAddTokens])) {
            const networkTokens = allTokens[interactingChainId];
            const newNetworkTokens = {
                ...networkTokens,
                ...{ [userAddressToAddTokens]: newTokens },
            };
            newAllTokens = {
                ...allTokens,
                ...{ [interactingChainId]: newNetworkTokens },
            };
        }
        let newAllIgnoredTokens = allIgnoredTokens;
        if (newIgnoredTokens?.length ||
            (newIgnoredTokens &&
                allIgnoredTokens &&
                allIgnoredTokens[interactingChainId] &&
                allIgnoredTokens[interactingChainId][userAddressToAddTokens])) {
            const networkIgnoredTokens = allIgnoredTokens[interactingChainId];
            const newIgnoredNetworkTokens = {
                ...networkIgnoredTokens,
                ...{ [userAddressToAddTokens]: newIgnoredTokens },
            };
            newAllIgnoredTokens = {
                ...allIgnoredTokens,
                ...{ [interactingChainId]: newIgnoredNetworkTokens },
            };
        }
        let newAllDetectedTokens = allDetectedTokens;
        if (newDetectedTokens?.length ||
            (newDetectedTokens &&
                allDetectedTokens &&
                allDetectedTokens[interactingChainId] &&
                allDetectedTokens[interactingChainId][userAddressToAddTokens])) {
            const networkDetectedTokens = allDetectedTokens[interactingChainId];
            const newDetectedNetworkTokens = {
                ...networkDetectedTokens,
                ...{ [userAddressToAddTokens]: newDetectedTokens },
            };
            newAllDetectedTokens = {
                ...allDetectedTokens,
                ...{ [interactingChainId]: newDetectedNetworkTokens },
            };
        }
        return { newAllTokens, newAllIgnoredTokens, newAllDetectedTokens };
    }
    #getAddressOrSelectedAddress(address) {
        if (address) {
            return address;
        }
        return this.#getSelectedAddress();
    }
    /**
     * Removes all tokens from the ignored list.
     */
    clearIgnoredTokens() {
        if (this.#isDeprecated()) {
            this.#enforceDisabledState();
            return;
        }
        this.update((state) => {
            state.allIgnoredTokens = {};
        });
    }
    async #requestApproval(suggestedAssetMeta) {
        const requestData = {
            id: suggestedAssetMeta.id,
            interactingAddress: suggestedAssetMeta.interactingAddress,
            asset: {
                address: suggestedAssetMeta.asset.address,
                decimals: suggestedAssetMeta.asset.decimals,
                symbol: suggestedAssetMeta.asset.symbol,
                image: suggestedAssetMeta.asset.image &&
                    suggestedAssetMeta.asset.image.trim() !== ''
                    ? suggestedAssetMeta.asset.image
                    : null,
            },
        };
        if (suggestedAssetMeta.pageMeta) {
            requestData.metadata = {
                pageMeta: suggestedAssetMeta.pageMeta,
            };
        }
        return this.messenger.call('ApprovalController:addRequest', {
            id: suggestedAssetMeta.id,
            origin: getNonEmptyString(suggestedAssetMeta.origin) ?? ORIGIN_METAMASK,
            type: ApprovalType.WatchAsset,
            requestData,
        }, true);
    }
    #getSelectedAccount() {
        return this.messenger.call('AccountsController:getSelectedAccount');
    }
    #getSelectedAddress() {
        // If the address is not defined (or empty), we fallback to the currently selected account's address
        const account = this.messenger.call('AccountsController:getAccount', this.#selectedAccountId);
        return account?.address ?? '';
    }
    /**
     * Reset the controller state to the default state.
     */
    resetState() {
        this.update(() => {
            return getDefaultTokensState();
        });
    }
}
export default TokensController;
