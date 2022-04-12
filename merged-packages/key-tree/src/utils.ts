import { bytesToHex } from '@noble/hashes/utils';
import {
  BIP32Node,
  BIP44PurposeNodeToken,
  ChangeHDPathString,
  CoinTypeHDPathString,
  CoinTypeToAddressTuple,
  HardenedBIP32Node,
  UnhardenedBIP32Node,
} from './constants';

/**
 * Gets a string representation of a BIP-44 path of depth 2, i.e.:
 * `m / 44' / coin_type'`
 *
 * For display purposes only.
 *
 * @param coin_type - The `coin_type` index to create a path visualization for.
 * @returns The visualization of the BIP-44 path for thte specified `coin_type`.
 */
export function getBIP44CoinTypePathString(
  coin_type: number,
): CoinTypeHDPathString {
  return `m / ${BIP44PurposeNodeToken} / ${getUnhardenedBIP32NodeToken(
    coin_type,
  )}'`;
}

type BIP44PathIndex = number | { index: number; hardened: boolean };

type BIP44PathIndices = {
  coin_type: number;
  account?: number;
  change?: BIP44PathIndex;
  address_index: BIP44PathIndex;
};

export type CoinTypeToAddressIndices = Pick<
  BIP44PathIndices,
  'account' | 'change' | 'address_index'
>;

/**
 * Gets a string representation of a BIP-44 path of depth 4, i.e.:
 * `m / 44' / coin_type' / account' / change`
 *
 * For display purposes only.
 *
 * @param coinTypePath - The parent `coin_type` path.
 * @param coin_type - The `change` index to create a path visualization for.
 * @returns The visualization of the BIP-44 path for the specified `coin_type`
 * and `change` indices.
 */
export function getBIP44ChangePathString(
  coinTypePath: CoinTypeHDPathString,
  indices: Omit<CoinTypeToAddressIndices, 'address_index'>,
): ChangeHDPathString {
  return `${coinTypePath} / ${getHardenedBIP32NodeToken(
    indices.account || 0,
  )} / ${getBIP32NodeToken(indices.change || 0)}`;
}

/**
 * Gets a BIP-44 path tuple of the form `account' / change / address_index`,
 * which can be used to derive address keys together with a `coin_type` key.
 *
 * @param indices - The BIP-44 derivation index values.
 * @param indices.account - The `account` index value.
 * @param indices.change - The `change` index value.
 * @param indices.address_index - The `address_index` index value.
 * @returns The `account' / change / address_index` path corresponding to the
 * specified indices.
 */
export function getBIP44CoinTypeToAddressPathTuple({
  account = 0,
  change = 0,
  address_index,
}: CoinTypeToAddressIndices): CoinTypeToAddressTuple {
  return [
    getHardenedBIP32NodeToken(account),
    getBIP32NodeToken(change),
    getBIP32NodeToken(address_index),
  ] as const;
}

/**
 * A hardened BIP-32 node token, e.g. `bip32:0'`.
 * Validates that the index is a non-negative integer number, and throws an
 * error if validation fails.
 *
 * @param index - The index of the node.
 * @returns The hardened BIP-32 node token.
 */
export function getHardenedBIP32NodeToken(index: number): HardenedBIP32Node {
  validateBIP32Index(index);
  return `${getUnhardenedBIP32NodeToken(index)}'`;
}

/**
 * An unhardened BIP-32 node token, e.g. `bip32:0`.
 * Validates that the index is a non-negative integer number, and throws an
 * error if validation fails.
 *
 * @param index - The index of the node.
 * @returns The unhardened BIP-32 node token.
 */
export function getUnhardenedBIP32NodeToken(
  index: number,
): UnhardenedBIP32Node {
  validateBIP32Index(index);
  return `bip32:${index}`;
}

/**
 * A hardened or unhardened BIP-32 node token, e.g. `bip32:0` or `bip32:0'`.
 * Validates that the index is a non-negative integer number, and throws an
 * error if validation fails.
 *
 * @param index - The index of the node.
 * @returns The hardened or unhardened BIP-32 node token.
 */
export function getBIP32NodeToken(index: BIP44PathIndex): BIP32Node {
  if (typeof index === 'number') {
    return getUnhardenedBIP32NodeToken(index);
  }

  if (
    !index ||
    !Number.isInteger(index.index) ||
    typeof index.hardened !== 'boolean'
  ) {
    throw new Error(
      'Invalid BIP-32 index: Must be an object containing the index and whether it is hardened.',
    );
  }

  if (index.hardened) {
    return getHardenedBIP32NodeToken(index.index);
  }

  return getUnhardenedBIP32NodeToken(index.index);
}

/**
 * Validates that the index is a non-negative integer number. Throws an
 * error if validation fails.
 *
 * @param addressIndex - The index to validate.
 */
export function validateBIP32Index(addressIndex: number) {
  if (!isValidBIP32Index(addressIndex)) {
    throw new Error(`Invalid BIP-32 index: Must be a non-negative integer.`);
  }
}

/**
 * @param index - The BIP-32 index to test.
 * @returns Whether the index is a non-negative integer number.
 */
export function isValidBIP32Index(index: number): boolean {
  return Number.isInteger(index) && index >= 0;
}

/**
 * @param bip32Token - The token to test.
 * @returns Whether the token is hardened, i.e. ends with `'`.
 */
export function isHardened(bip32Token: string): boolean {
  return bip32Token.endsWith(`'`);
}

/**
 * @param hexString - The hexadecimal string to strip.
 * @returns The hexadecimal string, without a `0x`-prefix, if any.
 */
export function stripHexPrefix(hexString: string): string {
  return hexString.replace(/^0x/iu, '');
}

/**
 * Tests whether the specified string is a valid hexadecimal string. The string
 * may or may not be `0x`-prefixed, and the test is case-insensitive.
 *
 * @param hexString - The string to test.
 * @returns Whether the specified string is a valid hexadecimal string. The
 * string may or may not be `0x`-prefixed.
 */
export function isValidHexString(hexString: string): boolean {
  return /^(?:0x)?[a-f0-9]+$/iu.test(hexString);
}

/**
 * @param hexString - The hexadecimal string to convert.
 * @returns The {@link Buffer} corresponding to the hexadecimal string.
 */
export function hexStringToBuffer(hexString: string | Buffer): Buffer {
  if (Buffer.isBuffer(hexString)) {
    return hexString;
  }

  if (typeof hexString !== 'string' || !isValidHexString(hexString)) {
    throw new Error(`Invalid hex string: "${hexString}".`);
  }

  return Buffer.from(stripHexPrefix(hexString), 'hex');
}

/**
 * @param hexString - The hexadecimal string to convert.
 * @returns The {@link Buffer} corresponding to the hexadecimal string.
 */
export function nullableHexStringToBuffer(
  hexString?: string | Buffer,
): Buffer | undefined {
  if (hexString) {
    return hexStringToBuffer(hexString);
  }

  return undefined;
}

/**
 * Tests whether the specified {@link Buffer} is a valid BIP-32 key.
 * A valid buffer key is 64 bytes long and has at least one non-zero byte.
 *
 * @param buffer - The {@link Buffer} to test.
 * @param expectedLength - The expected length of the buffer.
 * @returns Whether the buffer represents a valid BIP-32 key.
 */
export function isValidBufferKey(
  buffer: Buffer,
  expectedLength: number,
): boolean {
  if (buffer.length !== expectedLength) {
    return false;
  }

  for (const byte of buffer) {
    if (byte !== 0) {
      return true;
    }
  }
  return false;
}

/**
 * Get a BigInt from a byte array.
 *
 * @param bytes - The byte array to get the BigInt for.
 * @returns The byte array as BigInt.
 */
export function bytesToNumber(bytes: Uint8Array): bigint {
  return BigInt(`0x${bytesToHex(bytes)}`);
}

/**
 * Get a Buffer from a hexadecimal string or Buffer. Validates that the
 * length of the Buffer matches the specified length, and that the buffer
 * is not empty.
 *
 * @param value - The value to convert to a Buffer.
 * @param length - The length to validate the Buffer against.
 */
export function getBuffer(value: unknown, length: number): Buffer {
  if (value instanceof Buffer) {
    validateBuffer(value, length);

    return value;
  }

  if (typeof value === 'string') {
    if (!isValidHexString(value)) {
      throw new Error(
        `Invalid value: Must be a valid hex string of length: ${length * 2}.`,
      );
    }

    const buffer = hexStringToBuffer(value);
    validateBuffer(buffer, length);

    return buffer;
  }

  throw new Error(`Invalid value: Expected a Buffer or hexadecimal string.`);
}

function validateBuffer(
  buffer: Buffer,
  length: number,
): asserts buffer is Buffer {
  if (!isValidBufferKey(buffer, length)) {
    throw new Error(`Invalid value: Must be a non-zero ${length}-byte buffer.`);
  }
}
