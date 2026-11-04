import type { Hex } from '@metamask/utils';
import nock from 'nock';
export declare const mockResponse_accountsAPI_MultichainAccountBalances: (accountAddress: Hex) => {
    count: number;
    balances: ({
        object: string;
        address: string;
        symbol: string;
        name: string;
        type: string;
        decimals: number;
        chainId: number;
        balance: string;
        accountAddress: string;
    } | {
        type?: undefined;
        object: string;
        address: string;
        name: string;
        symbol: string;
        decimals: number;
        balance: string;
        chainId: number;
        accountAddress: string;
    })[];
    unprocessedNetworks: never[];
};
export declare const mockAPI_accountsAPI_MultichainAccountBalances: (accountAddress: Hex) => nock.Scope;
