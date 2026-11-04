import type { CaipAccountAddress } from '@metamask/utils';
import type { GetBalancesResponse } from './types.js';
export declare const MULTICHAIN_ACCOUNTS_DOMAIN = "https://accounts.api.cx.metamask.io";
/**
 * Fetches Supported Networks.
 *
 * @returns supported networks (decimal)
 */
export declare function fetchSupportedNetworks(): Promise<number[]>;
/**
 * Fetches Balances for multiple networks.
 *
 * @param address - address to fetch balances from
 * @param options - params to pass down for a more refined search
 * @param options.networks - the networks (in decimal) that you want to filter by
 * @param platform - indicates whether the platform is extension or mobile
 * @param jwtToken - JWT token for authentication
 * @returns a Balances Response
 */
export declare function fetchMultiChainBalances(address: string, options: {
    networks?: number[];
}, platform: 'extension' | 'mobile', jwtToken?: string): Promise<GetBalancesResponse>;
/**
 * Fetches Balances for multiple networks.
 *
 * @param options - params to pass down for a more refined search
 * @param options.accountAddresses - the account addresses that you want to filter by
 * @param options.networks - the networks (in decimal) that you want to filter by
 * @param platform - indicates whether the platform is extension or mobile
 * @param jwtToken - JWT token for authentication
 * @returns a Balances Response
 */
export declare function fetchMultiChainBalancesV4(options: {
    accountAddresses?: CaipAccountAddress[];
    networks?: number[];
}, platform: 'extension' | 'mobile', jwtToken?: string): Promise<GetBalancesResponse>;
