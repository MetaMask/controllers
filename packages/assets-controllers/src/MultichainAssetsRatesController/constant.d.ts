import type { CaipAssetType } from '@metamask/utils';
/**
 * Maps each SUPPORTED_CURRENCIES entry to its CAIP-19 (or CAIP-like) identifier.
 * For fiat, we mimic the old “swift:0/iso4217:XYZ” style.
 */
export declare const MAP_CAIP_CURRENCIES: {
    [key: string]: CaipAssetType;
};
