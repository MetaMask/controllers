import type { IntentEntry } from '@metamask/chomp-api-service';
import { createDeferredPromise } from '@metamask/utils';
import type { Hex } from '@metamask/utils';
import { describe, it, expect } from 'vitest';

import {
  MONEY_ACCOUNT_ADDRESS,
  MONEY_ACCOUNT_KEY,
  SFA_IDENTITY,
  MFA_IDENTITY,
  MFA_ACCOUNT_ADDRESS,
  MIGRATING_IDENTITY,
  getLifecycle,
  withController,
} from '../tests/helpers.js';

describe('MoneyAccountLifecycleController', () => {
  describe('startMigration', () => {
    it('creates an MFA account and stops at the unimplemented migration once the pre-checks pass', async () => {
      await withController(async ({ rootMessenger, mocks }) => {
        await expect(
          rootMessenger.call('MoneyAccountLifecycleController:startMigration'),
        ).rejects.toThrow(
          `Migrating Money Account ${MONEY_ACCOUNT_ADDRESS} to ${MFA_ACCOUNT_ADDRESS} is not implemented yet`,
        );

        expect(mocks.getDerivedIdentities).toHaveBeenCalledTimes(1);
        expect(mocks.createMfaAccount).toHaveBeenCalledTimes(1);
        expect(mocks.getIntentsByAddress).toHaveBeenCalledWith(
          MFA_ACCOUNT_ADDRESS,
        );
        expect(mocks.getMoneyAccount).toHaveBeenCalledWith({
          type: 'mnemonic',
        });
        expect(mocks.getMoneyAccount).not.toHaveBeenCalledWith();
      });
    });

    it('records the freshly fetched identities', async () => {
      await withController(
        {
          options: {
            state: {
              moneyAccounts: {
                [MONEY_ACCOUNT_KEY]: { type: 'sfa', identity: SFA_IDENTITY },
              },
            },
          },
        },
        async ({ controller, mocks }) => {
          mocks.getDerivedIdentities.mockResolvedValue({
            identities: [MIGRATING_IDENTITY],
          });

          await expect(controller.startMigration()).rejects.toThrow(
            'A Money Account identity is already migrating',
          );

          expect(getLifecycle(controller)).toStrictEqual({
            type: 'migrating',
            identity: MIGRATING_IDENTITY,
          });
        },
      );
    });

    it.each([
      { description: 'the money account', identities: [MIGRATING_IDENTITY] },
      {
        description: 'another identity',
        identities: [
          SFA_IDENTITY,
          {
            ...MFA_IDENTITY,
            currentAddress: '0x00000000000000000000000000000000000000ee',
            previousAddresses: [],
            status: 'MIGRATING',
          },
        ],
      },
    ] as const)(
      'does not start a second migration while $description is migrating',
      async ({ identities }) => {
        await withController(async ({ controller, mocks }) => {
          mocks.getDerivedIdentities.mockResolvedValue({
            identities: [...identities],
          });

          await expect(controller.startMigration()).rejects.toThrow(
            'A Money Account identity is already migrating',
          );
          expect(mocks.createMfaAccount).not.toHaveBeenCalled();
        });
      },
    );

    it.each([
      { type: 'notInIdentity', identities: [] },
      { type: 'mfa', identities: [MFA_IDENTITY] },
    ] as const)(
      'does not migrate a money account that is $type',
      async ({ type, identities }) => {
        await withController(async ({ controller, mocks }) => {
          mocks.getDerivedIdentities.mockResolvedValue({
            identities: [...identities],
          });

          await expect(controller.startMigration()).rejects.toThrow(
            `Money Account ${MONEY_ACCOUNT_ADDRESS} cannot be migrated while it is '${type}'`,
          );
          expect(mocks.createMfaAccount).not.toHaveBeenCalled();
        });
      },
    );

    it('throws when there is no money account', async () => {
      await withController(
        { moneyAccountAddress: undefined },
        async ({ controller, mocks }) => {
          await expect(controller.startMigration()).rejects.toThrow(
            'There is no Money Account to migrate',
          );
          expect(mocks.getDerivedIdentities).not.toHaveBeenCalled();
        },
      );
    });

    it.each([
      { description: 'the feature is disabled', isEnabled: false },
      { description: 'the wallet is locked', isUnlocked: false },
      { description: 'there is no HD keyring', hasHdKeyring: false },
    ])('throws when $description', async ({ description, ...gates }) => {
      await withController(gates, async ({ controller, mocks }) => {
        await expect(controller.startMigration()).rejects.toThrow(
          'Money Account migration is not available',
        );
        expect(mocks.getDerivedIdentities).not.toHaveBeenCalled();
      });
    });

    it.each([
      {
        description: 'the current address of an identity',
        identity: {
          ...MFA_IDENTITY,
          currentAddress: MFA_ACCOUNT_ADDRESS.toLowerCase() as Hex,
          previousAddresses: [],
        },
      },
      {
        description: 'a previous address of an identity',
        identity: {
          ...MFA_IDENTITY,
          currentAddress: '0x00000000000000000000000000000000000000ee',
          previousAddresses: [MFA_ACCOUNT_ADDRESS.toLowerCase() as Hex],
        },
      },
    ] as const)(
      'does not migrate to an MFA address that is $description',
      async ({ identity }) => {
        await withController(async ({ controller, mocks }) => {
          mocks.getDerivedIdentities.mockResolvedValue({
            identities: [SFA_IDENTITY, identity],
          });

          await expect(controller.startMigration()).rejects.toThrow(
            `MFA account ${MFA_ACCOUNT_ADDRESS} is already part of a Money Account identity`,
          );
        });
      },
    );

    it('does not migrate to an MFA address that already has intents', async () => {
      await withController(async ({ controller, mocks }) => {
        mocks.getIntentsByAddress.mockResolvedValue([
          { account: MFA_ACCOUNT_ADDRESS } as IntentEntry,
        ]);

        await expect(controller.startMigration()).rejects.toThrow(
          `MFA account ${MFA_ACCOUNT_ADDRESS} already has CHOMP intents`,
        );
      });
    });

    it('does not start a migration while another is in flight, and allows one once it settles', async () => {
      await withController(async ({ controller, mocks }) => {
        const { promise, resolve } = createDeferredPromise<Hex>();
        mocks.createMfaAccount.mockReturnValueOnce(promise);

        const first = controller.startMigration();
        await expect(controller.startMigration()).rejects.toThrow(
          'A Money Account migration is already in progress',
        );
        resolve(MFA_ACCOUNT_ADDRESS);
        await expect(first).rejects.toThrow('is not implemented yet');

        await expect(controller.startMigration()).rejects.toThrow(
          'is not implemented yet',
        );
        expect(mocks.createMfaAccount).toHaveBeenCalledTimes(2);
      });
    });
  });
});
