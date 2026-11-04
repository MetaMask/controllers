import { handleFetch } from '@metamask/controller-utils';
export const MULTICHAIN_ACCOUNTS_DOMAIN = 'https://accounts.api.cx.metamask.io';
const getBalancesUrl = (address, queryParams) => {
    const url = new URL(`${MULTICHAIN_ACCOUNTS_DOMAIN}/v2/accounts/${address}/balances`);
    if (queryParams?.networks !== undefined) {
        url.searchParams.append('networks', queryParams.networks);
    }
    return url;
};
const getBalancesUrlV4 = (queryParams) => {
    const url = new URL(`${MULTICHAIN_ACCOUNTS_DOMAIN}/v4/multiaccount/balances`);
    if (queryParams?.networks !== undefined) {
        url.searchParams.append('networks', queryParams.networks);
    }
    if (queryParams?.accountAddresses !== undefined) {
        url.searchParams.append('accountAddresses', queryParams.accountAddresses);
    }
    return url;
};
/**
 * Fetches Supported Networks.
 *
 * @returns supported networks (decimal)
 */
export async function fetchSupportedNetworks() {
    const url = new URL(`${MULTICHAIN_ACCOUNTS_DOMAIN}/v1/supportedNetworks`);
    const response = await handleFetch(url);
    return response.fullSupport;
}
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
export async function fetchMultiChainBalances(address, options, platform, jwtToken) {
    const url = getBalancesUrl(address, {
        networks: options?.networks?.join(),
    });
    const headers = {
        'x-metamask-clientproduct': `metamask-${platform}`,
    };
    if (jwtToken) {
        headers.Authorization = `Bearer ${jwtToken}`;
    }
    const response = await handleFetch(url, {
        headers,
    });
    return response;
}
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
export async function fetchMultiChainBalancesV4(options, platform, jwtToken) {
    const url = getBalancesUrlV4({
        accountAddresses: options?.accountAddresses?.join(),
        networks: options?.networks?.join(),
    });
    const headers = {
        'x-metamask-clientproduct': `metamask-${platform}`,
    };
    if (jwtToken) {
        headers.Authorization = `Bearer ${jwtToken}`;
    }
    const response = await handleFetch(url, {
        headers,
    });
    return response;
}
