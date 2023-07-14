import { createBip39KeyFromSeed } from '.';

describe('index', () => {
  it('has expected exports', () => {
    expect(createBip39KeyFromSeed).toBeDefined();
  });
});
