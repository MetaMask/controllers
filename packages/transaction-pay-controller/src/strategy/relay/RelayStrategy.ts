import type { CaipChainId, Hex } from '@metamask/utils';

import type {
  PayStrategy,
  PayStrategyExecuteRequest,
  PayStrategyExecuteResult,
  PayStrategyGetRefreshIntervalRequest,
  PayStrategyGetQuotesRequest,
  TransactionPayQuote,
} from '../../types.js';
import {
  getMaxBalanceRefreshInterval,
  getPayStrategiesConfig,
} from '../../utils/feature-flags.js';
import { isEvmQuoteRequest, isNonEvmQuoteRequest } from '../../utils/token.js';
import { getTransaction } from '../../utils/transaction.js';
import { getRelayQuotes } from './relay-quotes.js';
import { getRelaySolanaQuotes } from './relay-solana-quotes.js';
import { submitRelayNonEvmQuote } from './relay-submit-non-evm.js';
import { submitRelayQuotes } from './relay-submit.js';
import type { RelayQuote, RelaySolanaPayQuote } from './types.js';

/**
 * Pay strategy that quotes and submits through Relay. Supports every source
 * protocol, and selects the quote and execution path from the protocol of the
 * source asset of each request.
 */
export class RelayStrategy implements PayStrategy<
  RelayQuote | RelaySolanaPayQuote,
  Hex | CaipChainId
> {
  supports(request: PayStrategyGetQuotesRequest<Hex | CaipChainId>): boolean {
    const config = getPayStrategiesConfig(request.messenger);
    return config.relay.enabled;
  }

  async getQuotes(
    request: PayStrategyGetQuotesRequest<Hex | CaipChainId>,
  ): Promise<
    TransactionPayQuote<RelayQuote | RelaySolanaPayQuote, Hex | CaipChainId>[]
  > {
    const { requests } = request;

    if (requests.some(isNonEvmQuoteRequest)) {
      return getRelaySolanaQuotes({
        ...request,
        requests: requests.filter(isNonEvmQuoteRequest),
      });
    }

    return getRelayQuotes({
      ...request,
      requests: requests.filter(isEvmQuoteRequest),
    });
  }

  async getRefreshInterval(
    request: PayStrategyGetRefreshIntervalRequest,
  ): Promise<number | undefined> {
    const { messenger, transactionId } = request;
    const transactionData = messenger.call('TransactionPayController:getState')
      .transactionData[transactionId];

    if (!transactionData?.isMaxAmount) {
      return undefined;
    }

    const transaction = getTransaction(transactionId, messenger);

    return getMaxBalanceRefreshInterval(messenger, transaction);
  }

  async execute(
    request: PayStrategyExecuteRequest<
      RelayQuote | RelaySolanaPayQuote,
      Hex | CaipChainId
    >,
  ): Promise<PayStrategyExecuteResult> {
    const { messenger, quotes, transaction } = request;

    if (quotes.some((quote) => isNonEvmQuoteRequest(quote.request))) {
      if (quotes.length > 1) {
        throw new Error('Relay: Multiple non-EVM quotes are not supported');
      }

      return await submitRelayNonEvmQuote({
        messenger,
        quote: quotes[0] as TransactionPayQuote<
          RelaySolanaPayQuote,
          CaipChainId
        >,
        transaction,
      });
    }

    return await submitRelayQuotes(
      request as PayStrategyExecuteRequest<RelayQuote>,
    );
  }
}
