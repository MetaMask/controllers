import type { AccountGroupId } from '@metamask/account-api';
import type { AccountTreeControllerState } from '@metamask/account-tree-controller';
import type { AccountsControllerState } from '@metamask/accounts-controller';
import type { InternalAccount } from '@metamask/keyring-internal-api';
import type { NetworkState } from '@metamask/network-controller';
import type { Hex } from '@metamask/utils';
import { weakMapMemoize } from 'reselect';
import type { CurrencyRateState } from '../CurrencyRateController.js';
import type { MultichainAssetsControllerState } from '../MultichainAssetsController/index.js';
import type { MultichainAssetsRatesControllerState } from '../MultichainAssetsRatesController/index.js';
import type { MultichainBalancesControllerState } from '../MultichainBalancesController/index.js';
import { TokenRwaData } from '../token-service.js';
import type { TokenBalancesControllerState } from '../TokenBalancesController.js';
import type { TokenRatesControllerState } from '../TokenRatesController.js';
import type { TokensControllerState } from '../TokensController.js';
export declare const TRON_RESOURCE: {
    readonly ENERGY: 'energy';
    readonly BANDWIDTH: 'bandwidth';
    readonly MAX_ENERGY: 'max-energy';
    readonly MAX_BANDWIDTH: 'max-bandwidth';
    readonly STRX_ENERGY: 'strx-energy';
    readonly STRX_BANDWIDTH: 'strx-bandwidth';
    readonly TRX_READY_FOR_WITHDRAWAL: 'trx-ready-for-withdrawal';
    readonly TRX_STAKING_REWARDS: 'trx-staking-rewards';
    readonly TRX_IN_LOCK_PERIOD: 'trx-in-lock-period';
};
export type TronResourceSymbol = (typeof TRON_RESOURCE)[keyof typeof TRON_RESOURCE];
export declare const TRON_RESOURCE_SYMBOLS: readonly TronResourceSymbol[];
export declare const TRON_RESOURCE_SYMBOLS_SET: ReadonlySet<TronResourceSymbol>;
export type AssetsByAccountGroup = {
    [accountGroupId: AccountGroupId]: AccountGroupAssets;
};
export type AccountGroupAssets = {
    [network: string]: Asset[];
};
type EvmAccountType = Extract<InternalAccount['type'], `eip155:${string}`>;
type MultichainAccountType = Exclude<InternalAccount['type'], `eip155:${string}`>;
export type Asset = ({
    accountType: EvmAccountType;
    assetId: Hex;
    address: Hex;
    chainId: Hex;
} | {
    accountType: MultichainAccountType;
    assetId: `${string}:${string}/${string}:${string}`;
    chainId: `${string}:${string}`;
}) & {
    accountId: string;
    image: string;
    name: string;
    symbol: string;
    decimals: number;
    isNative: boolean;
    rawBalance: Hex;
    balance: string;
    fiat: {
        balance: number;
        currency: string;
        conversionRate: number;
    } | undefined;
    rwaData?: TokenRwaData;
};
export type AssetListState = {
    accountTree: AccountTreeControllerState['accountTree'];
    selectedAccountGroup: AccountTreeControllerState['selectedAccountGroup'];
    internalAccounts: AccountsControllerState['internalAccounts'];
    allTokens: TokensControllerState['allTokens'];
    allIgnoredTokens: TokensControllerState['allIgnoredTokens'];
    tokenBalances: TokenBalancesControllerState['tokenBalances'];
    marketData: TokenRatesControllerState['marketData'];
    currencyRates: CurrencyRateState['currencyRates'];
    accountsAssets: MultichainAssetsControllerState['accountsAssets'];
    allIgnoredAssets: MultichainAssetsControllerState['allIgnoredAssets'];
    assetsMetadata: MultichainAssetsControllerState['assetsMetadata'];
    balances: MultichainBalancesControllerState['balances'];
    conversionRates: MultichainAssetsRatesControllerState['conversionRates'];
    currentCurrency: CurrencyRateState['currentCurrency'];
    networkConfigurationsByChainId: NetworkState['networkConfigurationsByChainId'];
    accountsByChainId: Record<Hex, Record<Hex, {
        balance: Hex | null;
    }>>;
};
export declare const selectAllAssets: any;
export type SelectAccountGroupAssetOpts = {
    filterTronStakedTokens: boolean;
};
export declare const selectAssetsBySelectedAccountGroup: ((state: AssetListState, opts?: SelectAccountGroupAssetOpts | undefined) => any) & {
    clearCache: () => void;
    resultsCount: () => number;
    resetResultsCount: () => void;
} & {
    resultFunc: (resultFuncArgs_0: any, resultFuncArgs_1: "" | `entropy:${string}/${string}` | `keyring:${string}/${string}` | `snap:${string}/${string}`, resultFuncArgs_2: SelectAccountGroupAssetOpts) => any;
    memoizedResultFunc: ((resultFuncArgs_0: any, resultFuncArgs_1: "" | `entropy:${string}/${string}` | `keyring:${string}/${string}` | `snap:${string}/${string}`, resultFuncArgs_2: SelectAccountGroupAssetOpts) => any) & {
        clearCache: () => void;
        resultsCount: () => number;
        resetResultsCount: () => void;
    };
    lastResult: () => any;
    dependencies: [any, (state: AssetListState) => "" | `entropy:${string}/${string}` | `keyring:${string}/${string}` | `snap:${string}/${string}`, (_state: AssetListState, opts?: SelectAccountGroupAssetOpts) => SelectAccountGroupAssetOpts];
    recomputations: () => number;
    resetRecomputations: () => void;
    dependencyRecomputations: () => number;
    resetDependencyRecomputations: () => void;
} & {
    memoize: typeof weakMapMemoize;
    argsMemoize: typeof weakMapMemoize;
};
export {};
