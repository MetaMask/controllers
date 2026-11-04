import { debounce } from 'lodash-es';
/**
 * Batched handler: buffers arguments, debounces flush, then runs an aggregator
 * on the buffer and invokes onFlush with the result. Used to coalesce rapid
 * updateBalances calls without dropping params.
 *
 * Each call to the returned function returns a Promise that resolves when the
 * flush that includes that call completes, or rejects if onFlush throws, so
 * callers can await or use .catch() for error handling.
 *
 * @param aggregatorFn - Reduces the buffered items into one.
 * @param timeframeMs - Debounce wait before flushing.
 * @param onFlush - Called with the aggregated result when flush runs.
 * @returns Function that accepts an item, schedules a batched flush, and returns a Promise that settles when that batch completes.
 */
export function createBatchedHandler(aggregatorFn, timeframeMs, onFlush) {
    let eventBuffer = [];
    let pendingSettlers = [];
    const flush = async () => {
        if (eventBuffer.length === 0) {
            return;
        }
        const buffer = eventBuffer;
        const settlers = pendingSettlers;
        eventBuffer = [];
        pendingSettlers = [];
        try {
            const merged = aggregatorFn(buffer);
            await onFlush(merged);
            settlers.forEach((settler) => settler.resolve());
        }
        catch (error) {
            settlers.forEach((settler) => settler.reject(error));
        }
    };
    const debouncedFlush = debounce(flush, timeframeMs, {
        leading: false,
        trailing: true,
    });
    const capture = (arg) => {
        return new Promise((resolve, reject) => {
            eventBuffer.push(arg);
            pendingSettlers.push({ resolve, reject });
            // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Rejections are forwarded to capture() callers via pendingSettlers.
            debouncedFlush();
        });
    };
    return capture;
}
