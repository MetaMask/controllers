import { AssetsController } from '@metamask/assets-controller';
import type { AssetsControllerMessenger } from '@metamask/assets-controller';
import { Messenger } from '@metamask/messenger';

import type { InitializationConfiguration } from '../../types.js';

export type { AssetsControllerInstanceOptions } from './types.js';

/**
 * Initialization configuration for `AssetsController`.
 *
 * `AccountTreeController` and `SnapController` are not Wallet defaults.
 * Construction does not call them. Account-group reads fall back to
 * `AccountsController` until `AccountTreeController` is registered, and snap
 * discovery leaves snap chains empty until `SnapController` is registered.
 * `AssetsController.init()` reads `NetworkEnablementController` during
 * `Wallet.init()`, after every default controller exists.
 */
export const assetsController: InitializationConfiguration<
  AssetsController,
  AssetsControllerMessenger
> = {
  name: 'AssetsController',
  reference: AssetsController,
  init: ({ state, messenger, options }) => {
    if (!options.queryApiClient) {
      throw new Error(
        'AssetsController requires `instanceOptions.assetsController.queryApiClient`.',
      );
    }

    return new AssetsController({
      ...options,
      messenger,
      state,
    });
  },
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
