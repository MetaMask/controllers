import { BigNumber } from 'bignumber.js';

/**
 * A BigNumber constructor that returns `NaN` for invalid input rather than
 * throwing (bignumber.js v11 throws by default via `STRICT`). Use this where
 * the caller validates the result with `isFinite()` / `isNaN()` and handles
 * the invalid case itself.
 */
export const LenientBigNumber = BigNumber.clone({ STRICT: false });

/**
 * Parses a hex string, with or without a `0x` prefix, into a BigNumber.
 * bignumber.js v11 rejects `0x` prefixes when a base is supplied.
 *
 * @param hexString - The hex string to parse.
 * @returns The parsed BigNumber.
 */
export const hexToBigNumber = (hexString: string): BigNumber =>
  new BigNumber(hexString.replace(/^0x/iu, ''), 16);
