import { toChecksumHexAddress, safelyExecuteWithTimeout, } from '@metamask/controller-utils';
import BN from 'bn.js';
import { STAKING_CONTRACT_ADDRESS_BY_CHAINID } from '../AssetsContractController.js';
import { shouldIncludeNativeToken } from '../constants.js';
import { getTokenBalancesForMultipleAddresses } from '../multicall.js';
const RPC_TIMEOUT_MS = 30000;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const checksum = (addr) => toChecksumHexAddress(addr);
export class RpcBalanceFetcher {
    #getProvider;
    #getNetworkClient;
    #getTokensState;
    constructor(getProvider, getNetworkClient, getTokensState) {
        this.#getProvider = getProvider;
        this.#getNetworkClient = getNetworkClient;
        this.#getTokensState = getTokensState;
    }
    supports() {
        return true; // fallback – supports every chain
    }
    #getStakingContractAddress(chainId) {
        return STAKING_CONTRACT_ADDRESS_BY_CHAINID[chainId];
    }
    async fetch({ chainIds, queryAllAccounts, selectedAccount, allAccounts, unprocessedTokens, }) {
        // Process all chains in parallel for better performance
        const chainProcessingPromises = chainIds.map(async (chainId) => {
            // if there are unprocessed tokens for a chain, it means the chain was partially processed.
            // because of this, we need to build distinct account <-> token groups to process
            const hasUnprocessedTokensForChain = queryAllAccounts
                ? Object.values(unprocessedTokens ?? {}).some((chainMap) => Boolean(chainMap[chainId] && chainMap[chainId].length > 0))
                : Boolean(unprocessedTokens?.[selectedAccount.toLowerCase()]?.[chainId] &&
                    unprocessedTokens[selectedAccount.toLowerCase()][chainId].length >
                        0);
            const tokensState = this.#getTokensState();
            const { accountTokenGroups, includeNativeAndStaked } = hasUnprocessedTokensForChain
                ? buildUnprocessedAccountTokenGroupsStatic(chainId, queryAllAccounts, selectedAccount, unprocessedTokens)
                : buildAccountTokenGroupsStatic(chainId, queryAllAccounts, selectedAccount, allAccounts, tokensState.allTokens, tokensState.allDetectedTokens);
            if (!accountTokenGroups.length) {
                return [];
            }
            const provider = this.#getProvider(chainId);
            await this.#ensureFreshBlockData(chainId);
            // Skip native token fetching for chains that return arbitrary large numbers
            const includeNative = shouldIncludeNativeToken(chainId);
            const balanceResult = await safelyExecuteWithTimeout(async () => {
                return await getTokenBalancesForMultipleAddresses(accountTokenGroups, chainId, provider, 
                // Skip native for Tempo chains
                includeNative && includeNativeAndStaked, includeNativeAndStaked);
            }, true, RPC_TIMEOUT_MS);
            // If timeout or error occurred, return empty array for this chain
            if (!balanceResult) {
                return [];
            }
            const { tokenBalances, stakedBalances } = balanceResult;
            const chainResults = [];
            if (includeNative && includeNativeAndStaked) {
                // Add native token entries for all addresses being processed
                const allAddressesForNative = new Set();
                accountTokenGroups.forEach((group) => {
                    allAddressesForNative.add(group.accountAddress);
                });
                // Ensure native token entries exist for all addresses
                allAddressesForNative.forEach((address) => {
                    const nativeBalance = tokenBalances[ZERO_ADDRESS]?.[address] || null;
                    chainResults.push({
                        success: true,
                        value: nativeBalance || new BN('0'),
                        account: address,
                        token: ZERO_ADDRESS,
                        chainId,
                    });
                });
            }
            // Add other token balances
            Object.entries(tokenBalances).forEach(([tokenAddr, balances]) => {
                // Skip native token since we handled it explicitly above
                if (tokenAddr === ZERO_ADDRESS) {
                    return;
                }
                Object.entries(balances).forEach(([acct, bn]) => {
                    chainResults.push({
                        success: bn !== null,
                        value: bn,
                        account: acct,
                        token: checksum(tokenAddr),
                        chainId,
                    });
                });
            });
            // Add staked balances for all addresses being processed
            const stakingContractAddress = this.#getStakingContractAddress(chainId);
            if (includeNativeAndStaked && stakingContractAddress) {
                // Get all unique addresses being processed for this chain
                const allAddresses = new Set();
                accountTokenGroups.forEach((group) => {
                    allAddresses.add(group.accountAddress);
                });
                // Add staked balance entry for each address
                const checksummedStakingAddress = checksum(stakingContractAddress);
                allAddresses.forEach((address) => {
                    const stakedBalance = stakedBalances?.[address] ?? null;
                    chainResults.push({
                        success: true,
                        value: stakedBalance ?? new BN('0'),
                        account: address,
                        token: checksummedStakingAddress,
                        chainId,
                    });
                });
            }
            return chainResults;
        });
        // Wait for all chains to complete (or fail) and collect results
        const chainResultsArray = await Promise.allSettled(chainProcessingPromises);
        const results = [];
        chainResultsArray.forEach((chainResult) => {
            if (chainResult.status === 'fulfilled') {
                results.push(...chainResult.value);
            }
        });
        return { balances: results };
    }
    /**
     * Ensures that the block tracker has the latest block data before performing multicall operations.
     * This is a temporary fix to ensure that the block number is up to date.
     *
     * @param chainId - The chain id to update block data for.
     */
    async #ensureFreshBlockData(chainId) {
        // Force fresh block data before multicall
        // TODO: This is a temporary fix to ensure that the block number is up to date.
        // We should remove this once we have a better solution for this on the block tracker controller.
        const networkClient = this.#getNetworkClient(chainId);
        await networkClient.blockTracker?.checkForLatestBlock?.();
    }
}
function buildAccountTokenGroups(queryAllAccounts, selectedAccount, accountTokenMap) {
    const pairs = [];
    const add = ([account, tokens]) => {
        const checksumAccount = checksum(account);
        const shouldInclude = queryAllAccounts || checksumAccount === checksum(selectedAccount);
        if (!shouldInclude) {
            return;
        }
        tokens.forEach((token) => pairs.push({
            accountAddress: account,
            tokenAddress: checksum(token),
        }));
    };
    Object.entries(accountTokenMap).forEach(add);
    // group by account
    const map = new Map();
    pairs.forEach(({ accountAddress, tokenAddress }) => {
        if (!map.has(accountAddress)) {
            map.set(accountAddress, []);
        }
        const tokens = map.get(accountAddress);
        if (tokens) {
            tokens.push(tokenAddress);
        }
    });
    return Array.from(map.entries()).map(([accountAddress, tokenAddresses]) => ({
        accountAddress,
        tokenAddresses,
    }));
}
/**
 * Merges imported & detected tokens for the requested chain and returns a list
 * of `{ accountAddress, tokenAddresses[] }` suitable for getTokenBalancesForMultipleAddresses.
 *
 * @param chainId - The chain ID to build account token groups for
 * @param queryAllAccounts - Whether to query all accounts or just the selected one
 * @param selectedAccount - The currently selected account
 * @param allAccounts - All available accounts
 * @param allTokens - All tokens from TokensController
 * @param allDetectedTokens - All detected tokens from TokensController
 * @returns Array of account/token groups for multicall
 */
function buildAccountTokenGroupsStatic(chainId, queryAllAccounts, selectedAccount, allAccounts, allTokens, allDetectedTokens) {
    const accountTokenMap = {};
    // Add all tokens
    Object.entries(allTokens[chainId] ?? {}).forEach(([account, tokens]) => {
        accountTokenMap[account] = tokens.map((token) => token.address);
    });
    // Add all detected tokens
    Object.entries(allDetectedTokens[chainId] ?? {}).forEach(([account, tokens]) => {
        if (!accountTokenMap[account]) {
            accountTokenMap[account] = [];
        }
        accountTokenMap[account] = Array.from(new Set([
            ...accountTokenMap[account],
            ...tokens.map((token) => token.address),
        ]));
    });
    // Add native tokens
    if (queryAllAccounts) {
        allAccounts.forEach((a) => {
            accountTokenMap[a.address] ??= [];
            accountTokenMap[a.address].push(ZERO_ADDRESS);
        });
    }
    else {
        accountTokenMap[selectedAccount] ??= [];
        accountTokenMap[selectedAccount].push(ZERO_ADDRESS);
    }
    return {
        accountTokenGroups: buildAccountTokenGroups(queryAllAccounts, selectedAccount, accountTokenMap),
        includeNativeAndStaked: true,
    };
}
function buildUnprocessedAccountTokenGroupsStatic(chainId, queryAllAccounts, selectedAccount, unprocessedTokens) {
    const accountTokenMap = {};
    Object.entries(unprocessedTokens).forEach(([account, tokens]) => {
        const lowercaseAccount = account.toLowerCase();
        if (queryAllAccounts ||
            lowercaseAccount === selectedAccount.toLowerCase()) {
            const tokenAddresses = tokens?.[chainId]?.map((tokenAddress) => tokenAddress.toLowerCase()) ??
                [];
            accountTokenMap[lowercaseAccount] = tokenAddresses;
        }
    });
    return {
        accountTokenGroups: buildAccountTokenGroups(queryAllAccounts, selectedAccount, accountTokenMap),
        includeNativeAndStaked: false,
    };
}
