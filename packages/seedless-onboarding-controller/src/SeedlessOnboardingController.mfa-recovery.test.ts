import { deriveStateFromMetadata } from '@metamask/base-controller';
import type {
  FetchedSecretDataItem,
  KeyPair,
  SEC1EncodedPublicKey,
  ToprfSecureBackup,
} from '@metamask/toprf-secure-backup';
import {
  EncAccountDataType,
  TOPRFError,
  TOPRFErrorCode,
  WrappedKeysItemId,
} from '@metamask/toprf-secure-backup';
import { bytesToBase64, bytesToHex, stringToBytes } from '@metamask/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import type { MockInstance } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import type { RootMessenger } from '../tests/__fixtures__/mockMessenger.js';
import {
  createMockToprfEncryptor,
  getMockInitialControllerState,
  MOCK_KEYRING_ID,
  MOCK_SEED_PHRASE,
  mockCreateToprfKeyAndBackupSeedPhrase,
  withController,
} from '../tests/controller-helpers.js';
import { createMockJWTToken } from '../tests/mocks/utils.js';
import { SeedlessOnboardingControllerErrorMessage } from './constants.js';
import type {
  RecoveryKeys,
  WrappedKeySet,
} from './mfa-recovery/recovery-keys.js';
import {
  isRecoveryKeysItem,
  parseRecoveryKeysItem,
  parseWrappedKeys,
  RECOVERY_KEYS_SECRET_TYPE,
  serializeRecoveryKeysItem,
  serializeWrappedKeys,
  WRAPPED_KEYS_PREFIX,
} from './mfa-recovery/recovery-keys.js';
import { SecretMetadata } from './SecretMetadata.js';

describe('SeedlessOnboardingController', () => {
  describe('MFA recovery', () => {
    const MOCK_PASSWORD = 'mock-password';
    const RECOVERY_SECRET = new Uint8Array(32).fill(7);
    const AAL2_USER_ID = 'mock-profile-id';
    const futureExp = (): number => Math.floor(Date.now() / 1000) + 3600;
    const AAL2_NODE_AUTH_TOKENS = [
      { authToken: 'aal2Token1', nodeIndex: 1, nodePubKey: 'nodePubKey' },
      { authToken: 'aal2Token2', nodeIndex: 2, nodePubKey: 'nodePubKey2' },
      { authToken: 'aal2Token3', nodeIndex: 3, nodePubKey: 'nodePubKey3' },
    ];
    const AAL2_AUTH_CONNECTION_ID = 'mm-recovery-dev-aal2-common';
    const AAL2_GROUPED_AUTH_CONNECTION_ID = 'mm-recovery-aal2-dev';
    const AAL2_REQUEST = {
      nodeAuthTokens: AAL2_NODE_AUTH_TOKENS,
      authConnectionId: AAL2_AUTH_CONNECTION_ID,
      groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
      userId: AAL2_USER_ID,
    };

    /**
     * Creates a random key pair.
     *
     * @returns The key pair.
     */
    function createRandomKeyPair(): KeyPair {
      const sk = BigInt(bytesToHex(secp256k1.utils.randomPrivateKey()));
      return { sk, pk: secp256k1.getPublicKey(sk, false) };
    }

    /**
     * Creates random TOPRF2 keys.
     *
     * @returns The recovery keys.
     */
    function createRandomRecoveryKeys(): RecoveryKeys {
      return {
        recoveryEncKey: secp256k1.utils.randomPrivateKey(),
        recoveryAuthKeyPair: createRandomKeyPair(),
      };
    }

    /**
     * Derives the key set held by the vault created in the tests.
     *
     * @returns The vault key set.
     */
    function getVaultKeySet(): WrappedKeySet {
      const encryptor = createMockToprfEncryptor();
      return {
        encKey: encryptor.deriveEncKey(MOCK_PASSWORD),
        pwEncKey: encryptor.derivePwEncKey(MOCK_PASSWORD),
        authKeyPair: encryptor.deriveAuthKeyPair(MOCK_PASSWORD),
      };
    }

    /**
     * Derives the keys that `createLocalKey` returns for a password, by
     * default the recovery secret.
     *
     * @param password - The password.
     * @returns The `createLocalKey` result.
     */
    function createLocalKeyResult(password = bytesToHex(RECOVERY_SECRET)): {
      encKey: Uint8Array;
      pwEncKey: Uint8Array;
      authKeyPair: KeyPair;
      oprfKey: bigint;
      seed: Uint8Array;
    } {
      const encryptor = createMockToprfEncryptor();
      return {
        encKey: encryptor.deriveEncKey(password),
        pwEncKey: encryptor.derivePwEncKey(password),
        authKeyPair: encryptor.deriveAuthKeyPair(password),
        oprfKey: 5n,
        seed: stringToBytes(password),
      };
    }

    /**
     * Mocks `fetchAuthPubKey`, answering by verifier.
     *
     * @param toprfClient - The ToprfSecureBackup instance.
     * @param keys - The keys to answer with.
     * @param keys.password - The TOPRF1 (social login verifier) auth public key.
     * @param keys.recovery - The TOPRF2 (recovery verifier) auth public key, or
     * an error to reject with.
     * @returns The spy.
     */
    function mockRecoveryFetchAuthPubKey(
      toprfClient: ToprfSecureBackup,
      keys: {
        password: SEC1EncodedPublicKey;
        recovery?: SEC1EncodedPublicKey | Error;
      },
    ): MockInstance {
      return vi
        .spyOn(toprfClient, 'fetchAuthPubKey')
        .mockImplementation(async ({ authConnectionId: verifier }) => {
          if (verifier === AAL2_AUTH_CONNECTION_ID) {
            if (keys.recovery === undefined) {
              throw new Error('unexpected TOPRF2 fetchAuthPubKey');
            }
            if (keys.recovery instanceof Error) {
              throw keys.recovery;
            }
            return { authPubKey: keys.recovery, keyIndex: 1 };
          }
          return { authPubKey: keys.password, keyIndex: 1 };
        });
    }

    /**
     * Returns the `fetchAuthPubKey` calls made against the TOPRF2 verifier.
     *
     * @param spy - The `fetchAuthPubKey` spy.
     * @returns The TOPRF2 calls.
     */
    function recoveryCalls(spy: MockInstance): unknown[][] {
      return spy.mock.calls.filter(
        ([params]) =>
          (params as { authConnectionId: string }).authConnectionId ===
          AAL2_AUTH_CONNECTION_ID,
      );
    }

    /**
     * Builds the fetched items for the given item data, the way the metadata
     * store returns them: recovery-keys and wrapped-keys items are
     * `WrappedKeys` items under their fixed item ID, other items get
     * server-assigned item IDs, which carry no meaning.
     *
     * @param source - The item data.
     * @returns The fetched items.
     */
    function toFetchedItems(source: Uint8Array[]): FetchedSecretDataItem[] {
      return source.map((data, index) => {
        if (isRecoveryKeysItem(data)) {
          return {
            itemId: WrappedKeysItemId.WrappedRecovery,
            data,
            version: 'v2',
            dataType: EncAccountDataType.WrappedKeys,
          };
        }
        if (new TextDecoder().decode(data).startsWith(WRAPPED_KEYS_PREFIX)) {
          return {
            itemId: WrappedKeysItemId.WrappedSeedless,
            data,
            version: 'v2',
            dataType: EncAccountDataType.WrappedKeys,
          };
        }
        return { itemId: `server-item-${index}`, data, version: 'v1' };
      });
    }

    /**
     * Mocks `fetchAllSecretDataItems`, answering by namespace.
     *
     * @param toprfClient - The ToprfSecureBackup instance.
     * @param items - The item data per namespace.
     * @param items.vault - The TOPRF1 namespace items, for the vault's
     * encryption key.
     * @param items.recovery - The TOPRF2 namespace items.
     * @param items.recoveryEncKey - The TOPRF2 encryption key.
     * @returns The spy.
     */
    function mockFetchAllSecretDataItems(
      toprfClient: ToprfSecureBackup,
      items: {
        vault: Uint8Array[];
        recovery?: Uint8Array[];
        recoveryEncKey?: Uint8Array;
      },
    ): MockInstance {
      const vaultEncKey = getVaultKeySet().encKey;
      return vi
        .spyOn(toprfClient, 'fetchAllSecretDataItems')
        .mockImplementation(async ({ decKey }) => {
          let source: Uint8Array[];
          if (bytesToHex(decKey) === bytesToHex(vaultEncKey)) {
            source = items.vault;
          } else if (
            items.recoveryEncKey !== undefined &&
            bytesToHex(decKey) === bytesToHex(items.recoveryEncKey)
          ) {
            source = items.recovery ?? [];
          } else {
            throw new Error('unexpected namespace');
          }
          return toFetchedItems(source);
        });
    }

    /**
     * Runs the callback with an unlocked controller that holds a vault.
     *
     * @param fn - The callback.
     * @returns Whatever the callback returns.
     */
    async function withUnlockedController<ReturnValue>(
      fn: Parameters<typeof withController<ReturnValue>>[1],
    ): Promise<ReturnValue> {
      return await withController(
        {
          state: getMockInitialControllerState({
            withMockAuthenticatedUser: true,
          }),
        },
        async (args) => {
          await mockCreateToprfKeyAndBackupSeedPhrase(
            args.toprfClient,
            args.controller,
            args.baseMessenger,
            MOCK_PASSWORD,
            MOCK_SEED_PHRASE,
            MOCK_KEYRING_ID,
          );
          vi.clearAllMocks();
          return await fn(args);
        },
      );
    }

    /**
     * Authenticates the controller at aal2.
     *
     * @param args - The controller test arguments.
     * @param args.toprfClient - The ToprfSecureBackup instance.
     * @param args.baseMessenger - The root messenger.
     * @param options - The options.
     * @param options.hasRecoveryShare - Whether the nodes hold a
     * recovery verifier share.
     */
    async function authenticateAal2(
      {
        toprfClient,
        baseMessenger,
      }: { toprfClient: ToprfSecureBackup; baseMessenger: RootMessenger },
      { hasRecoveryShare }: { hasRecoveryShare: boolean },
    ): Promise<void> {
      vi.spyOn(toprfClient, 'authenticate').mockResolvedValueOnce({
        nodeAuthTokens: AAL2_NODE_AUTH_TOKENS,
        isNewUser: !hasRecoveryShare,
      });
      await baseMessenger.call(
        'SeedlessOnboardingController:authenticateForRecovery',
        {
          aal2Token: createMockJWTToken({
            exp: futureExp(),
            sub: AAL2_USER_ID,
          }),
          authConnectionId: AAL2_AUTH_CONNECTION_ID,
          groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
        },
      );
    }

    /**
     * Builds the TOPRF1 namespace items: a seed phrase and a recovery-keys
     * item.
     *
     * @param recoveryKeys - The TOPRF2 keys to store.
     * @returns The item data.
     */
    function recoveryKeysItem(recoveryKeys: RecoveryKeys): Uint8Array[] {
      return [
        new SecretMetadata(MOCK_SEED_PHRASE).toBytes(),
        serializeRecoveryKeysItem(recoveryKeys),
      ];
    }

    /**
     * Reads the recovery keys back from the data of an `addSecretDataItem`
     * call.
     *
     * @param spy - The `addSecretDataItem` spy.
     * @param call - The call index.
     * @returns The stored recovery keys.
     */
    function storedRecoveryKeys(spy: MockInstance, call: number): RecoveryKeys {
      const [{ secretData }] = spy.mock.calls[call] as [
        { secretData: Uint8Array },
      ];
      return parseRecoveryKeysItem(secretData).recoveryKeys;
    }

    describe('authenticateForRecovery', () => {
      it('authenticates on the recovery verifier with the token sub and stores the aal2 set', async () => {
        const exp = futureExp();
        const aal2Token = createMockJWTToken({ exp, sub: AAL2_USER_ID });
        await withController(
          {
            state: getMockInitialControllerState({
              withMockAuthenticatedUser: true,
            }),
          },
          async ({
            controller,
            toprfClient,
            baseMessenger,
            mockRefreshJWTToken,
          }) => {
            const authenticateSpy = vi
              .spyOn(toprfClient, 'authenticate')
              .mockResolvedValue({
                nodeAuthTokens: AAL2_NODE_AUTH_TOKENS,
                isNewUser: false,
              });
            const before = controller.state;

            await baseMessenger.call(
              'SeedlessOnboardingController:authenticateForRecovery',
              {
                aal2Token,
                authConnectionId: AAL2_AUTH_CONNECTION_ID,
                groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
              },
            );

            expect(mockRefreshJWTToken).not.toHaveBeenCalled();
            expect(authenticateSpy).toHaveBeenCalledWith({
              authConnectionId: AAL2_AUTH_CONNECTION_ID,
              groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
              userId: AAL2_USER_ID,
              idTokens: [aal2Token],
            });
            expect(controller.state.recoverySession).toStrictEqual({
              nodeAuthTokens: AAL2_NODE_AUTH_TOKENS,
              expiresAt: exp,
              userId: AAL2_USER_ID,
              authConnectionId: AAL2_AUTH_CONNECTION_ID,
              groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
              hasRecoveryShare: true,
            });
            expect(controller.state.nodeAuthTokens).toStrictEqual(
              before.nodeAuthTokens,
            );
            expect(controller.state.accessToken).toBe(before.accessToken);
            expect(controller.state.metadataAccessToken).toBe(
              before.metadataAccessToken,
            );
          },
        );
      });

      it.each([
        ['expired', createMockJWTToken({ exp: 1 })],
        ['malformed', 'not-a-jwt'],
        [
          'missing exp',
          createMockJWTToken({ exp: undefined as unknown as number }),
        ],
        [
          'missing sub',
          createMockJWTToken({ sub: undefined as unknown as string }),
        ],
      ])(
        'rejects an %s aal2 token without refreshing or authenticating',
        async (_name, aal2Token) => {
          await withController(
            {
              state: getMockInitialControllerState({
                withMockAuthenticatedUser: true,
              }),
            },
            async ({
              controller,
              toprfClient,
              baseMessenger,
              mockRefreshJWTToken,
            }) => {
              const authenticateSpy = vi.spyOn(toprfClient, 'authenticate');

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:authenticateForRecovery',
                  {
                    aal2Token,
                    authConnectionId: AAL2_AUTH_CONNECTION_ID,
                    groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
                  },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.Aal2Required,
              );

              expect(mockRefreshJWTToken).not.toHaveBeenCalled();
              expect(authenticateSpy).not.toHaveBeenCalled();
              expect(controller.state.recoverySession).toBeUndefined();
            },
          );
        },
      );

      it.each([
        ['an empty authConnectionId', { authConnectionId: '' }],
        [
          'a missing authConnectionId',
          { authConnectionId: undefined as unknown as string },
        ],
        ['an empty groupedAuthConnectionId', { groupedAuthConnectionId: '' }],
        [
          'a missing groupedAuthConnectionId',
          { groupedAuthConnectionId: undefined as unknown as string },
        ],
      ])('rejects %s without authenticating', async (_name, overrides) => {
        await withController(
          {
            state: getMockInitialControllerState({
              withMockAuthenticatedUser: true,
            }),
          },
          async ({ controller, toprfClient, baseMessenger }) => {
            const authenticateSpy = vi.spyOn(toprfClient, 'authenticate');

            await expect(
              baseMessenger.call(
                'SeedlessOnboardingController:authenticateForRecovery',
                {
                  aal2Token: createMockJWTToken({
                    exp: futureExp(),
                    sub: AAL2_USER_ID,
                  }),
                  authConnectionId: AAL2_AUTH_CONNECTION_ID,
                  groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
                  ...overrides,
                },
              ),
            ).rejects.toThrow(
              SeedlessOnboardingControllerErrorMessage.MissingAuthUserInfo,
            );

            expect(authenticateSpy).not.toHaveBeenCalled();
            expect(controller.state.recoverySession).toBeUndefined();
          },
        );
      });

      it('throws AuthenticationError when authenticating fails', async () => {
        await withController(
          {
            state: getMockInitialControllerState({
              withMockAuthenticatedUser: true,
            }),
          },
          async ({ controller, toprfClient, baseMessenger }) => {
            vi.spyOn(toprfClient, 'authenticate').mockRejectedValueOnce(
              new Error('authenticate'),
            );

            await expect(
              baseMessenger.call(
                'SeedlessOnboardingController:authenticateForRecovery',
                {
                  aal2Token: createMockJWTToken({
                    exp: futureExp(),
                    sub: AAL2_USER_ID,
                  }),
                  authConnectionId: AAL2_AUTH_CONNECTION_ID,
                  groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
                },
              ),
            ).rejects.toThrow(
              SeedlessOnboardingControllerErrorMessage.AuthenticationError,
            );

            expect(controller.state.recoverySession).toBeUndefined();
          },
        );
      });

      it('does not persist or log the recovery session', async () => {
        await withController(
          {
            state: {
              recoverySession: {
                nodeAuthTokens: AAL2_NODE_AUTH_TOKENS,
                expiresAt: futureExp(),
                userId: AAL2_USER_ID,
                authConnectionId: AAL2_AUTH_CONNECTION_ID,
                groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
                hasRecoveryShare: true,
              },
            },
          },
          ({ controller }) => {
            for (const property of [
              'persist',
              'includeInStateLogs',
              'includeInDebugSnapshot',
              'usedInUi',
            ] as const) {
              const derived = deriveStateFromMetadata(
                controller.state,
                controller.metadata,
                property,
              );
              expect(derived).not.toHaveProperty('recoverySession');
            }
          },
        );
      });

      it.each([
        ['the controller is locked', 'SeedlessOnboardingController:setLocked'],
        ['the state is cleared', 'SeedlessOnboardingController:clearState'],
      ] as const)('clears the aal2 state when %s', async (_name, action) => {
        await withController(
          {
            state: getMockInitialControllerState({
              withMockAuthenticatedUser: true,
            }),
          },
          async ({ controller, toprfClient, baseMessenger }) => {
            await authenticateAal2(
              { toprfClient, baseMessenger },
              { hasRecoveryShare: true },
            );
            expect(controller.state.recoverySession).toBeDefined();

            await baseMessenger.call(action);

            expect(controller.state.recoverySession).toBeUndefined();
          },
        );
      });
    });

    describe('getRecoveryStatus', () => {
      it('returns PasswordOutdated, unverified, when the TOPRF1 auth public key differs from the vault', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          await authenticateAal2(
            { toprfClient, baseMessenger },
            { hasRecoveryShare: true },
          );
          const spy = mockRecoveryFetchAuthPubKey(toprfClient, {
            password: createRandomKeyPair().pk,
          });

          const result = await baseMessenger.call(
            'SeedlessOnboardingController:getRecoveryStatus',
          );

          expect(result).toStrictEqual({
            status: 'PasswordOutdated',
            verified: false,
          });
          expect(recoveryCalls(spy)).toHaveLength(0);
        });
      });

      describe('after rehydrating with the password', () => {
        it.each([
          [
            'without an aal2 set',
            async (): Promise<void> => undefined,
            { status: 'Enabled', verified: false },
          ],
          [
            'with an aal2 set',
            async (args: {
              toprfClient: ToprfSecureBackup;
              baseMessenger: RootMessenger;
            }): Promise<void> =>
              authenticateAal2(args, { hasRecoveryShare: true }),
            { status: 'Enabled', verified: true, hasRecoveryShare: true },
          ],
        ])(
          'returns Enabled %s when recovery was enabled on another device',
          async (_name, authenticateRecovery, expected) => {
            await withController(
              {
                state: getMockInitialControllerState({
                  withMockAuthenticatedUser: true,
                }),
              },
              async ({ toprfClient, baseMessenger }) => {
                const vaultKeySet = getVaultKeySet();
                const recoveryKeys = createRandomRecoveryKeys();
                vi.spyOn(toprfClient, 'recoverEncKey').mockResolvedValue({
                  encKey: vaultKeySet.encKey,
                  pwEncKey: vaultKeySet.pwEncKey,
                  authKeyPair: vaultKeySet.authKeyPair,
                  rateLimitResetResult: Promise.resolve(),
                  keyShareIndex: 1,
                });
                mockRecoveryFetchAuthPubKey(toprfClient, {
                  password: vaultKeySet.authKeyPair.pk,
                  recovery: recoveryKeys.recoveryAuthKeyPair.pk,
                });
                mockFetchAllSecretDataItems(toprfClient, {
                  vault: recoveryKeysItem(recoveryKeys),
                  recovery: [serializeWrappedKeys([vaultKeySet])],
                  recoveryEncKey: recoveryKeys.recoveryEncKey,
                });

                const secrets = await baseMessenger.call(
                  'SeedlessOnboardingController:fetchAllSecretData',
                  MOCK_PASSWORD,
                );
                expect(secrets).toHaveLength(1);
                await authenticateRecovery({ toprfClient, baseMessenger });

                const result = await baseMessenger.call(
                  'SeedlessOnboardingController:getRecoveryStatus',
                );

                expect(result).toStrictEqual(expected);
              },
            );
          },
        );
      });

      describe('without an aal2 set', () => {
        it('returns NotEnabled, unverified, when there is no recovery-keys item', async () => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              const spy = mockRecoveryFetchAuthPubKey(toprfClient, {
                password: getVaultKeySet().authKeyPair.pk,
              });
              mockFetchAllSecretDataItems(toprfClient, { vault: [] });

              const result = await baseMessenger.call(
                'SeedlessOnboardingController:getRecoveryStatus',
              );

              expect(result).toStrictEqual({
                status: 'NotEnabled',
                verified: false,
              });
              expect(recoveryCalls(spy)).toHaveLength(0);
            },
          );
        });

        it('skips the genuine check and returns Enabled, unverified, when the wrap is current', async () => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              const vaultKeySet = getVaultKeySet();
              const recoveryKeys = createRandomRecoveryKeys();
              const spy = mockRecoveryFetchAuthPubKey(toprfClient, {
                password: vaultKeySet.authKeyPair.pk,
              });
              mockFetchAllSecretDataItems(toprfClient, {
                vault: recoveryKeysItem(recoveryKeys),
                recovery: [serializeWrappedKeys([vaultKeySet])],
                recoveryEncKey: recoveryKeys.recoveryEncKey,
              });

              const result = await baseMessenger.call(
                'SeedlessOnboardingController:getRecoveryStatus',
              );

              expect(result).toStrictEqual({
                status: 'Enabled',
                verified: false,
              });
              expect(recoveryCalls(spy)).toHaveLength(0);
            },
          );
        });
      });

      describe('with an aal2 set', () => {
        it.each([
          ['no recovery share', false],
          ['a recovery share', true],
        ])(
          'returns NotEnabled with %s when there is no recovery-keys item',
          async (_name, hasRecoveryShare) => {
            await withUnlockedController(
              async ({ toprfClient, baseMessenger }) => {
                await authenticateAal2(
                  { toprfClient, baseMessenger },
                  { hasRecoveryShare },
                );
                const spy = mockRecoveryFetchAuthPubKey(toprfClient, {
                  password: getVaultKeySet().authKeyPair.pk,
                });
                mockFetchAllSecretDataItems(toprfClient, { vault: [] });

                const result = await baseMessenger.call(
                  'SeedlessOnboardingController:getRecoveryStatus',
                );

                expect(result).toStrictEqual({
                  status: 'NotEnabled',
                  verified: true,
                  hasRecoveryShare,
                });
                expect(recoveryCalls(spy)).toHaveLength(0);
              },
            );
          },
        );

        it('returns NotEnabled without a TOPRF2 lookup when the nodes hold no recovery share', async () => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: false },
              );
              const spy = mockRecoveryFetchAuthPubKey(toprfClient, {
                password: getVaultKeySet().authKeyPair.pk,
              });
              mockFetchAllSecretDataItems(toprfClient, {
                vault: recoveryKeysItem(createRandomRecoveryKeys()),
              });

              const result = await baseMessenger.call(
                'SeedlessOnboardingController:getRecoveryStatus',
              );

              expect(result).toStrictEqual({
                status: 'NotEnabled',
                verified: true,
                hasRecoveryShare: false,
              });
              expect(recoveryCalls(spy)).toHaveLength(0);
            },
          );
        });

        it('returns NotEnabled when the TOPRF2 auth public key does not match the item', async () => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const spy = mockRecoveryFetchAuthPubKey(toprfClient, {
                password: getVaultKeySet().authKeyPair.pk,
                recovery: createRandomKeyPair().pk,
              });
              const fetchSpy = mockFetchAllSecretDataItems(toprfClient, {
                vault: recoveryKeysItem(createRandomRecoveryKeys()),
              });

              const result = await baseMessenger.call(
                'SeedlessOnboardingController:getRecoveryStatus',
              );

              expect(result).toStrictEqual({
                status: 'NotEnabled',
                verified: true,
                hasRecoveryShare: true,
              });
              expect(recoveryCalls(spy)).toStrictEqual([[AAL2_REQUEST]]);
              expect(fetchSpy).toHaveBeenCalledTimes(1);
            },
          );
        });

        it('returns NotEnabled when the recovery-keys item is malformed', async () => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              mockRecoveryFetchAuthPubKey(toprfClient, {
                password: getVaultKeySet().authKeyPair.pk,
                recovery: createRandomKeyPair().pk,
              });
              mockFetchAllSecretDataItems(toprfClient, {
                vault: [
                  stringToBytes(
                    JSON.stringify({ type: RECOVERY_KEYS_SECRET_TYPE }),
                  ),
                ],
              });

              const result = await baseMessenger.call(
                'SeedlessOnboardingController:getRecoveryStatus',
              );

              expect(result).toStrictEqual({
                status: 'NotEnabled',
                verified: true,
                hasRecoveryShare: true,
              });
            },
          );
        });

        it('returns Enabled when the item is genuine and the wrap holds the vault key set', async () => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const vaultKeySet = getVaultKeySet();
              const recoveryKeys = createRandomRecoveryKeys();
              mockRecoveryFetchAuthPubKey(toprfClient, {
                password: vaultKeySet.authKeyPair.pk,
                recovery: recoveryKeys.recoveryAuthKeyPair.pk,
              });
              const fetchSpy = mockFetchAllSecretDataItems(toprfClient, {
                vault: recoveryKeysItem(recoveryKeys),
                recovery: [
                  serializeWrappedKeys([
                    {
                      encKey: new Uint8Array(32).fill(3),
                      pwEncKey: new Uint8Array(32).fill(4),
                      authKeyPair: createRandomKeyPair(),
                    },
                    vaultKeySet,
                  ]),
                ],
                recoveryEncKey: recoveryKeys.recoveryEncKey,
              });

              const result = await baseMessenger.call(
                'SeedlessOnboardingController:getRecoveryStatus',
              );

              expect(result).toStrictEqual({
                status: 'Enabled',
                verified: true,
                hasRecoveryShare: true,
              });
              expect(fetchSpy).toHaveBeenCalledWith({
                decKey: recoveryKeys.recoveryEncKey,
                authKeyPair: recoveryKeys.recoveryAuthKeyPair,
              });
            },
          );
        });

        it.each([
          [
            'the wrapped set does not match the vault',
            [
              serializeWrappedKeys([
                {
                  encKey: new Uint8Array(32).fill(3),
                  pwEncKey: new Uint8Array(32).fill(4),
                  authKeyPair: createRandomKeyPair(),
                },
              ]),
            ],
          ],
          ['there is no wrapped-keys item', []],
          ['the wrapped-keys item is malformed', [stringToBytes('garbage')]],
        ])('returns WrapStale when %s', async (_name, recoveryItems) => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const recoveryKeys = createRandomRecoveryKeys();
              mockRecoveryFetchAuthPubKey(toprfClient, {
                password: getVaultKeySet().authKeyPair.pk,
                recovery: recoveryKeys.recoveryAuthKeyPair.pk,
              });
              mockFetchAllSecretDataItems(toprfClient, {
                vault: recoveryKeysItem(recoveryKeys),
                recovery: recoveryItems,
                recoveryEncKey: recoveryKeys.recoveryEncKey,
              });

              const result = await baseMessenger.call(
                'SeedlessOnboardingController:getRecoveryStatus',
              );

              expect(result).toStrictEqual({
                status: 'WrapStale',
                verified: true,
                hasRecoveryShare: true,
              });
            },
          );
        });

        it('throws FailedToFetchAuthPubKey when the TOPRF2 lookup fails with a generic error', async () => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              mockRecoveryFetchAuthPubKey(toprfClient, {
                password: getVaultKeySet().authKeyPair.pk,
                recovery: new Error('nodes unreachable'),
              });
              mockFetchAllSecretDataItems(toprfClient, {
                vault: recoveryKeysItem(createRandomRecoveryKeys()),
              });

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:getRecoveryStatus',
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.FailedToFetchAuthPubKey,
              );
            },
          );
        });

        it('throws Aal2Required and clears the aal2 set, without refreshing, when the nodes reject it', async () => {
          await withUnlockedController(
            async ({ controller, toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const refreshSpy = vi.spyOn(controller, 'refreshAuthTokens');
              mockRecoveryFetchAuthPubKey(toprfClient, {
                password: getVaultKeySet().authKeyPair.pk,
                recovery: new TOPRFError(
                  TOPRFErrorCode.AuthTokenExpired,
                  'Auth token expired',
                ),
              });
              mockFetchAllSecretDataItems(toprfClient, {
                vault: recoveryKeysItem(createRandomRecoveryKeys()),
              });

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:getRecoveryStatus',
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.Aal2Required,
              );

              expect(refreshSpy).not.toHaveBeenCalled();
              expect(controller.state.recoverySession).toBeUndefined();
            },
          );
        });
      });

      it('throws FailedToFetchSecretMetadata when fetching the secret data fails', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: getVaultKeySet().authKeyPair.pk,
          });
          vi.spyOn(toprfClient, 'fetchAllSecretDataItems').mockRejectedValue(
            new Error('fetch failed'),
          );

          await expect(
            baseMessenger.call(
              'SeedlessOnboardingController:getRecoveryStatus',
            ),
          ).rejects.toThrow(
            SeedlessOnboardingControllerErrorMessage.FailedToFetchSecretMetadata,
          );
        });
      });

      it('refreshes the aal1 tokens and retries when fetching the secret data fails with an auth token error', async () => {
        await withUnlockedController(
          async ({ controller, toprfClient, baseMessenger }) => {
            const refreshSpy = vi
              .spyOn(controller, 'refreshAuthTokens')
              .mockResolvedValue();
            mockRecoveryFetchAuthPubKey(toprfClient, {
              password: getVaultKeySet().authKeyPair.pk,
            });
            vi.spyOn(toprfClient, 'fetchAllSecretDataItems')
              .mockRejectedValueOnce(
                new TOPRFError(
                  TOPRFErrorCode.AuthTokenExpired,
                  'Auth token expired',
                ),
              )
              .mockResolvedValueOnce([]);

            const result = await baseMessenger.call(
              'SeedlessOnboardingController:getRecoveryStatus',
            );

            expect(refreshSpy).toHaveBeenCalledTimes(1);
            expect(result.status).toBe('NotEnabled');
          },
        );
      });
    });

    describe('storeRecoveryKeys', () => {
      it('creates and persists a new recovery share when the nodes hold none, and writes the items in order', async () => {
        await withUnlockedController(
          async ({ controller, toprfClient, baseMessenger }) => {
            await authenticateAal2(
              { toprfClient, baseMessenger },
              { hasRecoveryShare: false },
            );
            const vaultKeySet = getVaultKeySet();
            const fetchAuthPubKeySpy = mockRecoveryFetchAuthPubKey(
              toprfClient,
              {
                password: vaultKeySet.authKeyPair.pk,
              },
            );
            const created = createLocalKeyResult();
            const createSpy = vi
              .spyOn(toprfClient, 'createLocalKey')
              .mockResolvedValueOnce(created);
            const addSpy = vi
              .spyOn(toprfClient, 'addSecretDataItem')
              .mockResolvedValue();
            const persistSpy = vi
              .spyOn(toprfClient, 'persistLocalKey')
              .mockResolvedValue();
            const recoverSpy = vi.spyOn(toprfClient, 'recoverEncKey');

            const result = await baseMessenger.call(
              'SeedlessOnboardingController:storeRecoveryKeys',
              { recoverySecret: RECOVERY_SECRET },
            );

            expect(result).toStrictEqual({ liveKeyMatches: true });
            expect(controller.state.recoverySession?.hasRecoveryShare).toBe(
              true,
            );
            expect(createSpy).toHaveBeenCalledWith({
              password: bytesToHex(RECOVERY_SECRET),
            });
            expect(recoverSpy).not.toHaveBeenCalled();
            expect(recoveryCalls(fetchAuthPubKeySpy)).toHaveLength(0);
            expect(addSpy.mock.calls).toStrictEqual([
              [
                {
                  encKey: created.encKey,
                  authKeyPair: created.authKeyPair,
                  secretData: serializeWrappedKeys([vaultKeySet]),
                  itemId: WrappedKeysItemId.WrappedSeedless,
                  dataType: EncAccountDataType.WrappedKeys,
                },
              ],
              [
                {
                  encKey: vaultKeySet.encKey,
                  authKeyPair: vaultKeySet.authKeyPair,
                  secretData: expect.any(Uint8Array),
                  itemId: WrappedKeysItemId.WrappedRecovery,
                  dataType: EncAccountDataType.WrappedKeys,
                },
              ],
            ]);
            expect(storedRecoveryKeys(addSpy, 1)).toStrictEqual({
              recoveryEncKey: created.encKey,
              recoveryAuthKeyPair: created.authKeyPair,
            });
            expect(persistSpy).toHaveBeenCalledWith({
              ...AAL2_REQUEST,
              oprfKey: created.oprfKey,
              authPubKey: created.authKeyPair.pk,
            });
            const [wrapOrder, recoveryKeysOrder] =
              addSpy.mock.invocationCallOrder;
            expect(createSpy.mock.invocationCallOrder[0]).toBeLessThan(
              wrapOrder,
            );
            expect(wrapOrder).toBeLessThan(
              persistSpy.mock.invocationCallOrder[0],
            );
            expect(persistSpy.mock.invocationCallOrder[0]).toBeLessThan(
              recoveryKeysOrder,
            );
          },
        );
      });

      it('reuses the share it persisted when run again', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          await authenticateAal2(
            { toprfClient, baseMessenger },
            { hasRecoveryShare: false },
          );
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: getVaultKeySet().authKeyPair.pk,
          });
          const created = createLocalKeyResult();
          const createSpy = vi
            .spyOn(toprfClient, 'createLocalKey')
            .mockResolvedValue(created);
          vi.spyOn(toprfClient, 'addSecretDataItem').mockResolvedValue();
          const persistSpy = vi
            .spyOn(toprfClient, 'persistLocalKey')
            .mockResolvedValue();
          const recoverSpy = vi
            .spyOn(toprfClient, 'recoverEncKey')
            .mockResolvedValue({
              encKey: created.encKey,
              pwEncKey: created.pwEncKey,
              authKeyPair: created.authKeyPair,
              rateLimitResetResult: Promise.resolve(),
              keyShareIndex: 1,
            });

          await baseMessenger.call(
            'SeedlessOnboardingController:storeRecoveryKeys',
            { recoverySecret: RECOVERY_SECRET },
          );
          await baseMessenger.call(
            'SeedlessOnboardingController:storeRecoveryKeys',
            { recoverySecret: RECOVERY_SECRET },
          );

          expect(createSpy).toHaveBeenCalledTimes(1);
          expect(persistSpy).toHaveBeenCalledTimes(1);
          expect(recoverSpy).toHaveBeenCalledTimes(1);
        });
      });

      it('evaluates the existing recovery share without persisting a new one', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          await authenticateAal2(
            { toprfClient, baseMessenger },
            { hasRecoveryShare: true },
          );
          const vaultKeySet = getVaultKeySet();
          const existing = createLocalKeyResult();
          const fetchAuthPubKeySpy = mockRecoveryFetchAuthPubKey(toprfClient, {
            password: vaultKeySet.authKeyPair.pk,
          });
          const recoverSpy = vi
            .spyOn(toprfClient, 'recoverEncKey')
            .mockResolvedValue({
              encKey: existing.encKey,
              pwEncKey: existing.pwEncKey,
              authKeyPair: existing.authKeyPair,
              rateLimitResetResult: Promise.resolve(),
              keyShareIndex: 1,
            });
          const addSpy = vi
            .spyOn(toprfClient, 'addSecretDataItem')
            .mockResolvedValue();
          const persistSpy = vi.spyOn(toprfClient, 'persistLocalKey');
          const createSpy = vi.spyOn(toprfClient, 'createLocalKey');

          const result = await baseMessenger.call(
            'SeedlessOnboardingController:storeRecoveryKeys',
            { recoverySecret: RECOVERY_SECRET },
          );

          expect(result).toStrictEqual({ liveKeyMatches: true });
          expect(recoverSpy).toHaveBeenCalledWith({
            ...AAL2_REQUEST,
            password: bytesToHex(RECOVERY_SECRET),
          });
          expect(recoveryCalls(fetchAuthPubKeySpy)).toHaveLength(0);
          expect(createSpy).not.toHaveBeenCalled();
          expect(persistSpy).not.toHaveBeenCalled();
          expect(addSpy.mock.calls).toStrictEqual([
            [
              {
                encKey: existing.encKey,
                authKeyPair: existing.authKeyPair,
                secretData: serializeWrappedKeys([vaultKeySet]),
                itemId: WrappedKeysItemId.WrappedSeedless,
                dataType: EncAccountDataType.WrappedKeys,
              },
            ],
            [
              {
                encKey: vaultKeySet.encKey,
                authKeyPair: vaultKeySet.authKeyPair,
                secretData: expect.any(Uint8Array),
                itemId: WrappedKeysItemId.WrappedRecovery,
                dataType: EncAccountDataType.WrappedKeys,
              },
            ],
          ]);
          expect(storedRecoveryKeys(addSpy, 1)).toStrictEqual({
            recoveryEncKey: existing.encKey,
            recoveryAuthKeyPair: existing.authKeyPair,
          });
        });
      });

      it('does not fail when resetting the recovery rate limit fails', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          await authenticateAal2(
            { toprfClient, baseMessenger },
            { hasRecoveryShare: true },
          );
          const existing = createLocalKeyResult();
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: getVaultKeySet().authKeyPair.pk,
          });
          vi.spyOn(toprfClient, 'recoverEncKey').mockResolvedValue({
            encKey: existing.encKey,
            pwEncKey: existing.pwEncKey,
            authKeyPair: existing.authKeyPair,
            rateLimitResetResult: Promise.reject(new Error('reset failed')),
            keyShareIndex: 1,
          });
          vi.spyOn(toprfClient, 'addSecretDataItem').mockResolvedValue();

          const result = await baseMessenger.call(
            'SeedlessOnboardingController:storeRecoveryKeys',
            { recoverySecret: RECOVERY_SECRET },
          );

          expect(result).toStrictEqual({ liveKeyMatches: true });
        });
      });

      it('throws RecoveryKeyShareConflict without writing when the recovery secret does not match the share', async () => {
        await withUnlockedController(
          async ({ controller, toprfClient, baseMessenger }) => {
            await authenticateAal2(
              { toprfClient, baseMessenger },
              { hasRecoveryShare: true },
            );
            mockRecoveryFetchAuthPubKey(toprfClient, {
              password: getVaultKeySet().authKeyPair.pk,
            });
            vi.spyOn(toprfClient, 'recoverEncKey').mockRejectedValue(
              new TOPRFError(
                TOPRFErrorCode.CouldNotDeriveEncryptionKey,
                'could not derive',
              ),
            );
            const addSpy = vi.spyOn(toprfClient, 'addSecretDataItem');

            await expect(
              baseMessenger.call(
                'SeedlessOnboardingController:storeRecoveryKeys',
                { recoverySecret: RECOVERY_SECRET },
              ),
            ).rejects.toThrow(
              SeedlessOnboardingControllerErrorMessage.RecoveryKeyShareConflict,
            );

            expect(addSpy).not.toHaveBeenCalled();
            expect(controller.state.recoverySession).toBeDefined();
          },
        );
      });

      it('rethrows other recoverEncKey errors', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          await authenticateAal2(
            { toprfClient, baseMessenger },
            { hasRecoveryShare: true },
          );
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: getVaultKeySet().authKeyPair.pk,
          });
          vi.spyOn(toprfClient, 'recoverEncKey').mockRejectedValue(
            new Error('recover failed'),
          );

          await expect(
            baseMessenger.call(
              'SeedlessOnboardingController:storeRecoveryKeys',
              { recoverySecret: RECOVERY_SECRET },
            ),
          ).rejects.toThrow('recover failed');
        });
      });

      it('returns liveKeyMatches false when the live key changed after the write', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          await authenticateAal2(
            { toprfClient, baseMessenger },
            { hasRecoveryShare: false },
          );
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: createRandomKeyPair().pk,
          });
          vi.spyOn(toprfClient, 'createLocalKey').mockResolvedValueOnce(
            createLocalKeyResult(),
          );
          vi.spyOn(toprfClient, 'addSecretDataItem').mockResolvedValue();
          vi.spyOn(toprfClient, 'persistLocalKey').mockResolvedValue();

          const result = await baseMessenger.call(
            'SeedlessOnboardingController:storeRecoveryKeys',
            { recoverySecret: RECOVERY_SECRET },
          );

          expect(result).toStrictEqual({ liveKeyMatches: false });
        });
      });

      it.each([
        ['missing', {}],
        [
          'expired',
          {
            recoverySession: {
              nodeAuthTokens: AAL2_NODE_AUTH_TOKENS,
              expiresAt: Math.floor(Date.now() / 1000) - 10,
              userId: AAL2_USER_ID,
              authConnectionId: AAL2_AUTH_CONNECTION_ID,
              groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
              hasRecoveryShare: true,
            },
          },
        ],
        [
          'without a user ID',
          {
            recoverySession: {
              nodeAuthTokens: AAL2_NODE_AUTH_TOKENS,
              expiresAt: futureExp(),
              userId: '',
              authConnectionId: AAL2_AUTH_CONNECTION_ID,
              groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
              hasRecoveryShare: true,
            },
          },
        ],
        [
          'empty',
          {
            recoverySession: {
              nodeAuthTokens: [],
              expiresAt: futureExp(),
              userId: AAL2_USER_ID,
              authConnectionId: AAL2_AUTH_CONNECTION_ID,
              groupedAuthConnectionId: AAL2_GROUPED_AUTH_CONNECTION_ID,
              hasRecoveryShare: true,
            },
          },
        ],
      ])(
        'throws Aal2Required before any TOPRF2 step when the aal2 set is %s',
        async (_name, aal2State) => {
          await withUnlockedController(
            async ({ controller, toprfClient, baseMessenger }) => {
              controller.update((state) => {
                Object.assign(state, aal2State);
              });
              const refreshSpy = vi.spyOn(controller, 'refreshAuthTokens');
              const createSpy = vi.spyOn(toprfClient, 'createLocalKey');
              const addSpy = vi.spyOn(toprfClient, 'addSecretDataItem');

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:storeRecoveryKeys',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.Aal2Required,
              );

              expect(controller.state.recoverySession).toBeUndefined();
              expect(refreshSpy).not.toHaveBeenCalled();
              expect(createSpy).not.toHaveBeenCalled();
              expect(addSpy).not.toHaveBeenCalled();
            },
          );
        },
      );

      it('throws Aal2Required and clears the aal2 set when persisting is rejected with an auth token error', async () => {
        await withUnlockedController(
          async ({ controller, toprfClient, baseMessenger }) => {
            await authenticateAal2(
              { toprfClient, baseMessenger },
              { hasRecoveryShare: false },
            );
            const refreshSpy = vi.spyOn(controller, 'refreshAuthTokens');
            mockRecoveryFetchAuthPubKey(toprfClient, {
              password: getVaultKeySet().authKeyPair.pk,
            });
            vi.spyOn(toprfClient, 'createLocalKey').mockResolvedValueOnce(
              createLocalKeyResult(),
            );
            const addSpy = vi
              .spyOn(toprfClient, 'addSecretDataItem')
              .mockResolvedValue();
            vi.spyOn(toprfClient, 'persistLocalKey').mockRejectedValue(
              new TOPRFError(
                TOPRFErrorCode.AuthTokenExpired,
                'Auth token expired',
              ),
            );

            await expect(
              baseMessenger.call(
                'SeedlessOnboardingController:storeRecoveryKeys',
                { recoverySecret: RECOVERY_SECRET },
              ),
            ).rejects.toThrow(
              SeedlessOnboardingControllerErrorMessage.Aal2Required,
            );

            expect(controller.state.recoverySession).toBeUndefined();
            expect(refreshSpy).not.toHaveBeenCalled();
            // Only the wrapped-keys item; the recovery-keys item is not written.
            expect(addSpy).toHaveBeenCalledTimes(1);
          },
        );
      });
    });

    describe('changePassword', () => {
      const NEW_PASSWORD = 'new-mock-password';

      it('re-encrypts the recovery-keys item with the user secrets', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: getVaultKeySet().authKeyPair.pk,
          });
          const fetchSpy = vi
            .spyOn(toprfClient, 'fetchAllSecretDataItems')
            .mockResolvedValue([]);
          const encryptor = createMockToprfEncryptor();
          const changeEncKeySpy = vi
            .spyOn(toprfClient, 'changeEncKey')
            .mockResolvedValue({
              encKey: encryptor.deriveEncKey(NEW_PASSWORD),
              pwEncKey: encryptor.derivePwEncKey(NEW_PASSWORD),
              authKeyPair: encryptor.deriveAuthKeyPair(NEW_PASSWORD),
            });

          await baseMessenger.call(
            'SeedlessOnboardingController:changePassword',
            NEW_PASSWORD,
            MOCK_PASSWORD,
          );

          // The re-wrap reads the recovery-keys item with the new TOPRF1 key.
          expect(fetchSpy).toHaveBeenCalledTimes(1);
          expect(fetchSpy.mock.calls[0][0].decKey).toStrictEqual(
            encryptor.deriveEncKey(NEW_PASSWORD),
          );
          const [{ newPassword, transformDataItems }] =
            changeEncKeySpy.mock.calls[0];
          expect(newPassword).toBe(NEW_PASSWORD);
          const seedPhraseData = new SecretMetadata(MOCK_SEED_PHRASE, {
            timestamp: 1,
          }).toBytes();
          const recoveryKeysData = serializeRecoveryKeysItem(
            createRandomRecoveryKeys(),
            2,
          );
          expect(
            transformDataItems?.([
              {
                itemId: WrappedKeysItemId.WrappedRecovery,
                data: recoveryKeysData,
                version: 'v2',
                dataType: EncAccountDataType.WrappedKeys,
              },
              { itemId: 'server-item-1', data: seedPhraseData, version: 'v1' },
            ]),
          ).toStrictEqual([
            { data: seedPhraseData, dataType: undefined, version: 'v1' },
            {
              data: recoveryKeysData,
              dataType: EncAccountDataType.WrappedKeys,
              version: 'v2',
              itemId: WrappedKeysItemId.WrappedRecovery,
            },
          ]);
        });
      });
    });

    describe('changePassword re-wrap', () => {
      const NEW_PASSWORD = 'new-mock-password';

      /**
       * Mocks `changeEncKey` to return the key set of NEW_PASSWORD.
       *
       * @param toprfClient - The ToprfSecureBackup instance.
       * @returns The new TOPRF1 key set.
       */
      function mockPasswordChange(
        toprfClient: ToprfSecureBackup,
      ): WrappedKeySet {
        const encryptor = createMockToprfEncryptor();
        const newKeySet: WrappedKeySet = {
          encKey: encryptor.deriveEncKey(NEW_PASSWORD),
          pwEncKey: encryptor.derivePwEncKey(NEW_PASSWORD),
          authKeyPair: encryptor.deriveAuthKeyPair(NEW_PASSWORD),
        };
        vi.spyOn(toprfClient, 'changeEncKey').mockResolvedValue(newKeySet);
        return newKeySet;
      }

      /**
       * Mocks `fetchAllSecretDataItems`, answering by decryption key.
       *
       * @param toprfClient - The ToprfSecureBackup instance.
       * @param namespaces - The items per decryption key.
       * @returns The spy.
       */
      function mockNamespaces(
        toprfClient: ToprfSecureBackup,
        namespaces: { decKey: Uint8Array; items: Uint8Array[] }[],
      ): MockInstance {
        return vi
          .spyOn(toprfClient, 'fetchAllSecretDataItems')
          .mockImplementation(async ({ decKey }) => {
            const namespace = namespaces.find(
              (candidate) =>
                bytesToHex(candidate.decKey) === bytesToHex(decKey),
            );
            if (!namespace) {
              throw new Error('unexpected namespace');
            }
            return toFetchedItems(namespace.items);
          });
      }

      it('writes the new TOPRF1 keys to the wrapped-keys item when recovery is enabled', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          await authenticateAal2(
            { toprfClient, baseMessenger },
            { hasRecoveryShare: true },
          );
          const recoveryKeys = createRandomRecoveryKeys();
          const newKeySet = mockPasswordChange(toprfClient);
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: getVaultKeySet().authKeyPair.pk,
          });
          mockNamespaces(toprfClient, [
            {
              decKey: newKeySet.encKey,
              items: recoveryKeysItem(recoveryKeys),
            },
          ]);
          const addSpy = vi
            .spyOn(toprfClient, 'addSecretDataItem')
            .mockResolvedValue();

          await baseMessenger.call(
            'SeedlessOnboardingController:changePassword',
            NEW_PASSWORD,
            MOCK_PASSWORD,
          );

          expect(addSpy).toHaveBeenCalledTimes(1);
          const [{ encKey, authKeyPair, secretData }] = addSpy.mock
            .calls[0] as [
            {
              encKey: Uint8Array;
              authKeyPair: KeyPair;
              secretData: Uint8Array;
            },
          ];
          expect(encKey).toStrictEqual(recoveryKeys.recoveryEncKey);
          expect(authKeyPair).toStrictEqual(recoveryKeys.recoveryAuthKeyPair);
          expect(parseWrappedKeys(secretData)).toStrictEqual([newKeySet]);

          // The stored wrap now matches the live key, so the status is Enabled.
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: newKeySet.authKeyPair.pk,
            recovery: recoveryKeys.recoveryAuthKeyPair.pk,
          });
          mockNamespaces(toprfClient, [
            {
              decKey: newKeySet.encKey,
              items: recoveryKeysItem(recoveryKeys),
            },
            {
              decKey: recoveryKeys.recoveryEncKey,
              items: [secretData],
            },
          ]);
          expect(
            await baseMessenger.call(
              'SeedlessOnboardingController:getRecoveryStatus',
            ),
          ).toStrictEqual({
            status: 'Enabled',
            verified: true,
            hasRecoveryShare: true,
          });
        });
      });

      it('writes the new TOPRF1 keys to the wrapped-keys item without an aal2 set', async () => {
        await withUnlockedController(
          async ({ controller, toprfClient, baseMessenger }) => {
            expect(controller.state.recoverySession).toBeUndefined();
            const recoveryKeys = createRandomRecoveryKeys();
            const newKeySet = mockPasswordChange(toprfClient);
            const fetchAuthPubKeySpy = mockRecoveryFetchAuthPubKey(
              toprfClient,
              {
                password: getVaultKeySet().authKeyPair.pk,
              },
            );
            mockNamespaces(toprfClient, [
              {
                decKey: newKeySet.encKey,
                items: recoveryKeysItem(recoveryKeys),
              },
            ]);
            const addSpy = vi
              .spyOn(toprfClient, 'addSecretDataItem')
              .mockResolvedValue();

            await baseMessenger.call(
              'SeedlessOnboardingController:changePassword',
              NEW_PASSWORD,
              MOCK_PASSWORD,
            );

            expect(recoveryCalls(fetchAuthPubKeySpy)).toHaveLength(0);
            expect(addSpy).toHaveBeenCalledTimes(1);
            const [{ encKey, authKeyPair, secretData }] = addSpy.mock
              .calls[0] as [
              {
                encKey: Uint8Array;
                authKeyPair: KeyPair;
                secretData: Uint8Array;
              },
            ];
            expect(encKey).toStrictEqual(recoveryKeys.recoveryEncKey);
            expect(authKeyPair).toStrictEqual(recoveryKeys.recoveryAuthKeyPair);
            expect(parseWrappedKeys(secretData)).toStrictEqual([newKeySet]);
          },
        );
      });

      it('does not write a wrapped-keys item when MFA recovery is not enabled', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          const newKeySet = mockPasswordChange(toprfClient);
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: getVaultKeySet().authKeyPair.pk,
          });
          mockNamespaces(toprfClient, [
            {
              decKey: newKeySet.encKey,
              items: [new SecretMetadata(MOCK_SEED_PHRASE).toBytes()],
            },
          ]);
          const addSpy = vi
            .spyOn(toprfClient, 'addSecretDataItem')
            .mockResolvedValue();

          expect(
            await baseMessenger.call(
              'SeedlessOnboardingController:changePassword',
              NEW_PASSWORD,
              MOCK_PASSWORD,
            ),
          ).toBeUndefined();
          expect(addSpy).not.toHaveBeenCalled();
        });
      });

      it('still resolves and leaves the wrap stale when writing the wrapped-keys item fails', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          await authenticateAal2(
            { toprfClient, baseMessenger },
            { hasRecoveryShare: true },
          );
          const recoveryKeys = createRandomRecoveryKeys();
          const oldKeySet = getVaultKeySet();
          const newKeySet = mockPasswordChange(toprfClient);
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: oldKeySet.authKeyPair.pk,
          });
          mockNamespaces(toprfClient, [
            {
              decKey: newKeySet.encKey,
              items: recoveryKeysItem(recoveryKeys),
            },
          ]);
          vi.spyOn(toprfClient, 'addSecretDataItem').mockRejectedValue(
            new Error('write failed'),
          );

          expect(
            await baseMessenger.call(
              'SeedlessOnboardingController:changePassword',
              NEW_PASSWORD,
              MOCK_PASSWORD,
            ),
          ).toBeUndefined();

          // Only the wrap from before the change remains.
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: newKeySet.authKeyPair.pk,
            recovery: recoveryKeys.recoveryAuthKeyPair.pk,
          });
          mockNamespaces(toprfClient, [
            {
              decKey: newKeySet.encKey,
              items: recoveryKeysItem(recoveryKeys),
            },
            {
              decKey: recoveryKeys.recoveryEncKey,
              items: [serializeWrappedKeys([oldKeySet])],
            },
          ]);
          expect(
            await baseMessenger.call(
              'SeedlessOnboardingController:getRecoveryStatus',
            ),
          ).toStrictEqual({
            status: 'WrapStale',
            verified: true,
            hasRecoveryShare: true,
          });
        });
      });

      it('still resolves without writing when reading the recovery-keys item fails', async () => {
        await withUnlockedController(async ({ toprfClient, baseMessenger }) => {
          mockPasswordChange(toprfClient);
          mockRecoveryFetchAuthPubKey(toprfClient, {
            password: getVaultKeySet().authKeyPair.pk,
          });
          vi.spyOn(toprfClient, 'fetchAllSecretDataItems').mockRejectedValue(
            new Error('fetch failed'),
          );
          const addSpy = vi
            .spyOn(toprfClient, 'addSecretDataItem')
            .mockResolvedValue();

          expect(
            await baseMessenger.call(
              'SeedlessOnboardingController:changePassword',
              NEW_PASSWORD,
              MOCK_PASSWORD,
            ),
          ).toBeUndefined();
          expect(addSpy).not.toHaveBeenCalled();
        });
      });
    });

    describe('restore with the recovery secret', () => {
      const NEW_PASSWORD = 'new-mock-password';

      /**
       * Derives the TOPRF1 key set of NEW_PASSWORD.
       *
       * @returns The new key set.
       */
      function getNewKeySet(): WrappedKeySet {
        const encryptor = createMockToprfEncryptor();
        return {
          encKey: encryptor.deriveEncKey(NEW_PASSWORD),
          pwEncKey: encryptor.derivePwEncKey(NEW_PASSWORD),
          authKeyPair: encryptor.deriveAuthKeyPair(NEW_PASSWORD),
        };
      }

      /**
       * Runs the callback with a fresh-device controller: authenticated at
       * aal1, no vault.
       *
       * @param fn - The callback.
       * @returns Whatever the callback returns.
       */
      async function withFreshDeviceController<ReturnValue>(
        fn: Parameters<typeof withController<ReturnValue>>[1],
      ): Promise<ReturnValue> {
        return await withController(
          {
            state: getMockInitialControllerState({
              withMockAuthenticatedUser: true,
            }),
          },
          fn,
        );
      }

      /**
       * Mocks the remote side of a restore. The live TOPRF1 key is the vault
       * key set of MOCK_PASSWORD (the forgotten password).
       *
       * @param toprfClient - The ToprfSecureBackup instance.
       * @param options - The options.
       * @param options.wrappedKeySets - The wrapped-keys items, one key set
       * list per item. Defaults to one item wrapping the live key set.
       * @param options.rateLimitResetResult - The rate limit reset result.
       * @returns The recovery keys, the live and new key sets, and the spies.
       */
      function mockRestore(
        toprfClient: ToprfSecureBackup,
        {
          wrappedKeySets = [[getVaultKeySet()]],
          rateLimitResetResult = Promise.resolve(),
        }: {
          wrappedKeySets?: WrappedKeySet[][];
          rateLimitResetResult?: Promise<void>;
        } = {},
      ): {
        recoveryKeys: RecoveryKeys;
        liveKeySet: WrappedKeySet;
        newKeySet: WrappedKeySet;
        recoverSpy: MockInstance;
        fetchAuthPubKeySpy: MockInstance;
        changeEncKeySpy: MockInstance;
        addSpy: MockInstance;
      } {
        const liveKeySet = getVaultKeySet();
        const newKeySet = getNewKeySet();
        const recovery = createLocalKeyResult();
        const recoveryKeys: RecoveryKeys = {
          recoveryEncKey: recovery.encKey,
          recoveryAuthKeyPair: recovery.authKeyPair,
        };
        const recoverSpy = vi
          .spyOn(toprfClient, 'recoverEncKey')
          .mockResolvedValue({
            encKey: recovery.encKey,
            pwEncKey: recovery.pwEncKey,
            authKeyPair: recovery.authKeyPair,
            rateLimitResetResult,
            keyShareIndex: 1,
          });
        const fetchAuthPubKeySpy = mockRecoveryFetchAuthPubKey(toprfClient, {
          password: liveKeySet.authKeyPair.pk,
        });
        vi.spyOn(toprfClient, 'fetchAllSecretDataItems').mockImplementation(
          async ({ decKey }) => {
            let source: Uint8Array[];
            if (
              bytesToHex(decKey) === bytesToHex(recoveryKeys.recoveryEncKey)
            ) {
              source = wrappedKeySets.map((keySets) =>
                serializeWrappedKeys(keySets),
              );
            } else if (bytesToHex(decKey) === bytesToHex(newKeySet.encKey)) {
              source = recoveryKeysItem(recoveryKeys);
            } else {
              throw new Error('unexpected namespace');
            }
            return toFetchedItems(source);
          },
        );
        const changeEncKeySpy = vi
          .spyOn(toprfClient, 'changeEncKey')
          .mockResolvedValue(newKeySet);
        const addSpy = vi
          .spyOn(toprfClient, 'addSecretDataItem')
          .mockResolvedValue();
        return {
          recoveryKeys,
          liveKeySet,
          newKeySet,
          recoverSpy,
          fetchAuthPubKeySpy,
          changeEncKeySpy,
          addSpy,
        };
      }

      describe('recoverWithRecoverySecret', () => {
        it('evaluates the recovery secret on the recovery verifier with the aal2 set', async () => {
          await withFreshDeviceController(
            async ({ controller, toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { recoverSpy, changeEncKeySpy, addSpy } =
                mockRestore(toprfClient);

              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );

              expect(recoverSpy).toHaveBeenCalledWith({
                ...AAL2_REQUEST,
                password: bytesToHex(RECOVERY_SECRET),
              });
              expect(changeEncKeySpy).not.toHaveBeenCalled();
              expect(addSpy).not.toHaveBeenCalled();
              expect(controller.state.vault).toBeUndefined();
            },
          );
        });

        it('does not fail when resetting the recovery rate limit fails', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              mockRestore(toprfClient, {
                rateLimitResetResult: Promise.reject(new Error('reset failed')),
              });

              expect(
                await baseMessenger.call(
                  'SeedlessOnboardingController:recoverWithRecoverySecret',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).toBeUndefined();
            },
          );
        });

        it('throws VaultAlreadyExists on a device that holds a vault', async () => {
          await withUnlockedController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { recoverSpy } = mockRestore(toprfClient);

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:recoverWithRecoverySecret',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.VaultAlreadyExists,
              );
              expect(recoverSpy).not.toHaveBeenCalled();
            },
          );
        });

        it('throws when the user is not authenticated at aal1', async () => {
          await withController(async ({ toprfClient, baseMessenger }) => {
            const { recoverSpy } = mockRestore(toprfClient);

            await expect(
              baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              ),
            ).rejects.toThrow(
              SeedlessOnboardingControllerErrorMessage.MissingAuthUserInfo,
            );
            expect(recoverSpy).not.toHaveBeenCalled();
          });
        });

        it('throws Aal2Required without an aal2 set', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              const { recoverSpy } = mockRestore(toprfClient);

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:recoverWithRecoverySecret',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.Aal2Required,
              );
              expect(recoverSpy).not.toHaveBeenCalled();
            },
          );
        });

        it('throws Aal2Required and clears the aal2 set when the nodes reject it', async () => {
          await withFreshDeviceController(
            async ({ controller, toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              mockRestore(toprfClient);
              vi.spyOn(toprfClient, 'recoverEncKey').mockRejectedValue(
                new TOPRFError(TOPRFErrorCode.AuthTokenExpired, 'expired'),
              );

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:recoverWithRecoverySecret',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.Aal2Required,
              );
              expect(controller.state.recoverySession).toBeUndefined();
            },
          );
        });

        it('throws RecoveryNotEnabled without evaluating when the nodes hold no recovery share', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: false },
              );
              const { recoverSpy } = mockRestore(toprfClient);

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:recoverWithRecoverySecret',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.RecoveryNotEnabled,
              );
              expect(recoverSpy).not.toHaveBeenCalled();
            },
          );
        });

        it('throws IncorrectPassword when the recovery secret is wrong', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              mockRestore(toprfClient);
              vi.spyOn(toprfClient, 'recoverEncKey').mockRejectedValue(
                new TOPRFError(
                  TOPRFErrorCode.CouldNotDeriveEncryptionKey,
                  'could not derive',
                ),
              );

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:recoverWithRecoverySecret',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.IncorrectPassword,
              );
            },
          );
        });

        it('throws RecoveryNotEnabled when there is no wrapped-keys item', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              mockRestore(toprfClient, { wrappedKeySets: [] });

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:recoverWithRecoverySecret',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.RecoveryNotEnabled,
              );
            },
          );
        });

        it('throws RecoveryWrapStale when no wrapped key set is the live key', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { changeEncKeySpy } = mockRestore(toprfClient, {
                wrappedKeySets: [[getNewKeySet()]],
              });

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:recoverWithRecoverySecret',
                  { recoverySecret: RECOVERY_SECRET },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.RecoveryWrapStale,
              );
              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                  { newPassword: NEW_PASSWORD },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.NoPendingRecovery,
              );
              expect(changeEncKeySpy).not.toHaveBeenCalled();
            },
          );
        });
      });

      describe('resetPasswordWithRecoveredKeys', () => {
        it('resets the global password with the recovered keys, creates the vault and returns the secrets', async () => {
          await withFreshDeviceController(
            async ({ controller, toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const {
                recoveryKeys,
                liveKeySet,
                newKeySet,
                changeEncKeySpy,
                addSpy,
              } = mockRestore(toprfClient);

              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );
              const secrets = await baseMessenger.call(
                'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                { newPassword: NEW_PASSWORD },
              );

              expect(changeEncKeySpy).toHaveBeenCalledWith({
                nodeAuthTokens: controller.state.nodeAuthTokens,
                authConnectionId: controller.state.authConnectionId,
                groupedAuthConnectionId:
                  controller.state.groupedAuthConnectionId,
                userId: controller.state.userId,
                oldEncKey: liveKeySet.encKey,
                oldPwEncKey: liveKeySet.pwEncKey,
                oldAuthKeyPair: liveKeySet.authKeyPair,
                newKeyShareIndex: 1,
                newPassword: NEW_PASSWORD,
                transformDataItems: expect.any(Function),
              });

              expect(controller.state.vault).toBeDefined();
              expect(controller.state.authPubKey).toBe(
                bytesToBase64(newKeySet.authKeyPair.pk),
              );
              expect(
                await controller.verifyVaultPassword(NEW_PASSWORD),
              ).toBeUndefined();

              expect(addSpy).toHaveBeenCalledTimes(1);
              const [{ encKey, authKeyPair, secretData }] = addSpy.mock
                .calls[0] as [
                {
                  encKey: Uint8Array;
                  authKeyPair: KeyPair;
                  secretData: Uint8Array;
                },
              ];
              expect(encKey).toStrictEqual(recoveryKeys.recoveryEncKey);
              expect(authKeyPair).toStrictEqual(
                recoveryKeys.recoveryAuthKeyPair,
              );
              expect(parseWrappedKeys(secretData)).toStrictEqual([newKeySet]);

              expect(secrets).toHaveLength(1);
              expect(secrets[0].data).toStrictEqual(MOCK_SEED_PHRASE);

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                  { newPassword: NEW_PASSWORD },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.NoPendingRecovery,
              );
            },
          );
        });

        it('picks the live key set when the wrapped-keys item holds several', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const staleKeySet = createLocalKeyResult('stale-password');
              const { liveKeySet, changeEncKeySpy } = mockRestore(toprfClient, {
                wrappedKeySets: [[staleKeySet, getVaultKeySet()]],
              });

              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );
              await baseMessenger.call(
                'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                { newPassword: NEW_PASSWORD },
              );

              expect(changeEncKeySpy).toHaveBeenCalledWith(
                expect.objectContaining({
                  oldEncKey: liveKeySet.encKey,
                  oldPwEncKey: liveKeySet.pwEncKey,
                  oldAuthKeyPair: liveKeySet.authKeyPair,
                }),
              );
            },
          );
        });

        it('does not need a valid aal2 set', async () => {
          await withFreshDeviceController(
            async ({ controller, toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { changeEncKeySpy } = mockRestore(toprfClient);
              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );
              controller.update((state) => {
                delete state.recoverySession;
              });

              const secrets = await baseMessenger.call(
                'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                { newPassword: NEW_PASSWORD },
              );

              expect(changeEncKeySpy).toHaveBeenCalledTimes(1);
              expect(secrets).toHaveLength(1);
            },
          );
        });

        it('still resolves when writing the wrapped-keys item fails', async () => {
          await withFreshDeviceController(
            async ({ controller, toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { addSpy } = mockRestore(toprfClient);
              addSpy.mockRejectedValue(new Error('write failed'));
              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );

              const secrets = await baseMessenger.call(
                'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                { newPassword: NEW_PASSWORD },
              );

              expect(addSpy).toHaveBeenCalledTimes(1);
              expect(secrets).toHaveLength(1);
              expect(controller.state.vault).toBeDefined();
            },
          );
        });

        it('throws FailedToChangePassword and keeps the recovered keys when the key change fails', async () => {
          await withFreshDeviceController(
            async ({ controller, toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { changeEncKeySpy } = mockRestore(toprfClient);
              changeEncKeySpy.mockRejectedValueOnce(new Error('change failed'));
              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                  { newPassword: NEW_PASSWORD },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.FailedToChangePassword,
              );
              expect(controller.state.vault).toBeUndefined();

              const secrets = await baseMessenger.call(
                'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                { newPassword: NEW_PASSWORD },
              );
              expect(secrets).toHaveLength(1);
            },
          );
        });

        it('throws RecoveryWrapStale and drops the recovered keys when the live key changed between the steps', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { changeEncKeySpy } = mockRestore(toprfClient);
              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );
              mockRecoveryFetchAuthPubKey(toprfClient, {
                password: createRandomKeyPair().pk,
              });

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                  { newPassword: NEW_PASSWORD },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.RecoveryWrapStale,
              );
              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                  { newPassword: NEW_PASSWORD },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.NoPendingRecovery,
              );
              expect(changeEncKeySpy).not.toHaveBeenCalled();
            },
          );
        });

        it('refreshes the aal1 tokens and retries when the key change hits an expired token', async () => {
          await withFreshDeviceController(
            async ({ controller, toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { changeEncKeySpy } = mockRestore(toprfClient);
              changeEncKeySpy.mockRejectedValueOnce(
                new TOPRFError(TOPRFErrorCode.AuthTokenExpired, 'expired'),
              );
              const refreshSpy = vi
                .spyOn(controller, 'refreshAuthTokens')
                .mockResolvedValue();
              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );

              const secrets = await baseMessenger.call(
                'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                { newPassword: NEW_PASSWORD },
              );

              expect(refreshSpy).toHaveBeenCalledTimes(1);
              expect(changeEncKeySpy).toHaveBeenCalledTimes(2);
              expect(secrets).toHaveLength(1);
            },
          );
        });

        it('rejects an empty new password before changing the global key', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { changeEncKeySpy } = mockRestore(toprfClient);
              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                  { newPassword: '' },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.InvalidEmptyPassword,
              );
              expect(changeEncKeySpy).not.toHaveBeenCalled();

              const secrets = await baseMessenger.call(
                'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                { newPassword: NEW_PASSWORD },
              );
              expect(secrets).toHaveLength(1);
            },
          );
        });

        it('throws NoPendingRecovery without a prior recoverWithRecoverySecret', async () => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              const { changeEncKeySpy } = mockRestore(toprfClient);

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                  { newPassword: NEW_PASSWORD },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.NoPendingRecovery,
              );
              expect(changeEncKeySpy).not.toHaveBeenCalled();
            },
          );
        });

        it.each([
          [
            'setLocked',
            async (baseMessenger: RootMessenger): Promise<void> =>
              await baseMessenger.call(
                'SeedlessOnboardingController:setLocked',
              ),
          ],
          [
            'clearState',
            async (baseMessenger: RootMessenger): Promise<void> =>
              baseMessenger.call('SeedlessOnboardingController:clearState'),
          ],
        ])('throws NoPendingRecovery after %s', async (_name, clear) => {
          await withFreshDeviceController(
            async ({ toprfClient, baseMessenger }) => {
              await authenticateAal2(
                { toprfClient, baseMessenger },
                { hasRecoveryShare: true },
              );
              const { changeEncKeySpy } = mockRestore(toprfClient);
              await baseMessenger.call(
                'SeedlessOnboardingController:recoverWithRecoverySecret',
                { recoverySecret: RECOVERY_SECRET },
              );

              await clear(baseMessenger);

              await expect(
                baseMessenger.call(
                  'SeedlessOnboardingController:resetPasswordWithRecoveredKeys',
                  { newPassword: NEW_PASSWORD },
                ),
              ).rejects.toThrow(
                SeedlessOnboardingControllerErrorMessage.NoPendingRecovery,
              );
              expect(changeEncKeySpy).not.toHaveBeenCalled();
            },
          );
        });
      });
    });
  });
});
