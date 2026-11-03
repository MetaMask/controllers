import type { TokenAmountValues } from '@metamask/bridge-controller';
import { isNativeAddress } from '@metamask/bridge-controller';
import type { TransactionMeta } from '@metamask/transaction-controller';
import { BigNumber } from 'bignumber.js';

import type { BridgeHistoryItem } from '../types.js';
import { hexToBigNumber } from './hex-to-big-number.js';
import { parseDecimal } from './parse-decimal.js';

const getReceivedNativeAmount = (
  historyItem: BridgeHistoryItem,
  actualGas: Omit<TokenAmountValues, 'valueInCurrency'> | null,
  txMeta: TransactionMeta,
) => {
  const { preTxBalance, postTxBalance } = txMeta;

  if (!preTxBalance || !postTxBalance || preTxBalance === postTxBalance) {
    // If preTxBalance and postTxBalance are equal, postTxBalance hasn't been updated on time
    // because of the RPC provider delay, so we return an estimated receiving amount instead.
    return (
      parseDecimal(historyItem.quote.destTokenAmount)
        ?.div(new BigNumber(10).pow(historyItem.quote.destAsset.decimals))
        .toString(10) ?? null
    );
  }

  return actualGas && postTxBalance && preTxBalance
    ? hexToBigNumber(postTxBalance)
        .minus(hexToBigNumber(preTxBalance))
        .minus(actualGas.amount)
        .div(10 ** historyItem.quote.destAsset.decimals)
    : null;
};

const getReceivedERC20Amount = (
  historyItem: BridgeHistoryItem,
  txMeta: TransactionMeta,
) => {
  const { txReceipt } = txMeta;
  if (!txReceipt?.logs || txReceipt.status === '0x0') {
    return null;
  }
  const { account: accountAddress, quote } = historyItem;

  const TOKEN_TRANSFER_LOG_TOPIC_HASH =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  const tokenTransferLog = txReceipt.logs.find((txReceiptLog) => {
    const isTokenTransfer = txReceiptLog.topics?.[0]?.startsWith(
      TOKEN_TRANSFER_LOG_TOPIC_HASH,
    );
    const isTransferFromGivenToken =
      txReceiptLog.address?.toLowerCase() ===
      quote.destAsset.address?.toLowerCase();
    const isTransferFromGivenAddress =
      txReceiptLog.topics?.[2] &&
      (txReceiptLog.topics[2] === accountAddress ||
        txReceiptLog.topics[2].match(accountAddress?.slice(2)));

    return (
      isTokenTransfer && isTransferFromGivenToken && isTransferFromGivenAddress
    );
  });

  if (tokenTransferLog?.data) {
    return hexToBigNumber(tokenTransferLog.data).div(
      new BigNumber(10).pow(quote.destAsset.decimals),
    );
  }

  return null;
};

/**
 * Calculate the amount received after a swap transaction based on the txMeta
 *
 * @param historyItem - The bridge history item
 * @param actualGas - The actual gas used for the transaction
 * @param txMeta - The transaction meta from the TransactionController
 * @returns The actual amount received for the swap transaction
 */
export const getActualSwapReceivedAmount = (
  historyItem: BridgeHistoryItem,
  actualGas: Omit<TokenAmountValues, 'valueInCurrency'> | null,
  txMeta?: TransactionMeta,
) => {
  const { pricingData } = historyItem;
  const quotedReturnAmount = historyItem.quote.destTokenAmount;

  if (!txMeta?.txReceipt) {
    return null;
  }

  const actualReturnAmount = isNativeAddress(
    historyItem.quote.destAsset.address,
  )
    ? getReceivedNativeAmount(historyItem, actualGas, txMeta)
    : getReceivedERC20Amount(historyItem, txMeta);

  const quotedReturnInUsd = parseDecimal(pricingData?.quotedReturnInUsd);
  const quotedReturnTokens = parseDecimal(quotedReturnAmount);
  const returnUsdExchangeRate =
    quotedReturnInUsd && quotedReturnTokens
      ? quotedReturnInUsd
          .div(quotedReturnTokens)
          .multipliedBy(10 ** historyItem.quote.destAsset.decimals)
      : null;

  return {
    amount: actualReturnAmount,
    usd:
      actualReturnAmount && returnUsdExchangeRate
        ? returnUsdExchangeRate.multipliedBy(actualReturnAmount)
        : null,
  };
};

/**
 * Calculate the amount received after a bridge transaction based on the getTxStatus's
 * amount field
 *
 * @param historyItem - The bridge history item
 * @returns The actual amount received for the bridge transaction
 */
export const getActualBridgeReceivedAmount = (
  historyItem: BridgeHistoryItem,
): Omit<TokenAmountValues, 'valueInCurrency'> | null => {
  const { quote, pricingData, status } = historyItem;

  const quotedReturnInUsd = parseDecimal(pricingData?.quotedReturnInUsd);
  const quotedReturnTokens = parseDecimal(quote.destTokenAmount);
  const usdExchangeRate =
    quotedReturnInUsd && quotedReturnTokens
      ? quotedReturnInUsd.div(quotedReturnTokens)
      : null;

  const actualAmount = status.destChain?.amount;
  const parsedActualAmount = parseDecimal(actualAmount);
  return actualAmount && parsedActualAmount && usdExchangeRate
    ? {
        amount: actualAmount,
        usd: usdExchangeRate.multipliedBy(parsedActualAmount).toString(10),
      }
    : null;
};
