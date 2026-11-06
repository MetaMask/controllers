import { Web3Provider } from '@ethersproject/providers';
import { type Trade } from '@metamask/bridge-controller';
import { buildMoneyAccountDepositBatch } from '@metamask/money-account-utils';
import { generateBatchId } from '@metamask/transaction-controller';

import type { StatusResponse } from '../types.js';
import { getMoneyAccountDepositSetup } from '../utils/money-account.js';
import { getNetworkClientByChainId } from '../utils/network.js';
import { getReceivedERC20Amount } from '../utils/swap-received-amount.js';
import {
  findAllTransactionsInBatch,
  getAddTransactionBatchParams,
  shouldDisable7702,
} from '../utils/transaction.js';
import { SubmitStep } from './types.js';
import type { SubmitStrategyParams, SubmitStepResult } from './types.js';

/**
 * Submits a post-swap EVM deposit batch to the TransactionController
 *
 * @param args - The parameters for the transaction
 * @yields The approvalMeta and tradeMeta for the batched transaction
 */
export async function* submitDepositHandler(
  args: SubmitStrategyParams<Trade> & {
    batchId: `0x${string}`;
    historyKey: string;
  },
): AsyncGenerator<SubmitStepResult, void, void> {
  const {
    requireApproval,
    quoteResponses: [quoteResponse],
    messenger,
    addTransactionBatchFn,
    isDelegatedAccount,
    selectedAccount,
    previousTxHash,
    historyKey,
    batchId,
  } = args;

  const quote = quoteResponse.quote;

  if (!previousTxHash) {
    throw new Error('Previous transaction hash is required for deposit');
  }

  const depositConfig = await getMoneyAccountDepositSetup({
    messenger,
    quote,
    account: selectedAccount.address,
  });
  if (!depositConfig) {
    throw new Error('Failed to get money account deposit config');
  }

  try {
    // Get actual received amount from receipt
    const provider = getNetworkClientByChainId(messenger, quote.destChainId);
    if (!provider) {
      throw new Error(`No provider available for chain ${quote.destChainId}`);
    }
    const ethersProvider = new Web3Provider(provider);
    const txReceipt =
      await ethersProvider.getTransactionReceipt(previousTxHash);
    const receivedAmount = getReceivedERC20Amount(
      quote.destWalletAddress ?? quote.walletAddress ?? selectedAccount.address,
      quote.destAsset.address,
      txReceipt?.logs,
    );

    if (!receivedAmount) {
      throw new Error(`Missing received amount`);
    }

    const {
      boringVault,
      tellerAddress,
      accountantAddress,
      lensAddress,
      moneyAccountAddress,
      chainIdHex,
      isGasFeeSponsored,
    } = depositConfig;

    // Build txs
    const { approveTx, depositTx } = await buildMoneyAccountDepositBatch({
      amount: BigInt(receivedAmount.toNumber()),
      chainId: chainIdHex,
      provider: ethersProvider,
      boringVault,
      tellerAddress,
      accountantAddress,
      lensAddress,
    });

    const tradeData = [
      {
        quoteResponse,
        tx: {
          ...approveTx.params,
          from: moneyAccountAddress,
          chainId: quote.destChainId,
          gasLimit: null,
        },
        type: approveTx.type,
      },
      {
        quoteResponse,
        tx: {
          ...depositTx.params,
          from: moneyAccountAddress,
          chainId: quote.destChainId,
          gasLimit: null,
        },
        type: depositTx.type,
      },
    ];

    const transactionParams = await getAddTransactionBatchParams({
      tradeData,
      requireApproval,
      isDelegatedAccount,
      messenger,
      atomic: true,
      disable7702: shouldDisable7702(
        quoteResponse.quote.gasIncluded7702,
        quoteResponse.quote.gasIncluded,
        isDelegatedAccount,
      ),
      isGasFeeSponsored:
        isGasFeeSponsored || Boolean(quoteResponse.quote.gasSponsored),
      isGasFeeIncluded: Boolean(quoteResponse.quote.gasIncluded7702),
      batchId,
    });

    // Add tx batch
    await addTransactionBatchFn(transactionParams);
    // TODO this may not find deposits, need to test
    const tradeMeta = findAllTransactionsInBatch({
      messenger,
      batchId,
      tradeData,
    })?.find(({ txMeta }) => txMeta)?.txMeta;
    if (!tradeMeta?.hash) {
      throw new Error('Failed to find deposit transaction meta in batch');
    }

    yield {
      type: SubmitStep.SetTradeMeta,
      payload: { tradeMeta },
    };

    yield {
      type: SubmitStep.UpdateHistoryItem,
      payload: {
        historyKey,
        historyItemOverrides: {
          depositTxMeta: {
            id: tradeMeta.id,
            hash: tradeMeta.hash,
          },
        },
      },
    };
  } catch (error) {
    console.error(
      'Failed to deposit funds to money account after swap confirmation',
      error,
    );
    // Client submission hooks don't catch this error so use messenger to capture it
    messenger.captureException?.(error as Error);
  }
}
