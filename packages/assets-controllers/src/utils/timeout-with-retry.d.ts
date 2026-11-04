/**
 *
 * @param call - The async function to call.
 * @param timeout - Timeout in milliseconds for each call attempt.
 * @param maxRetries - Maximum number of retries on timeout.
 * @returns The resolved value of the call, or throws the last error if not a timeout or retries exhausted.
 */
export declare function timeoutWithRetry<T extends () => Promise<unknown>>(call: T, timeout: number, maxRetries: number): Promise<Awaited<ReturnType<T>>>;
