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
export declare function createBatchedHandler<Item>(aggregatorFn: (buffer: Item[]) => Item, timeframeMs: number, onFlush: (merged: Item) => void | Promise<void>): (arg: Item) => Promise<void>;
