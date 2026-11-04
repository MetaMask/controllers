/**
 * Remote feature flag key for DeFi Positions Controller V2 (camelCase, as
 * stored by RemoteFeatureFlagController after client-config resolution).
 */
const DEFI_CONTROLLER_V2_FEATURE_FLAG = 'defiControllerV2';
/** Delay between polls while Accounts API reports DeFi indexing in progress. */
const DEFAULT_PROCESSING_POLL_INTERVAL_MS = 5_000;
/**
 * Maximum fetch attempts (including the first) while any account still has
 * `processingDefiPositions: true`. After this, the call resolves without
 * updating state, so prior positions are kept for every selected account.
 */
const DEFAULT_PROCESSING_POLL_MAX_ATTEMPTS = 5;
/**
 * @param config - Optional remote poll overrides.
 * @returns Resolved positive integer max attempts and poll interval ms.
 */
function resolveProcessingPollConfig(config) {
    const maxAttempts = typeof config?.maxAttempts === 'number' &&
        Number.isFinite(config.maxAttempts) &&
        config.maxAttempts > 0
        ? Math.floor(config.maxAttempts)
        : DEFAULT_PROCESSING_POLL_MAX_ATTEMPTS;
    const pollInterval = typeof config?.pollInterval === 'number' &&
        Number.isFinite(config.pollInterval) &&
        config.pollInterval > 0
        ? config.pollInterval
        : DEFAULT_PROCESSING_POLL_INTERVAL_MS;
    return { maxAttempts, pollInterval };
}
/**
 * Narrows a remote feature-flag JSON value to the DeFi V2 poll config fields.
 *
 * @param flag - Raw flag value from RemoteFeatureFlagController state.
 * @returns Poll config fields when present, otherwise `undefined`.
 */
function parseDeFiControllerV2FeatureFlag(flag) {
    if (!flag || typeof flag !== 'object' || Array.isArray(flag)) {
        return undefined;
    }
    const { maxAttempts, pollInterval } = flag;
    return { maxAttempts, pollInterval };
}
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
export function getProcessingPollConfig(messenger) {
    const { remoteFeatureFlags } = messenger.call('RemoteFeatureFlagController:getState');
    return resolveProcessingPollConfig(parseDeFiControllerV2FeatureFlag(remoteFeatureFlags?.[DEFI_CONTROLLER_V2_FEATURE_FLAG]));
}
