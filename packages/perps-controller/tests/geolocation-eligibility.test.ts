import { getDefaultGeolocationControllerState } from '@metamask/geolocation-controller';
import { Messenger, MOCK_ANY_NAMESPACE } from '@metamask/messenger';
import type {
  MockAnyNamespace,
  MessengerActions,
  MessengerEvents,
} from '@metamask/messenger';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { PerpsController } from '../src/PerpsController.js';
import type { PerpsControllerMessenger } from '../src/PerpsController.js';
import type { PerpsPlatformDependencies } from '../src/types/index.js';

vi.mock('@nktkas/hyperliquid', () => ({}));

type RootMessenger = Messenger<
  MockAnyNamespace,
  MessengerActions<PerpsControllerMessenger>,
  MessengerEvents<PerpsControllerMessenger>
>;

const REMOTE_FEATURE_FLAG_STATE = {
  remoteFeatureFlags: {
    perpsPerpTradingGeoBlockedCountriesV2: {
      blockedRegions: ['US'],
    },
  },
  cacheTimestamp: 0,
};

function buildMockInfrastructure(): PerpsPlatformDependencies {
  return {
    logger: { error: vi.fn(), warn: vi.fn() },
    debugLogger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    metrics: {
      trackEvent: vi.fn(),
    } as unknown as PerpsPlatformDependencies['metrics'],
    performance: {
      startTrace: vi.fn(),
      endTrace: vi.fn(),
    } as unknown as PerpsPlatformDependencies['performance'],
    tracer: {
      trace: vi.fn(),
    } as unknown as PerpsPlatformDependencies['tracer'],
    streamManager: {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      pauseChannel: vi.fn(),
      resumeChannel: vi.fn(),
    } as unknown as PerpsPlatformDependencies['streamManager'],
    featureFlags: { validateVersionGated: vi.fn() },
    marketDataFormatters: {
      formatPrice: vi.fn(),
      formatSize: vi.fn(),
    } as unknown as PerpsPlatformDependencies['marketDataFormatters'],
    cacheInvalidator: {
      invalidate: vi.fn(),
    } as unknown as PerpsPlatformDependencies['cacheInvalidator'],
    diskCache: {
      getItem: vi.fn().mockResolvedValue(null),
      getItemSync: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    },
    rewards: { getPerpsDiscountForAccount: vi.fn().mockResolvedValue(0) },
  };
}

type BuildControllerOptions = {
  initialLocation: string;
  deferEligibilityCheck?: boolean;
};

type BuildControllerResult = {
  controller: PerpsController;
  getGeolocation: Mock<() => Promise<string>>;
  publishLocation: (nextLocation: string) => void;
};

function buildController({
  initialLocation,
  deferEligibilityCheck,
}: BuildControllerOptions): BuildControllerResult {
  const rootMessenger: RootMessenger = new Messenger({
    namespace: MOCK_ANY_NAMESPACE,
  });
  let location = initialLocation;
  const getGeolocation = vi.fn(async (): Promise<string> => location);

  rootMessenger.registerActionHandler(
    'RemoteFeatureFlagController:getState',
    () => REMOTE_FEATURE_FLAG_STATE,
  );
  rootMessenger.registerActionHandler(
    'GeolocationController:getGeolocation',
    getGeolocation,
  );

  const controllerMessenger: PerpsControllerMessenger = new Messenger({
    namespace: 'PerpsController',
    parent: rootMessenger,
  });
  rootMessenger.delegate({
    actions: [
      'RemoteFeatureFlagController:getState',
      'GeolocationController:getGeolocation',
    ],
    events: [
      'RemoteFeatureFlagController:stateChange',
      'GeolocationController:stateChange',
    ],
    messenger: controllerMessenger,
  });

  const controller = new PerpsController({
    messenger: controllerMessenger,
    infrastructure: buildMockInfrastructure(),
    deferEligibilityCheck,
  });

  const publishLocation = (nextLocation: string): void => {
    location = nextLocation;
    rootMessenger.publish(
      'GeolocationController:stateChange',
      { ...getDefaultGeolocationControllerState(), location: nextLocation },
      [],
    );
  };

  return { controller, getGeolocation, publishLocation };
}

const flushPromises = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('PerpsController - geolocation changes', () => {
  it('blocks the user when the location moves into a blocked region', async () => {
    const { controller, publishLocation } = buildController({
      initialLocation: 'FR',
    });
    await flushPromises();

    publishLocation('US-CA');
    await flushPromises();

    expect(controller.state.isEligible).toBe(false);
  });

  it('unblocks the user when the location moves out of a blocked region', async () => {
    const { controller, publishLocation } = buildController({
      initialLocation: 'US-CA',
    });
    await flushPromises();

    publishLocation('FR');
    await flushPromises();

    expect(controller.state.isEligible).toBe(true);
  });

  it('does not re-check eligibility when the location is unchanged', async () => {
    const { getGeolocation, publishLocation } = buildController({
      initialLocation: 'FR',
    });
    publishLocation('FR');
    await flushPromises();
    getGeolocation.mockClear();

    publishLocation('FR');
    await flushPromises();

    expect(getGeolocation).not.toHaveBeenCalled();
  });

  it('does not re-check eligibility while eligibility monitoring is deferred', async () => {
    const { getGeolocation, publishLocation } = buildController({
      initialLocation: 'FR',
      deferEligibilityCheck: true,
    });

    publishLocation('US-CA');
    await flushPromises();

    expect(getGeolocation).not.toHaveBeenCalled();
  });
});
