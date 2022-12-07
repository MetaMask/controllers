import {
  MAX_BIP_44_DEPTH,
  MIN_BIP_44_DEPTH,
  SLIP10Node,
  secp256k1,
  ed25519,
} from '.';

// This is purely for coverage shenanigans
describe('index', () => {
  it('has expected exports', () => {
    expect(MAX_BIP_44_DEPTH).toBe(5);
    expect(MIN_BIP_44_DEPTH).toBe(0);

    expect(SLIP10Node).toBeDefined();
    expect(secp256k1).toBeDefined();
    expect(ed25519).toBeDefined();
  });
});
