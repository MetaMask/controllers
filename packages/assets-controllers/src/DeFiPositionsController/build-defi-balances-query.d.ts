import type { InternalAccount } from '@metamask/keyring-internal-api';
import type { CaipChainId } from '@metamask/utils';
/**
 * Networks the DeFi balances (v6 multiaccount) endpoint supports.
 * Cross-section of the supported chains from:
 * https://developers.zerion.io/supported-blockchains
 * https://accounts.api.cx.metamask.io/v2/supportedNetworks
 */
export declare const DEFI_SUPPORTED_NETWORKS: readonly CaipChainId[];
export type DeFiBalancesQuery = {
    /** CAIP-2 networks to query, deduped across accounts. */
    networks: CaipChainId[];
    /**
     * Request CAIP-10 account IDs → internal MetaMask account IDs
     * (`InternalAccount.id`). EVM keys use the all-chains reference and a
     * lowercased address; Solana keys keep address case.
     */
    internalAccountIdByCaip: Map<string, string>;
};
/**
 * Builds the account IDs and networks to request DeFi positions for, from the
 * accounts in the selected account group.
 *
 * Picks the group's EVM account (queried across all supported EVM chains) and
 * its Solana account (queried on supported Solana chains). Enabled-network
 * filtering is intentionally omitted here: positions are stored per chain, so
 * the client can filter by enabled networks when reading state.
 *
 * @param internalAccounts - Accounts belonging to the selected account group.
 * @returns Networks and a CAIP→internal account ID map for the v6 multiaccount
 * balances request. Map keys are the CAIP account IDs to query.
 */
export declare function buildDeFiBalancesQuery(internalAccounts: InternalAccount[]): DeFiBalancesQuery;
