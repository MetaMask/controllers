import type { TransactionMeta } from '@metamask/transaction-controller';
import type { Hex } from '@metamask/utils';

import { USDC_DECIMALS } from '../../constants.js';
import type { QuoteRequest } from '../../types.js';
import { normalizePerpsDepositRequest } from '../../utils/perps.js';

export const ACROSS_HYPERCORE_USDC_PERPS_ADDRESS =
  '0x2100000000000000000000000000000000000000' as Hex;

/**
 * Convert the transaction-pay request into the Across route shape required for
 * direct perps deposits, targeting the HyperCore USDC-PERPS token. Across
 * quotes USDC-PERPS with 6 decimals, so the amount is not shifted.
 *
 * @param request - Transaction pay quote request.
 * @param transaction - Parent transaction whose calls are inspected.
 * @returns Normalized request for Across quoting.
 */
export function normalizeAcrossRequest(
  request: QuoteRequest,
  transaction: Pick<TransactionMeta, 'txParams' | 'nestedTransactions'>,
): QuoteRequest {
  return normalizePerpsDepositRequest(
    request,
    transaction,
    ACROSS_HYPERCORE_USDC_PERPS_ADDRESS,
    USDC_DECIMALS,
  );
}
