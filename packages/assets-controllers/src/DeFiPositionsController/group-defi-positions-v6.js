import { V6_DEFI_POSITION_TYPES } from '@metamask/core-backend';
import { KnownCaipNamespace, parseCaipAccountId, parseCaipAssetType, parseCaipChainId, } from '@metamask/utils';
/** Static.cx host used to build CAIP-19 token icon URLs for DeFi positions. */
const STATIC_METAMASK_BASE_URL = 'https://static.cx.metamask.io';
/**
 * Possible `positionType` values from Accounts API v6 DeFi metadata.
 * Re-export of {@link V6_DEFI_POSITION_TYPES} from `@metamask/core-backend`.
 */
export const DEFI_POSITION_TYPES = V6_DEFI_POSITION_TYPES;
/**
 * Position types whose fiat value is a liability and is subtracted from the
 * protocol group's aggregated `marketValue`.
 */
export const DEFI_POSITION_LIABILITY_TYPES = new Set(['loan']);
// Prefer ETH/WETH first in the list-row icon stack when a protocol has multiple
// underlyings. Display-only.
const SYMBOL_PRIORITY = ['ETH', 'WETH'];
/**
 * Builds a static token icon URL for a CAIP asset ID.
 *
 * @param assetId - The CAIP-19 asset ID.
 * @returns The token icon URL, or `undefined` when it cannot be built.
 */
function getDefiTokenImageUrl(assetId) {
    try {
        const { chainId } = parseCaipAssetType(assetId);
        const { namespace } = parseCaipChainId(chainId);
        const isEvm = namespace === KnownCaipNamespace.Eip155;
        const normalizedAssetId = (isEvm ? assetId.toLowerCase() : assetId).replace(/:/gu, '/');
        return `${STATIC_METAMASK_BASE_URL}/api/v2/tokenIcons/assets/${normalizedAssetId}.png`;
    }
    catch {
        return undefined;
    }
}
/**
 * Returns whether a balance row is a DeFi position carrying protocol metadata.
 *
 * @param balance - A balance row from the v6 API.
 * @returns True when the row is an `object: defi` row with protocol metadata.
 */
function isDefiBalanceWithMetadata(balance) {
    return (balance.object === 'defi' &&
        balance.metadata !== undefined &&
        balance.metadata.protocolId !== undefined);
}
/**
 * Returns the fiat market value for a v6 DeFi balance row.
 *
 * @param balance - A balance row from the v6 API.
 * @returns The fiat value, or `undefined` when price is missing or the
 * balance/price is invalid.
 */
function getMarketValue(balance) {
    if (balance.price === undefined) {
        return undefined;
    }
    const normalizedBalance = Number.parseFloat(balance.balance);
    const price = Number.parseFloat(balance.price);
    if (!Number.isFinite(normalizedBalance) || !Number.isFinite(price)) {
        return undefined;
    }
    return normalizedBalance * price;
}
/**
 * Returns the sign used when rolling a position's market value into a protocol
 * group total. Liability types (currently `lending`) subtract; all others add.
 *
 * @param positionType - The position's protocol module type.
 * @returns `-1` for liabilities, `1` otherwise.
 */
function getMarketValueSign(positionType) {
    return DEFI_POSITION_LIABILITY_TYPES.has(positionType) ? -1 : 1;
}
/**
 * Moves a priority symbol (ETH/WETH) to the front of the icon group, in place.
 *
 * @param iconGroup - The icon-group entries to reorder.
 */
function orderIconGroup(iconGroup) {
    const priorityIndex = iconGroup.findIndex((item) => SYMBOL_PRIORITY.includes(item.symbol));
    if (priorityIndex > 0) {
        const [priorityIcon] = iconGroup.splice(priorityIndex, 1);
        iconGroup.unshift(priorityIcon);
    }
}
/**
 * Maps a DeFi balance row to a details-page underlying position.
 *
 * @param balance - A DeFi balance row with protocol metadata.
 * @returns The underlying position for the details page.
 */
function toUnderlyingPosition(balance) {
    const assetId = balance.assetId;
    const { chainId } = parseCaipAssetType(assetId);
    const { positionType, poolAddress, groupId } = balance.metadata;
    return {
        assetId,
        chainId,
        symbol: balance.symbol,
        name: balance.name,
        balance: balance.balance,
        decimals: balance.decimals,
        marketValue: getMarketValue(balance),
        positionType,
        poolAddress,
        groupId,
        tokenImage: getDefiTokenImageUrl(assetId),
    };
}
/**
 * Builds a chain-reference-agnostic key (`namespace:address`) for matching the
 * CAIP-10 account IDs we request against the ones the v6 API echoes back.
 *
 * We request EVM balances with the all-chains reference (`eip155:0:<address>`),
 * but the response echoes a separate per-chain ID for every chain
 * (`eip155:1:<address>`, `eip155:137:<address>`, ...). Matching on the full
 * CAIP-10 string therefore fails, so we drop the reference and match on
 * namespace + address instead. EVM addresses are lowercased; other namespaces
 * keep their case.
 *
 * @param caipAccountId - A CAIP-10 account ID.
 * @returns The match key, or a case-normalized fallback if parsing fails.
 */
function toAccountMatchKey(caipAccountId) {
    try {
        const { chain: { namespace }, address, } = parseCaipAccountId(caipAccountId);
        const normalizedAddress = namespace === KnownCaipNamespace.Eip155 ? address.toLowerCase() : address;
        return `${namespace}:${normalizedAddress}`;
    }
    catch {
        return caipAccountId.startsWith(`${KnownCaipNamespace.Eip155}:`)
            ? caipAccountId.toLowerCase()
            : caipAccountId;
    }
}
/**
 * Transforms a v6 multiaccount balances response into the stored DeFi state:
 * positions keyed by internal account ID, each mapping to a flat list of
 * protocol groups. Every group carries its own `chainId` (so the client can
 * filter without a nested chain map) plus both the DeFi-tab summary and the
 * details-page sections. When the request-account map is provided, every
 * requested account is included with an empty list so stale data is cleared
 * even when the flat response contains no rows for that account.
 *
 * When `internalAccountIdByCaip` is provided, response account IDs are matched
 * to internal MetaMask account IDs via namespace + address (ignoring chain
 * reference and EVM case). Unmatched accounts are skipped. When omitted, the
 * response account ID is used as-is (handy for unit tests).
 *
 * @param response - The v6 multiaccount balances response.
 * @param internalAccountIdByCaip - Optional map of request CAIP-10 account IDs
 * to internal MetaMask account IDs.
 * @returns DeFi positions keyed by internal account ID.
 */
export function groupDeFiPositionsV6(response, internalAccountIdByCaip) {
    const internalAccountIdByMatchKey = internalAccountIdByCaip
        ? new Map([...internalAccountIdByCaip].map(([caipAccountId, internalId]) => [
            toAccountMatchKey(caipAccountId),
            internalId,
        ]))
        : undefined;
    // Accumulate groups per resolved internal account ID. The v6 response rows
    // carry per-chain account IDs (e.g. `eip155:1:<addr>`,
    // `eip155:137:<addr>`), and several can resolve to the same internal account
    // ID, so merge across all of them.
    const groupsByAccountKey = new Map(internalAccountIdByCaip
        ? [...new Set(internalAccountIdByCaip.values())].map((accountId) => [
            accountId,
            new Map(),
        ])
        : []);
    for (const balance of response.balances) {
        const accountId = internalAccountIdByMatchKey
            ? internalAccountIdByMatchKey.get(toAccountMatchKey(balance.accountId))
            : balance.accountId;
        if (accountId === undefined) {
            continue;
        }
        let groupsByKey = groupsByAccountKey.get(accountId);
        if (!groupsByKey) {
            groupsByKey = new Map();
            groupsByAccountKey.set(accountId, groupsByKey);
        }
        if (!isDefiBalanceWithMetadata(balance)) {
            continue;
        }
        const position = toUnderlyingPosition(balance);
        const { protocolId, productName, protocolIconUrl } = balance.metadata;
        const groupKey = `${position.chainId}#${protocolId}`;
        let group = groupsByKey.get(groupKey);
        if (!group) {
            group = {
                protocolId,
                productName,
                // Upstream may omit the icon; keep a string so clients do not need
                // optional handling on the stored group shape.
                protocolIconUrl: protocolIconUrl ?? '',
                chainId: position.chainId,
                marketValue: 0,
                iconGroup: [],
                sections: [],
            };
            groupsByKey.set(groupKey, group);
        }
        if (position.marketValue !== undefined) {
            group.marketValue +=
                position.marketValue * getMarketValueSign(position.positionType);
        }
        if (!group.iconGroup.some((item) => item.symbol === position.symbol)) {
            group.iconGroup.push({
                symbol: position.symbol,
                avatarValue: position.tokenImage,
            });
        }
        // Sections are keyed by productName; distinct groupIds under the same
        // product remain available on each underlying position.
        let section = group.sections.find((item) => item.productName === productName);
        if (!section) {
            section = { productName, positions: [] };
            group.sections.push(section);
        }
        section.positions.push(position);
    }
    const result = {};
    for (const [accountId, groupsByKey] of groupsByAccountKey) {
        const groups = [...groupsByKey.values()];
        for (const group of groups) {
            orderIconGroup(group.iconGroup);
        }
        result[accountId] = groups;
    }
    return result;
}
