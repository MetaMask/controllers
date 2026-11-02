import type { InternalAccount } from '@metamask/keyring-internal-api';
import { describe, expect, it } from 'vitest';

import type { AssetsControllerState } from './AssetsController.js';
import {
  captureAssetsFetchTracking,
  registerAssetsBackgroundFetch,
  trackAssetsLoading,
} from './trackAssetsLoading.js';

type FakeControllerState = Pick<
  AssetsControllerState,
  'assetsLoadingStatus' | 'assetsRefreshingStatus'
>;

const ACCOUNT_1: InternalAccount = {
  id: 'account-1',
  address: '0x1234567890123456789012345678901234567890',
  options: {},
  methods: [],
  type: 'eip155:eoa',
  scopes: ['eip155:1'],
  metadata: {
    name: 'Test Account 1',
    keyring: { type: 'HD Key Tree' },
    importTime: 0,
    lastSelected: 0,
  },
};

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

const ACCOUNT_2: InternalAccount = {
  ...ACCOUNT_1,
  id: 'account-2',
  metadata: { ...ACCOUNT_1.metadata, name: 'Test Account 2' },
};

type FetchOptions = {
  forceUpdate?: boolean;
  fail?: boolean;
  deferBackground?: boolean;
  failBackground?: boolean;
};

/**
 * Minimal stand-in for the controller: just the state and `update` the
 * decorator needs, with a fetch method that stays in flight until released.
 */
class FakeAssetsController {
  readonly holds: (() => void)[] = [];

  readonly backgroundReleases: (() => void)[] = [];

  state: FakeControllerState = {};

  update(callback: (state: FakeControllerState) => void): void {
    callback(this.state);
  }

  /**
   * Let the oldest fetch that is still in flight finish.
   */
  releaseNextFetch(): void {
    const resolve = this.holds.shift();
    resolve?.();
  }

  /**
   * Let the oldest background fetch finish.
   */
  releaseNextBackground(): void {
    const resolve = this.backgroundReleases.shift();
    resolve?.();
  }

  @trackAssetsLoading
  async getAssets(
    _accounts: InternalAccount[],
    options?: FetchOptions,
  ): Promise<void> {
    const trackingToken = captureAssetsFetchTracking(this);
    if (options?.deferBackground) {
      registerAssetsBackgroundFetch(
        trackingToken,
        new Promise<void>((resolve, reject) => {
          this.backgroundReleases.push(() => {
            if (options.failBackground) {
              reject(new Error('background failed'));
              return;
            }
            resolve();
          });
        }),
      );
    }
    if (options?.fail) {
      throw new Error('fetch failed');
    }
    await new Promise<void>((resolve) => {
      this.holds.push(resolve);
    });
  }
}

describe('trackAssetsLoading', () => {
  it('marks accounts as loading while the fetch is in flight and loaded once it settles', async () => {
    const controller = new FakeAssetsController();
    const fetchPromise = controller.getAssets([ACCOUNT_1, ACCOUNT_2], {
      forceUpdate: true,
    });

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loading',
      [ACCOUNT_2.id]: 'loading',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'refreshing',
      [ACCOUNT_2.id]: 'refreshing',
    });
    controller.releaseNextFetch();
    await fetchPromise;

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
      [ACCOUNT_2.id]: 'loaded',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'idle',
      [ACCOUNT_2.id]: 'idle',
    });
  });

  it('settles the loading status when the fetch fails', async () => {
    const controller = new FakeAssetsController();

    await expect(
      controller.getAssets([ACCOUNT_1], { forceUpdate: true, fail: true }),
    ).rejects.toThrow('fetch failed');

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'idle',
    });
  });

  it('does not re-mark a settled account, so a later refresh never re-toggles it', async () => {
    const controller = new FakeAssetsController();
    const firstFetch = controller.getAssets([ACCOUNT_1], {
      forceUpdate: true,
    });
    controller.releaseNextFetch();
    await firstFetch;

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
    });

    // A later forced refresh of the settled account is not re-marked as loading.
    const refreshFetch = controller.getAssets([ACCOUNT_1], {
      forceUpdate: true,
    });

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'refreshing',
    });

    controller.releaseNextFetch();
    await refreshFetch;

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'idle',
    });
  });

  it('marks only accounts that have never settled within a fetch', async () => {
    const controller = new FakeAssetsController();
    const firstFetch = controller.getAssets([ACCOUNT_1], {
      forceUpdate: true,
    });
    controller.releaseNextFetch();
    await firstFetch;

    const mixedFetch = controller.getAssets([ACCOUNT_1, ACCOUNT_2], {
      forceUpdate: true,
    });

    // ACCOUNT_1 is settled and stays loaded; ACCOUNT_2 is on its first fetch.
    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
      [ACCOUNT_2.id]: 'loading',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'refreshing',
      [ACCOUNT_2.id]: 'refreshing',
    });

    controller.releaseNextFetch();
    await mixedFetch;

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
      [ACCOUNT_2.id]: 'loaded',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'idle',
      [ACCOUNT_2.id]: 'idle',
    });
  });

  it('does not mark anything when there are no accounts', async () => {
    const controller = new FakeAssetsController();
    const fetchPromise = controller.getAssets([], { forceUpdate: true });

    expect(controller.state.assetsLoadingStatus).toBeUndefined();
    expect(controller.state.assetsRefreshingStatus).toBeUndefined();

    controller.releaseNextFetch();
    await fetchPromise;

    expect(controller.state.assetsLoadingStatus).toBeUndefined();
    expect(controller.state.assetsRefreshingStatus).toBeUndefined();
  });

  it('does not track calls that do not force an update', async () => {
    const controller = new FakeAssetsController();
    const fetchPromise = controller.getAssets([ACCOUNT_1]);

    expect(controller.state.assetsLoadingStatus).toBeUndefined();
    expect(controller.state.assetsRefreshingStatus).toBeUndefined();

    controller.releaseNextFetch();
    await fetchPromise;

    expect(controller.state.assetsLoadingStatus).toBeUndefined();
    expect(controller.state.assetsRefreshingStatus).toBeUndefined();
  });

  it('keeps both flags active until a registered background fetch settles', async () => {
    const controller = new FakeAssetsController();
    const fetchPromise = controller.getAssets([ACCOUNT_1], {
      forceUpdate: true,
      deferBackground: true,
    });

    controller.releaseNextFetch();
    await fetchPromise;

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loading',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'refreshing',
    });

    controller.releaseNextBackground();
    await flushMicrotasks();

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'idle',
    });
  });

  it('settles both flags when the background fetch fails', async () => {
    const controller = new FakeAssetsController();
    const fetchPromise = controller.getAssets([ACCOUNT_1], {
      forceUpdate: true,
      deferBackground: true,
      failBackground: true,
    });

    controller.releaseNextFetch();
    await fetchPromise;
    controller.releaseNextBackground();
    await flushMicrotasks();

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'idle',
    });
  });

  it('does not let an older background fetch settle a newer refresh', async () => {
    const controller = new FakeAssetsController();
    const firstFetch = controller.getAssets([ACCOUNT_1], {
      forceUpdate: true,
      deferBackground: true,
    });
    controller.releaseNextFetch();
    await firstFetch;

    const secondFetch = controller.getAssets([ACCOUNT_1], {
      forceUpdate: true,
      deferBackground: true,
    });
    controller.releaseNextFetch();
    await secondFetch;

    controller.releaseNextBackground();
    await flushMicrotasks();

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loading',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'refreshing',
    });

    controller.releaseNextBackground();
    await flushMicrotasks();

    expect(controller.state.assetsLoadingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'loaded',
    });
    expect(controller.state.assetsRefreshingStatus).toStrictEqual({
      [ACCOUNT_1.id]: 'idle',
    });
  });
});
