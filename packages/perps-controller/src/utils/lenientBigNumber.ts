import { BigNumber } from 'bignumber.js';

/**
 * A BigNumber constructor that returns `NaN` for invalid input rather than
 * throwing (bignumber.js v10+ throws by default; v11 exposes `STRICT`).
 *
 * This is a compatibility shim: much of this package validates untrusted venue
 * data by constructing a BigNumber and then checking `isFinite()` or comparing
 * the result, which relied on bignumber.js v9 returning `NaN`. Method
 * arguments are also parsed with this constructor's configuration, so a
 * garbage operand yields `false` instead of throwing.
 *
 * TODO: validate venue payloads once at the adapter boundary, then use the
 * default BigNumber constructor for trusted values and drop this shim.
 */
export const LenientBigNumber = BigNumber.clone({ STRICT: false });
