/**
 * Calculates the total market value and total positions for a given account
 * and returns a breakdown of the market value per protocol.
 *
 * @param accountPositionsPerChain - The account positions per chain.
 * @returns An object containing the total market value, total positions, and a breakdown of the market value per protocol.
 */
export function calculateDeFiPositionMetrics(accountPositionsPerChain) {
    let totalMarketValueUSD = 0;
    let totalPositions = 0;
    const breakdown = [];
    Object.entries(accountPositionsPerChain).forEach(([chainId, chainPositions]) => {
        const chainTotalMarketValueUSD = chainPositions.aggregatedMarketValue;
        totalMarketValueUSD += chainTotalMarketValueUSD;
        Object.entries(chainPositions.protocols).forEach(([protocolId, protocol]) => {
            const protocolTotalMarketValueUSD = protocol.aggregatedMarketValue;
            const protocolCount = Object.values(protocol.positionTypes).reduce((acc, positionType) => acc + (positionType?.positions?.flat().length || 0), 0);
            totalPositions += protocolCount;
            breakdown.push({
                protocolId,
                marketValueUSD: protocolTotalMarketValueUSD,
                chainId: chainId,
                count: protocolCount,
            });
        });
    });
    return {
        category: 'DeFi',
        event: 'DeFi Stats',
        properties: {
            totalMarketValueUSD,
            totalPositions,
            breakdown,
        },
    };
}
