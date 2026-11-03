import { BigNumber } from 'bignumber.js';

/**
 * Parses a value into a finite BigNumber.
 *
 * bignumber.js throws on invalid input. This returns `undefined` for anything
 * that is not a finite decimal, so callers decide explicitly what invalid
 * input means rather than relying on a `NaN` result. Strings with a `0x`
 * prefix are parsed as hex.
 *
 * @param value - The value to parse.
 * @returns The parsed BigNumber, or `undefined` if the value is not a finite
 * decimal.
 */
export function parseDecimal(
  value: BigNumber.Value | null | undefined,
): BigNumber | undefined {
  try {
    const parsed = new BigNumber(value as BigNumber.Value);
    return parsed.isFinite() ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parses a hex string, with or without a `0x` prefix, into a BigNumber.
 * bignumber.js v11 rejects `0x` prefixes when a base is supplied.
 *
 * @param hexString - The hex string to parse.
 * @returns The parsed BigNumber.
 */
export const hexToBigNumber = (hexString: string): BigNumber =>
  new BigNumber(hexString.replace(/^0x/iu, ''), 16);
