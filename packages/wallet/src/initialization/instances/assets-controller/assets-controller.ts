import { AssetsController } from '@metamask/assets-controller';
import type { AssetsControllerMessenger } from '@metamask/assets-controller';
import { Messenger } from '@metamask/messenger';

import type { InitializationConfiguration } from '../../types.js';

export type { AssetsControllerInstanceOptions } from './types.js';

/**
 * Initialization configuration for `AssetsController`.
 *
 * The controller's constructor does not call other controllers, so the
 * Wallet can construct it before controllers it depends on that are not
 * Wallet defaults yet, such as `AccountTreeController` and `SnapController`.
 *
 * Asset tracking does not start on its own. Once the client has registered
 * and initialized those controllers, it must call `AssetsController:start`
 * (or `AssetsController.start()`). That reads enabled networks, creates the
 * data sources and subscribes to external events.
 */
export const assetsController: InitializationConfiguration<
  AssetsController,
  AssetsControllerMessenger
> = {
  name: 'AssetsController',
  reference: AssetsController,
  init: ({ state, messenger, options }) =>
    new AssetsController({
      ...options,
      messenger,
      state,
    }),
  getMessenger: (parent) => {
    const messenger: AssetsControllerMessenger = new Messenger({
      namespace: 'AssetsController',
      parent,
    });

    parent.delegate({
      messenger,
      actions: [
        'AccountsController:getSelectedAccount',
        'AccountTreeController:getAccountsFromSelectedAccountGroup',
        'AccountTreeController:isInitialized',
        'ClientController:getState',
        'ConfigRegistryController:getNetworkConfigByCaip2ChainId',
        'KeyringController:isUnlocked',
        'NetworkController:getNetworkClientById',
        'NetworkController:getState',
        'NetworkEnablementController:getState',
        'PermissionController:getPermissions',
        'PhishingController:bulkScanTokens',
        'RemoteFeatureFlagController:getState',
        'SnapController:getRunnableSnaps',
        'SnapController:handleRequest',
      ],
      events: [
        'AccountActivityService:balanceUpdated',
        'AccountActivityService:statusChanged',
        'AccountsController:accountBalancesUpdated',
        'AccountTreeController:initialized',
        'AccountTreeController:selectedAccountGroupChange',
        'AccountTreeController:uninitialized',
        'ClientController:stateChange',
        'KeyringController:lock',
        'KeyringController:unlock',
        'MultichainTransactionsController:transactionConfirmed',
        'NetworkController:networkAdded',
        'NetworkController:networkDidChange',
        'NetworkController:networkRemoved',
        'NetworkController:stateChange',
        'NetworkEnablementController:stateChange',
        'PermissionController:stateChange',
        'PreferencesController:stateChange',
        'RemoteFeatureFlagController:stateChange',
        'SnapController:snapInstalled',
        'TransactionController:transactionConfirmed',
        'TransactionController:unapprovedTransactionAdded',
      ],
    });

    return messenger;
  },
};
