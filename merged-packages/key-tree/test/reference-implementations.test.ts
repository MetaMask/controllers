import { BIP44Node } from '../src';
import { BIP44PurposeNodeToken, HDPathTuple } from '../src/constants';
import { ed25519 } from '../src/curves';
import { deriveKeyFromPath } from '../src/derivation';
import { privateKeyToEthAddress } from '../src/derivers/bip32';
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
        const node = await BIP44Node.create({
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

          expect(await childNode.getAddress()).toStrictEqual(expectedAddress);
        }
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the expected keys', async () => {
        // Ethereum coin type key
        const parentKey = await deriveKeyFromPath([
          mnemonicBip39Node,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ]);

        for (let index = 0; index < addresses.length; index++) {
          const expectedAddress = addresses[index];
          const childKey = await deriveKeyFromPath(
            getBIP44CoinTypeToAddressPathTuple({ address_index: index }),
            parentKey,
          );

          expect(
            privateKeyToEthAddress(childKey).toString('hex'),
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
        const node = await BIP44Node.create({
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
              .then((childNode) => childNode.getAddress()),
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
        const parentKey = await deriveKeyFromPath([
          mnemonicBip39Node,
          BIP44PurposeNodeToken,
          `bip32:60'`,
        ]);

        const numberOfAccounts = 5;
        const ourAccounts = [];
        for (let i = 0; i < numberOfAccounts; i++) {
          ourAccounts.push(
            privateKeyToEthAddress(
              await deriveKeyFromPath(
                getBIP44CoinTypeToAddressPathTuple({ address_index: i }),
                parentKey,
              ),
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
        const seedKey = createBip39KeyFromSeed(seed);

        const parentNode = await BIP44Node.create({
          depth: 0,
          key: seedKey,
        });
        const node = await parentNode.derive(path.ours.tuple);

        expect(node.keyBuffer.slice(0, 32).toString('hex')).toStrictEqual(
          privateKey,
        );

        expect(await node.getAddress()).toStrictEqual(address);

        for (const { index, address: theirAddress } of sampleAddressIndices) {
          const ourAddress = privateKeyToEthAddress(
            (await node.derive([`bip32:${index}`])).keyBuffer,
          ).toString('hex');

          expect(ourAddress).toStrictEqual(theirAddress);
        }
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the same keys as the reference implementation', async () => {
        const seedKey = createBip39KeyFromSeed(seed);
        const parentKey = await deriveKeyFromPath(path.ours.tuple, seedKey);

        expect(parentKey.slice(0, 32).toString('hex')).toStrictEqual(
          privateKey,
        );

        expect(privateKeyToEthAddress(parentKey).toString('hex')).toStrictEqual(
          address,
        );

        for (const { index, address: theirAddress } of sampleAddressIndices) {
          const ourAddress = privateKeyToEthAddress(
            await deriveKeyFromPath([`bip32:${index}`], parentKey),
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
          const seedKey = createBip39KeyFromSeed(seed);

          for (const keyObj of vector.keys) {
            const { path, privateKey } = keyObj;

            let targetKey: Buffer;

            // If the path is empty, use the master node
            if (path.ours.string === '') {
              targetKey = seedKey;
            } else {
              targetKey = await deriveKeyFromPath(
                path.ours.tuple as HDPathTuple,
                seedKey,
              );
            }

            expect(targetKey.slice(0, 32).toString('hex')).toStrictEqual(
              privateKey,
            );
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
            const seedKey = createBip39KeyFromSeed(
              hexStringToBuffer(hexSeed),
              ed25519,
            );

            for (const { path, privateKey, publicKey } of keys) {
              let targetKey: Buffer;
              if (path.ours.string === '') {
                targetKey = seedKey;
              } else {
                targetKey = await deriveKeyFromPath(
                  path.ours.tuple as HDPathTuple,
                  seedKey,
                  path.ours.tuple.length,
                  ed25519,
                );
              }

              expect(targetKey.slice(0, 32).toString('hex')).toBe(privateKey);
              expect(
                (await ed25519.getPublicKey(targetKey.slice(0, 32))).toString(
                  'hex',
                ),
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

      describe('BIP44Node', () => {
        it('derives the same keys as the reference implementation', async () => {
          // Ethereum coin type node
          const seedKey = createBip39KeyFromSeed(seed, ed25519);

          const parentNode = await SLIP10Node.create({
            depth: 0,
            key: seedKey,
            curve: ed25519,
          });
          const node = await parentNode.derive(path.ours.tuple);

          expect(node.keyBuffer.slice(0, 32).toString('hex')).toStrictEqual(
            privateKey,
          );

          for (const {
            index,
            privateKey: theirPrivateKey,
            publicKey: theirPublicKey,
          } of sampleKeyIndices) {
            const childNode = await node.derive([`bip32:${index}'`]);
            const ourPrivateKey = childNode.keyBuffer.slice(0, 32);

            expect(ourPrivateKey.toString('hex')).toStrictEqual(
              theirPrivateKey,
            );

            expect(await childNode.getPublicKey()).toStrictEqual(
              theirPublicKey,
            );
          }
        });
      });

      describe('deriveKeyFromPath', () => {
        it('derives the same keys as the reference implementation', async () => {
          // Ethereum coin type key
          const seedKey = createBip39KeyFromSeed(seed, ed25519);
          const parentKey = await deriveKeyFromPath(
            [BIP44PurposeNodeToken, `bip32:0'`, `bip32:0'`, `bip32:1'`],
            seedKey,
            2,
            ed25519,
          );

          for (const {
            index,
            privateKey: theirPrivateKey,
          } of sampleKeyIndices) {
            const ourPrivateKey = await deriveKeyFromPath(
              [`bip32:${index}'`],
              parentKey,
              1,
              ed25519,
            );

            expect(ourPrivateKey.slice(0, 32).toString('hex')).toStrictEqual(
              theirPrivateKey,
            );
          }
        });
      });
    });
  });
});
