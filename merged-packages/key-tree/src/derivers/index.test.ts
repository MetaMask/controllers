import { createBip39KeyFromSeed, mnemonicToSeed } from '.';

describe('index', () => {
  it('has expected exports', () => {
    expect(createBip39KeyFromSeed).toBeDefined();
    expect(mnemonicToSeed).toBeDefined();
  });
});
