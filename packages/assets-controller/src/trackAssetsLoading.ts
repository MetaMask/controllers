import type { InternalAccount } from '@metamask/keyring-internal-api';

import type { AssetsController } from './AssetsController.js';
import type {
  AccountId,
  AssetsLoadingStatus,
  AssetsRefreshingStatus,
} from './types.js';

/**
 * The controller surface the loading tracker needs. `update` is spelled out
 * here because it is protected on the controller and so cannot be picked.
 */
type AssetsLoadingStateUpdater = Pick<AssetsController, 'state'> & {
  update: (
    callback: (state: {
      assetsLoadingStatus?: Record<AccountId, AssetsLoadingStatus>;
      assetsRefreshingStatus?: Record<AccountId, AssetsRefreshingStatus>;
    }) => void,
  ) => void;
};

/**
 * One forced `getAssets` call. `epochs` is the per-account generation captured
 * when the call started. A later call for the same account bumps the
 * generation so this call cannot settle the newer one.
 */
export type AssetsFetchTrackingToken = {
  epochs: ReadonlyMap<AccountId, number>;
  backgroundPromises: Promise<unknown>[];
};

const epochsByController = new WeakMap<object, Map<AccountId, number>>();
const pendingTokenByController = new WeakMap<
  object,
  AssetsFetchTrackingToken
>();

/**
 * Mark the accounts for a forced fetch and return the token that call must
 * settle. The token is also stored for `getAssets` to capture synchronously
 * before its first await.
 *
 * @param controller - The controller whose state should be updated.
 * @param accounts - The accounts included in this fetch.
 * @returns The token for this fetch.
 */
export function beginAssetsFetchTracking(
  controller: AssetsLoadingStateUpdater,
  accounts: InternalAccount[],
): AssetsFetchTrackingToken {
  let epochs = epochsByController.get(controller);
  if (!epochs) {
    epochs = new Map();
    epochsByController.set(controller, epochs);
  }

  const callEpochs = new Map<AccountId, number>();
  for (const account of accounts) {
    const nextEpoch = (epochs.get(account.id) ?? 0) + 1;
    epochs.set(account.id, nextEpoch);
    callEpochs.set(account.id, nextEpoch);
  }

  const token: AssetsFetchTrackingToken = {
    epochs: callEpochs,
    backgroundPromises: [],
  };
  pendingTokenByController.set(controller, token);

  controller.update((state) => {
    state.assetsLoadingStatus ??= {};
    state.assetsRefreshingStatus ??= {};
    for (const account of accounts) {
      if (state.assetsLoadingStatus[account.id] === undefined) {
        state.assetsLoadingStatus[account.id] = 'loading';
      }
      state.assetsRefreshingStatus[account.id] = 'refreshing';
    }
  });

  return token;
}

/**
 * Take the tracking token installed for the fetch that is starting now.
 * `getAssets` calls this on entry, before any await, so overlapping fetches
 * each keep the token that belongs to them.
 *
 * @param controller - The controller instance the decorator wrapped.
 * @returns The token for this call, or `undefined` when the call is not tracked.
 */
export function captureAssetsFetchTracking(
  controller: object,
): AssetsFetchTrackingToken | undefined {
  const token = pendingTokenByController.get(controller);
  if (token) {
    pendingTokenByController.delete(controller);
  }
  return token;
}

/**
 * Keep a slow-pipeline promise on the fetch that started it. Settlement waits
 * for every promise registered this way. Calls with no token are not tracked.
 *
 * @param token - The token captured for this fetch.
 * @param promise - The background fetch promise. It must not reject.
 */
export function registerAssetsBackgroundFetch(
  token: AssetsFetchTrackingToken | undefined,
  promise: Promise<unknown>,
): void {
  token?.backgroundPromises.push(promise);
}

/**
 * Settle first-load and refresh status for a fetch. Accounts whose generation
 * has moved on are left alone. When a background fetch was registered, this
 * returns before that work finishes and applies the update once it settles.
 *
 * @param controller - The controller whose state should be updated.
 * @param token - The token returned when the fetch began.
 */
export function settleAssetsFetchTracking(
  controller: AssetsLoadingStateUpdater,
  token: AssetsFetchTrackingToken,
): void {
  const epochs = epochsByController.get(controller);
  const apply = (): void => {
    controller.update((state) => {
      state.assetsLoadingStatus ??= {};
      state.assetsRefreshingStatus ??= {};
      for (const [accountId, epoch] of token.epochs) {
        if (epochs?.get(accountId) !== epoch) {
          continue;
        }
        if (state.assetsLoadingStatus[accountId] === 'loading') {
          state.assetsLoadingStatus[accountId] = 'loaded';
        }
        state.assetsRefreshingStatus[accountId] = 'idle';
      }
    });
  };

  if (token.backgroundPromises.length === 0) {
    apply();
    return;
  }

  void Promise.allSettled(token.backgroundPromises).then(apply);
}

/**
 * Method decorator that tracks per-account fetch status around the decorated
 * fetch method.
 *
 * Accounts whose assets have never been fetched are marked `'loading'` and
 * settle to `'loaded'` once the fast pipeline and any slow pipeline have both
 * finished, whether they succeeded or failed. Accounts that already settled
 * are never re-marked, so later refreshes do not re-toggle first-load status.
 *
 * Every forced fetch also sets `'refreshing'` until that same work settles.
 * Calls that do not force an update are cache reads and are not tracked.
 * `getAssets` still returns after the fast pipeline; the slow pipeline does
 * not delay that return.
 *
 * @param target - The decorated fetch method.
 * @param _context - The decorator context.
 * @returns The wrapped fetch method.
 */
export function trackAssetsLoading<
  This,
  Args extends [InternalAccount[], { forceUpdate?: boolean }?, ...unknown[]],
  Return,
>(
  target: (this: This, ...args: Args) => Promise<Return>,
  _context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Promise<Return>
  >,
): (this: This, ...args: Args) => Promise<Return> {
  return async function (this: This, ...args: Args): Promise<Return> {
    const [accounts, options] = args;
    if (options?.forceUpdate !== true || accounts.length === 0) {
      return target.call(this, ...args);
    }
    const controller = this as unknown as AssetsLoadingStateUpdater;
    const token = beginAssetsFetchTracking(controller, accounts);
    try {
      return await target.call(this, ...args);
    } finally {
      settleAssetsFetchTracking(controller, token);
    }
  };
}
