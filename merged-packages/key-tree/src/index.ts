export { BIP44Node, BIP44NodeInterface, JsonBIP44Node } from './BIP44Node';
export { SLIP10Node, SLIP10NodeInterface, JsonSLIP10Node } from './SLIP10Node';
export { secp256k1, ed25519 } from './curves';
export {
  BIP44CoinTypeNode,
  BIP44CoinTypeNodeInterface,
  BIP_44_COIN_TYPE_DEPTH,
  CoinTypeHDPathTuple,
  deriveBIP44AddressKey,
  getBIP44AddressKeyDeriver,
  JsonBIP44CoinTypeNode,
} from './BIP44CoinTypeNode';
export {
  MIN_BIP_44_DEPTH,
  MAX_BIP_44_DEPTH,
  BIP44Depth,
  BIP44PurposeNodeToken,
  BIP32Node,
  BIP39Node,
} from './constants';

/**
 * The {@link Buffer} accessible to `@metamask/key-tree`, re-exported in case
 * of module resolution issues.
 */
export const PackageBuffer = Buffer;
