import { assert } from '@metamask/utils';
const TIMEOUT_ERROR = new Error('timeout');
/**
 *
 * @param call - The async function to call.
 * @param timeout - Timeout in milliseconds for each call attempt.
 * @param maxRetries - Maximum number of retries on timeout.
 * @returns The resolved value of the call, or throws the last error if not a timeout or retries exhausted.
 */
// eslint-disable-next-line consistent-return
export async function timeoutWithRetry(call, timeout, maxRetries) {
    assert(maxRetries >= 0, 'maxRetries must be greater than or equal to 0');
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            return (await Promise.race([
                call(),
                new Promise((_resolve, reject) => setTimeout(() => reject(TIMEOUT_ERROR), timeout)),
            ]));
        }
        catch (err) {
            if (err === TIMEOUT_ERROR && attempt < maxRetries) {
                attempt += 1;
                continue;
            }
            throw err;
        }
    }
}
