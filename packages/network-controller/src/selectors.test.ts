import {
  FeatureFlags,
  RemoteFeatureFlagControllerState,
} from '@metamask/remote-feature-flag-controller';
import { describe, expect, it } from 'vitest';

import {
  RPC_FAILOVER_MODES,
  selectRpcFailoverModeFeatureFlag,
} from './selectors.js';

/**
 * Builds RemoteFeatureFlagController state, filling in the given feature flags.
 *
 * @param remoteFeatureFlags - The remote feature flags.
 * @returns The RemoteFeatureFlagController state object.
 */
function buildRemoteFeatureFlagControllerState(
  remoteFeatureFlags: FeatureFlags,
): RemoteFeatureFlagControllerState {
  return {
    remoteFeatureFlags,
    cacheTimestamp: 0,
  };
}

describe('selectRpcFailoverModeFeatureFlag', () => {
  it.each(RPC_FAILOVER_MODES)(
    'returns "%s" when the corePlatformRpcFailoverMode flag is "%s"',
    (flagValue) => {
      const state = buildRemoteFeatureFlagControllerState({
        remoteFeatureFlags: {
          corePlatformRpcFailoverMode: flagValue,
        },
      });

      expect(selectRpcFailoverModeFeatureFlag(state)).toBeNull();
    },
  );

  it('returns null when the corePlatformRpcFailoverMode flag is absent', () => {
    const state = buildRemoteFeatureFlagControllerState({
      remoteFeatureFlags: {},
    });

    expect(selectRpcFailoverModeFeatureFlag(state)).toBeNull();
  });

  it('returns null when the corePlatformRpcFailoverMode flag is an unrecognized value', () => {
    const state = buildRemoteFeatureFlagControllerState({
      remoteFeatureFlags: {
        corePlatformRpcFailoverMode: 'something-unrecognized',
      },
    });

    expect(selectRpcFailoverModeFeatureFlag(state)).toBeNull();
  });
});
