import { AssetsController } from '@metamask/assets-controller';
import type { AssetsControllerMessenger } from '@metamask/assets-controller';
import { Messenger } from '@metamask/messenger';

import type { InitializationConfiguration } from '../../types.js';

export type { AssetsControllerInstanceOptions } from './types.js';

/**
 * Initialization configuration for `AssetsController`.
 *
 * The controller's constructor only subscribes to messenger events and never
 * calls other controllers, so the Wallet can construct it before controllers
 * it depends on that are not Wallet defaults yet, such as
 * `AccountTreeController` and `SnapController`.
 *
 * The client does not need to start it. The first time the client opens the
 * UI (`ClientController:setUiOpen(true)`, published as
 * `ClientController:stateChange`), the controller reads enabled networks,
 * creates its data sources and starts fetching once the keyring is unlocked
 * and the account tree is initialized. The client must register those
 * controllers before it opens the UI.
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
