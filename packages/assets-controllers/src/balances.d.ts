import type { AccountTreeControllerState } from '@metamask/account-tree-controller';
import type { AccountsControllerState } from '@metamask/accounts-controller';
import type { Hex } from '@metamask/utils';
import type { CurrencyRateState } from './CurrencyRateController.js';
import type { MultichainAssetsControllerState } from './MultichainAssetsController/index.js';
import type { MultichainAssetsRatesControllerState } from './MultichainAssetsRatesController/index.js';
import type { MultichainBalancesControllerState } from './MultichainBalancesController/index.js';
import type { TokenBalancesControllerState } from './TokenBalancesController.js';
import type { TokenRatesControllerState } from './TokenRatesController.js';
import type { TokensControllerState } from './TokensController.js';
export type AccountGroupBalance = {
    walletId: string;
    groupId: string;
    totalBalanceInUserCurrency: number;
    userCurrency: string;
};
export type WalletBalance = {
    walletId: string;
    groups: Record<string, AccountGroupBalance>;
    totalBalanceInUserCurrency: number;
    userCurrency: string;
};
export type AllWalletsBalance = {
    wallets: Record<string, WalletBalance>;
    totalBalanceInUserCurrency: number;
    userCurrency: string;
};
export type BalanceChangePeriod = '1d' | '7d' | '30d';
export type BalanceChangeResult = {
    period: BalanceChangePeriod;
    currentTotalInUserCurrency: number;
    previousTotalInUserCurrency: number;
    amountChangeInUserCurrency: number;
    percentChange: number;
    userCurrency: string;
};
/**
 * Minimal network config shape needed to derive native currency by chain.
 * Compatible with NetworkController's networkConfigurationsByChainId entries.
 */
export type NetworkConfigurationNativeCurrency = {
    nativeCurrency: string;
};
/**
 * Calculate balances for all wallets and groups.
 * Pure function – accepts controller states and returns aggregated totals.
 *
 * @param accountTreeState - AccountTreeController state
 * @param accountsState - AccountsController state
 * @param tokenBalancesState - TokenBalancesController state
 * @param tokenRatesState - TokenRatesController state
 * @param multichainRatesState - MultichainAssetsRatesController state
 * @param multichainBalancesState - MultichainBalancesController state
 * @param multichainAssetsState - MultichainAssetsController state
 * @param tokensState - TokensController state
 * @param currencyRateState - CurrencyRateController state
 * @param enabledNetworkMap - Map of enabled networks keyed by namespace
 * @param networkConfigurationsByChainId - Network configurations by chain ID.
 * @returns Aggregated balances for all wallets
 */
export declare function calculateBalanceForAllWallets(accountTreeState: AccountTreeControllerState, accountsState: AccountsControllerState, tokenBalancesState: TokenBalancesControllerState, tokenRatesState: TokenRatesControllerState, multichainRatesState: MultichainAssetsRatesControllerState, multichainBalancesState: MultichainBalancesControllerState, multichainAssetsState: MultichainAssetsControllerState, tokensState: TokensControllerState, currencyRateState: CurrencyRateState, enabledNetworkMap: Record<string, Record<string, boolean>> | undefined, networkConfigurationsByChainId?: Record<Hex, NetworkConfigurationNativeCurrency>): AllWalletsBalance;
/**
 * Calculate aggregated portfolio value change for a given period (1d, 7d, 30d).
 * Logic mirrors extension/mobile historical aggregation:
 * - For each asset with available percent change for the requested period, compute current value in user currency.
 * - Reconstruct previous value by dividing current by (1 + percent/100).
 * - Sum across all assets, then compute amount change and percent change.
 *
 * @param accountTreeState - AccountTreeController state.
 * @param accountsState - AccountsController state.
 * @param tokenBalancesState - TokenBalancesController state.
 * @param tokenRatesState - TokenRatesController state.
 * @param multichainRatesState - MultichainAssetsRatesController state.
 * @param multichainBalancesState - MultichainBalancesController state.
 * @param multichainAssetsState - MultichainAssetsController state.
 * @param tokensState - TokensController state.
 * @param currencyRateState - CurrencyRateController state.
 * @param enabledNetworkMap - Map of enabled networks keyed by namespace.
 * @param period - Period to compute change for ('1d' | '7d' | '30d').
 * @param networkConfigurationsByChainId - Optional network configurations to derive native currency fallback pricing.
 * @returns Aggregated change details for the requested period.
 */
export declare function calculateBalanceChangeForAllWallets(accountTreeState: AccountTreeControllerState, accountsState: AccountsControllerState, tokenBalancesState: TokenBalancesControllerState, tokenRatesState: TokenRatesControllerState, multichainRatesState: MultichainAssetsRatesControllerState, multichainBalancesState: MultichainBalancesControllerState, multichainAssetsState: MultichainAssetsControllerState, tokensState: TokensControllerState, currencyRateState: CurrencyRateState, enabledNetworkMap: Record<string, Record<string, boolean>> | undefined, period: BalanceChangePeriod, networkConfigurationsByChainId?: Record<Hex, NetworkConfigurationNativeCurrency>): BalanceChangeResult;
/**
 * Calculate portfolio value change for a specific account group and period.
 *
 * @param accountTreeState - AccountTreeController state.
 * @param accountsState - AccountsController state.
 * @param tokenBalancesState - TokenBalancesController state.
 * @param tokenRatesState - TokenRatesController state.
 * @param multichainRatesState - MultichainAssetsRatesController state.
 * @param multichainBalancesState - MultichainBalancesController state.
 * @param multichainAssetsState - MultichainAssetsController state.
 * @param tokensState - TokensController state.
 * @param currencyRateState - CurrencyRateController state.
 * @param enabledNetworkMap - Map of enabled networks keyed by namespace.
 * @param groupId - Account group ID to compute change for.
 * @param period - Change period ('1d' | '7d' | '30d').
 * @param networkConfigurationsByChainId - Optional network configurations to derive native currency fallback pricing.
 * @returns Change result including current, previous, delta, percent, and period.
 */
export declare function calculateBalanceChangeForAccountGroup(accountTreeState: AccountTreeControllerState, accountsState: AccountsControllerState, tokenBalancesState: TokenBalancesControllerState, tokenRatesState: TokenRatesControllerState, multichainRatesState: MultichainAssetsRatesControllerState, multichainBalancesState: MultichainBalancesControllerState, multichainAssetsState: MultichainAssetsControllerState, tokensState: TokensControllerState, currencyRateState: CurrencyRateState, enabledNetworkMap: Record<string, Record<string, boolean>> | undefined, groupId: string, period: BalanceChangePeriod, networkConfigurationsByChainId?: Record<Hex, NetworkConfigurationNativeCurrency>): BalanceChangeResult;
