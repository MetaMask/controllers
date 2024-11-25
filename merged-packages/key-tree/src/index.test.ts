import {
  MAX_BIP_44_DEPTH,
  MIN_BIP_44_DEPTH,
  SLIP10Node,
  secp256k1,
  ed25519,
  isValidBIP32PathSegment,
  createBip39KeyFromSeed,
  mnemonicPhraseToBytes,
  ed25519Bip32,
  getBIP44CoinTypeToAddressPathTuple,
  mnemonicToSeed,
} from '.';

// This is purely for coverage shenanigans
describe('index', () => {
  it('has expected exports', () => {
    expect(MAX_BIP_44_DEPTH).toBe(5);
    expect(MIN_BIP_44_DEPTH).toBe(0);

    expect(SLIP10Node).toBeDefined();
    expect(secp256k1).toBeDefined();
    expect(ed25519).toBeDefined();
    expect(ed25519Bip32).toBeDefined();
    expect(isValidBIP32PathSegment).toBeDefined();
    expect(createBip39KeyFromSeed).toBeDefined();
    expect(mnemonicPhraseToBytes).toBeDefined();
    expect(getBIP44CoinTypeToAddressPathTuple).toBeDefined();
    expect(mnemonicToSeed).toBeDefined();
  });
});
