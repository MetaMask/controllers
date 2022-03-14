import { bytesToHex } from '@noble/hashes/utils';
import {
  BASE_64_KEY_LENGTH,
  BASE_64_REGEX,
  BASE_64_ZERO,
  BUFFER_KEY_LENGTH,
  BIP44PurposeNodeToken,
  UnhardenedBIP32Node,
  CoinTypeHDPathString,
  CoinTypeToAddressTuple,
  HardenedBIP32Node,
  ChangeHDPathString,
  HEXADECIMAL_KEY_LENGTH,
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

type BIP44PathIndices = {
  coin_type: number;
  account?: number;
  change?: number;
  address_index: number;
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
  )} / ${getUnhardenedBIP32NodeToken(indices.change || 0)}`;
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
    getUnhardenedBIP32NodeToken(change),
    getUnhardenedBIP32NodeToken(address_index),
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
 * @param base64String - The Base64 string to convert.
 * @returns The {@link Buffer} corresponding to the Base64 string.
 */
export function base64StringToBuffer(base64String: string): Buffer {
  return Buffer.from(base64String, 'base64');
}

/**
 * @param hexString - The hexadecimal string to convert.
 * @returns The {@link Buffer} corresponding to the hexadecimal string.
 */
export function hexStringToBuffer(hexString: string): Buffer {
  return Buffer.from(stripHexPrefix(hexString), 'hex');
}

/**
 * @param input - The {@link Buffer} to convert.
 * @returns The buffer as a Base64 string.
 */
export function bufferToBase64String(input: Buffer): string {
  return input.toString('base64');
}

/**
 * Tests whether the specified {@link Buffer} is a valid BIP-32 key.
 * A valid buffer key is 64 bytes long and has at least one non-zero byte.
 *
 * @param buffer - The {@link Buffer} to test.
 * @returns Whether the buffer represents a valid BIP-32 key.
 */
export function isValidBufferKey(buffer: Buffer): boolean {
  if (buffer.length !== BUFFER_KEY_LENGTH) {
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
 * @param input - The string to test.
 * @returns Whether the given string is a valid Base64 string.
 */
function isValidBase64String(input: string) {
  return BASE_64_REGEX.test(input);
}

/**
 * Tests whether the specified hexadecimal string is a valid BIP-32 key.
 * A valid hexadecimal string key is 128 characters long (excluding any `0x`
 * prefix) and has at least one non-zero byte.
 *
 * @param stringKey - The hexadecimal string to test.
 * @returns Whether the string represents a valid BIP-32 key.
 */
export function isValidHexStringKey(stringKey: string): boolean {
  if (!isValidHexString(stringKey)) {
    return false;
  }

  const stripped = stripHexPrefix(stringKey);
  if (stripped.length !== HEXADECIMAL_KEY_LENGTH) {
    return false;
  }

  if (/^0+$/iu.test(stripped)) {
    return false;
  }
  return true;
}

/**
 * Tests whether the specified Base64 string is a valid BIP-32 key.
 * A valid Base64 string key is 88 characters long and has at least one non-zero
 * byte.
 *
 * @param stringKey - The Base64 string to test.
 * @returns Whether the string represents a valid BIP-32 key.
 */
export function isValidBase64StringKey(stringKey: string): boolean {
  if (!isValidBase64String(stringKey)) {
    return false;
  }

  if (stringKey.length !== BASE_64_KEY_LENGTH) {
    return false;
  }

  if (stringKey === BASE_64_ZERO) {
    return false;
  }
  return true;
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
