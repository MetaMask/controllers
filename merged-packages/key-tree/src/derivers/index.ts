import * as bip32 from './bip32';
import * as bip39 from './bip39';

export type Deriver = {
  deriveChildKey: (pathPart: string, parentKey?: Buffer) => Buffer;
};

export const derivers = {
  bip32,
  bip39,
};
