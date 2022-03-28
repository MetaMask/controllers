import fixtures from '../test/fixtures';
import { HDPathTuple } from './constants';
import { deriveKeyFromPath } from './derivation';
import { derivers } from './derivers';
import { getUnhardenedBIP32NodeToken } from './utils';

const {
  bip32: { deriveChildKey: bip32Derive, privateKeyToEthAddress },
  bip39: { deriveChildKey: bip39Derive, bip39MnemonicToMultipath },
} = derivers;

const { addresses: expectedAddresses, mnemonic } = fixtures.local;
const ethereumBip32PathParts = [
  `bip32:44'`,
  `bip32:60'`,
  `bip32:0'`,
  `bip32:0`,
] as const;

describe('derivation', () => {
  describe('deriveKeyFromPath', () => {
    it('derives full BIP-44 paths', async () => {
      // generate keys
      const keys = await Promise.all(
        expectedAddresses.map((_, index) => {
          const bip32Part = [
            ...ethereumBip32PathParts,
            getUnhardenedBIP32NodeToken(index),
          ] as const;
          const bip39Part = bip39MnemonicToMultipath(mnemonic);
          const multipath = [bip39Part, ...bip32Part] as HDPathTuple;

          expect(multipath).toStrictEqual([
            `bip39:${mnemonic}`,
            `bip32:44'`,
            `bip32:60'`,
            `bip32:0'`,
            `bip32:0`,
            `bip32:${index}`,
          ]);
          return deriveKeyFromPath(multipath);
        }),
      );

      // validate addresses
      keys.forEach((key, index) => {
        const address = privateKeyToEthAddress(key);
        expect(address.toString('hex')).toStrictEqual(expectedAddresses[index]);
      });
    });

    it('derives the correct keys using a previously derived parent key', async () => {
      // generate parent key
      const bip39Part = bip39MnemonicToMultipath(mnemonic);
      const multipath = [bip39Part, ...ethereumBip32PathParts] as HDPathTuple;
      const parentKey = await deriveKeyFromPath(multipath);
      const keys = await Promise.all(
        expectedAddresses.map((_, index) => {
          return deriveKeyFromPath([`bip32:${index}`], parentKey);
        }),
      );

      // validate addresses
      keys.forEach((key, index) => {
        const address = privateKeyToEthAddress(key);
        expect(address.toString('hex')).toStrictEqual(expectedAddresses[index]);
      });
    });

    it('validates inputs', async () => {
      // generate parent key
      const bip39Part = bip39MnemonicToMultipath(mnemonic);
      const multipath = [bip39Part, ...ethereumBip32PathParts] as const;
      const parentKey = await deriveKeyFromPath(multipath);

      // Empty segments are forbidden
      await expect(() => deriveKeyFromPath([] as any)).rejects.toThrow(
        /Invalid HD path segment: The segment must not be empty\./u,
      );

      // Segments cannot exceed BIP-44 maximum depth
      await expect(() =>
        deriveKeyFromPath([...multipath, multipath[4], multipath[4]] as any),
      ).rejects.toThrow(
        /Invalid HD path segment: The segment cannot exceed a 0-indexed depth of 5\./u,
      );

      // Malformed multipaths are disallowed
      await expect(() => {
        const [, ...rest] = multipath;
        return deriveKeyFromPath([
          bip39Part.replace('bip39', 'foo') as any,
          ...rest,
        ]);
      }).rejects.toThrow(
        /Invalid HD path segment: The path segment is malformed\./u,
      );

      await expect(() => {
        const [, bip32Part1, ...rest] = multipath;
        return deriveKeyFromPath([
          bip39Part,
          bip32Part1.replace('bip32', 'bar') as any,
          ...rest,
        ]);
      }).rejects.toThrow(
        /Invalid HD path segment: The path segment is malformed\./u,
      );

      await expect(() => {
        const [, bip32Part1, ...rest] = multipath;
        return deriveKeyFromPath([
          bip39Part,
          bip32Part1.replace(`44'`, 'xyz') as any,
          ...rest,
        ]);
      }).rejects.toThrow(
        /Invalid HD path segment: The path segment is malformed\./u,
      );

      await expect(() => {
        const [, bip32Part1, ...rest] = multipath;
        return deriveKeyFromPath([
          bip39Part,
          bip32Part1.replace(`'`, '"') as any,
          ...rest,
        ]);
      }).rejects.toThrow(
        /Invalid HD path segment: The path segment is malformed\./u,
      );

      await expect(
        deriveKeyFromPath(
          [bip39Part, ethereumBip32PathParts[0]],
          Buffer.alloc(64).fill(1),
          0,
        ),
      ).rejects.toThrow(
        /Invalid HD path segment: The segment must consist of a single BIP-39 node for depths of 0\. Received:/u,
      );

      // bip39 seed phrase component must be completely lowercase
      await expect(
        deriveKeyFromPath([bip39Part.replace('r', 'R') as any]),
      ).rejects.toThrow(
        /Invalid HD path segment: The path segment is malformed\./u,
      );

      // Multipaths that start with bip39 segment require _no_ parentKey
      await expect(deriveKeyFromPath([bip39Part], parentKey)).rejects.toThrow(
        /Invalid derivation parameters: May not specify parent key if the path segment starts with a BIP-39 node\./u,
      );

      // Multipaths that start with bip32 segment require parentKey
      await expect(deriveKeyFromPath([`bip32:1'`])).rejects.toThrow(
        /Invalid derivation parameters: Must specify parent key if the first node of the path segment is not a BIP-39 node\./u,
      );

      // parentKey must be a buffer if specified
      await expect(
        deriveKeyFromPath([`bip32:1'`], parentKey.toString('base64') as any),
      ).rejects.toThrow('Parent key must be a Buffer if specified.');
    });
  });

  describe('bip32Derive', () => {
    it('derives the expected keys and addresses', async () => {
      // generate parent key
      let parentKey: Buffer;

      /* eslint-disable require-atomic-updates */
      parentKey = await bip39Derive(mnemonic);
      parentKey = await bip32Derive(`44'`, parentKey);
      parentKey = await bip32Derive(`60'`, parentKey);
      parentKey = await bip32Derive(`0'`, parentKey);
      parentKey = await bip32Derive(`0`, parentKey);
      /* eslint-enable require-atomic-updates */

      const keys = await Promise.all(
        expectedAddresses.map((_, index) => {
          return bip32Derive(`${index}`, parentKey);
        }),
      );

      // validate addresses
      keys.forEach((key, index) => {
        const address = privateKeyToEthAddress(key);
        expect(address.toString('hex')).toStrictEqual(expectedAddresses[index]);
      });
    });

    it('throws for invalid inputs', async () => {
      const inputs = [
        String(-1),
        String(1.1),
        String(2147483649),
        String(Number.MAX_SAFE_INTEGER),
        String({}),
        String('foo'),
      ];

      for (const input of inputs) {
        // eslint-disable-next-line no-loop-func
        await expect(
          bip32Derive(input as any, Buffer.allocUnsafe(64).fill(1)),
        ).rejects.toThrow(
          'Invalid BIP-32 index: The index must be a non-negative decimal integer less than 2147483648.',
        );
      }

      await expect(bip32Derive(`44'`, undefined as any)).rejects.toThrow(
        'Invalid parameters: Must specify a parent key.',
      );

      await expect(
        bip32Derive(`44'`, Buffer.allocUnsafe(63).fill(1)),
      ).rejects.toThrow('Invalid parent key: Must be 64 bytes long.');
    });
  });

  // The outputs of this function are tested in key derivation above
  describe('privateKeyToEthAddress', () => {
    it('throws for invalid inputs', () => {
      [
        Buffer.allocUnsafe(63).fill(1),
        Buffer.alloc(64, 0),
        'foo',
        {},
        null,
        undefined,
      ].forEach((invalidInput) => {
        expect(() => privateKeyToEthAddress(invalidInput as any)).toThrow(
          'Invalid key: The key must be a 64-byte, non-zero Buffer.',
        );
      });
    });
  });
});
