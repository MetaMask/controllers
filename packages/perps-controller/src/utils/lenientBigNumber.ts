import { BigNumber } from 'bignumber.js';

/**
 * A BigNumber constructor that returns `NaN` for invalid input rather than
 * throwing (bignumber.js v11 throws by default via `STRICT`). Use this where
 * the caller validates the result with `isFinite()` / `isNaN()` and falls back
 * to a default.
 */
export const LenientBigNumber = BigNumber.clone({ STRICT: false });
