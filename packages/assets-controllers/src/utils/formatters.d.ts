/**
 * Create formatter functions with the given locale.
 *
 * @param options - Configuration options.
 * @param options.locale - Locale string.
 * @returns Object with formatter functions.
 */
export declare function createFormatters({ locale }: {
    locale?: string | undefined;
}): {
    /**
     * Format a number with optional Intl overrides.
     *
     * @param value - Numeric value to format.
     * @param options - Optional Intl.NumberFormat overrides.
     */
    formatNumber: (value: number | bigint | `${number}`, options?: Intl.NumberFormatOptions | undefined) => string;
    /**
     * Format a value as a currency string.
     *
     * @param value - Numeric value to format.
     * @param currency - ISO 4217 currency code (e.g. 'USD').
     * @param options - Optional Intl.NumberFormat overrides.
     */
    formatCurrency: (value: number | bigint | `${number}`, currency: string | undefined, options?: Intl.NumberFormatOptions | undefined) => string;
    /**
     * Compact currency (e.g. $1.2K, $3.4M) with up to two decimal digits.
     *
     * @param value - Numeric value to format.
     * @param currency - ISO 4217 currency code.
     */
    formatCurrencyCompact: (value: number | bigint | `${number}`, currency: string | undefined) => string;
    /**
     * Currency with thresholds for small values.
     *
     * @param value - Numeric value to format.
     * @param currency - ISO 4217 currency code.
     */
    formatCurrencyWithMinThreshold: (value: number | bigint | `${number}`, currency: string | undefined) => string;
    /**
     * Format token price with varying precision based on value.
     *
     * @param value - Numeric value to format.
     * @param currency - ISO 4217 currency code.
     */
    formatCurrencyTokenPrice: (value: number | bigint | `${number}`, currency: string | undefined) => string;
    /**
     * Format a value as a token string with symbol.
     *
     * @param value - Numeric value to format.
     * @param symbol - Token symbol (e.g. 'ETH', 'SepoliaETH').
     * @param options - Optional Intl.NumberFormat overrides.
     */
    formatToken: (value: number | bigint | `${number}`, symbol: string, options?: Intl.NumberFormatOptions | undefined) => string;
    /**
     * Format token quantity with varying precision based on value.
     *
     * @param value - Numeric value to format.
     * @param symbol - Token symbol (e.g. 'ETH', 'SepoliaETH').
     */
    formatTokenQuantity: (value: number | bigint | `${number}`, symbol: string) => string;
};
