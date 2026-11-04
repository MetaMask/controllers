import type { Hex } from '@metamask/utils';
/**
 * @param balance - The balance to stringify as a decimal string
 * @param decimals - The number of decimals of the balance
 * @param balanceDecimals - The number of decimals to display
 * @returns The stringified balance with the specified number of decimals
 */
export declare function stringifyBalanceWithDecimals(balance: bigint, decimals: number, balanceDecimals?: number): string;
/**
 * Converts a decimal string representation back to a Hex balance.
 * This is the inverse operation of stringifyBalanceWithDecimals.
 *
 * @param balanceString - The decimal string representation (e.g., "123.456")
 * @param decimals - The number of decimals to apply (shifts decimal point right)
 * @returns The balance as a Hex string
 *
 * @example
 * parseBalanceWithDecimals("123.456", 18) // Returns '0x6B14BD1E6EEA00000'
 * parseBalanceWithDecimals("0.001", 18)   // Returns '0x38D7EA4C68000'
 * parseBalanceWithDecimals("123", 18)     // Returns '0x6AAF7C8516D0C0000'
 */
export declare function parseBalanceWithDecimals(balanceString: string, decimals: number): Hex | undefined;
