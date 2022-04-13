import { BIP44Node } from '../src';
import { BIP44PurposeNodeToken, HDPathTuple } from '../src/constants';
import { ed25519 } from '../src/curves';
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
import { DerivedKeys } from '../src/derivers';
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
        const derivedKeys = await deriveKeyFromPath({
          path: [mnemonicBip39Node, BIP44PurposeNodeToken, `bip32:60'`],
        });

        for (let index = 0; index < addresses.length; index++) {
          const expectedAddress = addresses[index];
          const { publicKey } = await deriveKeyFromPath({
            path: getBIP44CoinTypeToAddressPathTuple({ address_index: index }),
            ...derivedKeys,
          });

          expect(
            `0x${publicKeyToEthAddress(publicKey).toString('hex')}`,
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
        for (let i = 0; i < numberOfAccounts; i++) {
          const path = getBIP44CoinTypeToAddressPathTuple({ address_index: i });
          const address = await node
            .derive(path)
            .then((childNode) => childNode.address);

          expect(address).toBe(addresses[i]);
        }
      });

      it('derives the same keys as the reference implementation using public key derivation', async () => {
        // Ethereum coin type node
        const node = await BIP44Node.fromDerivationPath({
          derivationPath: [
            mnemonicBip39Node,
            BIP44PurposeNodeToken,
            `bip32:60'`,
          ],
        });

        const numberOfAccounts = 5;
        for (let i = 0; i < numberOfAccounts; i++) {
          const [account, change, index] = getBIP44CoinTypeToAddressPathTuple({
            address_index: i,
          });
          const parentNode = await node.derive([account, change]);

          const address = await parentNode
            .neuter()
            .derive([index])
            .then((childNode) => childNode.address);

          expect(address).toBe(addresses[i]);
        }
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the same keys as the reference implementation', async () => {
        // Ethereum coin type key
        const derivedKeys = await deriveKeyFromPath({
          path: [mnemonicBip39Node, BIP44PurposeNodeToken, `bip32:60'`],
        });

        const numberOfAccounts = 5;
        const ourAccounts = [];
        for (let i = 0; i < numberOfAccounts; i++) {
          ourAccounts.push(
            publicKeyToEthAddress(
              await deriveKeyFromPath({
                path: getBIP44CoinTypeToAddressPathTuple({ address_index: i }),
                ...derivedKeys,
              }).then(({ publicKey }) => publicKey),
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
        const derivedKeys = await createBip39KeyFromSeed(seed);

        const parentNode = await BIP44Node.fromExtendedKey({
          depth: 0,
          ...derivedKeys,
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

      it('derives the same keys as the reference implementation using public key derivation', async () => {
        const derivedKeys = await createBip39KeyFromSeed(seed);

        const parentNode = await BIP44Node.fromExtendedKey({
          depth: 0,
          ...derivedKeys,
        });
        const node = await parentNode.derive(path.ours.tuple);

        expect(node.privateKey).toStrictEqual(privateKey);
        expect(node.address).toStrictEqual(address);

        for (const { index, address: theirAddress } of sampleAddressIndices) {
          const ourAddress = await node
            .neuter()
            .derive([`bip32:${index}`])
            .then((childNode) => childNode.address);

          expect(ourAddress).toStrictEqual(theirAddress);
        }
      });
    });

    describe('deriveKeyFromPath', () => {
      it('derives the same keys as the reference implementation', async () => {
        const derivedKeys = await createBip39KeyFromSeed(seed);
        const { privateKey: parentKey, chainCode } = await deriveKeyFromPath({
          path: path.ours.tuple,
          ...derivedKeys,
        });

        expect(parentKey).toStrictEqual(hexStringToBuffer(privateKey));
        expect(
          `0x${privateKeyToEthAddress(parentKey as Buffer).toString('hex')}`,
        ).toStrictEqual(address);

        for (const { index, address: theirAddress } of sampleAddressIndices) {
          const { publicKey } = await deriveKeyFromPath({
            path: [`bip32:${index}`],
            privateKey: parentKey,
            chainCode,
          });

          const ourAddress = `0x${publicKeyToEthAddress(publicKey).toString(
            'hex',
          )}`;
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
          const derivedKeys = await createBip39KeyFromSeed(seed);

          for (const keyObj of vector.keys) {
            const { path, privateKey } = keyObj;

            let targetKey: DerivedKeys;

            // If the path is empty, use the master node
            if (path.ours.string === '') {
              targetKey = derivedKeys;
            } else {
              targetKey = await deriveKeyFromPath({
                path: path.ours.tuple as HDPathTuple,
                ...derivedKeys,
              });
            }

            expect(
              (targetKey.privateKey as Buffer).toString('hex'),
            ).toStrictEqual(privateKey);
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
            const derivedKeys = await createBip39KeyFromSeed(
              hexStringToBuffer(hexSeed),
              ed25519,
            );

            for (const { path, privateKey, publicKey } of keys) {
              let targetKey: DerivedKeys;
              if (path.ours.string === '') {
                targetKey = derivedKeys;
              } else {
                targetKey = await deriveKeyFromPath({
                  path: path.ours.tuple as HDPathTuple,
                  depth: path.ours.tuple.length,
                  curve: ed25519,
                  ...derivedKeys,
                });
              }

              expect((targetKey.privateKey as Buffer).toString('hex')).toBe(
                privateKey,
              );
              expect(targetKey.publicKey.toString('hex')).toBe(publicKey);
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
          const derivedKeys = await createBip39KeyFromSeed(seed, ed25519);

          const parentNode = await SLIP10Node.fromExtendedKey({
            depth: 0,
            curve: 'ed25519',
            ...derivedKeys,
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
          const derivedKeys = await createBip39KeyFromSeed(seed, ed25519);
          const derivedChildKeys = await deriveKeyFromPath({
            path: [BIP44PurposeNodeToken, `bip32:0'`, `bip32:0'`, `bip32:1'`],
            depth: 2,
            curve: ed25519,
            ...derivedKeys,
          });

          for (const {
            index,
            privateKey: theirPrivateKey,
          } of sampleKeyIndices) {
            const { privateKey: ourPrivateKey } = await deriveKeyFromPath({
              path: [`bip32:${index}'`],
              depth: 1,
              curve: ed25519,
              ...derivedChildKeys,
            });

            expect((ourPrivateKey as Buffer).toString('hex')).toStrictEqual(
              theirPrivateKey,
            );
          }
        });
      });
    });
  });
});
