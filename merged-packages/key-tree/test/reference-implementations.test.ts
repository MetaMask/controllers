import { BIP44Node } from '../src';
import { BIP44PurposeNodeToken, HDPathTuple } from '../src/constants';
import { ed25519, secp256k1 } from '../src/curves';
import { deriveKeyFromPath } from '../src/derivation';
import {
  privateKeyToEthAddress,
  publicKeyToEthAddress,
} from '../src/derivers/bip32';
import { createBip39KeyFromSeed } from '../src/derivers/bip39';
import {
  getBIP44CoinTypeToAddressPathTuple,
  hexStringToBuffer,
} from '../src/utils';
import { SLIP10Node } from '../src/SLIP10Node';
import fixtures from './fixtures';

describe('reference implementation tests', () => {
  describe('local', () => {
    const { addresses, mnemonic } = fixtures.local;
    const mnemonicBip39Node = `bip39:${mnemonic}` as const;

    describe('BIP44Node', () => {
      it('derives the expected keys', async () => {
        // Ethereum coin type node
        const node = await BIP44Node.fromDerivationPath({
          derivationPath: [
            mnemonicBip39Node,
            BIP44PurposeNodeToken,
            `bip32:60'`,
          ],
        });

        for (let index = 0; index < addresses.length; index++) {
          const expectedAddress = addresses[index];
          const childNode = await node.derive(
            getBIP44CoinTypeToAddressPathTuple({ address_index: index }),
          );

          expect(childNode.address).toStrictEqual(expectedAddress);
        }
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the expected keys', async () => {
        // Ethereum coin type key
        const [parentKey, , parentChainCode] = await deriveKeyFromPath([
          mnemonicBip39Node,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ]);

        for (let index = 0; index < addresses.length; index++) {
          const expectedAddress = addresses[index];
          const [childKey] = await deriveKeyFromPath(
            getBIP44CoinTypeToAddressPathTuple({ address_index: index }),
            parentKey,
            undefined,
            parentChainCode,
          );

          const publicKey = secp256k1.getPublicKey(childKey, false);
          expect(
            publicKeyToEthAddress(publicKey).toString('hex'),
          ).toStrictEqual(expectedAddress);
        }
      });
    });
  });

  describe('eth-hd-keyring', () => {
    const { mnemonic, addresses } = fixtures['eth-hd-keyring'];
    const mnemonicBip39Node = `bip39:${mnemonic}` as const;

    describe('BIP44Node', () => {
      it('derives the same keys as the reference implementation', async () => {
        // Ethereum coin type node
        const node = await BIP44Node.fromDerivationPath({
          derivationPath: [
            mnemonicBip39Node,
            BIP44PurposeNodeToken,
            `bip32:60'`,
          ],
        });

        const numberOfAccounts = 5;
        const ourAccounts = [];
        for (let i = 0; i < numberOfAccounts; i++) {
          ourAccounts.push(
            await node
              .derive(getBIP44CoinTypeToAddressPathTuple({ address_index: i }))
              .then((childNode) => childNode.address),
          );
        }

        expect(addresses).toStrictEqual(
          ourAccounts.map((account) => `0x${account}`),
        );
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the same keys as the reference implementation', async () => {
        // Ethereum coin type key
        const [parentKey, , chainCode] = await deriveKeyFromPath([
          mnemonicBip39Node,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ]);

        const numberOfAccounts = 5;
        const ourAccounts = [];
        for (let i = 0; i < numberOfAccounts; i++) {
          ourAccounts.push(
            publicKeyToEthAddress(
              await deriveKeyFromPath(
                getBIP44CoinTypeToAddressPathTuple({ address_index: i }),
                parentKey,
                undefined,
                chainCode,
              ).then(([childKey]) => secp256k1.getPublicKey(childKey, false)),
            ).toString('hex'),
          );
        }

        expect(addresses).toStrictEqual(
          ourAccounts.map((account) => `0x${account}`),
        );
      });
    });
  });

  describe('ethereumjs-wallet', () => {
    const { sampleAddressIndices, hexSeed, privateKey, address, path } =
      fixtures['ethereumjs-wallet'];
    const seed = hexStringToBuffer(hexSeed);

    describe('BIP44Node', () => {
      it('derives the same keys as the reference implementation', async () => {
        const [seedKey, , chainCode] = await createBip39KeyFromSeed(seed);

        const parentNode = await BIP44Node.fromExtendedKey({
          depth: 0,
          privateKey: seedKey,
          chainCode,
        });
        const node = await parentNode.derive(path.ours.tuple);

        expect(node.privateKey).toStrictEqual(privateKey);
        expect(node.address).toStrictEqual(address);

        for (const { index, address: theirAddress } of sampleAddressIndices) {
          const ourAddress = await node
            .derive([`bip32:${index}`])
            .then((childNode) => childNode.address);

          expect(ourAddress).toStrictEqual(theirAddress);
        }
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the same keys as the reference implementation', async () => {
        const [seedKey, , seedChainCode] = await createBip39KeyFromSeed(seed);
        const [parentKey, , chainCode] = await deriveKeyFromPath(
          path.ours.tuple,
          seedKey,
          undefined,
          seedChainCode,
        );

        expect(parentKey.toString('hex')).toStrictEqual(privateKey);

        expect(privateKeyToEthAddress(parentKey).toString('hex')).toStrictEqual(
          address,
        );

        for (const { index, address: theirAddress } of sampleAddressIndices) {
          const [childKey] = await deriveKeyFromPath(
            [`bip32:${index}`],
            parentKey,
            undefined,
            chainCode,
          );

          const ourAddress = publicKeyToEthAddress(
            secp256k1.getPublicKey(childKey, false),
          ).toString('hex');

          expect(ourAddress).toStrictEqual(theirAddress);
        }
      });
    });
  });

  describe('BIP-32 specification test vectors', () => {
    const vectors = fixtures.bip32;

    // We only test the BIP-32 vectors with deriveKeyFromPath, since not all
    // paths are BIP-44 compatible.
    describe('deriveKeyFromPath', () => {
      it('derives the test vector keys', async () => {
        for (const vector of vectors) {
          const seed = hexStringToBuffer(vector.hexSeed);
          const [seedKey, publicKey, chainCode] = await createBip39KeyFromSeed(
            seed,
          );

          for (const keyObj of vector.keys) {
            const { path, privateKey } = keyObj;

            let targetKey: [Buffer, Buffer, Buffer];

            // If the path is empty, use the master node
            if (path.ours.string === '') {
              targetKey = [seedKey, publicKey, chainCode];
            } else {
              targetKey = await deriveKeyFromPath(
                path.ours.tuple as HDPathTuple,
                seedKey,
                undefined,
                chainCode,
              );
            }

            expect(targetKey[0].toString('hex')).toStrictEqual(privateKey);
          }
        }
      });
    });
  });

  describe('ed25519', () => {
    describe('SLIP-10', () => {
      const vectors = fixtures.ed25519.slip10;

      describe('deriveKeyFromPath', () => {
        it('derives the test vector keys', async () => {
          for (const { hexSeed, keys } of vectors) {
            const [seedKey, seedPublicKey, chainCode] =
              await createBip39KeyFromSeed(hexStringToBuffer(hexSeed), ed25519);

            for (const { path, privateKey, publicKey } of keys) {
              let targetKey: [Buffer, Buffer, Buffer];
              if (path.ours.string === '') {
                targetKey = [seedKey, seedPublicKey, chainCode];
              } else {
                targetKey = await deriveKeyFromPath(
                  path.ours.tuple as HDPathTuple,
                  seedKey,
                  undefined,
                  chainCode,
                  path.ours.tuple.length,
                  ed25519,
                );
              }

              expect(targetKey[0].toString('hex')).toBe(privateKey);
              expect(
                (await ed25519.getPublicKey(targetKey[0])).toString('hex'),
              ).toBe(publicKey);
            }
          }
        });
      });
    });

    describe('ed25519-hd-key', () => {
      const { sampleKeyIndices, hexSeed, privateKey, path } =
        fixtures.ed25519['ed25519-hd-key'];
      const seed = hexStringToBuffer(hexSeed);

      describe('SLIP10Node', () => {
        it('derives the same keys as the reference implementation', async () => {
          // Ethereum coin type node
          const [childKey, , chainCode] = await createBip39KeyFromSeed(
            seed,
            ed25519,
          );

          const parentNode = await SLIP10Node.fromExtendedKey({
            depth: 0,
            privateKey: childKey,
            chainCode,
            curve: 'ed25519',
          });
          const node = await parentNode.derive(path.ours.tuple);

          expect(node.privateKey).toStrictEqual(privateKey);

          for (const {
            index,
            privateKey: theirPrivateKey,
            publicKey: theirPublicKey,
          } of sampleKeyIndices) {
            const childNode = await node.derive([`bip32:${index}'`]);

            expect(childNode.privateKey).toStrictEqual(theirPrivateKey);
            expect(childNode.publicKey).toStrictEqual(theirPublicKey);
          }
        });
      });

      describe('deriveKeyFromPath', () => {
        it('derives the same keys as the reference implementation', async () => {
          // Ethereum coin type key
          const [seedKey, , chainCode] = await createBip39KeyFromSeed(
            seed,
            ed25519,
          );
          const [childKey, , childChainCode] = await deriveKeyFromPath(
            [BIP44PurposeNodeToken, `bip32:0'`, `bip32:0'`, `bip32:1'`],
            seedKey,
            undefined,
            chainCode,
            2,
            ed25519,
          );

          for (const {
            index,
            privateKey: theirPrivateKey,
          } of sampleKeyIndices) {
            const [ourPrivateKey] = await deriveKeyFromPath(
              [`bip32:${index}'`],
              childKey,
              undefined,
              childChainCode,
              1,
              ed25519,
            );

            expect(ourPrivateKey.toString('hex')).toStrictEqual(
              theirPrivateKey,
            );
          }
        });
      });
    });
  });
});
