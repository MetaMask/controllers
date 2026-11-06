import {
  array,
  boolean,
  enums,
  literal,
  number,
  optional,
  string,
  type,
  union,
} from '@metamask/superstruct';
import type { Infer } from '@metamask/superstruct';

/**
 * Stellar specific token metadata (trustline and native reserve fields).
 * All fields are optional and unknown fields are allowed.
 */
const TokenBalanceMetadataStruct = type({
  limit: optional(string()),
  authorized: optional(boolean()),
  sponsored: optional(boolean()),
  spendableBalance: optional(string()),
  minimumReserveBalance: optional(string()),
});

/**
 * DeFi protocol metadata attached to `object: defi` rows (v6 only).
 */
const DefiBalanceMetadataStruct = type({
  protocolId: string(),
  productName: string(),
  description: string(),
  protocolUrl: string(),
  protocolIconUrl: optional(string()),
  positionType: enums([
    'deposit',
    'loan',
    'locked',
    'staked',
    'reward',
    'wallet',
    'investment',
  ]),
  poolAddress: string(),
  groupId: string(),
});

const V5BalanceItemStruct = type({
  object: literal('token'),
  symbol: string(),
  name: string(),
  type: enums(['native', 'erc20']),
  decimals: number(),
  assetId: string(),
  balance: string(),
  accountId: string(),
  metadata: optional(TokenBalanceMetadataStruct),
});

const V6BalanceItemStruct = type({
  accountId: string(),
  object: enums(['token', 'defi']),
  type: string(),
  assetId: string(),
  name: string(),
  symbol: string(),
  decimals: number(),
  balance: string(),
  price: optional(string()),
  labels: optional(array(string())),
  canonicalHead: optional(string()),
  metadata: optional(
    union([DefiBalanceMetadataStruct, TokenBalanceMetadataStruct]),
  ),
});

/** Accounts API v5 multi account balances response. */
export const V5BalancesResponseStruct = type({
  count: number(),
  unprocessedNetworks: array(string()),
  balances: array(V5BalanceItemStruct),
});

/** Accounts API v6 multi account balances response. */
export const V6BalancesResponseStruct = type({
  unprocessedNetworks: array(string()),
  unprocessedIncludeAssetIds: array(string()),
  balances: array(V6BalanceItemStruct),
  processingDefiPositions: optional(array(string())),
});

/** A validated v5 or v6 balances response. */
export type BalancesResponse =
  | Infer<typeof V5BalancesResponseStruct>
  | Infer<typeof V6BalancesResponseStruct>;
