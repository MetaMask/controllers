import type { Web3Provider } from '@ethersproject/providers';
import type { InternalAccount } from '@metamask/keyring-internal-api';
import type { NetworkClient } from '@metamask/network-controller';
import type { Hex } from '@metamask/utils';
import BN from 'bn.js';
import type { UnprocessedTokens } from '../multi-chain-accounts-service/api-balance-fetcher.js';
import type { TokensControllerState } from '../TokensController.js';
export type ChainIdHex = Hex;
export type ChecksumAddress = Hex;
export type ProcessedBalance = {
    success: boolean;
    value?: BN;
    account: ChecksumAddress;
    token: ChecksumAddress;
    chainId: ChainIdHex;
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
        unprocessedTokens?: UnprocessedTokens;
    }): Promise<BalanceFetchResult>;
};
export declare class RpcBalanceFetcher implements BalanceFetcher {
    #private;
    constructor(getProvider: (chainId: ChainIdHex) => Web3Provider, getNetworkClient: (chainId: ChainIdHex) => NetworkClient, getTokensState: () => {
        allTokens: TokensControllerState['allTokens'];
        allDetectedTokens: TokensControllerState['allDetectedTokens'];
    });
    supports(): boolean;
    fetch({ chainIds, queryAllAccounts, selectedAccount, allAccounts, unprocessedTokens, }: Parameters<BalanceFetcher['fetch']>[0]): Promise<BalanceFetchResult>;
}
