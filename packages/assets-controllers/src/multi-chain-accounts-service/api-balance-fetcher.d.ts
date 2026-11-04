import type { Web3Provider } from '@ethersproject/providers';
import type { InternalAccount } from '@metamask/keyring-internal-api';
import type { Hex } from '@metamask/utils';
import BN from 'bn.js';
export type ChainIdHex = Hex;
export type ChecksumAddress = Hex;
export type ProcessedBalance = {
    success: boolean;
    value?: BN;
    account: ChecksumAddress | string;
    token: ChecksumAddress;
    chainId: ChainIdHex;
};
/**
 * Account -> ChainId -> TokenAddress[]
 */
export type UnprocessedTokens = {
    [account: string]: {
        [chainId: ChainIdHex]: string[];
    };
};
export type BalanceFetchResult = {
    balances: ProcessedBalance[];
    unprocessedChainIds?: ChainIdHex[];
    unprocessedTokens?: UnprocessedTokens;
};
export type BalanceFetcher = {
    supports(chainId: ChainIdHex): boolean;
    fetch(input: {
        chainIds: ChainIdHex[];
        queryAllAccounts: boolean;
        selectedAccount: ChecksumAddress;
        allAccounts: InternalAccount[];
        jwtToken?: string;
        unprocessedTokens?: UnprocessedTokens;
    }): Promise<BalanceFetchResult>;
};
export type GetProviderFunction = (chainId: ChainIdHex) => Web3Provider;
export declare class AccountsApiBalanceFetcher implements BalanceFetcher {
    #private;
    constructor(platform?: 'extension' | 'mobile', getProvider?: GetProviderFunction, getUserTokens?: () => {
        [account: ChecksumAddress]: {
            [chainId: ChainIdHex]: {
                [tokenAddress: ChecksumAddress]: unknown;
            };
        };
    });
    supports(chainId: ChainIdHex): boolean;
    fetch({ chainIds, queryAllAccounts, selectedAccount, allAccounts, jwtToken, }: Parameters<BalanceFetcher['fetch']>[0]): Promise<BalanceFetchResult>;
}
