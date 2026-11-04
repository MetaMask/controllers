import { Contract } from '@ethersproject/contracts';
import type { Web3Provider } from '@ethersproject/providers';
import type { Hex } from '@metamask/utils';
import BN from 'bn.js';
export type Call = {
    contract: Contract;
    functionSignature: string;
    arguments: unknown[];
};
export type MulticallResult = {
    success: boolean;
    value: unknown;
};
export type Aggregate3Call = {
    target: string;
    allowFailure: boolean;
    callData: string;
};
export type Aggregate3Result = {
    success: boolean;
    returnData: string;
};
/**
 * Executes an array of contract calls. If the chain supports multicalls,
 * the calls will be executed in single RPC requests (up to maxCallsPerMulticall).
 * Otherwise the calls will be executed separately in parallel (up to maxCallsParallel).
 *
 * @param calls - An array of contract calls to execute.
 * @param chainId - The hexadecimal chain id.
 * @param provider - An ethers rpc provider.
 * @param maxCallsPerMulticall - If multicall is supported, the maximum number of calls to exeute in each multicall.
 * @param maxCallsParallel - If multicall is not supported, the maximum number of calls to execute in parallel.
 * @returns An array of results, with a success boolean and value for each call.
 */
export declare const multicallOrFallback: (calls: Call[], chainId: Hex, provider: Web3Provider, maxCallsPerMulticall?: number, maxCallsParallel?: number) => Promise<MulticallResult[]>;
/**
 * Execute multiple contract calls using Multicall3's aggregate3 function.
 * This allows for more efficient batch calls with individual failure handling.
 *
 * @param calls - Array of calls to execute via aggregate3
 * @param chainId - The hexadecimal chain id
 * @param provider - An ethers rpc provider
 * @returns Promise resolving to array of results from aggregate3
 */
export declare const aggregate3: (calls: Aggregate3Call[], chainId: Hex, provider: Web3Provider) => Promise<Aggregate3Result[]>;
/**
 * Get staked balances for multiple addresses using two-step process:
 * 1. Get shares for all addresses
 * 2. Convert non-zero shares to assets
 *
 * @param userAddresses - Array of user addresses to check
 * @param chainId - Chain ID as hex string
 * @param provider - Ethers provider
 * @returns Promise resolving to map of user address to staked balance
 */
export declare const getStakedBalancesForAddresses: (userAddresses: string[], chainId: Hex, provider: Web3Provider) => Promise<Record<string, BN>>;
/**
 * Get token balances (both ERC20 and native) for multiple addresses using aggregate3.
 * This is more efficient than individual balanceOf calls for multiple addresses and tokens.
 * Native token balances are mapped to the zero address (0x0000000000000000000000000000000000000000).
 *
 * @param accountTokenGroups - Array of objects containing account addresses and their associated token addresses
 * @param chainId - The hexadecimal chain id
 * @param provider - An ethers rpc provider
 * @param includeNative - Whether to include native token balances (default: true)
 * @param includeStaked - Whether to include staked balances from supported staking contracts (default: false)
 * @returns Promise resolving to object containing tokenBalances map and optional stakedBalances map
 */
export declare const getTokenBalancesForMultipleAddresses: (accountTokenGroups: {
    accountAddress: Hex;
    tokenAddresses: Hex[];
}[], chainId: Hex, provider: Web3Provider, includeNative: boolean, includeStaked: boolean) => Promise<{
    tokenBalances: Record<string, Record<string, BN>>;
    stakedBalances?: Record<string, BN>;
}>;
export type NftOwnershipQuery = {
    nftAddress: string;
    tokenId: string;
    userAddress: string;
    standard: string | null;
};
export type NftOwnershipResult = {
    nftAddress: string;
    tokenId: string;
    isOwned: boolean | undefined;
};
/**
 * Check ownership for multiple NFTs, using Multicall3 when available to batch
 * all calls into a single RPC request, falling back to individual calls otherwise.
 *
 * @param nfts - Array of NFT queries containing address, tokenId, owner address, and standard.
 * @param chainId - The hexadecimal chain id.
 * @param provider - An ethers rpc provider.
 * @returns Promise resolving to array of ownership results. `isOwned` is `undefined`
 * when ownership could not be determined (e.g. unsupported standard or RPC error).
 */
export declare const getNftOwnershipForMultipleNfts: (nfts: NftOwnershipQuery[], chainId: Hex, provider: Web3Provider) => Promise<NftOwnershipResult[]>;
