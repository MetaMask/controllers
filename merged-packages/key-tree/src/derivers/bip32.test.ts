import { CURVE } from '@noble/secp256k1';
import { hexStringToBuffer } from '../utils';
import fixtures from '../../test/fixtures';
import { privateAdd } from './bip32';

const privateAddFixtures = fixtures['secp256k1-node'].privateAdd;

describe('privateAdd', () => {
  it.each(privateAddFixtures)(
    'adds a tweak to a private key',
    ({ privateKey, tweak, result }) => {
      const expected = hexStringToBuffer(result);

      expect(
        privateAdd(hexStringToBuffer(privateKey), hexStringToBuffer(tweak)),
      ).toStrictEqual(expected);
    },
  );

  it('throws if the tweak is larger than the curve order', () => {
    const privateKey = hexStringToBuffer(
      '51f34c9afc9d5b43e085688db58bb923c012bb07e42a8eaf18a8400aa9a167fb',
    );
    const tweak = hexStringToBuffer(CURVE.n.toString(16));

    expect(() => privateAdd(privateKey, tweak)).toThrow(
      'Invalid tweak: Tweak is larger than the curve order.',
    );
  });

  it('throws if the result is invalid', () => {
    // n - 1
    const privateKey = hexStringToBuffer(
      'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
    );

    // 1
    const tweak = hexStringToBuffer(
      '0000000000000000000000000000000000000000000000000000000000000001',
    );

    expect(() => privateAdd(privateKey, tweak)).toThrow(
      'Invalid private key or tweak: The resulting private key is invalid.',
    );
  });
});
