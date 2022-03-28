import { utils } from '@noble/secp256k1';

export type Curve = {
  name: 'secp256k1' | 'ed25519';
  secret: Uint8Array;
  deriveUnhardenedKeys: boolean;
  curve: {
    n: bigint;
  };
  getPublicKey: (
    privateKey: Uint8Array | string | bigint,
    compressed?: boolean,
  ) => Buffer | Promise<Buffer>;
  isValidPrivateKey: (privateKey: Uint8Array | string | bigint) => boolean;
};

// As long as both parameters are specified, this function is the same for all curves.
export const { mod } = utils;
