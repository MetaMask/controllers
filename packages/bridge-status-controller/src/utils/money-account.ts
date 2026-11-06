import {
  getAccountByAddress,
  getFeatureFlags,
  type QuoteResponseV1,
} from '@metamask/bridge-controller';
import { getMoneyAccountVaultConfig } from '@metamask/money-account-utils';
import { CHAIN_IDS } from '@metamask/transaction-controller';

import type { BridgeStatusControllerMessenger } from '../types.js';

type MoneyAccountDepositConfig = {
  chainIdHex: `0x${string}`;
  boringVault: `0x${string}`;
  tellerAddress: `0x${string}`;
  accountantAddress: `0x${string}`;
  lensAddress: `0x${string}`;
  moneyAccountAddress: `0x${string}`;
  isGasFeeSponsored: boolean;
};

/**
 * Resolves the primary money account and vault config to use for the money account deposit request
 *
 * UI: Money is dest token
 *
 * emvAccount swap X to MUSD at moneyAccount's evmAddress (swap + send)
 * moneyAccount's evmAddress deposit MUSD to moneyAccount
 *
 * @param params - The parameters for the function
 * @param params.messenger - The bridge-controller messenger instance
 * @param params.quoteRequest - The normalized quote request
 * @returns The money account deposit config, undefined if the dest wallet address is not a money account
 */
export const getMoneyAccountDepositSetup = async ({
  messenger,
  quote,
  account,
}: {
  messenger: BridgeStatusControllerMessenger;
  quote: QuoteResponseV1['quote'];
  account: string;
}): Promise<MoneyAccountDepositConfig | undefined> => {
  // Get primary money account for dest wallet address
  const depositor = getAccountByAddress(
    messenger,
    quote.destWalletAddress ?? quote.walletAddress ?? account,
  )?.id;
  if (!depositor) {
    return undefined;
  }
  const primaryMoneyAccount = messenger.call(
    'MoneyAccountController:getMoneyAccount',
    { id: depositor },
  );
  if (!primaryMoneyAccount) {
    return undefined;
  }
  if (!primaryMoneyAccount.address) {
    return undefined;
  }

  // Get vault config
  const featureFlags = getFeatureFlags(messenger);
  const vaultConfig = getMoneyAccountVaultConfig(featureFlags);
  if (!vaultConfig) {
    return undefined;
  }

  const {
    chainId,
    boringVault,
    tellerAddress,
    accountantAddress,
    lensAddress,
  } = vaultConfig;

  return {
    chainIdHex: chainId,
    boringVault,
    tellerAddress,
    accountantAddress,
    lensAddress,
    moneyAccountAddress: primaryMoneyAccount.address as `0x${string}`,
    isGasFeeSponsored: CHAIN_IDS.MONAD === chainId,
  };
};
