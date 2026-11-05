/**
 * Take profit / stop loss calculations shared by the MetaMask clients.
 *
 * RoE (return on equity) is signed: positive at a gain and negative at a loss,
 * for a take profit and a stop loss alike, so a stop loss can sit at a gain
 * and a take profit at a loss.
 *
 * For a long, a take profit sits above the reference price and a stop loss
 * below it; for a short, the other way round.
 */
import { DECIMAL_PRECISION_CONFIG } from '../constants/perpsConfig.js';
import type { OrderDirection } from '../types/index.js';

/**
 * Price context for the TP/SL calculations and checks.
 */
export type TpslCalculationParams = {
  /** Reference price: the current market price, or a pending limit order's price. */
  currentPrice: number;
  /** Position or order side. */
  direction?: OrderDirection;
  /** Position leverage. Defaults to 1. */
  leverage?: number;
  /** Entry price of an existing position. RoE is measured from it when set. */
  entryPrice?: number;
  /** Liquidation price that a stop loss must stay clear of. */
  liquidationPrice?: string;
};

/**
 * Largest stop loss RoE loss, in percent per 1x of leverage: just short of
 * the 100% that would price the stop at zero.
 */
const MAX_STOP_LOSS_ROE_PER_LEVERAGE = 99;

/**
 * Upper bound of a stop loss percentage, whatever the leverage.
 */
const MAX_STOP_LOSS_PERCENTAGE = 999;

/**
 * Parse a price that may carry `$` or `,` formatting.
 *
 * @param price - The price text.
 * @returns The price, or NaN when it is not a number.
 */
function parsePrice(price: string): number {
  return Number.parseFloat(price.replace(/[$,]/gu, ''));
}

/**
 * Whether a trigger on this side gains as the price rises: a long's take
 * profit or a short's stop loss.
 *
 * @param direction - The position side.
 * @param isProfit - True for a take profit, false for a stop loss.
 * @returns True when the trigger sits above the reference price.
 */
function isAboveReference(
  direction: OrderDirection | undefined,
  isProfit: boolean,
): boolean {
  return (direction === 'long') === isProfit;
}

/**
 * Decimal places for a trigger price: more for low-priced assets.
 *
 * @param price - The trigger price.
 * @returns The number of decimal places to keep.
 */
function getTriggerPriceDecimals(price: number): number {
  if (price < 0.01) {
    return 8;
  }
  if (price < 1) {
    return DECIMAL_PRECISION_CONFIG.MaxPriceDecimals;
  }
  if (price < 100) {
    return 4;
  }
  return 2;
}

/**
 * Price that RoE is measured from: the entry price of an existing position,
 * else the current price. An entry price of 0 or NaN counts as none.
 *
 * @param params - Price context.
 * @returns The base price.
 */
function getBasePrice(params: TpslCalculationParams): number {
  const { currentPrice, entryPrice } = params;
  return entryPrice === undefined ||
    entryPrice === 0 ||
    Number.isNaN(entryPrice)
    ? currentPrice
    : entryPrice;
}

/**
 * Signed RoE of a trigger price as a number.
 *
 * @param price - The trigger price; may carry `$` or `,` formatting.
 * @param params - Price context.
 * @returns The RoE in percent, or undefined without a usable price, side or
 * leverage.
 */
function getSignedRoE(
  price: string,
  params: TpslCalculationParams,
): number | undefined {
  const { direction, leverage = 1 } = params;
  const basePrice = getBasePrice(params);
  if (!basePrice || basePrice <= 0 || !price || !direction || !(leverage > 0)) {
    return undefined;
  }
  const triggerPrice = parsePrice(price);
  if (Number.isNaN(triggerPrice) || triggerPrice <= 0) {
    return undefined;
  }
  const roe = ((triggerPrice - basePrice) / basePrice) * leverage * 100;
  return direction === 'long' ? roe : -roe;
}

/**
 * Trigger price for a signed RoE. RoE is measured from the entry price when
 * set, else from the current price; the price moves by RoE / leverage.
 *
 * A stop loss's loss is capped at 99% of the margin per 1x of leverage, so a
 * stop loss at a loss is never priced at or below zero. Any other RoE that
 * moves the price down by 100% or more (a large short gain, or a long take
 * profit at a large loss) gives a price at or below zero, returned as is;
 * `isPositiveTriggerPrice` rejects it.
 *
 * @param roePercentage - Signed RoE in percent (10 for +10%, -5 for -5%).
 * @param isProfit - True for a take profit, false for a stop loss.
 * @param params - Price context.
 * @returns The trigger price as a string, or '' without a usable price, side
 * or leverage.
 * @example calculatePriceForRoE(-10, false, { currentPrice: 2500, direction: 'long', leverage: 2 }) => '2375'
 */
export function calculatePriceForRoE(
  roePercentage: number,
  isProfit: boolean,
  params: TpslCalculationParams,
): string {
  const { direction, leverage = 1 } = params;
  const basePrice = getBasePrice(params);
  if (!basePrice || basePrice <= 0 || !direction || !(leverage > 0)) {
    return '';
  }

  const roe = isProfit
    ? roePercentage
    : Math.max(roePercentage, -leverage * MAX_STOP_LOSS_ROE_PER_LEVERAGE);
  const priceChangeRatio = roe / (leverage * 100);
  const price =
    basePrice *
    (direction === 'long' ? 1 + priceChangeRatio : 1 - priceChangeRatio);

  return Number.parseFloat(
    price.toFixed(getTriggerPriceDecimals(price)),
  ).toString();
}

/**
 * Signed RoE of a trigger price: positive at a gain and negative at a loss,
 * for a take profit or a stop loss alike. Use it for a TP/SL bound to an open
 * position.
 *
 * @param price - The trigger price; may carry `$` or `,` formatting.
 * @param params - Price context.
 * @returns The RoE in percent with two decimals, or '' without a usable price,
 * side or leverage.
 * @example calculateSignedRoEForPrice('2375', { currentPrice: 2500, direction: 'long', leverage: 2 }) => '-10.00'
 */
export function calculateSignedRoEForPrice(
  price: string,
  params: TpslCalculationParams,
): string {
  return getSignedRoE(price, params)?.toFixed(2) ?? '';
}

/**
 * RoE of a trigger price on its own side: a take profit's gain (zero or
 * more) and a stop loss's loss (zero or less). A trigger on the wrong side
 * reads as zero.
 *
 * @param price - The trigger price; may carry `$` or `,` formatting.
 * @param isProfit - True for a take profit, false for a stop loss.
 * @param params - Price context.
 * @returns The RoE in percent with two decimals, or '' without a usable price,
 * side or leverage.
 * @example calculateRoEForPrice('2375', true, { currentPrice: 2500, direction: 'long', leverage: 2 }) => '0.00'
 */
export function calculateRoEForPrice(
  price: string,
  isProfit: boolean,
  params: TpslCalculationParams,
): string {
  const roe = getSignedRoE(price, params);
  if (roe === undefined) {
    return '';
  }
  const isWrongSide = isProfit ? roe < 0 : roe > 0;
  return (isWrongSide ? 0 : roe).toFixed(2);
}

/**
 * Trigger price for a price move from the current price, in the trigger's
 * profitable or losing direction.
 *
 * @param percentage - Price move in percent.
 * @param isProfit - True for a take profit, false for a stop loss.
 * @param params - Price context.
 * @returns The trigger price with two decimals, or '' without a current price.
 */
export function calculatePriceForPercentage(
  percentage: number,
  isProfit: boolean,
  params: TpslCalculationParams,
): string {
  const { currentPrice, direction } = params;
  if (!currentPrice) {
    return '';
  }
  const move = percentage / 100;
  const multiplier = isAboveReference(direction, isProfit)
    ? 1 + move
    : 1 - move;
  return (currentPrice * multiplier).toFixed(2);
}

/**
 * Price move from the current price to a trigger price, negative when the
 * trigger sits on the wrong side for a take profit or stop loss.
 *
 * @param price - The trigger price; may carry `$` or `,` formatting.
 * @param isProfit - True for a take profit, false for a stop loss.
 * @param params - Price context.
 * @returns The move in percent with two decimals, or '' without a usable
 * price.
 */
export function calculatePercentageForPrice(
  price: string,
  isProfit: boolean,
  params: TpslCalculationParams,
): string {
  const { currentPrice, direction } = params;
  if (!currentPrice || !price) {
    return '';
  }
  const triggerPrice = parsePrice(price);
  if (Number.isNaN(triggerPrice)) {
    return '';
  }
  const priceDiff = triggerPrice - currentPrice;
  const percentage = Math.abs((priceDiff / currentPrice) * 100).toFixed(2);
  const isExpectedSide = isAboveReference(direction, isProfit)
    ? priceDiff > 0
    : priceDiff < 0;
  return isExpectedSide ? percentage : `-${percentage}`;
}

/**
 * Largest stop loss percentage for a leverage: 99% per 1x, at most 999%.
 *
 * @param leverage - The position leverage.
 * @returns The maximum stop loss percentage.
 */
export function getMaxStopLossPercentage(leverage: number): number {
  return Math.min(
    leverage * MAX_STOP_LOSS_ROE_PER_LEVERAGE,
    MAX_STOP_LOSS_PERCENTAGE,
  );
}

/**
 * Whether a stop loss percentage is above zero and within the leverage's
 * maximum.
 *
 * @param percentage - The stop loss percentage, as a positive number.
 * @param leverage - The position leverage.
 * @returns True when the percentage is allowed.
 */
export function isValidStopLossPercentage(
  percentage: number,
  leverage: number,
): boolean {
  return percentage > 0 && percentage <= getMaxStopLossPercentage(leverage);
}

/**
 * Whether a trigger price can be sent at all: the venue rejects a trigger at
 * or below zero. Direction checks alone would let a negative price through.
 *
 * @param price - The trigger price; may carry `$` or `,` formatting.
 * @returns False only when the price parses to a number at or below zero.
 */
export function isPositiveTriggerPrice(price?: string): boolean {
  if (!price) {
    return true;
  }
  const triggerPrice = parsePrice(price);
  return Number.isNaN(triggerPrice) || triggerPrice > 0;
}

/**
 * Whether a trigger price is positive and on its side of the reference price.
 *
 * @param price - The trigger price; may carry `$` or `,` formatting.
 * @param params - Price context.
 * @param isProfit - True for a take profit, false for a stop loss.
 * @returns False for a non-positive price or one on the wrong side; true
 * when the price, reference price or side is missing.
 */
function isTriggerPriceOnSide(
  price: string,
  params: TpslCalculationParams,
  isProfit: boolean,
): boolean {
  const { currentPrice, direction } = params;
  if (!isPositiveTriggerPrice(price)) {
    return false;
  }
  if (!currentPrice || !direction || !price) {
    return true;
  }
  const triggerPrice = parsePrice(price);
  if (Number.isNaN(triggerPrice)) {
    return true;
  }
  return isAboveReference(direction, isProfit)
    ? triggerPrice > currentPrice
    : triggerPrice < currentPrice;
}

/**
 * Whether a take profit price is positive and above the reference price for a
 * long, below it for a short.
 *
 * @param price - The take profit price; may carry `$` or `,` formatting.
 * @param params - Price context.
 * @returns False for an invalid price; true when the price, reference price or
 * side is missing.
 */
export function isValidTakeProfitPrice(
  price: string,
  params: TpslCalculationParams,
): boolean {
  return isTriggerPriceOnSide(price, params, true);
}

/**
 * Whether a stop loss price is positive and below the reference price for a
 * long, above it for a short.
 *
 * @param price - The stop loss price; may carry `$` or `,` formatting.
 * @param params - Price context.
 * @returns False for an invalid price; true when the price, reference price or
 * side is missing.
 */
export function isValidStopLossPrice(
  price: string,
  params: TpslCalculationParams,
): boolean {
  return isTriggerPriceOnSide(price, params, false);
}

/**
 * Whether a stop loss triggers before liquidation: above the liquidation price
 * for a long, below it for a short.
 *
 * @param price - The stop loss price; may carry `$` or `,` formatting.
 * @param liquidationPrice - The liquidation price; may carry formatting.
 * @param direction - The position side.
 * @returns False when the stop loss is at or beyond liquidation; true when an
 * input is missing or not a number.
 */
export function isStopLossSafeFromLiquidation(
  price?: string,
  liquidationPrice?: string,
  direction?: OrderDirection,
): boolean {
  if (!liquidationPrice || !direction || !price) {
    return true;
  }
  const stopLossPrice = parsePrice(price);
  const liquidation = parsePrice(liquidationPrice);
  if (Number.isNaN(stopLossPrice) || Number.isNaN(liquidation)) {
    return true;
  }
  return direction === 'long'
    ? stopLossPrice > liquidation
    : stopLossPrice < liquidation;
}

/**
 * Whether a take profit and stop loss pair is valid: both positive, each on
 * its side of the reference price, and the stop loss clear of liquidation.
 *
 * @param takeProfitPrice - The take profit price, if any.
 * @param stopLossPrice - The stop loss price, if any.
 * @param params - Price context, including the liquidation price.
 * @returns True when every set price passes its checks.
 */
export function validateTPSLPrices(
  takeProfitPrice: string | undefined,
  stopLossPrice: string | undefined,
  params: TpslCalculationParams,
): boolean {
  // The positive floor needs no reference price, so it comes before the
  // early return that skips the side checks.
  if (
    !isPositiveTriggerPrice(takeProfitPrice) ||
    !isPositiveTriggerPrice(stopLossPrice)
  ) {
    return false;
  }
  if (!params.currentPrice || !params.direction) {
    return true;
  }
  return (
    (!takeProfitPrice || isValidTakeProfitPrice(takeProfitPrice, params)) &&
    (!stopLossPrice || isValidStopLossPrice(stopLossPrice, params)) &&
    isStopLossSafeFromLiquidation(
      stopLossPrice,
      params.liquidationPrice,
      params.direction,
    )
  );
}

/**
 * Format a RoE percentage for display, without the `%` sign: rounded to two
 * decimals, whole numbers without decimals, `-` for a loss and, when
 * `signed`, `+` for a gain. A value that rounds to zero has no sign.
 *
 * @param value - RoE in percent, as a number or numeric string.
 * @param options - Formatting options.
 * @param options.signed - Prefix a gain with `+`. Defaults to false.
 * @returns The formatted RoE, or '' when the value is not a number.
 * @example formatRoePercent(10) => '10'
 * @example formatRoePercent(-25.5) => '-25.50'
 * @example formatRoePercent(12.5, { signed: true }) => '+12.50'
 */
export function formatRoePercent(
  value: number | string,
  { signed = false }: { signed?: boolean } = {},
): string {
  const roe = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(roe)) {
    return '';
  }
  const rounded = Math.round(Math.abs(roe) * 100) / 100;
  const magnitude = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(2);
  if (rounded === 0) {
    return magnitude;
  }
  if (roe < 0) {
    return `-${magnitude}`;
  }
  return signed ? `+${magnitude}` : magnitude;
}
