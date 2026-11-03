import { BigNumber } from 'bignumber.js';

/**
 * Parses a value into a finite BigNumber.
 *
 * bignumber.js throws on invalid input. This returns `undefined` for anything
 * that is not a finite decimal, so callers decide explicitly what invalid
 * input means rather than relying on a `NaN` result.
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
