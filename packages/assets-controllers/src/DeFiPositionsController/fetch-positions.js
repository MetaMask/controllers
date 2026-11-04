import { timeoutWithRetry } from '../utils/timeout-with-retry.js';
// TODO: Update with prod API URL when available
export const DEFI_POSITIONS_API_URL = 'https://defiadapters.api.cx.metamask.io';
const EIGHT_SECONDS_IN_MS = 8_000;
const MAX_RETRIES = 1;
/**
 * Builds a function that fetches DeFi positions for a given account address
 *
 * @returns A function that fetches DeFi positions for a given account address
 */
export function buildPositionFetcher() {
    return async (accountAddress) => {
        const defiPositionsResponse = await timeoutWithRetry(() => fetch(`${DEFI_POSITIONS_API_URL}/positions/${accountAddress}`), EIGHT_SECONDS_IN_MS, MAX_RETRIES);
        if (defiPositionsResponse.status !== 200) {
            throw new Error(`Unable to fetch defi positions - HTTP ${defiPositionsResponse.status}`);
        }
        return (await defiPositionsResponse.json()).data;
    };
}
