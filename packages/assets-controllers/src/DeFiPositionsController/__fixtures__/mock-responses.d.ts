import type { DefiPositionResponse } from '../fetch-positions.js';
/**
 * Entries are from different chains
 */
export declare const MOCK_DEFI_RESPONSE_MULTI_CHAIN: DefiPositionResponse[];
/**
 * The first entry is a failed entry
 */
export declare const MOCK_DEFI_RESPONSE_FAILED_ENTRY: DefiPositionResponse[];
/**
 * The second entry has no price
 */
export declare const MOCK_DEFI_RESPONSE_NO_PRICES: DefiPositionResponse[];
/**
 * The second entry is a borrow position
 */
export declare const MOCK_DEFI_RESPONSE_BORROW: DefiPositionResponse[];
/**
 * Complex mock with multiple chains, failed entries, borrow positions, etc.
 */
export declare const MOCK_DEFI_RESPONSE_COMPLEX: DefiPositionResponse[];
