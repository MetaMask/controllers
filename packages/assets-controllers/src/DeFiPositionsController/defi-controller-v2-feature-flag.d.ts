import type { RemoteFeatureFlagControllerState } from '@metamask/remote-feature-flag-controller';
/**
 * Resolved positive integer processing-poll limits.
 */
type ResolvedProcessingPollConfig = {
    maxAttempts: number;
    pollInterval: number;
};
/**
 * Messenger surface needed to read the DeFi V2 remote feature flag.
 */
type GetProcessingPollConfigMessenger = {
    call: (actionType: 'RemoteFeatureFlagController:getState') => RemoteFeatureFlagControllerState;
};
/**
 * Reads `defiControllerV2` from RemoteFeatureFlagController and returns
 * resolved processing-poll limits. Missing or invalid flag values fall back to
 * {@link DEFAULT_PROCESSING_POLL_MAX_ATTEMPTS} /
 * {@link DEFAULT_PROCESSING_POLL_INTERVAL_MS}.
 *
 * @param messenger - Messenger that can call
 * `RemoteFeatureFlagController:getState`.
 * @returns Positive integer max attempts and poll interval ms.
 */
export declare function getProcessingPollConfig(messenger: GetProcessingPollConfigMessenger): ResolvedProcessingPollConfig;
export {};
