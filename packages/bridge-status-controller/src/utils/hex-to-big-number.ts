import { BigNumber } from 'bignumber.js';

/**
 * Parses a hex string, with or without a `0x` prefix, into a BigNumber.
 * bignumber.js v11 rejects `0x` prefixes when a base is supplied.
 *
 * @param hexString - The hex string to parse.
 * @returns The parsed BigNumber.
 */
export const hexToBigNumber = (hexString: string): BigNumber =>
  new BigNumber(hexString.replace(/^0x/iu, ''), 16);
