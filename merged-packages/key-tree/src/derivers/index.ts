import { Curve } from '../curves';
import * as bip32 from './bip32';
import * as bip39 from './bip39';

export type Deriver = {
  deriveChildKey: (
    pathPart: string,
    parentKey?: Buffer,
    parentPublicKey?: Buffer,
    chainCode?: Buffer,
    curve?: Curve,
  ) => Promise<[privateKey: Buffer, publicKey: Buffer, chainCode: Buffer]>;
};

export const derivers = {
  bip32,
  bip39,
};
